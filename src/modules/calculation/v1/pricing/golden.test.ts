import { describe, expect, it } from 'vitest'
import { checkCostBreakdownInvariants, checkPricingInvariants } from '../../contracts/invariants'
import { isIssuable } from '../../contracts'
import { mutated, validRequestRaw, without } from '../../testing/fixtures'
import { fullOf, override, withChannel } from '../../testing/pricing-helpers'
import type { PricingResult } from '../../contracts/results'

/**
 * GOLDEN de precios. Los valores esperados salen de un script independiente (aritmética directa, sin
 * reutilizar código del repositorio) y, los más simples, de cálculo a mano. Fórmula base:
 *   neto objetivo = (C + cargo fijo) / (1 − c_eff − margen objetivo)
 * y todo se recalcula sobre el precio EFECTIVO (después de descuento, IVA y redondeo comercial).
 */
const NET_ROUNDING = { mode: 'STEP', step: 100, direction: 'UP', target: 'NET' }
const PLATE_6 = (raw: Record<string, unknown>, n: number) =>
  mutated('input.plates[0].partsPerPlate', 6, mutated('input.quantity', n, raw))

interface Expected {
  unit: number
  net: number
  vat: number
  gross: number
  commission: number
  utility: number
  margin: number
  markup: number
}

function expectPricing(raw: Record<string, unknown>, expected: Expected): PricingResult {
  const { cost, output } = fullOf(raw)
  const { pricing } = output
  expect(pricing.customerUnitPrice).toBe(expected.unit)
  expect(pricing.netTotal).toBe(expected.net)
  expect(pricing.vatTotal).toBe(expected.vat)
  expect(pricing.grossTotal).toBe(expected.gross)
  expect(pricing.commission).toBe(expected.commission)
  expect(pricing.commercialUtility).toBe(expected.utility)
  expect(pricing.commercialMargin).toBeCloseTo(expected.margin, 6)
  expect(pricing.commercialMarkup).toBeCloseTo(expected.markup, 6)
  expect(checkPricingInvariants(pricing, cost.breakdown)).toEqual([])
  expect(checkCostBreakdownInvariants(cost.breakdown, cost.quantities.units)).toEqual([])
  return pricing
}

describe('GOLDEN A — venta directa, margen 35 %, IVA 19 %, redondeo $100 ↑ sobre el bruto (caso base, costo $13.885)', () => {
  const { cost, output } = fullOf(validRequestRaw())
  const { pricing, flags } = output

  it('neto objetivo = 13.885 / 0,65 = $21.361,54 y precio de venta $25.500 IVA incl.', () => {
    expect(pricing.targetNetTotal).toBe(21362)
    expect(pricing.customerUnitPrice).toBe(25500) // 21.361,54 × 1,19 = 25.420,23 → $25.500
    expect(pricing.mode).toBe('TARGET_MARGIN')
    expect(pricing.customerPriceMode).toBe('GROSS')
  })

  it('neto, IVA y bruto separados; el IVA no es utilidad ni costo', () => {
    expect(pricing.netTotal).toBe(21429) // 25.500 / 1,19
    expect(pricing.vatTotal).toBe(4071)
    expect(pricing.grossTotal).toBe(25500)
    expect(pricing.commission).toBe(0)
    expect(pricing.commercialUtility).toBe(7544) // 21.429 − 0 − 13.885
  })

  it('margen y markup sobre el precio efectivo (margen es la variable principal; markup, derivado)', () => {
    expect(pricing.commercialMargin).toBeCloseTo(0.352046, 6) // 7.544 / 21.429
    expect(pricing.commercialMarkup).toBeCloseTo(0.54332, 5) // 7.544 / 13.885
  })

  it('piso (margen mínimo 25 %) y equilibrio', () => {
    expect(pricing.floorNetTotal).toBe(18513) // 13.885 / 0,75
    expect(pricing.breakEvenNetTotal).toBe(13885)
  })

  it('sin descuento, sin advertencias, y el costo absorbido es 0', () => {
    expect(pricing.discount).toEqual({ applied: 0 })
    expect(flags).toEqual([])
    expect(pricing.absorbedCost).toBe(0)
    expect(pricing.realUtility).toBe(pricing.commercialUtility)
    expect(isIssuable(flags)).toBe(true)
  })

  it('una sola línea principal con su costo y el detalle de sus ítems', () => {
    expect(pricing.lines).toHaveLength(1)
    expect(pricing.lines[0]).toMatchObject({ code: 'main', kind: 'MAIN', quantity: 1, customerUnitPrice: 25500, costBasis: 13885 })
    expect(pricing.lines[0]?.sourceItemCodes).toHaveLength(10)
    expect(checkPricingInvariants(pricing, cost.breakdown)).toEqual([])
  })
})

