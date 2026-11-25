import {
  parseClp,
  parseFraction,
  parseGrams,
  parseHours,
  parseMinutes,
  parseMoneyAmount,
  parseQuantity,
  parseRatio,
  parseTaxedAmount,
  parseWatts,
  type Fraction,
  type MoneyAmount,
  type Quantity,
  type TaxedAmount,
} from '../../../../core/money'
import {
  childPath,
  indexPath,
  isRecord,
  issue,
  readArray,
  readBoolean,
  readEnum,
  readRecord,
  readString,
  take,
  takeMany,
  type Issue,
} from '../../../../core/validation'
import { parseEntityRef, parseIsoDateTime, type EntityRef } from '../../../../core/versioning'
import {
  MAX_AUXILIARY_COSTS,
  MAX_CATALOG_ENTRIES,
  MAX_DISCOUNT_TIERS,
  MAX_FAILURE_RATE,
  MAX_LABEL_LENGTH,
  MAX_ROUNDING_STEP,
  SUPPORTED_CURRENCY,
} from '../constants'
import type { CostSpec } from '../cost-spec'
import {
  BelowMinPolicyId,
  ChannelKind,
  CommissionBase,
  CostBehavior,
  CostComponent,
  CustomerPriceMode,
  FailureModelId,
  LaborKind,
  RoundingDirection,
  RoundingMode,
  RoundingTarget,
  ServiceKind,
  TaxRegime,
} from '../enums'
import type {
  ChannelValues,
  CostProfileValues,
  DiscountTier,
  FailureParams,
  MachineValues,
  MaterialValues,
  ParameterSnapshot,
  PricingProfileValues,
  RoundingStrategy,
  ServiceValues,
  TaxProfileValues,
} from '../parameters'
import { checkUniqueCodes, readCostSpec, readRecoveryConfig } from './cost-spec'

const Currency = { CLP: SUPPORTED_CURRENCY } as const

function readRef(issues: Issue[], path: string, value: unknown): EntityRef | undefined {
  return takeMany(issues, parseEntityRef(value, path))
}

function readTaxed(issues: Issue[], path: string, value: unknown): TaxedAmount | undefined {
  return takeMany(issues, parseTaxedAmount(value, path))
}

/** Tasa de falla: [0, 1) y no superior a MAX_FAILURE_RATE. */
export function readFailureRate(issues: Issue[], path: string, value: unknown): Fraction | undefined {
  const rate = take(issues, parseFraction(value, path, 'EXCLUSIVE'))
  if (rate !== undefined && rate > MAX_FAILURE_RATE) {
    issues.push(issue(path, 'RANGE', `La tasa de falla no puede superar ${String(MAX_FAILURE_RATE)}`))
    return undefined
  }
  return rate
}

export function readRoundingStrategy(issues: Issue[], path: string, value: unknown): RoundingStrategy | undefined {
  if (!isRecord(value)) {
    issues.push(issue(path, value === undefined ? 'REQUIRED' : 'TYPE', 'Debe ser un objeto'))
    return undefined
  }
  const mode = readEnum(issues, childPath(path, 'mode'), value.mode, RoundingMode)
  if (mode === undefined) return undefined
  if (mode === RoundingMode.NONE) {
    return readRecord(issues, path, value, ['mode']) === undefined ? undefined : { mode: RoundingMode.NONE }
  }
  const record = readRecord(issues, path, value, ['mode', 'step', 'direction', 'target'])
  if (record === undefined) return undefined
  const step = take(issues, parseClp(record.step, childPath(path, 'step'), 'POSITIVE'))
  if (step !== undefined && step > MAX_ROUNDING_STEP) {
    issues.push(issue(childPath(path, 'step'), 'RANGE', `Máximo ${String(MAX_ROUNDING_STEP)}`))
  }
  const direction = readEnum(issues, childPath(path, 'direction'), record.direction, RoundingDirection)
  const target = readEnum(issues, childPath(path, 'target'), record.target, RoundingTarget)
  if (step === undefined || direction === undefined || target === undefined) return undefined
  return { mode: RoundingMode.STEP, step, direction, target }
}

