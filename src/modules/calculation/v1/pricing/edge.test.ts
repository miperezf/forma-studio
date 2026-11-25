import { describe, expect, it } from 'vitest'
import { err } from '../../../../core/result'
import { calculateCost } from '../cost/engine'
import { checkCostBreakdownInvariants, checkPricingInvariants } from '../../contracts/invariants'
import { costSpecRaw, requestOf } from '../../testing/cost-helpers'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { fullOf, override, priceOf, priceResult, withChannel } from '../../testing/pricing-helpers'
import { calculatePricing } from './index'

const flagCodes = (raw: unknown) => priceOf(raw).flags.map((f) => f.code)

/** Costos en cero: PLA gratis, energía y desgaste en 0, mano de obra en 0. */
function zeroCostRaw(): Record<string, unknown> {
  let raw = mutated('params.materials.pla-basic.spool.price.amount', 0, validRequestRaw())
  raw = mutated('params.machines.printer-1.electricityPerHourOverride.amount', 0, raw)
  raw = mutated('params.machines.printer-1.wearPerHourOverride', 0, raw)
  raw = mutated('params.costProfile.labor.ratePerHour', 0, raw)
  return raw
}

describe('margen inalcanzable (c_eff + margen ≥ 1)', () => {
  const expectInfeasible = (raw: Record<string, unknown>, commission: number, margin: number) => {
    const result = priceResult(raw)
    expect(result.ok).toBe(false)
    if (!result.ok && result.error.code === 'INFEASIBLE_MARGIN') {
      expect(result.error.effectiveCommission).toBeCloseTo(commission, 9)
      expect(result.error.margin).toBeCloseTo(margin, 9)
    } else {
      throw new Error('se esperaba INFEASIBLE_MARGIN')
    }
  }

  it('comisión 70 % con margen 35 %', () => expectInfeasible(withChannel(validRequestRaw(), { commission: 0.7 }), 0.7, 0.35))

  it('la comisión sobre el bruto agrava la tasa efectiva (55 % × 1,19 = 65,45 %)', () => {
    expectInfeasible(withChannel(validRequestRaw(), { commission: 0.55, base: 'GROSS' }), 0.55 * 1.19, 0.35)
  })

  it('el IVA no recuperable de la comisión también cuenta', () => {
    expectInfeasible(withChannel(validRequestRaw(), { commission: 0.55, vatCharged: true, vatRecoverable: false }), 0.55 * 1.19, 0.35)
  })

  it('exactamente en el límite (65 % + 35 % = 100 %) se rechaza, sin precios infinitos por error binario', () => {
    expectInfeasible(withChannel(validRequestRaw(), { commission: 0.65 }), 0.65, 0.35)
  })

  it('el límite con error binario (70 % + 30 % deja 5,5e-17 positivo) también se rechaza, no produce un precio absurdo', () => {
    expect(1 - 0.7 - 0.3).toBeGreaterThan(0) // sin tolerancia sería "factible" y el neto llegaría a ~2,5e20
    const raw = mutated('overrides', [override('TARGET_MARGIN', { value: 0.3 })], withChannel(validRequestRaw(), { commission: 0.7 }))
    expectInfeasible(raw, 0.7, 0.3)
  })

  it('apenas bajo el límite sí se calcula (precio muy alto pero finito)', () => {
    const { pricing } = priceOf(withChannel(validRequestRaw(), { commission: 0.6499 }))
    expect(pricing.netTotal).toBeGreaterThan(100_000_000)
    expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.34)
  })

  it('un override de margen objetivo que lo hace inalcanzable también se rechaza', () => {
    const raw = mutated('overrides', [override('TARGET_MARGIN', { value: 0.9 })], withChannel(validRequestRaw(), { commission: 0.2 }))
    expectInfeasible(raw, 0.2, 0.9)
  })
})

