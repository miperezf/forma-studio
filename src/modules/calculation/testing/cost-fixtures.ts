import { roundToClp, type Clp, type Quantity } from '../../../core/money'
import type { RecoveryConfig } from '../contracts/cost-spec'
import type { CostBehavior, CostComponent } from '../contracts/enums'
import { expectedPooledAmount } from '../contracts/invariants'
import type { CostBreakdown, CostItem } from '../contracts/results'

export interface ItemSpec {
  readonly code: string
  readonly rawAmount: number
  readonly behavior?: CostBehavior
  readonly component?: CostComponent
  readonly recoveryConfig?: RecoveryConfig
  readonly derivedFrom?: string
  /** Fuerza valores para fabricar ítems inconsistentes en tests negativos. */
  readonly vatRecoverable?: Clp
  readonly force?: { readonly amount?: Clp; readonly pooledAmount?: Clp }
}

/** Ítem coherente por construcción (salvo `force`). */
export function costItem(spec: ItemSpec, quantity: Quantity): CostItem {
  const amount = spec.force?.amount ?? roundToClp(spec.rawAmount)
  const base = {
    code: spec.code,
    label: spec.code,
    component: spec.component ?? 'OTHER',
    behavior: spec.behavior ?? 'PER_UNIT',
    basis: { quantity: 1, unit: 'u', unitCost: spec.rawAmount, multiplier: 1 },
    rawAmount: spec.rawAmount,
    amount,
    recoveryConfig: spec.recoveryConfig ?? { recovery: 'IN_PRICE' },
  } as const
  const pooledAmount = spec.force?.pooledAmount ?? expectedPooledAmount({ ...base }, quantity)
  return {
    ...base,
    pooledAmount,
    vatRecoverable: spec.vatRecoverable ?? roundToClp(0),
    ...(spec.derivedFrom === undefined ? {} : { derivedFrom: spec.derivedFrom }),
  }
}

const sum = (values: readonly number[]): Clp => roundToClp(values.reduce((a, b) => a + b, 0))

/** Desglose coherente construido a partir de ítems (totales calculados a mano, sin usar el motor). */
export function breakdownOf(items: readonly CostItem[], quantity: Quantity): CostBreakdown {
  const amounts = items.map((i) => i.amount as number)
  const byRecovery = (r: string): Clp =>
    sum(items.filter((i) => i.recoveryConfig.recovery === r).map((i) => i.amount as number))
  const byBehavior = (b: string): Clp => sum(items.filter((i) => i.behavior === b).map((i) => i.amount as number))
  const components = [...new Set(items.map((i) => i.component))]
  const byComponent: Partial<Record<CostComponent, Clp>> = {}
  for (const c of components) byComponent[c] = sum(items.filter((i) => i.component === c).map((i) => i.amount as number))
  const pool = sum(items.map((i) => i.pooledAmount as number))
  const deferred = sum(
    items.filter((i) => i.recoveryConfig.amortization !== undefined).map((i) => (i.amount as number) - (i.pooledAmount as number)),
  )
  void amounts
  return {
    items,
    platesRequired: [],
    totals: {
      byBehavior: {
        PER_UNIT: byBehavior('PER_UNIT'),
        PER_PLATE: byBehavior('PER_PLATE'),
        PER_BATCH: byBehavior('PER_BATCH'),
        ONE_OFF: byBehavior('ONE_OFF'),
        PER_EXTRA_PART: byBehavior('PER_EXTRA_PART'),
      },
      byComponent,
      byRecovery: { IN_PRICE: byRecovery('IN_PRICE'), SEPARATE_LINE: byRecovery('SEPARATE_LINE'), ABSORBED: byRecovery('ABSORBED') },
    },
    pricingPool: pool,
    absorbedCost: byRecovery('ABSORBED'),
    deferredCost: deferred,
    recoverableVat: sum(items.map((i) => i.vatRecoverable as number)),
    failureRates: [],
    unitCost: (pool as number) / quantity,
  }
}
