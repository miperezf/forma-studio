import { describe, expect, it } from 'vitest'
import { parseQuantity, roundToClp, type Quantity } from '../../../core/money'
import {
  calculationErrorCategory,
  checkCostBreakdownInvariants,
  checkCostItemInvariants,
  expectedPooledAmount,
  isInternalError,
  type CalculationError,
  type CostBreakdown,
  type RecoveryConfig,
} from './index'
import { breakdownOf, costItem } from '../testing/cost-fixtures'

function qty(n: number): Quantity {
  const parsed = parseQuantity(n, 'q')
  if (!parsed.ok) throw new Error('cantidad inválida en el test')
  return parsed.value
}

const IN_PRICE: RecoveryConfig = { recovery: 'IN_PRICE' }
const SEPARATE: RecoveryConfig = { recovery: 'SEPARATE_LINE' }
const ABSORBED: RecoveryConfig = { recovery: 'ABSORBED' }
const amortized = (overUnits: number): RecoveryConfig => ({
  recovery: 'IN_PRICE',
  amortization: { overUnits: qty(overUnits) },
})

function paths(issues: readonly { path: string; code: string }[]): string[] {
  return issues.map((i) => `${i.path}:${i.code}`).sort()
}

describe('expectedPooledAmount: qué importe entra al precio', () => {
  const pooled = (raw: number, recoveryConfig: RecoveryConfig, n: number): number =>
    expectedPooledAmount({ amount: roundToClp(raw), rawAmount: raw, recoveryConfig }, qty(n))

  it('IN_PRICE sin amortización: entra completo (un ONE_OFF nunca se multiplica por N)', () => {
    expect(pooled(27000, IN_PRICE, 1)).toBe(27000)
    expect(pooled(27000, IN_PRICE, 50)).toBe(27000)
  })

  it('SEPARATE_LINE: entra completo, pero a SU línea', () => {
    expect(pooled(27000, SEPARATE, 10)).toBe(27000)
  })

  it('ABSORBED: no entra al precio', () => {
    expect(pooled(27000, ABSORBED, 10)).toBe(0)
  })

  it('amortización explícita: round(raw × N / overUnits) mientras N < overUnits', () => {
    expect(pooled(40000, amortized(100), 10)).toBe(4000)
    expect(pooled(40000, amortized(100), 1)).toBe(400)
    expect(pooled(40000, amortized(100), 33)).toBe(13200)
    expect(pooled(1000, amortized(3), 1)).toBe(333) // 333,33…
    expect(pooled(1000, amortized(3), 2)).toBe(667) // 666,66…
  })

  it('amortización: con N ≥ overUnits entra el monto completo, nunca más que amount', () => {
    expect(pooled(40000, amortized(100), 100)).toBe(40000)
    expect(pooled(40000, amortized(100), 250)).toBe(40000)
  })

  it('amortiza desde rawAmount, no desde el monto ya redondeado (sin doble redondeo)', () => {
    // raw 1000,4 → amount 1000. Con share 1/3: round(1000,4/3) = 333, no round(1000/3) distinto.
    expect(pooled(1000.4, amortized(3), 1)).toBe(333)
    expect(pooled(1001.4, amortized(3), 1)).toBe(334) // 333,8
  })

  it('es determinista', () => {
    expect(pooled(40000, amortized(7), 3)).toBe(pooled(40000, amortized(7), 3))
  })
})

