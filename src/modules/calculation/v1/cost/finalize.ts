import { roundToClp, sumClp, type Clp } from '../../../../core/money'
import type { CostBreakdown, CostItem, CostTotals, ResolvedFailureRate } from '../../contracts/results'
import { CostBehavior, Recovery, type CostComponent } from '../../contracts/enums'
import { expectedPooledAmount } from '../../contracts/invariants'
import type { CostDraft, ResolvedQuantities } from './context'

/** Redondea un ítem exacto a CLP y calcula qué parte entra al pool de precio. */
export function finalizeItem(draft: CostDraft, quantities: ResolvedQuantities): CostItem {
  const amount = roundToClp(draft.rawAmount)
  const pooledAmount = expectedPooledAmount(
    { amount, rawAmount: draft.rawAmount, recoveryConfig: draft.recoveryConfig },
    quantities.units,
  )
  return {
    code: draft.code,
    label: draft.label,
    component: draft.component,
    behavior: draft.behavior,
    basis: draft.basis,
    rawAmount: draft.rawAmount,
    amount,
    recoveryConfig: draft.recoveryConfig,
    pooledAmount,
    vatRecoverable: roundToClp(draft.vatRecoverableRaw),
    ...(draft.plateId === undefined ? {} : { plateId: draft.plateId }),
    ...(draft.derivedFrom === undefined ? {} : { derivedFrom: draft.derivedFrom }),
  }
}

function totalsOf(items: readonly CostItem[]): CostTotals {
  const sumWhere = (predicate: (item: CostItem) => boolean): Clp =>
    sumClp(items.filter(predicate).map((item) => item.amount))
  const byComponent: Partial<Record<CostComponent, Clp>> = {}
  for (const item of items) {
    byComponent[item.component] = sumClp([byComponent[item.component] ?? roundToClp(0), item.amount])
  }
  return {
    byBehavior: {
      [CostBehavior.PER_UNIT]: sumWhere((i) => i.behavior === CostBehavior.PER_UNIT),
      [CostBehavior.PER_PLATE]: sumWhere((i) => i.behavior === CostBehavior.PER_PLATE),
      [CostBehavior.PER_BATCH]: sumWhere((i) => i.behavior === CostBehavior.PER_BATCH),
      [CostBehavior.ONE_OFF]: sumWhere((i) => i.behavior === CostBehavior.ONE_OFF),
      [CostBehavior.PER_EXTRA_PART]: sumWhere((i) => i.behavior === CostBehavior.PER_EXTRA_PART),
    },
    byComponent,
    byRecovery: {
      [Recovery.IN_PRICE]: sumWhere((i) => i.recoveryConfig.recovery === Recovery.IN_PRICE),
      [Recovery.SEPARATE_LINE]: sumWhere((i) => i.recoveryConfig.recovery === Recovery.SEPARATE_LINE),
      [Recovery.ABSORBED]: sumWhere((i) => i.recoveryConfig.recovery === Recovery.ABSORBED),
    },
  }
}

/** Ítems finales → desglose con totales, pool, absorbido, diferido y crédito fiscal. */
export function buildBreakdown(
  items: readonly CostItem[],
  quantities: ResolvedQuantities,
  failureRates: readonly ResolvedFailureRate[],
): CostBreakdown {
  const pricingPool = sumClp(items.map((item) => item.pooledAmount))
  const absorbedCost = sumClp(
    items.filter((item) => item.recoveryConfig.recovery === Recovery.ABSORBED).map((item) => item.amount),
  )
  const deferredCost = sumClp(
    items
      .filter((item) => item.recoveryConfig.amortization !== undefined)
      .map((item) => roundToClp(item.amount - item.pooledAmount)),
  )
  return {
    items,
    platesRequired: quantities.plates.map((plate) => ({ plateId: plate.plateId, platesRequired: plate.platesRequired })),
    totals: totalsOf(items),
    pricingPool,
    absorbedCost,
    deferredCost,
    recoverableVat: sumClp(items.map((item) => item.vatRecoverable)),
    failureRates,
    unitCost: pricingPool / quantities.units,
  }
}
