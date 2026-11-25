/**
 * Datos de prueba en JSON plano (lo que llegaría de Firestore o de un formulario).
 * Los valores reproducen el caso de la auditoría (120 g, 8 h, PLA $15.000/kg,
 * electricidad $180/h, desgaste $250/h, valor hora $5.000) solo para pruebas;
 * NO son parámetros de negocio validados.
 */
export type RawRecord = { [key: string]: unknown }

const taxedNet = (amount: number): RawRecord => ({ amount, basis: 'NET', vatRecoverable: true })

export function validRequestRaw(): RawRecord {
  return {
    calculationVersion: 'v1',
    mode: 'QUOTE',
    input: {
      quantity: 1,
      batches: 1,
      plates: [
        {
          id: 'plate-1',
          label: 'Placa principal',
          filaments: [{ materialId: 'pla-basic', grams: 120 }],
          machineId: 'printer-1',
          printHours: 8,
          partsPerPlate: 1,
          partsPerUnit: 1,
          weightIncludesWaste: false,
          source: 'MANUAL',
        },
      ],
      services: [{ serviceId: 'assembly', active: false }],
      extraCosts: [],
      channelId: 'direct',
    },
    params: {
      costProfile: {
        ref: { id: 'cost-default', revision: 1 },
        labor: { ratePerHour: 5000 },
        supervision: { hoursPerPrintHour: 0.15 },
        preparation: { jobSetupMinutes: 20, plateChangeoverMinutes: 0 },
        energy: { kwhPrice: taxedNet(200) },
        materialWaste: { fraction: 0 },
        failure: {
          modelId: 'GEOMETRIC_RETRY',
          rate: 0.08,
          costFraction: 1,
          affectedComponents: ['MATERIAL', 'ELECTRICITY', 'WEAR', 'SUPERVISION'],
        },
        auxiliaryCosts: [],
      },
      pricingProfile: {
        ref: { id: 'pricing-default', revision: 1 },
        targetMargin: 0.35,
        minMargin: 0.25,
        onBelowMin: 'WARN',
        discountTiers: [
          { minQty: 1, maxQty: 4, discount: 0 },
          { minQty: 5, maxQty: 9, discount: 0.05 },
          { minQty: 10, maxQty: 24, discount: 0.08 },
          { minQty: 25, maxQty: 49, discount: 0.12 },
          { minQty: 50, maxQty: null, discount: 0.15 },
        ],
        rounding: { mode: 'STEP', step: 100, direction: 'UP', target: 'GROSS' },
      },
      taxProfile: {
        ref: { id: 'tax-default', revision: 1 },
        regime: 'VAT_REGISTERED',
        vatRate: 0.19,
        purchaseVatRate: 0.19,
        customerPriceMode: 'GROSS',
      },
      channel: {
        ref: { id: 'direct', revision: 1 },
        name: 'Venta directa',
        kind: 'DIRECT',
        commission: 0,
        fixedFee: taxedNet(0),
        commissionBase: 'NET',
        commissionTax: { vatCharged: false, vatRecoverable: false },
      },
      materials: {
        'pla-basic': {
          ref: { id: 'pla-basic', revision: 1 },
          name: 'PLA',
          brand: 'Genérica',
          spool: { price: taxedNet(15000), netGrams: 1000 },
        },
      },
      machines: {
        'printer-1': {
          ref: { id: 'printer-1', revision: 1 },
          name: 'Impresora de referencia',
          electricityPerHourOverride: taxedNet(180),
          wearPerHourOverride: 250,
        },
      },
      services: {
        assembly: {
          ref: { id: 'assembly', revision: 1 },
          name: 'Ensamblaje',
          kind: 'ASSEMBLY',
          behavior: 'PER_EXTRA_PART',
          component: 'ASSEMBLY',
          supplyCost: taxedNet(2000),
          laborMinutes: 18,
          laborKind: 'ASSEMBLY',
          defaultRecovery: { recovery: 'IN_PRICE' },
        },
        'modeling-3d': {
          ref: { id: 'modeling-3d', revision: 1 },
          name: 'Modelado 3D personalizado',
          kind: 'STANDARD',
          behavior: 'ONE_OFF',
          component: 'DESIGN',
          supplyCost: taxedNet(27000),
          laborMinutes: 0,
          laborKind: 'POSTPROCESS',
          defaultRecovery: { recovery: 'SEPARATE_LINE' },
        },
      },
      resolvedAt: '2026-10-08T12:00:00Z',
      currency: 'CLP',
    },
    overrides: [],
  }
}

type PathToken = string | number

function tokenize(path: string): PathToken[] {
  const tokens: PathToken[] = []
  for (const match of path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    if (match[2] !== undefined) tokens.push(Number(match[2]))
    else if (match[1] !== undefined) tokens.push(match[1])
  }
  return tokens
}

function walk(root: unknown, tokens: readonly PathToken[]): { parent: Record<PathToken, unknown>; key: PathToken } {
  let current = root as Record<PathToken, unknown>
  for (const token of tokens.slice(0, -1)) current = current[token] as Record<PathToken, unknown>
  const key = tokens[tokens.length - 1]
  if (key === undefined) throw new Error('ruta vacía')
  return { parent: current, key }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Copia profunda de la solicitud válida con `path` reemplazado por `value`. */
export function mutated(path: string, value: unknown, base: RawRecord = validRequestRaw()): RawRecord {
  const copy = clone(base)
  const { parent, key } = walk(copy, tokenize(path))
  parent[key] = value
  return copy
}

/** Copia profunda sin la propiedad `path`. */
export function without(path: string, base: RawRecord = validRequestRaw()): RawRecord {
  const copy = clone(base)
  const { parent, key } = walk(copy, tokenize(path))
  Reflect.deleteProperty(parent, key)
  return copy
}

/** Lee el valor en `path` de la solicitud válida (para construir variantes). */
export function valueAt(path: string, base: RawRecord = validRequestRaw()): unknown {
  const { parent, key } = walk(base, tokenize(path))
  return parent[key]
}