describe('checkCostItemInvariants', () => {
  const N = qty(10)
  const check = (item: ReturnType<typeof costItem>) => paths(checkCostItemInvariants(item, N, 'items[0]'))

  it('un ítem coherente no tiene problemas, para cada modalidad de recuperación', () => {
    expect(check(costItem({ code: 'a', rawAmount: 1234.5 }, N))).toEqual([])
    expect(check(costItem({ code: 'a', rawAmount: 27000, behavior: 'ONE_OFF', recoveryConfig: SEPARATE }, N))).toEqual([])
    expect(check(costItem({ code: 'a', rawAmount: 500, recoveryConfig: ABSORBED }, N))).toEqual([])
    expect(
      check(costItem({ code: 'a', rawAmount: 40000, behavior: 'ONE_OFF', recoveryConfig: amortized(100) }, N)),
    ).toEqual([])
  })

  it('amount debe ser el redondeo de rawAmount', () => {
    const item = costItem({ code: 'a', rawAmount: 1234.5, force: { amount: roundToClp(1234), pooledAmount: roundToClp(1234) } }, N)
    expect(check(item)).toEqual(['items[0].amount:INCONSISTENT'])
  })

  it('pooledAmount debe corresponder a la recuperación', () => {
    const absorbedButPooled = costItem({ code: 'a', rawAmount: 500, recoveryConfig: ABSORBED, force: { pooledAmount: roundToClp(500) } }, N)
    expect(check(absorbedButPooled)).toEqual(['items[0].pooledAmount:INCONSISTENT'])
    const doubled = costItem({ code: 'a', rawAmount: 500, force: { pooledAmount: roundToClp(1000) } }, N)
    expect(check(doubled)).toEqual(['items[0].pooledAmount:INCONSISTENT', 'items[0].pooledAmount:RANGE'])
  })

  it('un ONE_OFF IN_PRICE sin amortización multiplicado por N se detecta', () => {
    // 27.000 × 10 en vez de 27.000: amount y pooled coherentes entre sí, pero no con rawAmount
    const multiplied = costItem({ code: 'dev', rawAmount: 27000, behavior: 'ONE_OFF', force: { amount: roundToClp(270000), pooledAmount: roundToClp(270000) } }, N)
    expect(check(multiplied)).toEqual(['items[0].amount:INCONSISTENT'])
  })

  it('la amortización exige ONE_OFF e IN_PRICE (relación con behavior)', () => {
    const perUnit = costItem({ code: 'a', rawAmount: 100, behavior: 'PER_UNIT', recoveryConfig: amortized(5) }, N)
    expect(check(perUnit)).toContain('items[0].recoveryConfig.amortization:INCONSISTENT')
    const separate = costItem({ code: 'a', rawAmount: 100, behavior: 'ONE_OFF', recoveryConfig: { recovery: 'SEPARATE_LINE', amortization: { overUnits: qty(5) } } }, N)
    expect(check(separate)).toContain('items[0].recoveryConfig.amortization:INCONSISTENT')
  })

  it('FAILURE exige derivedFrom y solo FAILURE puede tenerlo', () => {
    expect(check(costItem({ code: 'f', rawAmount: 10, component: 'FAILURE' }, N))).toEqual(['items[0].derivedFrom:INCONSISTENT'])
    expect(check(costItem({ code: 'f', rawAmount: 10, component: 'MATERIAL', derivedFrom: 'material' }, N))).toEqual(['items[0].derivedFrom:INCONSISTENT'])
    expect(check(costItem({ code: 'f', rawAmount: 10, component: 'FAILURE', derivedFrom: 'material' }, N))).toEqual([])
  })

  it('rawAmount debe ser finito y no negativo', () => {
    expect(check(costItem({ code: 'a', rawAmount: Number.NaN, force: { amount: roundToClp(0), pooledAmount: roundToClp(0) } }, N))).toEqual(['items[0].rawAmount:RANGE'])
    expect(check(costItem({ code: 'a', rawAmount: -5, force: { amount: roundToClp(-5), pooledAmount: roundToClp(-5) } }, N))).toEqual(['items[0].rawAmount:RANGE'])
  })
})