describe('el modo TEST no calcula precio', () => {
  it('devuelve INVALID_INPUT', () => {
    const request = requestOf(mutated('mode', 'TEST', validRequestRaw()))
    const cost = calculateCost(request)
    if (!cost.ok) throw new Error('costo falló')
    const result = calculatePricing(request, cost.value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT')
  })
})

describe('costos cero y márgenes extremos', () => {
  it('sin costos y sin comisión no hay nada que cobrar: precio 0, margen indefinido (null) y advertencia', () => {
    const { pricing, flags } = priceOf(zeroCostRaw())
    expect(pricing.customerUnitPrice).toBe(0)
    expect(pricing.netTotal).toBe(0)
    expect(pricing.commercialUtility).toBe(0)
    expect(pricing.commercialMargin).toBeNull()
    expect(pricing.commercialMarkup).toBeNull()
    expect(pricing.realMargin).toBeNull()
    expect(pricing.realMarkup).toBeNull()
    expect(flags.map((f) => f.code)).toContain('PRICING_POOL_EMPTY')
  })

  it('sin costos pero con cargo fijo: el precio cubre el cargo y mantiene el margen', () => {
    const raw = withChannel(zeroCostRaw(), { commission: 0, fixedFee: { amount: 150, basis: 'NET', vatRecoverable: true } })
    const { pricing } = priceOf(raw)
    expect(pricing.customerUnitPrice).toBe(300) // 150 / 0,65 = 230,77 neto → 274,62 bruto → $300
    expect(pricing.commission).toBe(150)
    expect(pricing.commercialUtility).toBeGreaterThan(0)
    expect(pricing.commercialMargin).toBeCloseTo(0.4048, 3)
  })

  it('un precio fijo de $1 (muy bajo el costo): utilidad negativa y todas las advertencias', () => {
    const raw = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 1 } })], validRequestRaw())
    const { pricing, flags } = priceOf(raw)
    expect(pricing.netTotal).toBe(1)
    expect(pricing.commercialUtility).toBe(1 - 13885)
    expect(pricing.commercialMargin).toBeLessThan(-10000)
    expect(flags.map((f) => f.code)).toEqual(['OVERRIDE_APPLIED', 'BELOW_TARGET', 'BELOW_MIN', 'NEGATIVE_UTILITY'])
    expect(flagCodes(raw)).toEqual(flags.map((f) => f.code))
  })

  it('margen objetivo y mínimo muy altos (90 %) funcionan sin comisión', () => {
    const raw = mutated('overrides', [override('TARGET_MARGIN', { value: 0.9 }), override('MIN_MARGIN', { value: 0.9 })], validRequestRaw())
    const { pricing } = priceOf(raw)
    expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.9)
  })
})

describe('redondeo con pasos mayores que el precio', () => {
  const rounding = (step: number, direction: string) => mutated('params.pricingProfile.rounding', { mode: 'STEP', step, direction, target: 'GROSS' }, validRequestRaw())

  it('UP: el precio sube al paso completo', () => {
    const { pricing } = priceOf(rounding(100000, 'UP'))
    expect(pricing.customerUnitPrice).toBe(100000)
    expect(pricing.commercialMargin).toBeGreaterThan(0.8)
  })

  it('DOWN: el precio cae a 0 (utilidad negativa), y se advierte', () => {
    const raw = rounding(100000, 'DOWN')
    expect(priceOf(raw).pricing.customerUnitPrice).toBe(0)
    expect(flagCodes(raw)).toEqual(['BELOW_TARGET', 'BELOW_MIN', 'NEGATIVE_UTILITY'])
  })

  it('DOWN con CAP: sube hasta el primer paso que cumple el mínimo', () => {
    const raw = mutated('params.pricingProfile.onBelowMin', 'CAP', rounding(100000, 'DOWN'))
    const { pricing } = priceOf(raw)
    expect(pricing.customerUnitPrice).toBe(100000)
    expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.25)
  })

  it('un precio unitario diminuto con muchas unidades queda gobernado por la grilla', () => {
    const raw = mutated('input.plates[0].partsPerPlate', 1_000_000, mutated('input.quantity', 1_000_000, validRequestRaw()))
    const { cost, output } = fullOf(raw)
    expect(output.pricing.customerUnitPrice).toBe(100) // 0,018 neto por unidad → paso mínimo de $100
    expect(output.pricing.commercialMargin).toBeGreaterThan(0.99)
    expect(checkPricingInvariants(output.pricing, cost.breakdown)).toEqual([])
  })
})