function readDiscountTiers(issues: Issue[], path: string, value: unknown): readonly DiscountTier[] | undefined {
  const raw = readArray(issues, path, value, { min: 0, max: MAX_DISCOUNT_TIERS })
  if (raw === undefined) return undefined
  const tiers: DiscountTier[] = []
  let complete = true
  raw.forEach((item, index) => {
    const tierPath = indexPath(path, index)
    const record = readRecord(issues, tierPath, item, ['minQty', 'maxQty', 'discount'])
    if (record === undefined) {
      complete = false
      return
    }
    const minQty = take(issues, parseQuantity(record.minQty, childPath(tierPath, 'minQty')))
    const maxQty: Quantity | null | undefined =
      record.maxQty === null ? null : take(issues, parseQuantity(record.maxQty, childPath(tierPath, 'maxQty')))
    const discount = take(issues, parseFraction(record.discount, childPath(tierPath, 'discount'), 'EXCLUSIVE'))
    if (minQty === undefined || maxQty === undefined || discount === undefined) {
      complete = false
      return
    }
    tiers.push({ minQty, maxQty, discount })
  })
  if (!complete) return undefined

  tiers.forEach((tier, index) => {
    const tierPath = indexPath(path, index)
    if (tier.maxQty !== null && tier.maxQty < tier.minQty) {
      issues.push(issue(childPath(tierPath, 'maxQty'), 'RANGE', 'maxQty no puede ser menor que minQty'))
    }
    const previous = tiers[index - 1]
    if (index === 0) {
      if (tier.minQty !== 1) issues.push(issue(childPath(tierPath, 'minQty'), 'INCONSISTENT', 'El primer tramo debe comenzar en 1'))
    } else if (previous !== undefined) {
      if (previous.maxQty === null) {
        issues.push(issue(childPath(tierPath, 'minQty'), 'INCONSISTENT', 'Solo el último tramo puede ser abierto'))
      } else if (tier.minQty !== previous.maxQty + 1) {
        issues.push(issue(childPath(tierPath, 'minQty'), 'INCONSISTENT', 'Los tramos deben ser contiguos, sin huecos ni solapes'))
      }
    }
    if (index === tiers.length - 1 && tier.maxQty !== null) {
      issues.push(issue(childPath(tierPath, 'maxQty'), 'INCONSISTENT', 'El último tramo debe ser abierto (maxQty null)'))
    }
  })
  return tiers
}

function readFailureParams(issues: Issue[], path: string, value: unknown): FailureParams | undefined {
  const record = readRecord(issues, path, value, ['modelId', 'rate', 'costFraction', 'affectedComponents'])
  if (record === undefined) return undefined
  const modelId = readEnum(issues, childPath(path, 'modelId'), record.modelId, FailureModelId)
  const rate = readFailureRate(issues, childPath(path, 'rate'), record.rate)
  const costFraction = take(issues, parseFraction(record.costFraction, childPath(path, 'costFraction')))
  const componentsPath = childPath(path, 'affectedComponents')
  const rawComponents = readArray(issues, componentsPath, record.affectedComponents, {
    min: 0,
    max: Object.keys(CostComponent).length,
  })
  const affectedComponents: CostComponent[] = []
  rawComponents?.forEach((raw, index) => {
    const component = readEnum(issues, indexPath(componentsPath, index), raw, CostComponent)
    if (component === undefined) return
    if (component === CostComponent.FAILURE) {
      issues.push(issue(indexPath(componentsPath, index), 'INCONSISTENT', 'FAILURE no puede estar afectado por fallas'))
    }
    if (affectedComponents.includes(component)) {
      issues.push(issue(indexPath(componentsPath, index), 'DUPLICATE', `Componente repetido: ${component}`))
    }
    affectedComponents.push(component)
  })
  if (
    modelId === undefined ||
    rate === undefined ||
    costFraction === undefined ||
    rawComponents === undefined ||
    affectedComponents.length !== rawComponents.length
  ) {
    return undefined
  }
  return { modelId, rate, costFraction, affectedComponents }
}

