import { err, ok, type Result } from '../../core/result'
import {
  CHILE_PURCHASE_VAT_RATE,
  DEFAULT_CHANNELS,
  FIRST_REVISION,
  GRAMS_PER_KG,
  PERCENT,
  PROFILE_IDS,
  FIRST_EXTRA_SLOT,
} from './constants'
import {
  ChannelSchema,
  MaterialSchema,
  PrinterSchema,
  ShopSettingsSchema,
  type Channel,
  type ShopData,
} from './shop-data'

/** Referencia versionada a un perfil: lo que queda en el snapshot para auditar de dónde salió cada valor. */
export interface ProfileRef {
  readonly id: string
  readonly revision: number
}

export interface ProfileIssue {
  readonly path: string
  readonly message: string
}

/**
 * Perfiles tipados del taller (unidades del motor: fracciones, $/h, $/kg). Cada uno con su `ref {id, revision}`.
 * Los montos de compras que digita el operador se interpretan como BRUTOS (D1, provisional): el motor descuenta el
 * IVA recuperable solo si el régimen es afecto.
 */
export interface CostProfile {
  readonly ref: ProfileRef
  readonly laborPerHour: number
  readonly supervisionHoursPerPrintHour: number
  readonly jobSetupMinutes: number
  readonly energyPerKwh: number
  readonly failureRate: number
  readonly packingPerUnit: number
  readonly purchaseAmountsBasis: 'GROSS'
}

export interface PricingProfile {
  readonly ref: ProfileRef
  readonly targetMargin: number
  readonly minMargin: number
  readonly onBelowMin: 'WARN' | 'CAP' | 'BLOCK'
  /** 0 = sin redondeo; si no, paso en CLP hacia arriba sobre el precio que ve el cliente (D3). */
  readonly roundingStep: number
  /** Sin tramos hasta que el taller los configure (D4). */
  readonly discountTiers: readonly []
}

export interface TaxProfile {
  readonly ref: ProfileRef
  readonly regime: 'VAT_REGISTERED' | 'NOT_REGISTERED'
  readonly vatRate: number
  readonly purchaseVatRate: number
  readonly customerPriceMode: 'GROSS'
  /** D2: régimen explícito; `regimeConfirmed` = el propietario lo confirmó en Configuración. */
  readonly regimeConfirmed: boolean
}

export interface MaterialProfile {
  readonly ref: ProfileRef
  readonly name: string
  readonly brand: string
  readonly pricePerKg: number
}

export interface MachineProfile {
  readonly ref: ProfileRef
  readonly name: string
  readonly purchasePrice: number
  readonly residualValue: number
  readonly lifetimeHours: number
  readonly averageWatts: number
  readonly maintenanceReservePerHour: number
}

export interface ChannelProfile {
  readonly ref: ProfileRef
  readonly name: string
  readonly kind: Channel['kind']
  readonly commission: number
  readonly fixedFee: number
}

export interface CommercialDefaults {
  readonly validDays: number
  readonly terms: string
}

export interface ShopProfiles {
  readonly cost: CostProfile
  readonly pricing: PricingProfile
  readonly tax: TaxProfile
  readonly commercial: CommercialDefaults
  readonly materials: Readonly<Record<string, MaterialProfile>>
  readonly machines: Readonly<Record<string, MachineProfile>>
  readonly channels: Readonly<Record<string, ChannelProfile>>
}

function zodIssues(prefix: string, issues: readonly { path: readonly PropertyKey[]; message: string }[]): ProfileIssue[] {
  return issues.map((item) => ({ path: [prefix, ...item.path.map(String)].join('.'), message: item.message }))
}