describe('IVA en casos límite', () => {
  it('régimen afecto con tasa de venta 0 (ventas exentas): bruto = neto', () => {
    const raw = mutated('params.taxProfile.vatRate', 0, validRequestRaw())
    const { pricing } = priceOf(raw)
    expect(pricing.vatTotal).toBe(0)
    expect(pricing.netTotal).toBe(pricing.grossTotal)
  })

  it('no afecto + comisión sobre el bruto: no hay IVA de venta que agregar a la base', () => {
    let raw = mutated('params.taxProfile.regime', 'NOT_REGISTERED', validRequestRaw())
    raw = mutated('params.taxProfile.vatRate', 0, raw)
    const grossBase = priceOf(withChannel(raw, { commission: 0.13, base: 'GROSS' })).pricing
    const netBase = priceOf(withChannel(raw, { commission: 0.13, base: 'NET' })).pricing
    expect(grossBase).toEqual(netBase)
  })

  it('tasa de venta del 21 % (configurable)', () => {
    const { pricing } = priceOf(mutated('params.taxProfile.vatRate', 0.21, validRequestRaw()))
    expect(pricing.grossTotal - pricing.netTotal).toBe(pricing.vatTotal)
    expect(pricing.vatTotal / pricing.netTotal).toBeCloseTo(0.21, 3)
  })
})

describe('líneas comerciales: casos límite', () => {
  const withExtra = (spec: Record<string, unknown>, raw = validRequestRaw()) => mutated('input.extraCosts', [spec], raw)
  const separate = (code: string, amount: number) => costSpecRaw(code, amount, 'ONE_OFF', { recoveryConfig: { recovery: 'SEPARATE_LINE' } })

  it('una línea separada de costo 0 no aparece (nada que cobrar)', () => {
    const { pricing } = priceOf(withExtra(separate('free', 0)))
    expect(pricing.lines.map((l) => l.code)).toEqual(['main'])
  })

  it('una línea separada de costo 0 con precio fijo sí aparece, con su costo en 0', () => {
    const raw = mutated('overrides', [override('FIXED_LINE_PRICE', { itemCode: 'extra:free', value: { customerPrice: 5000 } })], withExtra(separate('free', 0)))
    const { pricing } = priceOf(raw)
    const line = pricing.lines.find((l) => l.code === 'extra:free')
    expect(line?.customerLineTotal).toBe(5000)
    expect(line?.costBasis).toBe(0)
  })

  it('todas las líneas con precio fijo: no hay reparto por margen', () => {
    const raw = mutated(
      'overrides',
      [
        override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 30000 } }),
        override('FIXED_LINE_PRICE', { itemCode: 'extra:design', value: { customerPrice: 10000 } }),
      ],
      withExtra(separate('design', 5000)),
    )
    const { cost, output } = fullOf(raw)
    expect(output.pricing.mode).toBe('FIXED_PRICE')
    expect(output.pricing.grossTotal).toBe(40000)
    expect(checkPricingInvariants(output.pricing, cost.breakdown)).toEqual([])
  })

  it('precios fijos que ya cubren el objetivo dejan en $0 a las líneas a precio objetivo (se informa por el margen resultante)', () => {
    const raw = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 100000 } })], withExtra(separate('design', 5000)))
    const { pricing } = priceOf(raw)
    expect(pricing.lines.find((l) => l.code === 'extra:design')?.customerLineTotal).toBe(0)
    expect(pricing.commercialMargin).toBeGreaterThan(0.35)
  })

  it('un código de línea desconocido en FIXED_LINE_PRICE se advierte y no altera el precio', () => {
    const base = priceOf(withExtra(separate('design', 5000)))
    const raw = mutated('overrides', [override('FIXED_LINE_PRICE', { itemCode: 'extra:nope', value: { customerPrice: 9999 } })], withExtra(separate('design', 5000)))
    const out = priceOf(raw)
    expect(out.flags).toEqual([{ code: 'UNKNOWN_OVERRIDE_TARGET', severity: 'WARNING', path: 'overrides[0]' }])
    expect(out.pricing).toEqual(base.pricing)
  })

  it('un FIXED_LINE_PRICE sobre una falla no existe como línea: se advierte', () => {
    const raw = mutated('overrides', [override('FIXED_LINE_PRICE', { itemCode: 'failure:extra:design', value: { customerPrice: 1 } })], mutated('params.costProfile.failure.affectedComponents', ['OTHER'], withExtra(separate('design', 5000))))
    expect(priceOf(raw).flags.map((f) => f.code)).toEqual(['UNKNOWN_OVERRIDE_TARGET'])
  })

  it('un ITEM_RECOVERY desconocido lo advierte la capa de costos; pricing no lo duplica ni lo da por aplicado', () => {
    const raw = mutated('overrides', [override('ITEM_RECOVERY', { itemCode: 'service:nada', value: { recovery: 'ABSORBED' } })], validRequestRaw())
    const { cost, output } = fullOf(raw)
    expect(cost.flags.map((f) => f.code)).toEqual(['UNKNOWN_OVERRIDE_TARGET'])
    expect(output.flags).toEqual([])
  })

  it('la falla de un costo separado no crea línea ni aparece como línea del precio', () => {
    const raw = mutated('params.costProfile.failure.affectedComponents', ['DESIGN'], mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw()))
    const { pricing } = priceOf(raw)
    expect(pricing.lines.map((l) => l.code)).toEqual(['main', 'service:modeling-3d'])
    expect(pricing.lines[1]?.sourceItemCodes).toEqual(['service:modeling-3d', 'failure:service:modeling-3d'])
    expect(pricing.lines[1]?.costBasis).toBe(27000 + 2348)
  })

  it('una falla SEPARATE_LINE con origen IN_PRICE es una entrada inválida (INVALID_INPUT)', () => {
    const raw = mutated(
      'overrides',
      [
        override('ITEM_RECOVERY', { itemCode: 'service:modeling-3d', value: { recovery: 'IN_PRICE' } }),
        override('ITEM_RECOVERY', { itemCode: 'failure:service:modeling-3d', value: { recovery: 'SEPARATE_LINE' } }),
      ],
      mutated('params.costProfile.failure.affectedComponents', ['DESIGN'], mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw())),
    )
    const result = priceResult(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT')
  })
})

