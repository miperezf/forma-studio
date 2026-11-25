import { describe, expect, it } from 'vitest'
import {
  addClp,
  fractionFromPercent,
  fractionToPercent,
  isClp,
  multiplyClp,
  parseClp,
  parseFiniteNumber,
  parseFraction,
  parseGrams,
  parseHours,
  parseMoneyAmount,
  parseQuantity,
  parseSafeInteger,
  parseTaxedAmount,
  roundHalfAwayFromZero,
  roundToClp,
  subClp,
  sumClp,
  ZERO_CLP,
} from './index'

describe('redondeo a CLP (política única: mitad se aleja de cero)', () => {
  const roundingCases: [number, number][] = [
    [0, 0],
    [0.49, 0],
    [0.5, 1],
    [1.5, 2],
    [2.5, 3],
    [-0.5, -1],
    [-2.5, -3],
    [-0.2, 0],
    [1666.67, 1667],
    [977.39, 977],
    [1234.4999999999998, 1235],
  ]
  it.each(roundingCases)('roundHalfAwayFromZero(%s) = %s', (input, expected) => {
    expect(roundHalfAwayFromZero(input)).toBe(expected)
  })

  it('nunca devuelve -0', () => {
    expect(Object.is(roundHalfAwayFromZero(-0.2), 0)).toBe(true)
    expect(Object.is(roundToClp(-0.4), 0)).toBe(true)
  })

  it('roundToClp rechaza valores no finitos (error de programación)', () => {
    expect(() => roundToClp(Number.NaN)).toThrow()
    expect(() => roundToClp(Number.POSITIVE_INFINITY)).toThrow()
    expect(() => roundToClp(Number.MAX_VALUE)).toThrow()
  })

  it('es determinista: misma entrada, misma salida', () => {
    const inputs = [0.1 + 0.2, 13884 / 0.65, 51429 * 0.13, 25500 / 1.19]
    for (const value of inputs) {
      expect(roundToClp(value)).toBe(roundToClp(value))
    }
    expect(roundToClp(13884 / 0.65)).toBe(21360)
    expect(roundToClp(25500 / 1.19)).toBe(21429)
  })
})

describe('Clp', () => {
  it('parseClp exige enteros y respeta la cota', () => {
    expect(parseClp(1200, 'p')).toEqual({ ok: true, value: 1200 })
    expect(parseClp(1200.5, 'p')).toEqual({
      ok: false,
      error: { path: 'p', code: 'NOT_INTEGER', message: 'Debe ser un entero' },
    })
    expect(parseClp(-1, 'p').ok).toBe(false)
    expect(parseClp(0, 'p', 'POSITIVE').ok).toBe(false)
    expect(parseClp(0, 'p').ok).toBe(true)
  })

  it('aritmética entera exacta', () => {
    const a = roundToClp(1000)
    const b = roundToClp(250)
    expect(addClp(a, b)).toBe(1250)
    expect(subClp(b, a)).toBe(-750)
    expect(sumClp([a, b, a])).toBe(2250)
    expect(sumClp([])).toBe(ZERO_CLP)
    expect(multiplyClp(a, 7)).toBe(7000)
    expect(() => multiplyClp(a, 1.5)).toThrow()
    expect(isClp(10)).toBe(true)
    expect(isClp(10.5)).toBe(false)
    expect(isClp('10')).toBe(false)
  })
})

describe('Fraction', () => {
  const fractionCases: [number, 'INCLUSIVE' | 'EXCLUSIVE', boolean][] = [
    [0, 'INCLUSIVE', true],
    [0.35, 'INCLUSIVE', true],
    [1, 'INCLUSIVE', true],
    [1, 'EXCLUSIVE', false],
    [0.9999, 'EXCLUSIVE', true],
    [35, 'INCLUSIVE', false],
    [-0.1, 'INCLUSIVE', false],
  ]
  it.each(fractionCases)('parseFraction(%s, %s) válido = %s', (value, upper, valid) => {
    expect(parseFraction(value, 'm', upper).ok).toBe(valid)
  })

  it('un porcentaje ingresado como fracción da un error con pista', () => {
    const result = parseFraction(60, 'targetMargin')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RANGE')
      expect(result.error.message).toContain('porcentaje')
    }
  })

  it('conversión de frontera porcentaje ↔ fracción', () => {
    const fraction = fractionFromPercent(35, 'm')
    expect(fraction.ok).toBe(true)
    if (fraction.ok) {
      expect(fraction.value).toBe(0.35)
      expect(fractionToPercent(fraction.value)).toBe(35)
    }
    expect(fractionFromPercent(150, 'm').ok).toBe(false)
  })
})

describe('números y unidades', () => {
  it('parseFiniteNumber: tipos, finitud y cotas', () => {
    expect(parseFiniteNumber(undefined, 'p').ok).toBe(false)
    expect(parseFiniteNumber('3', 'p').ok).toBe(false)
    expect(parseFiniteNumber(Number.NaN, 'p').ok).toBe(false)
    expect(parseFiniteNumber(Number.POSITIVE_INFINITY, 'p').ok).toBe(false)
    expect(parseFiniteNumber(-1, 'p').ok).toBe(false)
    expect(parseFiniteNumber(0, 'p', 'POSITIVE').ok).toBe(false)
    const negativeZero = parseFiniteNumber(-0, 'p')
    expect(negativeZero.ok && Object.is(negativeZero.value, 0)).toBe(true)
  })

  it('parseSafeInteger rechaza decimales', () => {
    expect(parseSafeInteger(3, 'p').ok).toBe(true)
    expect(parseSafeInteger(3.2, 'p').ok).toBe(false)
  })

  it('Quantity: entero ≥ 1 con tope', () => {
    expect(parseQuantity(1, 'q').ok).toBe(true)
    expect(parseQuantity(1_000_000, 'q').ok).toBe(true)
    expect(parseQuantity(1_000_001, 'q').ok).toBe(false)
    expect(parseQuantity(0, 'q').ok).toBe(false)
    expect(parseQuantity(2.5, 'q').ok).toBe(false)
  })

  it('Hours, Grams y MoneyAmount con cota positiva', () => {
    expect(parseHours(8, 'h', 'POSITIVE').ok).toBe(true)
    expect(parseHours(0, 'h', 'POSITIVE').ok).toBe(false)
    expect(parseGrams(120.5, 'g', 'POSITIVE').ok).toBe(true)
    expect(parseMoneyAmount(187.5, 'm').ok).toBe(true)
    expect(parseMoneyAmount(-1, 'm').ok).toBe(false)
  })
})

describe('TaxedAmount', () => {
  it('acepta un monto válido', () => {
    expect(parseTaxedAmount({ amount: 15000, basis: 'NET', vatRecoverable: true }, 'p')).toEqual({
      ok: true,
      value: { amount: 15000, basis: 'NET', vatRecoverable: true },
    })
  })

  it('acumula todos los problemas con su ruta', () => {
    const result = parseTaxedAmount({ amount: -5, basis: 'BRUTO', extra: 1 }, 'kwh')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const found = result.error.map((i) => `${i.path}:${i.code}`).sort()
      expect(found).toEqual([
        'kwh.amount:RANGE',
        'kwh.basis:ENUM',
        'kwh.extra:UNKNOWN_KEY',
        'kwh.vatRecoverable:REQUIRED',
      ])
    }
  })
})
