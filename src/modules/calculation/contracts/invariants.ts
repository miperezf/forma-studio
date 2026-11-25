import { isClp, roundToClp, sumClp, type Clp, type Quantity } from '../../../core/money'
import { issue, type Issue } from '../../../core/validation'
import { FLOAT_TOLERANCE } from './constants'
import { CostBehavior, CostComponent, CustomerPriceMode, LineKind, Recovery } from './enums'
import type { CostBreakdown, CostItem, PricingResult } from './results'

/**
 * Importe de un ítem que entra al pool de precio. ÚNICA definición de la relación entre
 * `amount`, `recoveryConfig`, `behavior` y `pooledAmount` (ver `CostItem`):
 * el motor la usa para calcular y los tests/auditorías para verificar.
 */
export function expectedPooledAmount(
  item: Pick<CostItem, 'amount' | 'rawAmount' | 'recoveryConfig'>,
  quantity: Quantity,
): Clp {
  const { recovery, amortization } = item.recoveryConfig
  if (recovery === Recovery.ABSORBED) return roundToClp(0)
  if (recovery === Recovery.SEPARATE_LINE) return item.amount
  if (amortization === undefined) return item.amount
  const share = quantity / amortization.overUnits
  if (share >= 1) return item.amount
  return roundToClp(item.rawAmount * share)
}

/** Verifica un ítem de forma aislada. Devuelve los problemas con ruta `path`. */
export function checkCostItemInvariants(item: CostItem, quantity: Quantity, path: string): readonly Issue[] {
  const issues: Issue[] = []
  const at = (field: string): string => `${path}.${field}`

  if (!Number.isFinite(item.rawAmount) || item.rawAmount < 0) {
    issues.push(issue(at('rawAmount'), 'RANGE', 'rawAmount debe ser finito y no negativo'))
    return issues
  }
  const { quantity: basisQuantity, unitCost, multiplier } = item.basis
  if (![basisQuantity, unitCost, multiplier].every((v) => Number.isFinite(v) && v >= 0)) {
    issues.push(issue(at('basis'), 'RANGE', 'basis.quantity, unitCost y multiplier deben ser finitos y no negativos'))
  } else if (!closeTo(item.rawAmount, basisQuantity * unitCost * multiplier)) {
    issues.push(issue(at('basis'), 'INCONSISTENT', 'rawAmount debe ser quantity × unitCost × multiplier'))
  }
  if (!isClp(item.vatRecoverable) || item.vatRecoverable < 0) {
    issues.push(issue(at('vatRecoverable'), 'RANGE', 'vatRecoverable debe ser un entero CLP no negativo'))
  }
  if (item.component === CostComponent.WEAR && item.vatRecoverable !== 0) {
    issues.push(
      issue(at('vatRecoverable'), 'INCONSISTENT', 'El desgaste no reconoce crédito fiscal: el IVA de la máquina se recuperó en su compra'),
    )
  }
  if (item.amount !== roundToClp(item.rawAmount)) {
    issues.push(issue(at('amount'), 'INCONSISTENT', 'amount debe ser el redondeo a CLP de rawAmount'))
  }
  if (item.pooledAmount < 0 || item.pooledAmount > item.amount) {
    issues.push(issue(at('pooledAmount'), 'RANGE', 'pooledAmount debe estar entre 0 y amount'))
  }
  if (item.pooledAmount !== expectedPooledAmount(item, quantity)) {
    issues.push(
      issue(at('pooledAmount'), 'INCONSISTENT', 'pooledAmount no corresponde a recoveryConfig, amount y cantidad'),
    )
  }
  const { recovery, amortization } = item.recoveryConfig
  if (amortization !== undefined && (recovery !== Recovery.IN_PRICE || item.behavior !== CostBehavior.ONE_OFF)) {
    issues.push(
      issue(at('recoveryConfig.amortization'), 'INCONSISTENT', 'La amortización solo aplica a ONE_OFF con IN_PRICE'),
    )
  }
  if ((item.component === CostComponent.FAILURE) !== (item.derivedFrom !== undefined)) {
    issues.push(
      issue(at('derivedFrom'), 'INCONSISTENT', 'Los ítems FAILURE deben indicar derivedFrom, y solo ellos'),
    )
  }
  return issues
}