export function readCostProfile(issues: Issue[], path: string, value: unknown): CostProfileValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'labor',
    'supervision',
    'preparation',
    'energy',
    'materialWaste',
    'failure',
    'auxiliaryCosts',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)

  const laborPath = childPath(path, 'labor')
  const labor = readRecord(issues, laborPath, record.labor, ['ratePerHour', 'rateByKind'])
  const ratePerHour =
    labor === undefined ? undefined : take(issues, parseMoneyAmount(labor.ratePerHour, childPath(laborPath, 'ratePerHour')))
  let rateByKind: Partial<Record<LaborKind, MoneyAmount>> | undefined
  if (labor !== undefined && labor.rateByKind !== undefined) {
    const kindsPath = childPath(laborPath, 'rateByKind')
    const kinds = readRecord(issues, kindsPath, labor.rateByKind, Object.values(LaborKind))
    if (kinds !== undefined) {
      rateByKind = {}
      for (const kind of Object.values(LaborKind)) {
        if (kinds[kind] === undefined) continue
        const rate = take(issues, parseMoneyAmount(kinds[kind], childPath(kindsPath, kind)))
        if (rate !== undefined) rateByKind[kind] = rate
      }
    }
  }

  const supervisionPath = childPath(path, 'supervision')
  const supervision = readRecord(issues, supervisionPath, record.supervision, ['hoursPerPrintHour'])
  const hoursPerPrintHour =
    supervision === undefined
      ? undefined
      : take(issues, parseRatio(supervision.hoursPerPrintHour, childPath(supervisionPath, 'hoursPerPrintHour')))

  const preparationPath = childPath(path, 'preparation')
  const preparation = readRecord(issues, preparationPath, record.preparation, [
    'jobSetupMinutes',
    'plateChangeoverMinutes',
  ])
  const jobSetupMinutes =
    preparation === undefined
      ? undefined
      : take(issues, parseMinutes(preparation.jobSetupMinutes, childPath(preparationPath, 'jobSetupMinutes')))
  const plateChangeoverMinutes =
    preparation === undefined
      ? undefined
      : take(
          issues,
          parseMinutes(preparation.plateChangeoverMinutes, childPath(preparationPath, 'plateChangeoverMinutes')),
        )

  const energyPath = childPath(path, 'energy')
  const energy = readRecord(issues, energyPath, record.energy, ['kwhPrice'])
  const kwhPrice = energy === undefined ? undefined : readTaxed(issues, childPath(energyPath, 'kwhPrice'), energy.kwhPrice)

  const wastePath = childPath(path, 'materialWaste')
  const waste = readRecord(issues, wastePath, record.materialWaste, ['fraction'])
  const wasteFraction =
    waste === undefined ? undefined : take(issues, parseFraction(waste.fraction, childPath(wastePath, 'fraction'), 'EXCLUSIVE'))

  const failure = readFailureParams(issues, childPath(path, 'failure'), record.failure)

  const auxPath = childPath(path, 'auxiliaryCosts')
  const rawAux = readArray(issues, auxPath, record.auxiliaryCosts, { min: 0, max: MAX_AUXILIARY_COSTS })
  const auxiliaryCosts: CostSpec[] = []
  rawAux?.forEach((raw, index) => {
    const spec = readCostSpec(issues, indexPath(auxPath, index), raw)
    if (spec !== undefined) auxiliaryCosts.push(spec)
  })
  checkUniqueCodes(issues, auxPath, auxiliaryCosts)

  if (
    ref === undefined ||
    ratePerHour === undefined ||
    (labor !== undefined && labor.rateByKind !== undefined && rateByKind === undefined) ||
    hoursPerPrintHour === undefined ||
    jobSetupMinutes === undefined ||
    plateChangeoverMinutes === undefined ||
    kwhPrice === undefined ||
    wasteFraction === undefined ||
    failure === undefined ||
    rawAux === undefined ||
    auxiliaryCosts.length !== rawAux.length
  ) {
    return undefined
  }
  return {
    ref,
    labor: { ratePerHour, ...(rateByKind === undefined ? {} : { rateByKind }) },
    supervision: { hoursPerPrintHour },
    preparation: { jobSetupMinutes, plateChangeoverMinutes },
    energy: { kwhPrice },
    materialWaste: { fraction: wasteFraction },
    failure,
    auxiliaryCosts,
  }
}