describe('errores: entrada corrupta vs. defecto interno', () => {
  it('perfil tributario incoherente que eludió el validador: INCONSISTENT_SNAPSHOT', () => {
    const request = requestOf(validRequestRaw())
    const cost = calculateCost(request)
    if (!cost.ok) throw new Error('costo falló')
    const tax = { ...request.params.taxProfile, regime: 'NOT_REGISTERED' as const } // vatRate 19 % con régimen no afecto
    const result = calculatePricing({ ...request, params: { ...request.params, taxProfile: tax } }, cost.value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
  })

  it('comisión fuera de rango que eludió el validador: INCONSISTENT_SNAPSHOT', () => {
    const request = requestOf(validRequestRaw())
    const cost = calculateCost(request)
    if (!cost.ok) throw new Error('costo falló')
    const channel = { ...request.params.channel, commission: 2 as never }
    const result = calculatePricing({ ...request, params: { ...request.params, channel } }, cost.value)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
  })

  it('un desglose que no corresponde a la solicitud (defecto del llamador/motor): INTERNAL_INVARIANT', () => {
    const request = requestOf(validRequestRaw())
    const cost = calculateCost(request)
    if (!cost.ok) throw new Error('costo falló')
    const tampered = { ...cost.value, breakdown: { ...cost.value.breakdown, pricingPool: (cost.value.breakdown.pricingPool + 1) as never } }
    const result = calculatePricing(request, tampered)
    expect(result).toEqual(err({ code: 'INTERNAL_INVARIANT', invariant: 'pricing.lines' }))
  })

  it('los resultados de pricing pasan las identidades junto al desglose', () => {
    const { cost, output } = fullOf(validRequestRaw())
    expect(checkCostBreakdownInvariants(cost.breakdown, cost.quantities.units)).toEqual([])
    expect(checkPricingInvariants(output.pricing, cost.breakdown)).toEqual([])
  })
})