function sumOf(values: Iterable<Clp>): Clp {
  return sumClp([...values])
}

function closeTo(a: number, b: number): boolean {
  return Math.abs(a - b) <= FLOAT_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b))
}

/**
 * Verifica un desglose completo: cada ítem, códigos únicos (sin doble conteo) y las identidades
 * contables entre ítems, pool, absorbido, diferido y totales.
 */
export function checkCostBreakdownInvariants(breakdown: CostBreakdown, quantity: Quantity): readonly Issue[] {
  const issues: Issue[] = []
  const seen = new Set<string>()

  breakdown.items.forEach((item, index) => {
    const path = `items[${String(index)}]`
    if (seen.has(item.code)) {
      issues.push(issue(`${path}.code`, 'DUPLICATE', `Ítem repetido (doble conteo): ${item.code}`))
    }
    seen.add(item.code)
    issues.push(...checkCostItemInvariants(item, quantity, path))
  })

  const items = breakdown.items
  const totalAmount = sumOf(items.map((item) => item.amount))
  const pool = sumOf(items.map((item) => item.pooledAmount))
  const absorbed = sumOf(
    items.filter((item) => item.recoveryConfig.recovery === Recovery.ABSORBED).map((item) => item.amount),
  )
  const deferred = sumOf(
    items
      .filter((item) => item.recoveryConfig.amortization !== undefined)
      .map((item) => roundToClp(item.amount - item.pooledAmount)),
  )

  if (breakdown.pricingPool !== pool) {
    issues.push(issue('pricingPool', 'INCONSISTENT', 'pricingPool debe ser la suma de pooledAmount'))
  }
  if (breakdown.absorbedCost !== absorbed) {
    issues.push(issue('absorbedCost', 'INCONSISTENT', 'absorbedCost debe ser la suma de amount de los ABSORBED'))
  }
  if (breakdown.deferredCost !== deferred) {
    issues.push(issue('deferredCost', 'INCONSISTENT', 'deferredCost debe ser la suma de (amount − pooledAmount) amortizado'))
  }
  if (totalAmount !== sumOf([breakdown.pricingPool, breakdown.absorbedCost, breakdown.deferredCost])) {
    issues.push(
      issue('totals', 'INCONSISTENT', 'Σ amount debe ser pricingPool + absorbedCost + deferredCost'),
    )
  }

  const byBehavior = sumOf(Object.values(breakdown.totals.byBehavior))
  if (byBehavior !== totalAmount) {
    issues.push(issue('totals.byBehavior', 'INCONSISTENT', 'byBehavior debe sumar Σ amount'))
  }
  const byComponent = sumOf(Object.values(breakdown.totals.byComponent).filter((v): v is Clp => v !== undefined))
  if (byComponent !== totalAmount) {
    issues.push(issue('totals.byComponent', 'INCONSISTENT', 'byComponent debe sumar Σ amount'))
  }
  for (const recovery of Object.values(Recovery)) {
    const expected = sumOf(items.filter((item) => item.recoveryConfig.recovery === recovery).map((item) => item.amount))
    if (breakdown.totals.byRecovery[recovery] !== expected) {
      issues.push(issue(`totals.byRecovery.${recovery}`, 'INCONSISTENT', 'No coincide con la suma de ítems de esa recuperación'))
    }
  }

  const recoverable = sumOf(items.map((item) => item.vatRecoverable))
  if (breakdown.recoverableVat !== recoverable) {
    issues.push(issue('recoverableVat', 'INCONSISTENT', 'recoverableVat debe ser la suma de vatRecoverable'))
  }

  const seenPlates = new Set<string>()
  let globalEntries = 0
  breakdown.failureRates.forEach((entry, index) => {
    const path = `failureRates[${String(index)}]`
    if (!(Number.isFinite(entry.rate) && entry.rate >= 0 && entry.rate < 1)) {
      issues.push(issue(`${path}.rate`, 'RANGE', 'La tasa de falla debe estar en [0, 1)'))
    }
    if (!(Number.isFinite(entry.costFraction) && entry.costFraction >= 0 && entry.costFraction <= 1)) {
      issues.push(issue(`${path}.costFraction`, 'RANGE', 'costFraction debe estar en [0, 1]'))
    }
    if (entry.scope === 'GLOBAL') {
      globalEntries += 1
    } else if (entry.plateId === undefined || seenPlates.has(entry.plateId)) {
      issues.push(issue(`${path}.plateId`, 'DUPLICATE', 'Cada placa tiene una única tasa resuelta'))
    } else {
      seenPlates.add(entry.plateId)
    }
    if (!entry.applied && items.some((item) => item.component === CostComponent.FAILURE)) {
      issues.push(issue(`${path}.applied`, 'INCONSISTENT', 'Con las fallas inactivas no puede haber ítems FAILURE'))
    }
  })
  if (globalEntries > 1) {
    issues.push(issue('failureRates', 'DUPLICATE', 'Solo puede haber una tasa GLOBAL'))
  }

  if (!closeTo(breakdown.unitCost, breakdown.pricingPool / quantity)) {
    issues.push(issue('unitCost', 'INCONSISTENT', 'unitCost debe ser pricingPool / cantidad'))
  }
  return issues
}

