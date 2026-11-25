import { describe, expect, it } from 'vitest'
import { roundToClp, type Clp } from '../../../../core/money'
import { taxProfile } from '../../testing/tax-fixtures'
import type { TaxProfileValues } from '../../contracts/parameters'
import {
  canRecoverVat,
  checkSplitInvariant,
  isRate,
  isVatEffectivelyRecoverable,
  purchaseVatRateOf,
  salesVatRateOf,
  splitFromGross,
  splitFromNet,
  type SaleSplit,
} from './index'

const clp = (n: number): Clp => roundToClp(n)

function mustSplit(result: ReturnType<typeof splitFromNet>): SaleSplit {
  if (!result.ok) throw new Error(`se esperaba éxito: ${JSON.stringify(result.error)}`)
  return result.value
}

describe('IVA de venta: neto → bruto', () => {
  const cases: [number, number, SaleSplit][] = [
    [100, 0.19, { net: clp(100), vat: clp(19), gross: clp(119) }],
    [1000, 0.19, { net: clp(1000), vat: clp(190), gross: clp(1190) }],
    [50, 0.19, { net: clp(50), vat: clp(10), gross: clp(60) }], // 9,5 → 10 (mitad se aleja de cero)
    [10, 0.19, { net: clp(10), vat: clp(2), gross: clp(12) }], // 1,9
    [2, 0.19, { net: clp(2), vat: clp(0), gross: clp(2) }], // 0,38
    [1, 0.5, { net: clp(1), vat: clp(1), gross: clp(2) }], // 0,5 → 1
    [1000, 0, { net: clp(1000), vat: clp(0), gross: clp(1000) }],
    [0, 0.19, { net: clp(0), vat: clp(0), gross: clp(0) }],
    [21429, 0.19, { net: clp(21429), vat: clp(4072), gross: clp(25501) }], // 4.071,51
    [1_000_000_000_000, 0.19, { net: clp(1_000_000_000_000), vat: clp(190_000_000_000), gross: clp(1_190_000_000_000) }],
  ]
  it.each(cases)('splitFromNet(%s, %s)', (net, rate, expected) => {
    expect(splitFromNet(clp(net), rate)).toEqual({ ok: true, value: expected })
  })
})

describe('IVA de venta: bruto → neto', () => {
  const cases: [number, number, SaleSplit][] = [
    [119, 0.19, { net: clp(100), vat: clp(19), gross: clp(119) }],
    [1190, 0.19, { net: clp(1000), vat: clp(190), gross: clp(1190) }],
    [25500, 0.19, { net: clp(21429), vat: clp(4071), gross: clp(25500) }], // 21.428,57
    [31800, 0.19, { net: clp(26723), vat: clp(5077), gross: clp(31800) }], // 26.722,69
    [60, 0.19, { net: clp(50), vat: clp(10), gross: clp(60) }], // 50,42
    [1, 0.19, { net: clp(1), vat: clp(0), gross: clp(1) }], // 0,84
    [0, 0.19, { net: clp(0), vat: clp(0), gross: clp(0) }],
    [1000, 0, { net: clp(1000), vat: clp(0), gross: clp(1000) }],
    [3, 0.5, { net: clp(2), vat: clp(1), gross: clp(3) }], // 2 exacto
    [1_190_000_000_000, 0.19, { net: clp(1_000_000_000_000), vat: clp(190_000_000_000), gross: clp(1_190_000_000_000) }],
  ]
  it.each(cases)('splitFromGross(%s, %s)', (gross, rate, expected) => {
    expect(splitFromGross(clp(gross), rate)).toEqual({ ok: true, value: expected })
  })
})

describe('consistencia neto + IVA = bruto', () => {
  it('se cumple exactamente en ambos sentidos (barrido de 0 a 3.000 con varias tasas)', () => {
    for (const rate of [0, 0.05, 0.19, 0.21, 0.5, 0.99]) {
      for (let value = 0; value <= 3000; value += 1) {
        const fromNet = mustSplit(splitFromNet(clp(value), rate))
        expect(fromNet.net + fromNet.vat).toBe(fromNet.gross)
        expect(checkSplitInvariant(fromNet, rate)).toBeUndefined()
        const fromGross = mustSplit(splitFromGross(clp(value), rate))
        expect(fromGross.net + fromGross.vat).toBe(fromGross.gross)
        expect(checkSplitInvariant(fromGross, rate)).toBeUndefined()
      }
    }
  })

  it('neto → bruto → neto recupera el neto original, siempre (barrido)', () => {
    for (const rate of [0, 0.05, 0.19, 0.21, 0.5, 0.99]) {
      for (let net = 0; net <= 5000; net += 1) {
        const gross = mustSplit(splitFromNet(clp(net), rate)).gross
        expect(mustSplit(splitFromGross(gross, rate)).net).toBe(net)
      }
    }
  })

  it('bruto → neto → bruto NO siempre recupera el bruto: por eso el precio bruto es la fuente de verdad', () => {
    const gross = clp(3)
    const split = mustSplit(splitFromGross(gross, 0.19)) // neto 3, IVA 0
    const back = mustSplit(splitFromNet(split.net, 0.19)) // IVA 1 → bruto 4
    expect(split).toEqual({ net: 3, vat: 0, gross: 3 })
    expect(back.gross).toBe(4)
    // mismo fenómeno en un precio comercial: neto 21.429 de un bruto 25.500 ya no vuelve a 25.500
    const commercial = mustSplit(splitFromGross(clp(25500), 0.19))
    expect(mustSplit(splitFromNet(commercial.net, 0.19)).gross).toBe(25501)
  })

  it('es monótono: un precio mayor nunca produce un bruto o un neto menor', () => {
    let previousGross = -1
    let previousNet = -1
    for (let value = 0; value <= 3000; value += 1) {
      const gross = mustSplit(splitFromNet(clp(value), 0.19)).gross
      const net = mustSplit(splitFromGross(clp(value), 0.19)).net
      expect(gross).toBeGreaterThanOrEqual(previousGross)
      expect(net).toBeGreaterThanOrEqual(previousNet)
      previousGross = gross
      previousNet = net
    }
  })

  it('el IVA nunca supera lo que permite el redondeo respecto del IVA exacto', () => {
    for (const net of [1, 7, 99, 1234, 98765]) {
      const split = mustSplit(splitFromNet(clp(net), 0.19))
      expect(Math.abs(split.vat - net * 0.19)).toBeLessThan(0.5000001)
    }
  })

  it('es determinista', () => {
    expect(splitFromGross(clp(25500), 0.19)).toEqual(splitFromGross(clp(25500), 0.19))
  })
})

