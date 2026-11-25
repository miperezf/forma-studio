import { describe, expect, it } from 'vitest'
import { isIssuable } from '../../contracts/flags'
import { checkCostBreakdownInvariants, checkPricingInvariants } from '../../contracts/invariants'
import { costSpecRaw } from '../../testing/cost-helpers'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { validateCalculationRequest } from '../../contracts/validate'
import { fullOf, override, priceResult, withChannel } from '../../testing/pricing-helpers'

/**
 * Cierre de v1/pricing:
 *  B · margen comercial vs margen real (costos ABSORBED)
 *  C · descuento + amortización NRE coexistiendo (orden: costos/amortización → precio → descuento → CAP → redondeo)
 *  A · factibilidad explícita (INFEASIBLE_MARGIN con razón, NO_FEASIBLE_PRICE) y CAP que no puede proteger el mínimo
 */
const TOL = 1e-12
const P6 = (n: number, raw = validRequestRaw()) => mutated('input.plates[0].partsPerPlate', 6, mutated('input.quantity', n, raw))
const withPolicy = (policy: 'WARN' | 'CAP' | 'BLOCK', raw: Record<string, unknown>) => mutated('params.pricingProfile.onBelowMin', policy, raw)
const DEV = (recoveryConfig: unknown, amount = 40000) => costSpecRaw('dev', amount, 'ONE_OFF', { component: 'DESIGN', recoveryConfig })
const AMORTIZED = { recovery: 'IN_PRICE', amortization: { overUnits: 100 } }
const withDev = (recoveryConfig: unknown, raw: Record<string, unknown>, amount = 40000) =>
  mutated('input.extraCosts', [DEV(recoveryConfig, amount)], raw)

describe('B · margen comercial vs margen real', () => {
  it('sin costos absorbidos: real = comercial', () => {
    const { pricing } = fullOf(validRequestRaw()).output
    expect(pricing.absorbedCost).toBe(0)
    expect(pricing.realUtility).toBe(pricing.commercialUtility)
    expect(pricing.realMargin).toBe(pricing.commercialMargin)
    expect(pricing.realMarkup).toBe(pricing.commercialMarkup)
  })

  it('absorbido $40.000: el precio NO cambia; la utilidad real = 7.544 − 40.000 = −32.456 y se advierte', () => {
    const raw = withDev({ recovery: 'ABSORBED' }, validRequestRaw())
    const { cost, output } = fullOf(raw)
    const base = fullOf(validRequestRaw()).output.pricing
    const { pricing } = output
    expect(pricing.customerUnitPrice).toBe(base.customerUnitPrice) // 25.500: lo absorbido no entra al precio
    expect(pricing.commercialUtility).toBe(7544)
    expect(pricing.absorbedCost).toBe(40000)
    expect(pricing.realUtility).toBe(-32456)
    expect(pricing.realMargin).toBeCloseTo(-32456 / 21429, 9)
    expect(pricing.realMarkup).toBeCloseTo(-32456 / (13885 + 40000), 9)
    expect(cost.breakdown.pricingPool).toBe(13885) // sin doble conteo: ni en el pool ni en las líneas
    expect(pricing.lines.reduce((s, l) => s + l.costBasis, 0)).toBe(13885)
    expect(output.flags.map((f) => f.code)).toEqual(['REAL_MARGIN_BELOW_MIN'])
    expect(isIssuable(output.flags)).toBe(true) // informativo: la política se decide con el margen comercial
  })

  it('absorbido pequeño ($500): real 7.044, margen real 32,87 % ≥ mínimo → sin advertencia', () => {
    const raw = mutated('input.extraCosts', [costSpecRaw('gift', 500, 'ONE_OFF', { recoveryConfig: { recovery: 'ABSORBED' } })], validRequestRaw())
    const { pricing, flags } = fullOf(raw).output
    expect(pricing.realUtility).toBe(7044)
    expect(pricing.realMargin).toBeCloseTo(7044 / 21429, 9)
    expect(flags).toEqual([])
  })

  it('un precio fijo 0 se rechaza en la validación: nunca se calcula un margen sobre neto 0 con costos', () => {
    const raw = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 0 } })], validRequestRaw())
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(false)
  })
})