describe('GOLDEN — comisión por canal', () => {
  const base = validRequestRaw()
  it('B · marketplace 13 % sobre el neto: el margen se mantiene DESPUÉS de la comisión', () => {
    const pricing = expectPricing(withChannel(base, { commission: 0.13 }), {
      unit: 31800, net: 26723, vat: 5077, gross: 31800, commission: 3474, utility: 9364, margin: 0.35041, markup: 0.674397,
    })
    expect(pricing.targetNetTotal).toBe(26702) // 13.885 / (1 − 0,13 − 0,35)
    expect(pricing.floorNetTotal).toBe(22395) // 13.885 / (1 − 0,13 − 0,25)
    expect(pricing.breakEvenNetTotal).toBe(15960) // 13.885 / (1 − 0,13)
  })

  it('C · 13 % sobre el BRUTO: c_eff = 0,13 × 1,19 sobre el neto', () => {
    expectPricing(withChannel(base, { commission: 0.13, base: 'GROSS' }), {
      unit: 33400, net: 28067, vat: 5333, gross: 33400, commission: 4342, utility: 9840, margin: 0.35059, markup: 0.708678,
    })
  })

  it('P · comisión con IVA NO recuperable: el IVA es costo (misma tasa efectiva que sobre el bruto)', () => {
    expectPricing(withChannel(base, { commission: 0.13, vatCharged: true, vatRecoverable: false }), {
      unit: 33400, net: 28067, vat: 5333, gross: 33400, commission: 4342, utility: 9840, margin: 0.35059, markup: 0.708678,
    })
  })

  it('comisión con IVA recuperable: el IVA no es costo (igual que B)', () => {
    expectPricing(withChannel(base, { commission: 0.13, vatCharged: true, vatRecoverable: true }), {
      unit: 31800, net: 26723, vat: 5077, gross: 31800, commission: 3474, utility: 9364, margin: 0.35041, markup: 0.674397,
    })
  })

  it('D · comisión 13 % + cargo fijo $150 por transacción', () => {
    const fixedFee = { amount: 150, basis: 'NET' as const, vatRecoverable: true }
    const pricing = expectPricing(withChannel(base, { commission: 0.13, fixedFee }), {
      unit: 32200, net: 27059, vat: 5141, gross: 32200, commission: 3668, utility: 9506, margin: 0.351306, markup: 0.684624,
    })
    expect(pricing.targetNetTotal).toBe(26990) // (13.885 + 150) / 0,52
  })

  it('X · solo cargo fijo (comisión 0): el margen se mantiene después del cargo', () => {
    expectPricing(withChannel(base, { commission: 0, fixedFee: { amount: 150, basis: 'NET', vatRecoverable: true } }), {
      unit: 25700, net: 21597, vat: 4103, gross: 25700, commission: 150, utility: 7562, margin: 0.350141, markup: 0.544616,
    })
  })

  it('el cargo fijo en base bruta se descompone (119 bruto recuperable = 100 de costo)', () => {
    const gross = withChannel(base, { commission: 0, fixedFee: { amount: 119, basis: 'GROSS', vatRecoverable: true } })
    const net = withChannel(base, { commission: 0, fixedFee: { amount: 100, basis: 'NET', vatRecoverable: true } })
    expect(fullOf(gross).output.pricing).toEqual(fullOf(net).output.pricing)
  })
})