describe('checkCostBreakdownInvariants: sin dobles contabilizaciones', () => {
  const N = qty(10)
  const items = () => [
    costItem({ code: 'material', rawAmount: 1800, component: 'MATERIAL', behavior: 'PER_PLATE' }, N),
    costItem({ code: 'prep', rawAmount: 1666.67, component: 'SETUP', behavior: 'PER_BATCH' }, N),
    costItem({ code: 'service:modeling', rawAmount: 27000, component: 'DESIGN', behavior: 'ONE_OFF', recoveryConfig: SEPARATE }, N),
    costItem({ code: 'extra:dev', rawAmount: 40000, component: 'DESIGN', behavior: 'ONE_OFF', recoveryConfig: amortized(100) }, N),
    costItem({ code: 'extra:small', rawAmount: 300, component: 'OTHER', behavior: 'PER_UNIT', recoveryConfig: ABSORBED }, N),
  ]

  it('la identidad Σ amount = pool + absorbido + diferido se cumple', () => {
    const breakdown = breakdownOf(items(), N)
    // 1.800 + 1.667 + 27.000 + 40.000 + 300 = 70.767
    // pool = 1.800 + 1.667 + 27.000 + 4.000 = 34.467 ; absorbido = 300 ; diferido = 36.000
    expect(breakdown.pricingPool).toBe(34467)
    expect(breakdown.absorbedCost).toBe(300)
    expect(breakdown.deferredCost).toBe(36000)
    expect(checkCostBreakdownInvariants(breakdown, N)).toEqual([])
  })

  it('un código repetido es doble conteo', () => {
    const repeated = [...items(), costItem({ code: 'material', rawAmount: 50 }, N)]
    expect(paths(checkCostBreakdownInvariants(breakdownOf(repeated, N), N))).toContain('items[5].code:DUPLICATE')
  })

  const tamper = (patch: Partial<CostBreakdown>): CostBreakdown => ({ ...breakdownOf(items(), N), ...patch })

  it('detecta pool, absorbido y diferido que no cuadran', () => {
    expect(paths(checkCostBreakdownInvariants(tamper({ pricingPool: roundToClp(40000) }), N))).toContain('pricingPool:INCONSISTENT')
    expect(paths(checkCostBreakdownInvariants(tamper({ absorbedCost: roundToClp(0) }), N))).toContain('absorbedCost:INCONSISTENT')
    expect(paths(checkCostBreakdownInvariants(tamper({ deferredCost: roundToClp(0) }), N))).toContain('deferredCost:INCONSISTENT')
  })

  it('detecta totales por comportamiento, componente y recuperación que no cuadran', () => {
    const base = breakdownOf(items(), N)
    const badBehavior = tamper({ totals: { ...base.totals, byBehavior: { ...base.totals.byBehavior, PER_UNIT: roundToClp(1) } } })
    expect(paths(checkCostBreakdownInvariants(badBehavior, N))).toContain('totals.byBehavior:INCONSISTENT')
    const badComponent = tamper({ totals: { ...base.totals, byComponent: { ...base.totals.byComponent, MATERIAL: roundToClp(1) } } })
    expect(paths(checkCostBreakdownInvariants(badComponent, N))).toContain('totals.byComponent:INCONSISTENT')
    const badRecovery = tamper({ totals: { ...base.totals, byRecovery: { ...base.totals.byRecovery, ABSORBED: roundToClp(0) } } })
    expect(paths(checkCostBreakdownInvariants(badRecovery, N))).toContain('totals.byRecovery.ABSORBED:INCONSISTENT')
  })

  it('unitCost informativo debe ser pricingPool / N', () => {
    expect(paths(checkCostBreakdownInvariants(tamper({ unitCost: 1 }), N))).toEqual(['unitCost:INCONSISTENT'])
  })

  it('un desglose vacío es coherente', () => {
    expect(checkCostBreakdownInvariants(breakdownOf([], N), N)).toEqual([])
  })

  it('un ONE_OFF SEPARATE_LINE no infla la línea principal: se cuenta una sola vez', () => {
    const only = breakdownOf(
      [costItem({ code: 'service:modeling', rawAmount: 27000, behavior: 'ONE_OFF', recoveryConfig: SEPARATE }, N)],
      N,
    )
    expect(only.pricingPool).toBe(27000)
    expect(only.totals.byRecovery.SEPARATE_LINE).toBe(27000)
    expect(only.totals.byRecovery.IN_PRICE).toBe(0)
    expect(checkCostBreakdownInvariants(only, N)).toEqual([])
  })
})