describe('entradas inválidas', () => {
  const badAmounts: [string, number][] = [
    ['decimal', 100.5],
    ['negativo', -1],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ]
  it.each(badAmounts)('monto %s → INVALID_AMOUNT en ambos sentidos', (_name, value) => {
    for (const fn of [splitFromNet, splitFromGross]) {
      const result = fn(value as Clp, 0.19)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_AMOUNT')
    }
  })

  const badRates: [string, number][] = [
    ['negativa', -0.19],
    ['igual a 1', 1],
    ['como porcentaje', 19],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ]
  it.each(badRates)('tasa %s → INVALID_RATE en ambos sentidos', (_name, rate) => {
    for (const fn of [splitFromNet, splitFromGross]) {
      const result = fn(clp(1000), rate)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_RATE')
    }
  })
})

describe('checkSplitInvariant detecta separaciones corruptas', () => {
  const split = (net: number, vat: number, gross: number): SaleSplit => ({ net: net as Clp, vat: vat as Clp, gross: gross as Clp })

  it('una separación correcta no tiene problemas', () => {
    expect(checkSplitInvariant(split(1000, 190, 1190), 0.19)).toBeUndefined()
  })

  it('net + vat ≠ gross', () => {
    expect(checkSplitInvariant(split(1000, 190, 1191), 0.19)).toContain('net + vat')
  })

  it('negativos, decimales y vat > gross', () => {
    expect(checkSplitInvariant(split(-1, 0, -1), 0.19)).toContain('negativos')
    expect(checkSplitInvariant(split(1000.5, 189.5, 1190), 0.19)).toContain('enteros')
    expect(checkSplitInvariant(split(0, 5, 5), 0)).toContain('redondeo')
  })

  it('IVA que se aparta del exacto más de lo permitido (ej.: IVA calculado con otra tasa)', () => {
    expect(checkSplitInvariant(split(1000, 210, 1210), 0.19)).toContain('redondeo')
    expect(checkSplitInvariant(split(1000, 190, 1190), 0.21)).toContain('redondeo')
  })
})

describe('tasas y régimen', () => {
  it('isRate: finita y en [0, 1)', () => {
    for (const ok of [0, 0.19, 0.999]) expect(isRate(ok)).toBe(true)
    for (const bad of [-0.01, 1, 19, Number.NaN, Number.POSITIVE_INFINITY]) expect(isRate(bad)).toBe(false)
  })

  it('afecto: la tasa de venta es vatRate; no afecto: 0', () => {
    expect(salesVatRateOf(taxProfile())).toEqual({ ok: true, value: 0.19 })
    expect(salesVatRateOf(taxProfile({ vatRate: 0.21 }))).toEqual({ ok: true, value: 0.21 })
    expect(salesVatRateOf(taxProfile({ regime: 'NOT_REGISTERED' }))).toEqual({ ok: true, value: 0 })
    // afecto con tasa 0 (ventas exentas) es válido
    expect(salesVatRateOf(taxProfile({ vatRate: 0 }))).toEqual({ ok: true, value: 0 })
  })

  it('no afecto con tasa de venta ≠ 0 es incoherente y se rechaza', () => {
    const incoherent = { ...taxProfile({ regime: 'NOT_REGISTERED' }), vatRate: 0.19 } as unknown as TaxProfileValues
    const result = salesVatRateOf(incoherent)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_COMBINATION')
  })

  it('tasas fuera de rango en el perfil', () => {
    const badSales = { ...taxProfile(), vatRate: 19 } as unknown as TaxProfileValues
    const sales = salesVatRateOf(badSales)
    expect(sales.ok).toBe(false)
    if (!sales.ok) expect(sales.error.code).toBe('INVALID_RATE')
    const badPurchase = { ...taxProfile(), purchaseVatRate: -1 } as unknown as TaxProfileValues
    const purchase = purchaseVatRateOf(badPurchase)
    expect(purchase.ok).toBe(false)
    if (!purchase.ok) expect(purchase.error.code).toBe('INVALID_RATE')
    expect(purchaseVatRateOf(taxProfile({ purchaseVatRate: 0.19 }))).toEqual({ ok: true, value: 0.19 })
  })

  it('solo el régimen afecto recupera crédito fiscal, y el régimen manda sobre el indicador', () => {
    expect(canRecoverVat(taxProfile())).toBe(true)
    expect(canRecoverVat(taxProfile({ regime: 'NOT_REGISTERED' }))).toBe(false)
    expect(isVatEffectivelyRecoverable(taxProfile(), true)).toBe(true)
    expect(isVatEffectivelyRecoverable(taxProfile(), false)).toBe(false)
    expect(isVatEffectivelyRecoverable(taxProfile({ regime: 'NOT_REGISTERED' }), true)).toBe(false)
  })
})