describe('GOLDEN — IVA y régimen', () => {
  it('F · negocio no afecto: sin IVA de venta; los costos incluyen el IVA que pagan (costo $14.554)', () => {
    let raw = mutated('params.taxProfile.regime', 'NOT_REGISTERED', validRequestRaw())
    raw = mutated('params.taxProfile.vatRate', 0, raw)
    const pricing = expectPricing(raw, { unit: 22400, net: 22400, vat: 0, gross: 22400, commission: 0, utility: 7846, margin: 0.350268, markup: 0.539096 })
    expect(pricing.lines[0]?.costBasis).toBe(14554)
  })

  it('E · el cliente ve el precio NETO y el redondeo es sobre el neto', () => {
    let raw = mutated('params.taxProfile.customerPriceMode', 'NET', validRequestRaw())
    raw = mutated('params.pricingProfile.rounding', NET_ROUNDING, raw)
    const pricing = expectPricing(raw, { unit: 21400, net: 21400, vat: 4066, gross: 25466, commission: 0, utility: 7515, margin: 0.351168, markup: 0.541232 })
    expect(pricing.customerPriceMode).toBe('NET')
  })

  it('V · el cliente ve el BRUTO pero el redondeo se hace sobre el neto', () => {
    const raw = mutated('params.pricingProfile.rounding', NET_ROUNDING, validRequestRaw())
    expectPricing(raw, { unit: 25466, net: 21400, vat: 4066, gross: 25466, commission: 0, utility: 7515, margin: 0.351168, markup: 0.541232 })
  })

  it('W · el cliente ve el NETO pero el redondeo se hace sobre el bruto', () => {
    const raw = mutated('params.taxProfile.customerPriceMode', 'NET', validRequestRaw())
    expectPricing(raw, { unit: 21429, net: 21429, vat: 4072, gross: 25501, commission: 0, utility: 7544, margin: 0.352046, markup: 0.54332 })
  })

  it('Q · marketplace con el cliente viendo el neto', () => {
    let raw = withChannel(mutated('params.taxProfile.customerPriceMode', 'NET', validRequestRaw()), { commission: 0.13 })
    raw = mutated('params.pricingProfile.rounding', NET_ROUNDING, raw)
    expectPricing(raw, { unit: 26800, net: 26800, vat: 5092, gross: 31892, commission: 3484, utility: 9431, margin: 0.351903, markup: 0.679222 })
  })

  it('el IVA de venta no cambia el neto objetivo (no es utilidad ni costo): misma meta con 0 %, 19 % o 21 %', () => {
    const targets = [0, 0.19, 0.21].map((rate) => {
      let raw = mutated('params.taxProfile.vatRate', rate, validRequestRaw())
      raw = mutated('params.taxProfile.regime', 'VAT_REGISTERED', raw)
      return fullOf(raw).output.pricing.targetNetTotal
    })
    expect(new Set(targets).size).toBe(1)
  })
})

describe('GOLDEN — redondeo comercial: el margen se recalcula sobre el precio efectivo', () => {
  it('K · sin redondeo comercial: al peso; el margen queda apenas bajo el objetivo y se informa', () => {
    const raw = mutated('params.pricingProfile.rounding', { mode: 'NONE' }, validRequestRaw())
    const { pricing, flags } = fullOf(raw).output
    expect(pricing.customerUnitPrice).toBe(25420)
    expect(pricing.netTotal).toBe(21361)
    expect(pricing.commercialUtility).toBe(7476)
    expect(pricing.commercialMargin).toBeCloseTo(0.349984, 6)
    expect(flags.map((f) => f.code)).toEqual(['BELOW_TARGET']) // 34,9984 % < 35 % por el redondeo a pesos enteros
  })

  it('L · redondeo hacia abajo: se aparta del objetivo (se informa) pero respeta el mínimo', () => {
    const raw = mutated('params.pricingProfile.rounding.direction', 'DOWN', validRequestRaw())
    const { pricing, flags } = fullOf(raw).output
    expect(pricing.customerUnitPrice).toBe(25400)
    expect(pricing.commercialUtility).toBe(7460)
    expect(pricing.commercialMargin).toBeCloseTo(0.349496, 6)
    expect(flags.map((f) => f.code)).toEqual(['BELOW_TARGET'])
  })

  it('U · redondeo al más cercano', () => {
    const raw = mutated('params.pricingProfile.rounding.direction', 'NEAREST', validRequestRaw())
    expect(fullOf(raw).output.pricing.customerUnitPrice).toBe(25400)
  })

  it('T · paso de $1.000 hacia arriba: más margen que el objetivo', () => {
    const raw = mutated('params.pricingProfile.rounding.step', 1000, validRequestRaw())
    const { pricing } = fullOf(raw).output
    expect(pricing.customerUnitPrice).toBe(26000)
    expect(pricing.commercialMargin).toBeCloseTo(0.364502, 6)
  })

  it('con redondeo hacia arriba el margen efectivo nunca queda bajo el objetivo (salvo el error de 1 peso)', () => {
    const { pricing } = fullOf(validRequestRaw()).output
    expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.35)
  })
})

