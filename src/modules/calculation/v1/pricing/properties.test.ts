import { describe, expect, it } from 'vitest'
import { checkCostBreakdownInvariants, checkPricingInvariants, isIssuable } from '../../contracts'
import { costSpecRaw } from '../../testing/cost-helpers'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { fullOf, override, priceResult } from '../../testing/pricing-helpers'
import { pick, seededRandom } from '../../testing/random'

/**
 * Barrido con semilla fija: 600 cotizaciones aleatorias (cantidades, geometría, servicios, canal, IVA, régimen,
 * redondeo, márgenes, política) y propiedades que deben cumplirse SIEMPRE. Ningún caso se escribe a mano.
 */
type Raw = Record<string, unknown>
interface Case {
  raw: Raw
  n: number
  policy: 'WARN' | 'CAP' | 'BLOCK'
  minMargin: number
  targetMargin: number
  rounding: { mode: 'NONE' } | { mode: 'STEP'; step: number; direction: 'UP' | 'DOWN' | 'NEAREST'; target: 'NET' | 'GROSS' }
  fixedPrice: boolean
  discountOff: boolean
}

function randomCase(random: () => number, over: { fixedPrice?: boolean; policy?: 'WARN' | 'CAP' | 'BLOCK' } = {}): Case {
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const n = between(1, 300)
  const perUnit = between(1, 4)
  let raw: Raw = mutated('input.quantity', n, validRequestRaw())
  raw = mutated('input.batches', between(1, 6), raw)
  raw = mutated('input.plates[0].partsPerPlate', between(1, 30), raw)
  raw = mutated('input.plates[0].partsPerUnit', perUnit, raw)
  const services: { serviceId: string; active: boolean }[] = []
  if (random() < 0.5) services.push({ serviceId: 'modeling-3d', active: true })
  if (perUnit > 1 && random() < 0.5) services.push({ serviceId: 'assembly', active: true })
  raw = mutated('input.services', services, raw)
  const extras: unknown[] = []
  if (random() < 0.4) {
    extras.push(costSpecRaw('dev', between(5000, 60000), 'ONE_OFF', { component: 'DESIGN', recoveryConfig: { recovery: 'IN_PRICE', amortization: { overUnits: between(5, 400) } } }))
  }
  if (random() < 0.3) extras.push(costSpecRaw('pack', between(100, 900), 'PER_UNIT'))
  raw = mutated('input.extraCosts', extras, raw)
  raw = mutated('params.costProfile.failure.rate', pick([0, 0.03, 0.08, 0.2], random), raw)

  raw = mutated('params.channel.commission', pick([0, 0.05, 0.13, 0.25], random), raw)
  raw = mutated('params.channel.commissionBase', pick(['NET', 'GROSS'] as const, random), raw)
  raw = mutated('params.channel.commissionTax', { vatCharged: random() < 0.5, vatRecoverable: random() < 0.5 }, raw)
  raw = mutated('params.channel.fixedFee', { amount: pick([0, 50, 150], random), basis: pick(['NET', 'GROSS'] as const, random), vatRecoverable: random() < 0.5 }, raw)

  const notRegistered = random() < 0.2
  raw = mutated('params.taxProfile.regime', notRegistered ? 'NOT_REGISTERED' : 'VAT_REGISTERED', raw)
  raw = mutated('params.taxProfile.vatRate', notRegistered ? 0 : pick([0, 0.19, 0.21], random), raw)
  raw = mutated('params.taxProfile.customerPriceMode', pick(['NET', 'GROSS'] as const, random), raw)

  const rounding: Case['rounding'] =
    random() < 0.25
      ? { mode: 'NONE' }
      : { mode: 'STEP', step: pick([10, 100, 500, 1000], random), direction: pick(['UP', 'DOWN', 'NEAREST'] as const, random), target: pick(['NET', 'GROSS'] as const, random) }
  raw = mutated('params.pricingProfile.rounding', rounding, raw)
  const targetMargin = pick([0.15, 0.25, 0.35, 0.5], random)
  const minMargin = Math.min(targetMargin, pick([0.1, 0.2, 0.25, 0.35], random))
  raw = mutated('params.pricingProfile.targetMargin', targetMargin, raw)
  raw = mutated('params.pricingProfile.minMargin', minMargin, raw)
  const policy = over.policy ?? pick(['WARN', 'CAP', 'BLOCK'] as const, random)
  raw = mutated('params.pricingProfile.onBelowMin', policy, raw)

  const fixedPrice = over.fixedPrice ?? random() < 0.1
  const overrides: unknown[] = []
  if (fixedPrice) overrides.push(override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: between(500, 90000) } }))
  const discountOff = !fixedPrice && random() < 0.3
  if (discountOff) overrides.push(override('DISCOUNT', { value: { mode: 'NONE' } }))
  raw = mutated('overrides', overrides, raw)
  return { raw, n, policy, minMargin, targetMargin, rounding, fixedPrice, discountOff }
}