export function readPricingProfile(issues: Issue[], path: string, value: unknown): PricingProfileValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'targetMargin',
    'minMargin',
    'onBelowMin',
    'discountTiers',
    'rounding',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)
  const targetMargin = take(issues, parseFraction(record.targetMargin, childPath(path, 'targetMargin'), 'EXCLUSIVE'))
  const minMargin = take(issues, parseFraction(record.minMargin, childPath(path, 'minMargin'), 'EXCLUSIVE'))
  if (targetMargin !== undefined && minMargin !== undefined && minMargin > targetMargin) {
    issues.push(issue(childPath(path, 'minMargin'), 'INCONSISTENT', 'El margen mínimo no puede superar al objetivo'))
  }
  const onBelowMin = readEnum(issues, childPath(path, 'onBelowMin'), record.onBelowMin, BelowMinPolicyId)
  const discountTiers = readDiscountTiers(issues, childPath(path, 'discountTiers'), record.discountTiers)
  const rounding = readRoundingStrategy(issues, childPath(path, 'rounding'), record.rounding)
  if (
    ref === undefined ||
    targetMargin === undefined ||
    minMargin === undefined ||
    onBelowMin === undefined ||
    discountTiers === undefined ||
    rounding === undefined
  ) {
    return undefined
  }
  return { ref, targetMargin, minMargin, onBelowMin, discountTiers, rounding }
}

export function readTaxProfile(issues: Issue[], path: string, value: unknown): TaxProfileValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'regime',
    'vatRate',
    'purchaseVatRate',
    'customerPriceMode',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)
  const regime = readEnum(issues, childPath(path, 'regime'), record.regime, TaxRegime)
  const vatRate = take(issues, parseFraction(record.vatRate, childPath(path, 'vatRate'), 'EXCLUSIVE'))
  const purchaseVatRate = take(
    issues,
    parseFraction(record.purchaseVatRate, childPath(path, 'purchaseVatRate'), 'EXCLUSIVE'),
  )
  if (regime === TaxRegime.NOT_REGISTERED && vatRate !== undefined && vatRate !== 0) {
    issues.push(issue(childPath(path, 'vatRate'), 'INCONSISTENT', 'Con régimen NOT_REGISTERED la tasa de IVA debe ser 0'))
  }
  const customerPriceMode = readEnum(
    issues,
    childPath(path, 'customerPriceMode'),
    record.customerPriceMode,
    CustomerPriceMode,
  )
  if (
    ref === undefined ||
    regime === undefined ||
    vatRate === undefined ||
    purchaseVatRate === undefined ||
    customerPriceMode === undefined
  ) {
    return undefined
  }
  return { ref, regime, vatRate, purchaseVatRate, customerPriceMode }
}

export function readChannel(issues: Issue[], path: string, value: unknown): ChannelValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'name',
    'kind',
    'commission',
    'fixedFee',
    'commissionBase',
    'commissionTax',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)
  const name = readString(issues, childPath(path, 'name'), record.name, MAX_LABEL_LENGTH)
  const kind = readEnum(issues, childPath(path, 'kind'), record.kind, ChannelKind)
  const commission = take(issues, parseFraction(record.commission, childPath(path, 'commission'), 'EXCLUSIVE'))
  const fixedFee = readTaxed(issues, childPath(path, 'fixedFee'), record.fixedFee)
  const commissionBase = readEnum(issues, childPath(path, 'commissionBase'), record.commissionBase, CommissionBase)
  const taxPath = childPath(path, 'commissionTax')
  const tax = readRecord(issues, taxPath, record.commissionTax, ['vatCharged', 'vatRecoverable'])
  const vatCharged = tax === undefined ? undefined : readBoolean(issues, childPath(taxPath, 'vatCharged'), tax.vatCharged)
  const vatRecoverable =
    tax === undefined ? undefined : readBoolean(issues, childPath(taxPath, 'vatRecoverable'), tax.vatRecoverable)
  if (
    ref === undefined ||
    name === undefined ||
    kind === undefined ||
    commission === undefined ||
    fixedFee === undefined ||
    commissionBase === undefined ||
    vatCharged === undefined ||
    vatRecoverable === undefined
  ) {
    return undefined
  }
  return { ref, name, kind, commission, fixedFee, commissionBase, commissionTax: { vatCharged, vatRecoverable } }
}