describe('GOLDEN — margen objetivo, descuentos y precio fijo', () => {
  it('N · margen objetivo 50 % por override de la cotización (el perfil no cambia)', () => {
    const raw = mutated('overrides', [override('TARGET_MARGIN', { value: 0.5 })], validRequestRaw())
    const { pricing, flags } = fullOf(raw).output
    expect(pricing.customerUnitPrice).toBe(33100)
    expect(pricing.commercialUtility).toBe(13930)
    expect(pricing.commercialMargin).toBeCloseTo(0.500809, 6)
    expect(flags).toEqual([{ code: 'OVERRIDE_APPLIED', severity: 'INFO', path: 'overrides[0]' }])
  })

  it('R · margen objetivo y mínimo en 0: el precio cubre el costo (con redondeo, queda un pequeño margen)', () => {
    const raw = mutated('overrides', [override('TARGET_MARGIN', { value: 0 }), override('MIN_MARGIN', { value: 0 })], validRequestRaw())
    const { pricing } = fullOf(raw).output
    expect(pricing.targetNetTotal).toBe(13885)
    expect(pricing.customerUnitPrice).toBe(16600)
    expect(pricing.commercialUtility).toBe(65)
  })

  it('G · 10 unidades en placas de 6, tramo del 8 %: el margen cae bajo el objetivo pero no bajo el mínimo', () => {
    const { pricing, flags } = fullOf(PLATE_6(validRequestRaw(), 10)).output
    expect(pricing.discount).toEqual({ applied: 0.08 })
    expect(pricing.customerUnitPrice).toBe(4400)
    expect(pricing.netTotal).toBe(36975)
    expect(pricing.vatTotal).toBe(7025)
    expect(pricing.grossTotal).toBe(44000)
    expect(pricing.commercialUtility).toBe(10874)
    expect(pricing.commercialMargin).toBeCloseTo(0.294091, 6)
    expect(flags.map((f) => f.code)).toEqual(['BELOW_TARGET'])
  })

  it('S · descuento manual del 10 % (override) en lugar del tramo', () => {
    const raw = mutated('overrides', [override('DISCOUNT', { value: { mode: 'MANUAL', pct: 0.1 } })], validRequestRaw())
    const { pricing } = fullOf(raw).output
    expect(pricing.discount).toEqual({ applied: 0.1 })
    expect(pricing.customerUnitPrice).toBe(22900)
    expect(pricing.commercialUtility).toBe(5359)
    expect(pricing.commercialMargin).toBeCloseTo(0.278476, 6)
  })

  it('descuento NONE (override) anula el tramo', () => {
    const withTier = PLATE_6(validRequestRaw(), 10)
    const none = mutated('overrides', [override('DISCOUNT', { value: { mode: 'NONE' } })], withTier)
    expect(fullOf(none).output.pricing.discount).toEqual({ applied: 0 })
    expect(fullOf(none).output.pricing.customerUnitPrice).toBeGreaterThan(fullOf(withTier).output.pricing.customerUnitPrice)
  })

  it('J · precio unitario fijo de $30.000: el margen resulta del precio, el descuento no se aplica', () => {
    const raw = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 30000 } })], PLATE_6(validRequestRaw(), 10))
    const { pricing } = fullOf(raw).output
    expect(pricing.mode).toBe('FIXED_PRICE')
    expect(pricing.customerUnitPrice).toBe(30000)
    expect(pricing.discount).toEqual({ applied: 0 })
    expect(pricing.grossTotal).toBe(300000)
  })

  it('J · con N = 1 el precio fijo de $30.000 da el margen de 44,9 %', () => {
    const raw = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 30000 } })], validRequestRaw())
    const pricing = expectPricing(raw, { unit: 30000, net: 25210, vat: 4790, gross: 30000, commission: 0, utility: 11325, margin: 0.449226, markup: 0.815628 })
    expect(pricing.mode).toBe('FIXED_PRICE')
  })
})