describe('C · descuento y amortización NRE coexisten (golden)', () => {
  it('solo amortización (N=1, $40.000 sobre 100 u.): pool 13.885 + 400 = 14.285 → $26.200', () => {
    const { cost, output } = fullOf(withDev(AMORTIZED, validRequestRaw()))
    expect(cost.breakdown.pricingPool).toBe(14285)
    expect(cost.breakdown.deferredCost).toBe(39600)
    expect(output.pricing).toMatchObject({ customerUnitPrice: 26200, netTotal: 22017, vatTotal: 4183, grossTotal: 26200, commercialUtility: 7732 })
    expect(output.pricing.discount).toEqual({ applied: 0 })
  })

  it('solo descuento (N=10, placas de 6, tramo 8 %): $4.400 (golden G sin cambios)', () => {
    const { pricing } = fullOf(P6(10)).output
    expect(pricing).toMatchObject({ customerUnitPrice: 4400, netTotal: 36975, grossTotal: 44000, commercialUtility: 10874 })
  })

  it('ambos (N=10): el descuento se aplica al precio que YA incorpora la amortización → $5.100', () => {
    // pool 26.101 + 4.000 = 30.101; 30.101/0,65/10 = 4.630,92 × 0,92 = 4.260,45 neto × 1,19 = 5.069,94 → $5.100
    const { cost, output } = fullOf(withDev(AMORTIZED, P6(10)))
    expect(cost.breakdown.pricingPool).toBe(30101)
    expect(cost.breakdown.deferredCost).toBe(36000)
    expect(output.pricing.discount).toEqual({ applied: 0.08 })
    expect(output.pricing).toMatchObject({ customerUnitPrice: 5100, netTotal: 42857, vatTotal: 8143, grossTotal: 51000, commercialUtility: 12756 })
    expect(output.pricing.commercialMargin).toBeCloseTo(12756 / 42857, 9)
    expect(output.pricing.lines).toHaveLength(1) // amortizado IN_PRICE: va en la línea principal, no en otra
  })

  it('ambos (N=50, tramo 15 %) con WARN: queda bajo el mínimo (23,59 %) y se advierte', () => {
    const { pricing, flags } = fullOf(withDev(AMORTIZED, P6(50))).output
    expect(pricing).toMatchObject({ customerUnitPrice: 4100, netTotal: 172269, grossTotal: 205000, commercialUtility: 40645 })
    expect(flags.map((f) => f.code)).toEqual(['BELOW_TARGET', 'BELOW_MIN'])
  })

  it('ambos (N=50) con CAP: recupera el mínimo tras descuento + redondeo → $4.200 (25,41 %), descuento limitado', () => {
    const { pricing, flags } = fullOf(withPolicy('CAP', withDev(AMORTIZED, P6(50)))).output
    expect(pricing).toMatchObject({ customerUnitPrice: 4200, netTotal: 176471, grossTotal: 210000, commercialUtility: 44847 })
    expect(pricing.commercialMargin ?? -1).toBeGreaterThanOrEqual(0.25)
    expect(pricing.discount.cappedFrom).toBe(0.15)
    expect(pricing.discount.applied).toBeLessThan(0.15)
    expect(flags.map((f) => f.code)).toEqual(['DISCOUNT_CAPPED', 'BELOW_TARGET'])
    expect(isIssuable(flags)).toBe(true)
  })

  it('ambos (N=50) con BLOCK: borrador calculable, emisión bloqueada', () => {
    const { flags } = fullOf(withPolicy('BLOCK', withDev(AMORTIZED, P6(50)))).output
    expect(flags.map((f) => f.code)).toContain('BLOCKED')
    expect(isIssuable(flags)).toBe(false)
  })
})