/** Valida los datos guardados por la Beta y los convierte en perfiles tipados. Nunca inventa valores faltantes. */
export function resolveShopProfiles(data: ShopData): Result<ShopProfiles, readonly ProfileIssue[]> {
  const issues: ProfileIssue[] = []
  const settings = ShopSettingsSchema.safeParse(data.shopSettings)
  if (!settings.success) issues.push(...zodIssues('shopSettings', settings.error.issues))

  const materials: Record<string, MaterialProfile> = {}
  data.materials.forEach((raw, index) => {
    const parsed = MaterialSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push(...zodIssues(`materials[${String(index)}]`, parsed.error.issues))
      return
    }
    const m = parsed.data
    materials[m.id] = { ref: { id: m.id, revision: m.revision }, name: m.name, brand: m.brand, pricePerKg: m.priceKg }
  })

  const machines: Record<string, MachineProfile> = {}
  data.printers.forEach((raw, index) => {
    const parsed = PrinterSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push(...zodIssues(`printers[${String(index)}]`, parsed.error.issues))
      return
    }
    const p = parsed.data
    machines[p.id] = {
      ref: { id: p.id, revision: p.revision },
      name: p.name,
      purchasePrice: p.purchasePrice,
      residualValue: p.residualValue,
      lifetimeHours: p.lifeHours,
      averageWatts: p.averageWatts,
      maintenanceReservePerHour: p.maintenanceBudget / p.maintenanceHours,
    }
  })

  const channels: Record<string, ChannelProfile> = {}
  ;(data.channels ?? DEFAULT_CHANNELS).forEach((raw, index) => {
    const parsed = ChannelSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push(...zodIssues(`channels[${String(index)}]`, parsed.error.issues))
      return
    }
    const c = parsed.data
    channels[c.id] = { ref: { id: c.id, revision: c.revision }, name: c.name, kind: c.kind, commission: c.rate, fixedFee: c.fixed }
  })

  if (!settings.success || issues.length > 0) return err(issues)
  const s = settings.data
  const shopRevision = s.revision
  const registered = s.taxRegime === 'VAT_REGISTERED'
  return ok({
    cost: {
      ref: { id: PROFILE_IDS.cost, revision: shopRevision },
      laborPerHour: s.laborPerHour,
      supervisionHoursPerPrintHour: s.supervisionFactor,
      jobSetupMinutes: s.preparationMinutes,
      energyPerKwh: s.energyPerKwh,
      failureRate: s.failureRate / PERCENT,
      packingPerUnit: s.packingPerUnit,
      purchaseAmountsBasis: 'GROSS',
    },
    pricing: {
      ref: { id: PROFILE_IDS.pricing, revision: shopRevision },
      targetMargin: s.targetMargin / PERCENT,
      minMargin: s.minMargin / PERCENT,
      onBelowMin: s.onBelowMin,
      roundingStep: s.priceRounding,
      discountTiers: [],
    },
    tax: {
      ref: { id: PROFILE_IDS.tax, revision: shopRevision },
      regime: registered ? 'VAT_REGISTERED' : 'NOT_REGISTERED',
      vatRate: registered ? s.taxRate / PERCENT : 0,
      purchaseVatRate: CHILE_PURCHASE_VAT_RATE,
      customerPriceMode: 'GROSS',
      regimeConfirmed: s.taxRegimeConfirmed,
    },
    commercial: { validDays: s.validDays, terms: s.terms },
    materials,
    machines,
    channels,
  })
}

/** Lo que el motor recibe de cada compra digitada por el operador (D1: bruto, IVA recuperable si el régimen lo permite). */
export const purchaseAmount = (amount: number) => ({ amount, basis: 'GROSS', vatRecoverable: true }) as const

/** Servicios del sistema: las tarifas salen del perfil de costos; los minutos, de la cotización. */
export const SYSTEM_SERVICES = {
  [PROFILE_IDS.finishing]: {
    ref: { id: PROFILE_IDS.finishing, revision: FIRST_REVISION },
    name: 'Acabados',
    kind: 'STANDARD',
    behavior: 'PER_UNIT',
    component: 'POSTPROCESS',
    supplyCost: purchaseAmount(0),
    laborMinutes: 0,
    laborKind: 'POSTPROCESS',
    defaultRecovery: { recovery: 'IN_PRICE' },
  },
  [PROFILE_IDS.assembly]: {
    ref: { id: PROFILE_IDS.assembly, revision: FIRST_REVISION },
    name: 'Ensamblaje',
    kind: 'ASSEMBLY',
    behavior: 'PER_EXTRA_PART',
    component: 'ASSEMBLY',
    supplyCost: purchaseAmount(0),
    laborMinutes: 0,
    laborKind: 'ASSEMBLY',
    defaultRecovery: { recovery: 'IN_PRICE' },
  },
} as const