/**
 * Identidades del resultado de precios frente a su desglose de costos. Verifica, entre otras:
 *  - cada línea: neto + IVA = bruto; total = precio unitario × cantidad; coincide con el modo del cliente;
 *  - las líneas suman los totales del documento, y su costo suma EXACTAMENTE el pool (sin doble conteo:
 *    cada ítem pertenece a una sola línea y las fallas van con su origen);
 *  - utilidad = neto − comisión − pool (el IVA no interviene); margen y markup recomputados;
 *  - piso (margen mínimo) y equilibrio ordenados respecto del objetivo.
 */
export function checkPricingInvariants(pricing: PricingResult, breakdown: CostBreakdown): readonly Issue[] {
  const issues: Issue[] = []
  const add = (path: string, message: string) => issues.push(issue(path, 'INCONSISTENT', message))

  if (pricing.lines[0]?.kind !== LineKind.MAIN || pricing.lines.filter((l) => l.kind === LineKind.MAIN).length !== 1) {
    add('lines', 'Debe haber exactamente una línea MAIN y ser la primera')
  }

  const owner = new Map<string, string>()
  pricing.lines.forEach((line, index) => {
    const path = `lines[${String(index)}]`
    if (line.netLineTotal + line.vatLineTotal !== line.grossLineTotal) add(path, 'neto + IVA debe ser bruto en la línea')
    if (line.customerLineTotal !== line.customerUnitPrice * line.quantity) {
      add(path, 'customerLineTotal debe ser customerUnitPrice × quantity')
    }
    const expectedCustomer = pricing.customerPriceMode === CustomerPriceMode.GROSS ? line.grossLineTotal : line.netLineTotal
    if (line.customerLineTotal !== expectedCustomer) add(path, 'customerLineTotal debe coincidir con el modo de precio del cliente')
    for (const code of line.sourceItemCodes) {
      const previous = owner.get(code)
      if (previous !== undefined) add(path, `El ítem ${code} está en dos líneas (${previous} y ${line.code}): doble conteo`)
      owner.set(code, line.code)
    }
    if (line.kind === LineKind.SEPARATE_LINE) {
      const root = breakdown.items.find((candidate) => candidate.code === line.code)
      if (root === undefined || root.component === CostComponent.FAILURE) {
        add(path, 'Una línea separada debe corresponder a un ítem de costo origen, nunca a una falla')
      }
      for (const code of line.sourceItemCodes) {
        const member = breakdown.items.find((candidate) => candidate.code === code)
        if (member?.derivedFrom !== undefined && !line.sourceItemCodes.includes(member.derivedFrom)) {
          add(path, `La falla ${code} debe agruparse con su origen ${member.derivedFrom}`)
        }
      }
    }
  })

  const sum = (pick: (line: PricingResult['lines'][number]) => number): number =>
    pricing.lines.reduce((total, line) => total + pick(line), 0)
  if (sum((l) => l.netLineTotal) !== pricing.netTotal) add('netTotal', 'Las líneas deben sumar el neto del documento')
  if (sum((l) => l.vatLineTotal) !== pricing.vatTotal) add('vatTotal', 'Las líneas deben sumar el IVA del documento')
  if (sum((l) => l.grossLineTotal) !== pricing.grossTotal) add('grossTotal', 'Las líneas deben sumar el bruto del documento')
  if (pricing.netTotal + pricing.vatTotal !== pricing.grossTotal) add('grossTotal', 'neto + IVA debe ser bruto')
  if (sum((l) => l.costBasis) !== breakdown.pricingPool) add('lines', 'El costo de las líneas debe sumar exactamente el pool de costos')
  if (pricing.absorbedCost !== breakdown.absorbedCost) add('absorbedCost', 'Debe coincidir con el costo absorbido del desglose')

  const pool = breakdown.pricingPool
  if (pricing.commercialUtility !== pricing.netTotal - pricing.commission - pool) {
    add('commercialUtility', 'commercialUtility debe ser netTotal − commission − pricingPool (sin IVA)')
  }
  if (pricing.realUtility !== pricing.commercialUtility - pricing.absorbedCost) {
    add('realUtility', 'realUtility debe ser commercialUtility − absorbedCost')
  }
  const ratioMatches = (actual: number | null, numerator: number, denominator: number): boolean =>
    denominator > 0 ? actual !== null && closeTo(actual, numerator / denominator) : actual === null
  if (!ratioMatches(pricing.commercialMargin, pricing.commercialUtility, pricing.netTotal)) {
    add('commercialMargin', 'commercialMargin debe ser commercialUtility / netTotal (null si netTotal ≤ 0)')
  }
  if (!ratioMatches(pricing.commercialMarkup, pricing.commercialUtility, pool)) {
    add('commercialMarkup', 'commercialMarkup debe ser commercialUtility / pricingPool (null si pool ≤ 0)')
  }
  if (!ratioMatches(pricing.realMargin, pricing.realUtility, pricing.netTotal)) {
    add('realMargin', 'realMargin debe ser realUtility / netTotal (null si netTotal ≤ 0)')
  }
  if (!ratioMatches(pricing.realMarkup, pricing.realUtility, pool + pricing.absorbedCost)) {
    add('realMarkup', 'realMarkup debe ser realUtility / (pricingPool + absorbedCost) (null si es 0)')
  }
  for (const [path, value] of [
    ['netTotal', pricing.netTotal],
    ['grossTotal', pricing.grossTotal],
    ['customerUnitPrice', pricing.customerUnitPrice],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) add(path, 'Todo precio emitido debe ser un entero CLP finito y no negativo')
  }

  if (!(pricing.discount.applied >= 0 && pricing.discount.applied < 1)) {
    issues.push(issue('discount.applied', 'RANGE', 'El descuento aplicado debe estar en [0, 1)'))
  }
  // Con un override de margen bajo el mínimo (D13) el objetivo puede quedar bajo el piso; el equilibrio nunca.
  if (!(pricing.breakEvenNetTotal <= pricing.floorNetTotal && pricing.breakEvenNetTotal <= pricing.targetNetTotal)) {
    add('targetNetTotal', 'El precio de equilibrio debe ser ≤ piso (margen mínimo) y ≤ objetivo')
  }
  return issues
}