export function readMaterial(issues: Issue[], path: string, value: unknown): MaterialValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'name',
    'brand',
    'spool',
    'wasteFractionOverride',
    'failureRateOverride',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)
  const name = readString(issues, childPath(path, 'name'), record.name, MAX_LABEL_LENGTH)
  const brand = readString(issues, childPath(path, 'brand'), record.brand, MAX_LABEL_LENGTH, true)
  const spoolPath = childPath(path, 'spool')
  const spool = readRecord(issues, spoolPath, record.spool, ['price', 'netGrams'])
  // El precio puede ser 0 (muestra gratuita, filamento reciclado); los gramos netos sí deben ser > 0.
  const price = spool === undefined ? undefined : readTaxed(issues, childPath(spoolPath, 'price'), spool.price)
  const netGrams =
    spool === undefined ? undefined : take(issues, parseGrams(spool.netGrams, childPath(spoolPath, 'netGrams'), 'POSITIVE'))
  const wasteFractionOverride =
    record.wasteFractionOverride === undefined
      ? undefined
      : take(
          issues,
          parseFraction(record.wasteFractionOverride, childPath(path, 'wasteFractionOverride'), 'EXCLUSIVE'),
        )
  const failureRateOverride =
    record.failureRateOverride === undefined
      ? undefined
      : readFailureRate(issues, childPath(path, 'failureRateOverride'), record.failureRateOverride)
  if (
    ref === undefined ||
    name === undefined ||
    brand === undefined ||
    price === undefined ||
    netGrams === undefined ||
    (record.wasteFractionOverride !== undefined && wasteFractionOverride === undefined) ||
    (record.failureRateOverride !== undefined && failureRateOverride === undefined)
  ) {
    return undefined
  }
  return {
    ref,
    name,
    brand,
    spool: { price, netGrams },
    ...(wasteFractionOverride === undefined ? {} : { wasteFractionOverride }),
    ...(failureRateOverride === undefined ? {} : { failureRateOverride }),
  }
}