describe('GOLDEN I — línea separada (modelado 3D) con margen objetivo sobre el total', () => {
  const { cost, output } = fullOf(mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw()))
  const { pricing } = output

  it('el margen objetivo aplica a la cotización completa; cada línea recibe su parte por costo', () => {
    expect(pricing.targetNetTotal).toBe(62900) // 40.885 / 0,65
    expect(pricing.lines.map((l) => [l.code, l.kind, l.customerUnitPrice, l.costBasis])).toEqual([
      ['main', 'MAIN', 25500, 13885],
      ['service:modeling-3d', 'SEPARATE_LINE', 49500, 27000],
    ])
    expect(pricing.grossTotal).toBe(75000)
    expect(pricing.netTotal).toBe(63025)
    expect(pricing.vatTotal).toBe(11975)
    expect(pricing.commercialUtility).toBe(22140)
    expect(pricing.commercialMargin).toBeCloseTo(0.351289, 6)
  })

  it('neto e IVA por línea suman exactamente el documento (mayor resto)', () => {
    expect(pricing.lines.map((l) => [l.netLineTotal, l.vatLineTotal, l.grossLineTotal])).toEqual([
      [21429, 4071, 25500],
      [41596, 7904, 49500],
    ])
  })

  it('el costo de las líneas suma el pool y se cumplen todas las identidades', () => {
    expect(pricing.lines.reduce((s, l) => s + l.costBasis, 0)).toBe(cost.breakdown.pricingPool)
    expect(checkPricingInvariants(pricing, cost.breakdown)).toEqual([])
  })

  it('el NRE no se multiplica por N: con 50 unidades su línea sigue costando $27.000', () => {
    const raw = mutated('input.quantity', 50, mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw()))
    const line = fullOf(raw).output.pricing.lines.find((l) => l.code === 'service:modeling-3d')
    expect(line?.costBasis).toBe(27000)
    expect(line?.quantity).toBe(1)
  })

  it('precio FIJO para la línea separada (tarifa comercial independiente del margen)', () => {
    const raw = mutated('overrides', [override('FIXED_LINE_PRICE', { itemCode: 'service:modeling-3d', value: { customerPrice: 20000 } })], mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw()))
    const out = fullOf(raw).output
    const line = out.pricing.lines.find((l) => l.code === 'service:modeling-3d')
    expect(line?.customerLineTotal).toBe(20000)
    // el margen objetivo del total se mantiene: la línea principal absorbe la diferencia
    expect(out.pricing.commercialMargin).toBeGreaterThanOrEqual(0.35)
    expect(out.flags.map((f) => f.code)).toEqual(['OVERRIDE_APPLIED'])
  })

  it('el costo del NRE absorbido ya no tiene línea ni entra al precio', () => {
    const raw = mutated('overrides', [override('ITEM_RECOVERY', { itemCode: 'service:modeling-3d', value: { recovery: 'ABSORBED' } })], mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw()))
    const out = fullOf(raw).output
    expect(out.pricing.lines).toHaveLength(1)
    expect(out.pricing.absorbedCost).toBe(27000)
    expect(out.pricing.realUtility).toBe(out.pricing.commercialUtility - 27000)
    expect(out.pricing.targetNetTotal).toBe(21362) // igual que el caso base
  })
})

describe('el cálculo no muta la solicitud y es determinista', () => {
  it('misma entrada, mismo resultado; la solicitud original no cambia', () => {
    const raw = withChannel(validRequestRaw(), { commission: 0.13 })
    const before = JSON.stringify(raw)
    expect(fullOf(raw).output).toEqual(fullOf(raw).output)
    expect(JSON.stringify(raw)).toBe(before)
    void without
  })
})
