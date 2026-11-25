import { describe, expect, it } from 'vitest'
import { checkCostBreakdownInvariants, checkPricingInvariants } from '../../contracts/invariants'
import { costSpecRaw, item } from '../../testing/cost-helpers'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { fullOf } from '../../testing/pricing-helpers'

/**
 * Condición 2 — rawAmount / amount / pooledAmount en un ONE_OFF amortizado.
 *   · rawAmount y amount (el costo único) NO dependen de N: no se multiplica por las unidades.
 *   · pooledAmount (lo que entra al precio) SÍ varía con N: round(raw × N / overUnits), con tope en el monto.
 * La placa es una sola para cualquier N (partsPerPlate muy grande): el resto del costo no cambia con N.
 */
const DEV = (recoveryConfig: unknown) => costSpecRaw('dev', 40000, 'ONE_OFF', { component: 'DESIGN', recoveryConfig })
const AMORTIZED = { recovery: 'IN_PRICE', amortization: { overUnits: 100 } }

function scenario(n: number, recoveryConfig: unknown | null) {
  let raw = mutated('input.plates[0].partsPerPlate', 1_000_000, mutated('input.quantity', n, validRequestRaw()))
  if (recoveryConfig !== null) raw = mutated('input.extraCosts', [DEV(recoveryConfig)], raw)
  return fullOf(raw)
}

describe('ONE_OFF amortizado sobre 100 unidades ($40.000)', () => {
  const table: [number, number, number][] = [
    // N, pooledAmount esperado, diferido esperado
    [1, 400, 39600],
    [10, 4000, 36000],
    [20, 8000, 32000],
    [99, 39600, 400],
    [100, 40000, 0],
    [101, 40000, 0], // tope: nunca más que el monto
    [200, 40000, 0],
    [1000, 40000, 0],
  ]

  it.each(table)('N = %s: pooledAmount %s, diferido %s', (n, pooled, deferred) => {
    const { cost } = scenario(n, AMORTIZED)
    const dev = item(cost, 'extra:dev')
    expect(dev.rawAmount).toBe(40000) // el costo único NO se multiplica por N
    expect(dev.amount).toBe(40000)
    expect(dev.basis.multiplier).toBe(1)
    expect(dev.pooledAmount).toBe(pooled) // la contribución amortizada SÍ varía con N
    expect(cost.breakdown.deferredCost).toBe(deferred)
    expect(dev.amount - dev.pooledAmount).toBe(deferred)
  })

  it('rawAmount y amount son idénticos para cualquier N; pooledAmount no', () => {
    const ns = [1, 7, 10, 50, 100, 500]
    const items = ns.map((n) => item(scenario(n, AMORTIZED).cost, 'extra:dev'))
    expect(new Set(items.map((i) => i.rawAmount)).size).toBe(1)
    expect(new Set(items.map((i) => i.amount)).size).toBe(1)
    expect(new Set(items.map((i) => i.pooledAmount)).size).toBeGreaterThan(1)
  })

  it('pooledAmount es no decreciente en N y se detiene en el tope', () => {
    let previous = -1
    for (let n = 1; n <= 150; n += 1) {
      const pooled = item(scenario(n, AMORTIZED).cost, 'extra:dev').pooledAmount
      expect(pooled).toBeGreaterThanOrEqual(previous)
      expect(pooled).toBeLessThanOrEqual(40000)
      previous = pooled
    }
    expect(previous).toBe(40000)
  })
})

describe('contribución al precio: depende de pooledAmount, no del costo completo ni de N × costo', () => {
  /** Neto objetivo con el desarrollo menos el neto objetivo sin él, a igual N: lo que aporta el desarrollo. */
  const contribution = (n: number, recoveryConfig: unknown) =>
    scenario(n, recoveryConfig).output.pricing.targetNetTotal - scenario(n, null).output.pricing.targetNetTotal

  it.each([
    [10, 4000],
    [20, 8000],
    [100, 40000],
    [200, 40000],
  ])('N = %s: el desarrollo aporta pooledAmount / (1 − margen) = %s / 0,65 al neto objetivo', (n, pooled) => {
    expect(Math.abs(contribution(n, AMORTIZED) - pooled / 0.65)).toBeLessThanOrEqual(1)
  })

  it('el aporte por unidad es constante hasta el tope y luego se diluye', () => {
    const perUnit = (n: number) => contribution(n, AMORTIZED) / n
    expect(perUnit(10)).toBeCloseTo(615.38, 0) // 400 / 0,65 por unidad
    expect(perUnit(20)).toBeCloseTo(615.38, 0)
    expect(perUnit(100)).toBeCloseTo(615.38, 0)
    expect(perUnit(200)).toBeCloseTo(307.69, 0) // 40.000 / 200 / 0,65: ya no crece
  })

  it('nunca se cobra el costo único multiplicado por N: el aporte no supera costo / (1 − margen)', () => {
    for (const n of [1, 10, 100, 1000]) {
      expect(contribution(n, AMORTIZED)).toBeLessThanOrEqual(40000 / 0.65 + 1)
    }
  })

  it('sin amortización explícita el ONE_OFF IN_PRICE entra completo con cualquier N (nunca × N)', () => {
    for (const n of [1, 10, 500]) {
      const { cost } = scenario(n, { recovery: 'IN_PRICE' })
      expect(item(cost, 'extra:dev').pooledAmount).toBe(40000)
      expect(Math.abs(contribution(n, { recovery: 'IN_PRICE' }) - 40000 / 0.65)).toBeLessThanOrEqual(1)
    }
  })

  it('lo diferido no entra al precio: precio con N = 10 equivale a un costo de $4.000, no de $40.000', () => {
    const { cost, output } = scenario(10, AMORTIZED)
    expect(cost.breakdown.pricingPool).toBe(13885 + 4000)
    expect(output.pricing.lines[0]?.costBasis).toBe(13885 + 4000)
    expect(output.pricing.absorbedCost).toBe(0)
  })
})

describe('las identidades se cumplen con amortización', () => {
  const sizes: [number][] = [[1], [10], [99], [100], [250]]
  it.each(sizes)('N = %s', (n) => {
    const { cost, output } = scenario(n, AMORTIZED)
    expect(checkCostBreakdownInvariants(cost.breakdown, cost.quantities.units)).toEqual([])
    expect(checkPricingInvariants(output.pricing, cost.breakdown)).toEqual([])
    const total = cost.breakdown.items.reduce((sum, i) => sum + i.amount, 0)
    expect(total).toBe(cost.breakdown.pricingPool + cost.breakdown.absorbedCost + cost.breakdown.deferredCost)
  })
})

describe('un ONE_OFF en línea separada tampoco depende de N', () => {
  it('su línea cuesta lo mismo con cualquier N', () => {
    const separate = { recovery: 'SEPARATE_LINE' }
    const costs = [1, 10, 100, 1000].map((n) => scenario(n, separate).output.pricing.lines.find((l) => l.code === 'extra:dev')?.costBasis)
    expect(new Set(costs)).toEqual(new Set([40000]))
  })
})