export function readMachine(issues: Issue[], path: string, value: unknown): MachineValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'name',
    'avgPowerW',
    'electricityPerHourOverride',
    'purchasePrice',
    'residualValue',
    'lifetimeHours',
    'maintenanceReservePerHour',
    'wearPerHourOverride',
    'supervisionRatioOverride',
    'failureRateOverride',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)
  const name = readString(issues, childPath(path, 'name'), record.name, MAX_LABEL_LENGTH)
  const present = (key: string): boolean => record[key] !== undefined
  // Ausente (undefined) ≠ cero: 0 es un valor explícito y válido (p. ej. energía incluida, equipo ya
  // depreciado). Solo `lifetimeHours` exige > 0 porque es divisor. `null` es TYPE, no "ausente".
  const avgPowerW = present('avgPowerW')
    ? take(issues, parseWatts(record.avgPowerW, childPath(path, 'avgPowerW')))
    : undefined
  const electricityPerHourOverride = present('electricityPerHourOverride')
    ? readTaxed(issues, childPath(path, 'electricityPerHourOverride'), record.electricityPerHourOverride)
    : undefined
  const purchasePrice = present('purchasePrice')
    ? readTaxed(issues, childPath(path, 'purchasePrice'), record.purchasePrice)
    : undefined
  const residualValue = present('residualValue')
    ? readTaxed(issues, childPath(path, 'residualValue'), record.residualValue)
    : undefined
  const lifetimeHours = present('lifetimeHours')
    ? take(issues, parseHours(record.lifetimeHours, childPath(path, 'lifetimeHours'), 'POSITIVE'))
    : undefined
  const maintenanceReservePerHour = present('maintenanceReservePerHour')
    ? take(issues, parseMoneyAmount(record.maintenanceReservePerHour, childPath(path, 'maintenanceReservePerHour')))
    : undefined
  const wearPerHourOverride = present('wearPerHourOverride')
    ? take(issues, parseMoneyAmount(record.wearPerHourOverride, childPath(path, 'wearPerHourOverride')))
    : undefined
  const supervisionRatioOverride = present('supervisionRatioOverride')
    ? take(issues, parseRatio(record.supervisionRatioOverride, childPath(path, 'supervisionRatioOverride')))
    : undefined
  const failureRateOverride = present('failureRateOverride')
    ? readFailureRate(issues, childPath(path, 'failureRateOverride'), record.failureRateOverride)
    : undefined

  if (!present('avgPowerW') && !present('electricityPerHourOverride')) {
    issues.push(issue(childPath(path, 'avgPowerW'), 'REQUIRED', 'Requiere avgPowerW o electricityPerHourOverride'))
  }
  if (!present('wearPerHourOverride') && !(present('purchasePrice') && present('lifetimeHours'))) {
    issues.push(
      issue(childPath(path, 'wearPerHourOverride'), 'REQUIRED', 'Requiere wearPerHourOverride o purchasePrice + lifetimeHours'),
    )
  }

  const optionalFailed =
    (present('avgPowerW') && avgPowerW === undefined) ||
    (present('electricityPerHourOverride') && electricityPerHourOverride === undefined) ||
    (present('purchasePrice') && purchasePrice === undefined) ||
    (present('residualValue') && residualValue === undefined) ||
    (present('lifetimeHours') && lifetimeHours === undefined) ||
    (present('maintenanceReservePerHour') && maintenanceReservePerHour === undefined) ||
    (present('wearPerHourOverride') && wearPerHourOverride === undefined) ||
    (present('supervisionRatioOverride') && supervisionRatioOverride === undefined) ||
    (present('failureRateOverride') && failureRateOverride === undefined)
  if (ref === undefined || name === undefined || optionalFailed) return undefined
  return {
    ref,
    name,
    ...(avgPowerW === undefined ? {} : { avgPowerW }),
    ...(electricityPerHourOverride === undefined ? {} : { electricityPerHourOverride }),
    ...(purchasePrice === undefined ? {} : { purchasePrice }),
    ...(residualValue === undefined ? {} : { residualValue }),
    ...(lifetimeHours === undefined ? {} : { lifetimeHours }),
    ...(maintenanceReservePerHour === undefined ? {} : { maintenanceReservePerHour }),
    ...(wearPerHourOverride === undefined ? {} : { wearPerHourOverride }),
    ...(supervisionRatioOverride === undefined ? {} : { supervisionRatioOverride }),
    ...(failureRateOverride === undefined ? {} : { failureRateOverride }),
  }
}

export function readService(issues: Issue[], path: string, value: unknown): ServiceValues | undefined {
  const record = readRecord(issues, path, value, [
    'ref',
    'name',
    'kind',
    'behavior',
    'component',
    'supplyCost',
    'laborMinutes',
    'laborKind',
    'laborRateOverride',
    'defaultRecovery',
  ])
  if (record === undefined) return undefined
  const ref = readRef(issues, childPath(path, 'ref'), record.ref)
  const name = readString(issues, childPath(path, 'name'), record.name, MAX_LABEL_LENGTH)
  const kind = readEnum(issues, childPath(path, 'kind'), record.kind, ServiceKind)
  const behavior = readEnum(issues, childPath(path, 'behavior'), record.behavior, CostBehavior)
  if (kind === ServiceKind.ASSEMBLY && behavior !== undefined && behavior !== CostBehavior.PER_EXTRA_PART) {
    issues.push(issue(childPath(path, 'behavior'), 'INCONSISTENT', 'El ensamblaje debe ser PER_EXTRA_PART'))
  }
  const component = readEnum(issues, childPath(path, 'component'), record.component, CostComponent)
  if (component === CostComponent.FAILURE) {
    issues.push(issue(childPath(path, 'component'), 'INCONSISTENT', 'FAILURE lo genera el modelo de fallas'))
  }
  const supplyCost = readTaxed(issues, childPath(path, 'supplyCost'), record.supplyCost)
  const laborMinutes = take(issues, parseMinutes(record.laborMinutes, childPath(path, 'laborMinutes')))
  const laborKind = readEnum(issues, childPath(path, 'laborKind'), record.laborKind, LaborKind)
  const laborRateOverride =
    record.laborRateOverride === undefined
      ? undefined
      : take(issues, parseMoneyAmount(record.laborRateOverride, childPath(path, 'laborRateOverride')))
  const defaultRecovery = readRecoveryConfig(issues, childPath(path, 'defaultRecovery'), record.defaultRecovery, behavior)
  if (
    ref === undefined ||
    name === undefined ||
    kind === undefined ||
    behavior === undefined ||
    component === undefined ||
    supplyCost === undefined ||
    laborMinutes === undefined ||
    laborKind === undefined ||
    (record.laborRateOverride !== undefined && laborRateOverride === undefined) ||
    defaultRecovery === undefined
  ) {
    return undefined
  }
  return {
    ref,
    name,
    kind,
    behavior,
    component,
    supplyCost,
    laborMinutes,
    laborKind,
    ...(laborRateOverride === undefined ? {} : { laborRateOverride }),
    defaultRecovery,
  }
}