/**
 * `ParameterSnapshot` en JSON plano (valores resueltos + refs con revisión). El motor lo valida con su propio
 * validador antes de calcular. Solo incluye el material y la máquina usados.
 */
export function toParameterSnapshotRaw(
  profiles: ShopProfiles,
  selection: { readonly materialId: string; readonly machineId: string; readonly channelId: string; readonly materialIds?: readonly string[] },
  resolvedAt: string,
): Result<Record<string, unknown>, readonly ProfileIssue[]> {
  const material = profiles.materials[selection.materialId]
  const extraIds = (selection.materialIds ?? []).filter((id) => id !== selection.materialId)
  const extraMaterials = extraIds.map((id) => profiles.materials[id])
  const machine = profiles.machines[selection.machineId]
  const channel = profiles.channels[selection.channelId]
  const issues: ProfileIssue[] = []
  if (material === undefined) issues.push({ path: 'materialId', message: 'El material ya no existe en el catálogo' })
  extraIds.forEach((id, index) => {
    if (extraMaterials[index] === undefined) issues.push({ path: `amsMaterial${String(index + FIRST_EXTRA_SLOT)}`, message: `El material ${id} ya no existe en el catálogo` })
  })
  if (machine === undefined) issues.push({ path: 'machineId', message: 'La impresora ya no existe en el catálogo' })
  if (channel === undefined) issues.push({ path: 'channelId', message: 'El canal de venta no existe' })
  if (material === undefined || machine === undefined || channel === undefined || issues.length > 0) return err(issues)
  const materialEntry = (m: typeof material) => ({
    ref: m.ref,
    name: m.name,
    brand: m.brand.length > 0 ? m.brand : 'Sin marca',
    spool: { price: purchaseAmount(m.pricePerKg), netGrams: GRAMS_PER_KG },
  })
  const { cost, pricing, tax } = profiles
  return ok({
    costProfile: {
      ref: cost.ref,
      labor: { ratePerHour: cost.laborPerHour },
      supervision: { hoursPerPrintHour: cost.supervisionHoursPerPrintHour },
      preparation: { jobSetupMinutes: cost.jobSetupMinutes, plateChangeoverMinutes: 0 },
      energy: { kwhPrice: purchaseAmount(cost.energyPerKwh) },
      materialWaste: { fraction: 0 },
      failure: {
        modelId: 'GEOMETRIC_RETRY',
        rate: cost.failureRate,
        costFraction: 1,
        affectedComponents: ['MATERIAL', 'ELECTRICITY', 'WEAR', 'SUPERVISION'],
      },
      auxiliaryCosts: [],
    },
    pricingProfile: {
      ref: pricing.ref,
      targetMargin: pricing.targetMargin,
      minMargin: pricing.minMargin,
      onBelowMin: pricing.onBelowMin,
      discountTiers: pricing.discountTiers,
      rounding:
        pricing.roundingStep === 0
          ? { mode: 'NONE' }
          : { mode: 'STEP', step: pricing.roundingStep, direction: 'UP', target: 'GROSS' },
    },
    taxProfile: {
      ref: tax.ref,
      regime: tax.regime,
      vatRate: tax.vatRate,
      purchaseVatRate: tax.purchaseVatRate,
      customerPriceMode: tax.customerPriceMode,
    },
    channel: {
      ref: channel.ref,
      name: channel.name,
      kind: channel.kind,
      commission: channel.commission,
      // D6 provisional: cargo fijo y comisión sin IVA (equivalente a la Beta).
      fixedFee: { amount: channel.fixedFee, basis: 'GROSS', vatRecoverable: false },
      commissionBase: 'NET',
      commissionTax: { vatCharged: false, vatRecoverable: false },
    },
    materials: Object.fromEntries([material, ...extraMaterials.filter((m) => m !== undefined)].map((m) => [m.ref.id, materialEntry(m)])),
    machines: {
      [machine.ref.id]: {
        ref: machine.ref,
        name: machine.name,
        avgPowerW: machine.averageWatts,
        purchasePrice: purchaseAmount(machine.purchasePrice),
        residualValue: purchaseAmount(machine.residualValue),
        lifetimeHours: machine.lifetimeHours,
        maintenanceReservePerHour: machine.maintenanceReservePerHour,
      },
    },
    services: SYSTEM_SERVICES,
    resolvedAt,
    currency: 'CLP',
  })
}