describe('A · CAP protege el mínimo aun cuando SOLO el redondeo lo rompe', () => {
  // objetivo = mínimo = 25 %, redondeo HACIA ABAJO: 13.885/0,75 × 1,19 = 22.030,9 → $22.000 → 24,89 % < 25 %
  const raw = mutated(
    'params.pricingProfile.rounding',
    { mode: 'STEP', step: 100, direction: 'DOWN', target: 'GROSS' },
    mutated('overrides', [override('TARGET_MARGIN', { value: 0.25 }), override('MIN_MARGIN', { value: 0.25 })], validRequestRaw()),
  )
  it('WARN: $22.000 bajo el mínimo sin ningún descuento', () => {
    const { pricing, flags } = fullOf(raw).output
    expect(pricing.discount).toEqual({ applied: 0 })
    expect(pricing.customerUnitPrice).toBe(22000)
    expect(flags.map((f) => f.code)).toContain('BELOW_MIN')
  })
  it('CAP: sube al menor valor de grilla que cumple → $22.100 (25,23 %)', () => {
    const { pricing, flags } = fullOf(withPolicy('CAP', raw)).output
    expect(pricing.customerUnitPrice).toBe(22100)
    expect(pricing.commercialUtility).toBe(18571 - 13885)
    expect(flags.map((f) => f.code)).not.toContain('BELOW_MIN')
  })
})

describe('A · factibilidad explícita', () => {
  it('c_eff + margen > 1 → INFEASIBLE_MARGIN EXCEEDS_LIMIT', () => {
    const result = priceResult(withChannel(validRequestRaw(), { commission: 0.7 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ code: 'INFEASIBLE_MARGIN', reason: 'EXCEEDS_LIMIT' })
  })
  it('c_eff + margen = 1 (denominador ≈ 0) → INFEASIBLE_MARGIN AT_LIMIT, nunca un precio infinito', () => {
    const result = priceResult(withChannel(validRequestRaw(), { commission: 0.65 }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ code: 'INFEASIBLE_MARGIN', reason: 'AT_LIMIT' })
  })
  it('denominador válido pero precio fuera del rango seguro de CLP → NO_FEASIBLE_PRICE PRICE_OUT_OF_RANGE', () => {
    const raw = withChannel(withDev({ recovery: 'IN_PRICE' }, validRequestRaw(), 900_000_000), { commission: 0.65 - 3e-9 })
    const result = priceResult(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ code: 'NO_FEASIBLE_PRICE', reason: 'PRICE_OUT_OF_RANGE' })
  })
})