const TOLERANCE = 1e-9
const CASES = 600

describe('propiedades de pricing (600 casos con semilla fija)', () => {
  const random = seededRandom(20261011)
  const cases = Array.from({ length: CASES }, () => randomCase(random))

  it('todo caso factible se calcula y cumple las identidades de costo y de precio', () => {
    for (const c of cases) {
      const { cost, output } = fullOf(c.raw)
      expect(checkCostBreakdownInvariants(cost.breakdown, cost.quantities.units)).toEqual([])
      expect(checkPricingInvariants(output.pricing, cost.breakdown)).toEqual([])
      const p = output.pricing
      expect(p.netTotal + p.vatTotal).toBe(p.grossTotal)
      expect(p.lines.reduce((s, l) => s + l.costBasis, 0)).toBe(cost.breakdown.pricingPool)
    }
  })

  it('la utilidad y el margen salen del neto y se recomputan sobre el precio efectivo (el IVA no interviene)', () => {
    for (const c of cases) {
      const { cost, output } = fullOf(c.raw)
      const p = output.pricing
      expect(p.commercialUtility).toBe(p.netTotal - p.commission - cost.breakdown.pricingPool)
      expect(p.commercialMargin).toBeCloseTo(p.netTotal > 0 ? p.commercialUtility / p.netTotal : 0, 9)
      expect(p.commercialMarkup).toBeCloseTo(cost.breakdown.pricingPool > 0 ? p.commercialUtility / cost.breakdown.pricingPool : 0, 9)
    }
  })

  it('CAP (sin precio fijo) garantiza margen efectivo ≥ mínimo, DESPUÉS de descuento, IVA y redondeo', () => {
    const capCases = Array.from({ length: 300 }, () => randomCase(seededRandom(Math.floor(random() * 1e9)), { policy: 'CAP', fixedPrice: false }))
    for (const c of capCases) {
      const { output } = fullOf(c.raw)
      expect(output.pricing.commercialMargin).toBeGreaterThanOrEqual(c.minMargin - TOLERANCE)
      expect(output.flags.map((f) => f.code)).not.toContain('BELOW_MIN')
      expect(output.pricing.discount.applied).toBeLessThan(1)
    }
  })

  it('BELOW_MIN ⇔ margen efectivo < mínimo; BLOCKED solo con política distinta de WARN y entonces no es emitible', () => {
    for (const c of cases) {
      const { output } = fullOf(c.raw)
      const margin = output.pricing.commercialMargin ?? Number.NEGATIVE_INFINITY
      const below = margin < c.minMargin - TOLERANCE
      const flags = output.flags.map((f) => f.code)
      expect(flags.includes('BELOW_MIN')).toBe(below)
      expect(flags.includes('BLOCKED')).toBe(below && c.policy !== 'WARN')
      expect(isIssuable(output.flags)).toBe(!(below && c.policy !== 'WARN'))
      expect(flags.includes('BELOW_TARGET')).toBe(margin < c.targetMargin - TOLERANCE)
    }
  })

  it('BLOCK nunca impide el cálculo: el resultado es el mismo que con WARN', () => {
    for (const c of cases.slice(0, 150)) {
      const warn = priceResult(mutated('params.pricingProfile.onBelowMin', 'WARN', c.raw))
      const block = priceResult(mutated('params.pricingProfile.onBelowMin', 'BLOCK', c.raw))
      expect(warn.ok && block.ok).toBe(true)
      if (warn.ok && block.ok) expect(block.value.pricing).toEqual(warn.value.pricing)
    }
  })

  it('con redondeo hacia arriba y sin descuento el margen efectivo no baja del objetivo más que el error de redondeo a pesos', () => {
    let checked = 0
    for (const c of cases) {
      if (c.fixedPrice || c.policy === 'CAP' || c.rounding.mode !== 'STEP' || c.rounding.direction !== 'UP') continue
      const noDiscount = mutated('overrides', [override('DISCOUNT', { value: { mode: 'NONE' } })], c.raw)
      const { pricing } = fullOf(noDiscount).output
      if (pricing.netTotal === 0) continue
      // cada importe se redondea a pesos (neto, IVA, comisión): a lo más ~5 pesos de desvío sobre el neto
      expect(pricing.commercialMargin).toBeGreaterThanOrEqual(c.targetMargin - 5 / pricing.netTotal)
      checked += 1
    }
    expect(checked).toBeGreaterThan(30)
  })

  it('un descuento nunca sube el precio: sin descuento el total es ≥ al del tramo', () => {
    for (const c of cases.slice(0, 200)) {
      if (c.fixedPrice) continue
      const withDiscount = fullOf(mutated('overrides', [], c.raw)).output.pricing
      const without = fullOf(mutated('overrides', [override('DISCOUNT', { value: { mode: 'NONE' } })], c.raw)).output.pricing
      expect(without.grossTotal).toBeGreaterThanOrEqual(withDiscount.grossTotal)
      expect(without.customerUnitPrice).toBeGreaterThanOrEqual(withDiscount.customerUnitPrice)
    }
  })

  it('monotonía: un margen objetivo mayor nunca baja el precio', () => {
    for (const c of cases.slice(0, 150)) {
      if (c.fixedPrice) continue
      const at = (m: number) => fullOf(mutated('params.pricingProfile.minMargin', 0, mutated('params.pricingProfile.targetMargin', m, c.raw))).output.pricing.grossTotal
      expect(at(0.3)).toBeGreaterThanOrEqual(at(0.2))
      expect(at(0.45)).toBeGreaterThanOrEqual(at(0.3))
    }
  })

  it('monotonía: una comisión mayor nunca baja el precio (el margen se sostiene después de la comisión)', () => {
    for (const c of cases.slice(0, 150)) {
      if (c.fixedPrice) continue
      const at = (commission: number) => fullOf(mutated('params.channel.commission', commission, c.raw)).output.pricing.grossTotal
      expect(at(0.1)).toBeGreaterThanOrEqual(at(0.05))
      expect(at(0.25)).toBeGreaterThanOrEqual(at(0.1))
    }
  })

  it('un cargo fijo mayor nunca baja el precio', () => {
    for (const c of cases.slice(0, 100)) {
      if (c.fixedPrice) continue
      const at = (amount: number) => fullOf(mutated('params.channel.fixedFee', { amount, basis: 'NET', vatRecoverable: true }, c.raw)).output.pricing.grossTotal
      expect(at(500)).toBeGreaterThanOrEqual(at(100))
    }
  })

  it('las fallas de costos separados jamás generan una línea propia', () => {
    for (const c of cases) {
      const raw = mutated('params.costProfile.failure.affectedComponents', ['MATERIAL', 'ELECTRICITY', 'WEAR', 'SUPERVISION', 'DESIGN'], c.raw)
      const { cost, output } = fullOf(raw)
      for (const line of output.pricing.lines) {
        expect(line.code.startsWith('failure:')).toBe(false)
        const root = cost.breakdown.items.find((i) => i.code === line.code)
        if (line.kind === 'SEPARATE_LINE') expect(root?.component).not.toBe('FAILURE')
      }
      const grouped = output.pricing.lines.flatMap((l) => l.sourceItemCodes)
      expect(new Set(grouped).size).toBe(grouped.length) // ningún ítem en dos líneas
    }
  })

  it('un ONE_OFF no escala con N en la línea separada ni en el pool: mismo costo con otra cantidad', () => {
    for (const c of cases.slice(0, 60)) {
      const raw = mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], c.raw)
      const other = mutated('input.quantity', c.n + 7, raw)
      const lineCost = (r: Raw) => fullOf(r).output.pricing.lines.find((l) => l.code === 'service:modeling-3d')?.costBasis
      const first = lineCost(mutated('input.extraCosts', [], raw))
      const second = lineCost(mutated('input.extraCosts', [], other))
      expect(first).toBeGreaterThanOrEqual(27000)
      expect(second).toBe(first) // el NRE (+ sus fallas por defecto: ninguna) no depende de N
    }
  })

  it('es determinista y no muta la solicitud', () => {
    for (const c of cases.slice(0, 100)) {
      const before = JSON.stringify(c.raw)
      expect(fullOf(c.raw).output).toEqual(fullOf(c.raw).output)
      expect(JSON.stringify(c.raw)).toBe(before)
    }
  })
})