describe('INTERNAL_INVARIANT separado de los errores de entrada', () => {
  const inputErrors: CalculationError[] = [
    { code: 'INVALID_INPUT', issues: [] },
    { code: 'INFEASIBLE_MARGIN', effectiveCommission: 0.7, margin: 0.4, reason: 'EXCEEDS_LIMIT' },
    { code: 'MISSING_PARAMETER', path: 'params.x' },
    { code: 'INCONSISTENT_SNAPSHOT', detail: 'x' },
    { code: 'UNKNOWN_CALCULATION_VERSION', version: 'v9' },
  ]

  it.each(inputErrors.map((e): [string, CalculationError] => [e.code, e]))('%s es un error de entrada', (_code, error) => {
    expect(calculationErrorCategory(error)).toBe('INPUT')
    expect(isInternalError(error)).toBe(false)
  })

  it('INTERNAL_INVARIANT es el único error interno', () => {
    const error: CalculationError = { code: 'INTERNAL_INVARIANT', invariant: 'tax.split-sum' }
    expect(calculationErrorCategory(error)).toBe('INTERNAL')
    expect(isInternalError(error)).toBe(true)
  })
})

describe('trazabilidad (basis) y crédito fiscal por ítem', () => {
  const N = qty(10)
  const good = () => costItem({ code: 'a', rawAmount: 1234.5, vatRecoverable: roundToClp(234) }, N)
  const check = (item: ReturnType<typeof costItem>) => paths(checkCostItemInvariants(item, N, 'items[0]'))

  it('rawAmount debe ser quantity × unitCost × multiplier', () => {
    expect(check(good())).toEqual([])
    const wrongMultiplier = { ...good(), basis: { ...good().basis, multiplier: 2 } }
    expect(check(wrongMultiplier)).toEqual(['items[0].basis:INCONSISTENT'])
    const wrongUnitCost = { ...good(), basis: { ...good().basis, unitCost: 1 } }
    expect(check(wrongUnitCost)).toEqual(['items[0].basis:INCONSISTENT'])
  })

  it('un multiplicador 0 es válido solo si el monto es 0 (p. ej. ensamblaje sin piezas extra)', () => {
    const zero = costItem({ code: 'a', rawAmount: 0 }, N)
    expect(check({ ...zero, basis: { quantity: 1, unit: 'u', unitCost: 3500, multiplier: 0 } })).toEqual([])
    expect(check({ ...good(), basis: { ...good().basis, multiplier: 0 } })).toEqual(['items[0].basis:INCONSISTENT'])
  })

  it('valores de basis negativos o no finitos se rechazan', () => {
    expect(check({ ...good(), basis: { ...good().basis, multiplier: -1 } })).toContain('items[0].basis:RANGE')
    expect(check({ ...good(), basis: { ...good().basis, quantity: Number.NaN } })).toContain('items[0].basis:RANGE')
  })

  it('vatRecoverable debe ser un entero no negativo', () => {
    expect(check({ ...good(), vatRecoverable: -1 as never })).toContain('items[0].vatRecoverable:RANGE')
    expect(check({ ...good(), vatRecoverable: 1.5 as never })).toContain('items[0].vatRecoverable:RANGE')
  })

  it('recoverableVat del desglose debe sumar el de los ítems', () => {
    const items = [
      costItem({ code: 'a', rawAmount: 1000, vatRecoverable: roundToClp(190) }, N),
      costItem({ code: 'b', rawAmount: 500, vatRecoverable: roundToClp(95) }, N),
    ]
    const breakdown = breakdownOf(items, N)
    expect(breakdown.recoverableVat).toBe(285)
    expect(checkCostBreakdownInvariants(breakdown, N)).toEqual([])
    expect(paths(checkCostBreakdownInvariants({ ...breakdown, recoverableVat: roundToClp(0) }, N))).toEqual(['recoverableVat:INCONSISTENT'])
  })

  it('el crédito fiscal no depende de la recuperación: un ítem ABSORBED conserva su IVA recuperable', () => {
    const absorbed = costItem({ code: 'a', rawAmount: 1000, recoveryConfig: { recovery: 'ABSORBED' }, vatRecoverable: roundToClp(190) }, N)
    expect(absorbed.pooledAmount).toBe(0)
    expect(absorbed.vatRecoverable).toBe(190)
    expect(check(absorbed)).toEqual([])
  })
})