describe('propiedades combinatorias (sin fast-check: barrido determinista)', () => {
  const recoveries: [string, unknown][] = [
    ['IN_PRICE', { recovery: 'IN_PRICE' }],
    ['AMORTIZED', AMORTIZED],
    ['SEPARATE_LINE', { recovery: 'SEPARATE_LINE' }],
    ['ABSORBED', { recovery: 'ABSORBED' }],
  ]
  const policies = ['WARN', 'CAP', 'BLOCK'] as const
  const ns = [1, 2, 5, 9, 10, 24, 25, 49, 50, 73, 120]

  it('identidad contable, reconciliación de documento, real = comercial − absorbido, CAP ⇒ mínimo, sin doble conteo', () => {
    let checked = 0
    for (const [name, recovery] of recoveries) {
      for (const policy of policies) {
        for (const n of ns) {
          const raw = withPolicy(policy, withDev(recovery, P6(n)))
          const { cost, output } = fullOf(raw)
          const { breakdown } = cost
          const { pricing, flags } = output
          const ctx = `${name}/${policy}/N=${String(n)}`
          const sumAmount = breakdown.items.reduce((s, i) => s + i.amount, 0)
          expect(sumAmount).toBe(breakdown.pricingPool + breakdown.absorbedCost + breakdown.deferredCost)
          expect(checkCostBreakdownInvariants(breakdown, cost.quantities.units)).toEqual([])
          expect(checkPricingInvariants(pricing, breakdown)).toEqual([])
          expect(pricing.lines.reduce((s, l) => s + l.costBasis, 0)).toBe(breakdown.pricingPool)
          expect(pricing.lines.reduce((s, l) => s + l.netLineTotal, 0)).toBe(pricing.netTotal)
          expect(pricing.lines.reduce((s, l) => s + l.vatLineTotal, 0)).toBe(pricing.vatTotal)
          expect(pricing.lines.reduce((s, l) => s + l.grossLineTotal, 0)).toBe(pricing.grossTotal)
          expect(pricing.realUtility).toBe(pricing.commercialUtility - pricing.absorbedCost)
          if (policy === 'CAP' && (pricing.commercialMargin ?? -1) < 0.25 - TOL) throw new Error(`CAP bajo el mínimo en ${ctx}`)
          if (policy !== 'WARN' && flags.some((f) => f.code === 'BELOW_MIN')) expect(isIssuable(flags)).toBe(false)
          expect(Number.isSafeInteger(pricing.grossTotal) && Number.isSafeInteger(pricing.customerUnitPrice)).toBe(true)
          checked += 1
        }
      }
    }
    expect(checked).toBe(recoveries.length * policies.length * ns.length)
  })

  it('el descuento nunca toca la línea separada: su precio no depende del tramo', () => {
    for (const n of ns) {
      const tier = fullOf(withDev({ recovery: 'SEPARATE_LINE' }, P6(n))).output.pricing
      const none = fullOf(mutated('overrides', [override('DISCOUNT', { value: { mode: 'NONE' } })], withDev({ recovery: 'SEPARATE_LINE' }, P6(n)))).output.pricing
      const sep = (p: typeof tier) => p.lines.find((l) => l.kind === 'SEPARATE_LINE')?.customerUnitPrice
      expect(sep(tier)).toBeDefined()
      // la parte de la línea separada se reparte por costo; el descuento solo se aplica a la principal
      expect(sep(tier)).toBe(sep(none))
    }
  })

  it('amortización: más unidades amortizadas nunca bajan el pool por debajo del costo recurrente', () => {
    for (const n of ns) {
      const plain = fullOf(P6(n)).cost.breakdown.pricingPool
      const amortized = fullOf(withDev(AMORTIZED, P6(n))).cost.breakdown.pricingPool
      expect(amortized - plain).toBe(Math.min(40000, Math.round((40000 * n) / 100)))
    }
  })
})

describe('D13 · override de margen de UNA cotización bajo el mínimo: decide la política', () => {
  // objetivo 20 % (override) con mínimo 25 % del perfil; base 13.885: 13.885/0,80 × 1,19 = 20.654,7 → $20.700
  const raw = mutated('overrides', [override('TARGET_MARGIN', { value: 0.2 })], validRequestRaw())
  it('WARN: precio al objetivo pedido ($20.700, 20,19 %), advierte BELOW_MIN y se puede emitir', () => {
    const { pricing, flags } = fullOf(raw).output
    expect(pricing.customerUnitPrice).toBe(20700)
    expect(pricing.commercialMargin ?? 0).toBeCloseTo((17395 - 13885) / 17395, 9)
    expect(flags.map((f) => f.code)).toEqual(['OVERRIDE_APPLIED', 'BELOW_MIN'])
    expect(isIssuable(flags)).toBe(true)
    expect(pricing.floorNetTotal).toBeGreaterThan(pricing.targetNetTotal)
  })
  it('CAP: sube al menor precio de grilla que cumple el mínimo ($22.100)', () => {
    const { pricing, flags } = fullOf(withPolicy('CAP', raw)).output
    expect(pricing.customerUnitPrice).toBe(22100)
    expect(pricing.commercialMargin ?? 0).toBeGreaterThanOrEqual(0.25)
    expect(flags.map((f) => f.code)).not.toContain('BELOW_MIN')
  })
  it('BLOCK: calcula el borrador con el precio pedido pero no es emitible', () => {
    const { pricing, flags } = fullOf(withPolicy('BLOCK', raw)).output
    expect(pricing.customerUnitPrice).toBe(20700)
    expect(flags.map((f) => f.code)).toContain('BLOCKED')
    expect(isIssuable(flags)).toBe(false)
  })
})