/** Catálogo indexado por `ref.id`: la clave debe coincidir con el id de la referencia. */
function readCatalog<T extends { readonly ref: EntityRef }>(
  issues: Issue[],
  path: string,
  value: unknown,
  readItem: (issues: Issue[], path: string, value: unknown) => T | undefined,
  minEntries: number,
): Readonly<Record<string, T>> | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  if (!isRecord(value)) {
    issues.push(issue(path, 'TYPE', 'Debe ser un objeto indexado por id'))
    return undefined
  }
  const keys = Object.keys(value)
  if (keys.length < minEntries) {
    issues.push(issue(path, 'EMPTY', `Requiere al menos ${String(minEntries)} elemento(s)`))
    return undefined
  }
  if (keys.length > MAX_CATALOG_ENTRIES) {
    issues.push(issue(path, 'TOO_MANY', `Máximo ${String(MAX_CATALOG_ENTRIES)} elementos`))
    return undefined
  }
  const result: Record<string, T> = {}
  let complete = true
  for (const key of keys) {
    const item = readItem(issues, childPath(path, key), value[key])
    if (item === undefined) {
      complete = false
      continue
    }
    if (item.ref.id !== key) {
      issues.push(issue(childPath(path, key), 'INCONSISTENT', 'La clave no coincide con ref.id'))
      complete = false
      continue
    }
    result[key] = item
  }
  return complete ? result : undefined
}

export function readParameterSnapshot(issues: Issue[], path: string, value: unknown): ParameterSnapshot | undefined {
  const record = readRecord(issues, path, value, [
    'costProfile',
    'pricingProfile',
    'taxProfile',
    'channel',
    'materials',
    'machines',
    'services',
    'resolvedAt',
    'currency',
  ])
  if (record === undefined) return undefined
  const costProfile = readCostProfile(issues, childPath(path, 'costProfile'), record.costProfile)
  const pricingProfile = readPricingProfile(issues, childPath(path, 'pricingProfile'), record.pricingProfile)
  const taxProfile = readTaxProfile(issues, childPath(path, 'taxProfile'), record.taxProfile)
  const channel = readChannel(issues, childPath(path, 'channel'), record.channel)
  const materials = readCatalog(issues, childPath(path, 'materials'), record.materials, readMaterial, 1)
  const machines = readCatalog(issues, childPath(path, 'machines'), record.machines, readMachine, 1)
  const services = readCatalog(issues, childPath(path, 'services'), record.services, readService, 0)
  const resolvedAt = take(issues, parseIsoDateTime(record.resolvedAt, childPath(path, 'resolvedAt')))
  const currency = readEnum(issues, childPath(path, 'currency'), record.currency, Currency)
  if (
    costProfile === undefined ||
    pricingProfile === undefined ||
    taxProfile === undefined ||
    channel === undefined ||
    materials === undefined ||
    machines === undefined ||
    services === undefined ||
    resolvedAt === undefined ||
    currency === undefined
  ) {
    return undefined
  }
  return { costProfile, pricingProfile, taxProfile, channel, materials, machines, services, resolvedAt, currency }
}