describe('desgaste sin crédito fiscal y tasas de falla resueltas', () => {
  const N = qty(10)

  it('un ítem de desgaste con IVA recuperable es inconsistente (no se reconoce de nuevo por impresión)', () => {
    const wear = costItem({ code: 'wear:p', rawAmount: 2000, component: 'WEAR', vatRecoverable: roundToClp(380) }, N)
    expect(paths(checkCostItemInvariants(wear, N, 'items[0]'))).toEqual(['items[0].vatRecoverable:INCONSISTENT'])
    const fine = costItem({ code: 'wear:p', rawAmount: 2000, component: 'WEAR' }, N)
    expect(checkCostItemInvariants(fine, N, 'items[0]')).toEqual([])
  })

  const entry = (over: Record<string, unknown> = {}) => ({
    scope: 'PLATE' as const,
    plateId: 'p1',
    modelId: 'GEOMETRIC_RETRY' as const,
    rate: 0.08,
    costFraction: 1,
    source: 'PROFILE' as const,
    sourceId: 'cost-default',
    applied: true,
    ...over,
  })
  const withRates = (failureRates: CostBreakdown['failureRates'], items = [costItem({ code: 'a', rawAmount: 100 }, N)]) => ({
    ...breakdownOf(items, N),
    failureRates,
  })

  it('tasas coherentes: una por placa y una global', () => {
    const rates = [entry(), entry({ plateId: 'p2' }), entry({ scope: 'GLOBAL', plateId: undefined })]
    expect(checkCostBreakdownInvariants(withRates(rates as never), N)).toEqual([])
  })

  it('tasa fuera de [0, 1), costFraction fuera de [0, 1], placa repetida o dos globales', () => {
    expect(paths(checkCostBreakdownInvariants(withRates([entry({ rate: 1 })] as never), N))).toEqual(['failureRates[0].rate:RANGE'])
    expect(paths(checkCostBreakdownInvariants(withRates([entry({ costFraction: 2 })] as never), N))).toEqual(['failureRates[0].costFraction:RANGE'])
    expect(paths(checkCostBreakdownInvariants(withRates([entry(), entry()] as never), N))).toEqual(['failureRates[1].plateId:DUPLICATE'])
    const globals = [entry({ scope: 'GLOBAL', plateId: undefined }), entry({ scope: 'GLOBAL', plateId: undefined })]
    expect(paths(checkCostBreakdownInvariants(withRates(globals as never), N))).toEqual(['failureRates:DUPLICATE'])
  })

  it('fallas inactivas no pueden coexistir con ítems FAILURE', () => {
    const failure = costItem({ code: 'failure:a', rawAmount: 8, component: 'FAILURE', derivedFrom: 'a' }, N)
    const breakdown = withRates([entry({ applied: false, inactiveReason: 'TEST_MODE' })] as never, [costItem({ code: 'a', rawAmount: 100 }, N), failure])
    expect(paths(checkCostBreakdownInvariants(breakdown, N))).toEqual(['failureRates[0].applied:INCONSISTENT'])
  })
})
