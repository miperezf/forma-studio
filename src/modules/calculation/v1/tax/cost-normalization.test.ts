import { describe, expect, it } from 'vitest'
import { roundToClp } from '../../../../core/money'
import { channel, taxed, taxProfile } from '../../testing/tax-fixtures'
import {
  decomposePurchase,
  economicFixedFee,
  roundCostTax,
  scaleDecomposition,
  sumDecompositions,
  type CostTaxDecomposition,
} from './index'
import type { TaxProfileValues } from '../../contracts/parameters'

function must(result: ReturnType<typeof decomposePurchase>): CostTaxDecomposition {
  if (!result.ok) throw new Error(`se esperaba éxito: ${JSON.stringify(result.error)}`)
  return result.value
}

const REGISTERED = taxProfile()
const NOT_REGISTERED = taxProfile({ regime: 'NOT_REGISTERED' })

interface Expected {
  netBase: number
  vatPaid: number
  vatRecoverable: number
  vatAsCost: number
  economicCost: number
  cashPaid: number
  overridden: boolean
}

type Case = [string, TaxProfileValues, 'NET' | 'GROSS', number, boolean, Expected]

// Tasa de compras 19 %. Valores calculados a mano.
const cases: Case[] = [
  ['afecto · NET · recuperable', REGISTERED, 'NET', 1000, true,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 190, vatAsCost: 0, economicCost: 1000, cashPaid: 1190, overridden: false }],
  ['afecto · NET · NO recuperable', REGISTERED, 'NET', 1000, false,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 0, vatAsCost: 190, economicCost: 1190, cashPaid: 1190, overridden: false }],
  ['afecto · GROSS · recuperable', REGISTERED, 'GROSS', 1190, true,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 190, vatAsCost: 0, economicCost: 1000, cashPaid: 1190, overridden: false }],
  ['afecto · GROSS · NO recuperable', REGISTERED, 'GROSS', 1190, false,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 0, vatAsCost: 190, economicCost: 1190, cashPaid: 1190, overridden: false }],
  ['no afecto · NET · declarado recuperable (el régimen manda)', NOT_REGISTERED, 'NET', 1000, true,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 0, vatAsCost: 190, economicCost: 1190, cashPaid: 1190, overridden: true }],
  ['no afecto · NET · no recuperable', NOT_REGISTERED, 'NET', 1000, false,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 0, vatAsCost: 190, economicCost: 1190, cashPaid: 1190, overridden: false }],
  ['no afecto · GROSS · declarado recuperable (el régimen manda)', NOT_REGISTERED, 'GROSS', 1190, true,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 0, vatAsCost: 190, economicCost: 1190, cashPaid: 1190, overridden: true }],
  ['no afecto · GROSS · no recuperable', NOT_REGISTERED, 'GROSS', 1190, false,
    { netBase: 1000, vatPaid: 190, vatRecoverable: 0, vatAsCost: 190, economicCost: 1190, cashPaid: 1190, overridden: false }],
]

describe('decomposePurchase: costo económico, IVA recuperable e IVA que es costo', () => {
  it.each(cases)('%s', (_name, tax, basis, amount, recoverable, expected) => {
    const d = must(decomposePurchase(taxed(amount, basis, recoverable), tax))
    expect(d.netBase).toBeCloseTo(expected.netBase, 9)
    expect(d.vatPaid).toBeCloseTo(expected.vatPaid, 9)
    expect(d.vatRecoverable).toBeCloseTo(expected.vatRecoverable, 9)
    expect(d.vatAsCost).toBeCloseTo(expected.vatAsCost, 9)
    expect(d.economicCost).toBeCloseTo(expected.economicCost, 9)
    expect(d.cashPaid).toBeCloseTo(expected.cashPaid, 9)
    expect(d.recoverabilityOverriddenByRegime).toBe(expected.overridden)
  })

  it('con otra tasa de compras (21 %) se descompone con esa tasa, no con la de ventas', () => {
    const tax = taxProfile({ vatRate: 0.19, purchaseVatRate: 0.21 })
    const d = must(decomposePurchase(taxed(1210, 'GROSS', true), tax))
    expect(d.netBase).toBeCloseTo(1000, 9)
    expect(d.vatRecoverable).toBeCloseTo(210, 9)
    expect(d.economicCost).toBeCloseTo(1000, 9)
  })

  it('un negocio no afecto igual paga IVA en sus compras (tasa de compras ≠ tasa de ventas 0)', () => {
    const tax = taxProfile({ regime: 'NOT_REGISTERED', vatRate: 0, purchaseVatRate: 0.19 })
    const d = must(decomposePurchase(taxed(1000, 'NET', false), tax))
    expect(d.economicCost).toBeCloseTo(1190, 9)
  })

  it('tasa de compras 0: no hay IVA y el costo es el monto, en cualquier base', () => {
    const tax = taxProfile({ purchaseVatRate: 0 })
    for (const basis of ['NET', 'GROSS'] as const) {
      for (const recoverable of [true, false]) {
        const d = must(decomposePurchase(taxed(777, basis, recoverable), tax))
        expect(d.economicCost).toBe(777)
        expect(d.cashPaid).toBe(777)
        expect(d.vatPaid).toBe(0)
        expect(d.vatRecoverable).toBe(0)
        expect(d.vatAsCost).toBe(0)
      }
    }
  })

  it('monto cero: todo es cero (y cero es un monto válido)', () => {
    for (const basis of ['NET', 'GROSS'] as const) {
      const d = must(decomposePurchase(taxed(0, basis, true), REGISTERED))
      expect(d).toEqual({
        netBase: 0, vatPaid: 0, vatRecoverable: 0, vatAsCost: 0, economicCost: 0, cashPaid: 0,
        recoverabilityOverriddenByRegime: false,
      })
    }
  })

  it('monto decimal (precio del kWh) y monto muy grande', () => {
    const kwh = must(decomposePurchase(taxed(187.5, 'NET', true), REGISTERED))
    expect(kwh.economicCost).toBe(187.5)
    expect(kwh.vatRecoverable).toBeCloseTo(35.625, 9)
    const big = must(decomposePurchase(taxed(1_000_000_000_000, 'GROSS', true), REGISTERED))
    expect(big.economicCost).toBeCloseTo(840_336_134_453.78, 1)
  })

  it('el costo económico NO incluye el IVA recuperable y el IVA recuperable NO se suma al costo', () => {
    const recoverable = must(decomposePurchase(taxed(1190, 'GROSS', true), REGISTERED))
    const notRecoverable = must(decomposePurchase(taxed(1190, 'GROSS', false), REGISTERED))
    expect(recoverable.economicCost).toBeLessThan(notRecoverable.economicCost)
    expect(notRecoverable.economicCost - recoverable.economicCost).toBeCloseTo(recoverable.vatRecoverable, 9)
    // mismo desembolso en ambos casos
    expect(recoverable.cashPaid).toBe(notRecoverable.cashPaid)
  })

  describe('entradas inválidas', () => {
    const amountCases: [string, number][] = [
      ['negativo', -1],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
    ]
    it.each(amountCases)('monto %s → INVALID_AMOUNT', (_name, value) => {
      const result = decomposePurchase({ amount: value, basis: 'NET', vatRecoverable: true } as never, REGISTERED)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_AMOUNT')
    })

    const rateCases: [string, number][] = [
      ['negativa', -0.1],
      ['igual a 1', 1],
      ['como porcentaje (19)', 19],
      ['NaN', Number.NaN],
    ]
    it.each(rateCases)('tasa de compras %s → INVALID_RATE', (_name, rate) => {
      const tax = { ...REGISTERED, purchaseVatRate: rate } as unknown as TaxProfileValues
      const result = decomposePurchase(taxed(1000, 'NET', true), tax)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_RATE')
        expect(result.error.field).toBe('purchaseVatRate')
      }
    })

    it('base desconocida → INVALID_COMBINATION', () => {
      const result = decomposePurchase({ amount: 1000, basis: 'BRUTO', vatRecoverable: true } as never, REGISTERED)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_COMBINATION')
    })
  })

  it('es determinista', () => {
    const a = decomposePurchase(taxed(1234.56, 'GROSS', true), REGISTERED)
    const b = decomposePurchase(taxed(1234.56, 'GROSS', true), REGISTERED)
    expect(a).toEqual(b)
  })
})

describe('equivalencia NET ↔ GROSS', () => {
  it('el mismo desembolso expresado neto o bruto da el mismo costo económico y el mismo IVA', () => {
    for (const rate of [0, 0.05, 0.19, 0.21]) {
      for (const amount of [1, 99.5, 1000, 123_456.78]) {
        for (const recoverable of [true, false]) {
          for (const tax of [taxProfile({ purchaseVatRate: rate }), taxProfile({ regime: 'NOT_REGISTERED', purchaseVatRate: rate })]) {
            const net = must(decomposePurchase(taxed(amount, 'NET', recoverable), tax))
            const gross = must(decomposePurchase(taxed(amount * (1 + rate), 'GROSS', recoverable), tax))
            for (const field of ['netBase', 'vatPaid', 'vatRecoverable', 'vatAsCost', 'economicCost', 'cashPaid'] as const) {
              expect(Math.abs(net[field] - gross[field])).toBeLessThan(1e-6)
            }
          }
        }
      }
    }
  })
})

describe('scaleDecomposition y sumDecompositions', () => {
  const base = must(decomposePurchase(taxed(1000, 'NET', true), REGISTERED))

  it('escala todos los importes y conserva las identidades', () => {
    const scaled = scaleDecomposition(base, 3)
    expect(scaled.ok).toBe(true)
    if (!scaled.ok) return
    expect(scaled.value.economicCost).toBeCloseTo(3000, 9)
    expect(scaled.value.vatRecoverable).toBeCloseTo(570, 9)
    expect(scaled.value.cashPaid).toBeCloseTo(3570, 9)
    expect(scaled.value.economicCost + scaled.value.vatRecoverable).toBeCloseTo(scaled.value.cashPaid, 9)
  })

  it('factor 0 es válido; negativo y no finito se rechazan', () => {
    const zero = scaleDecomposition(base, 0)
    expect(zero.ok && zero.value.economicCost === 0).toBe(true)
    for (const factor of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = scaleDecomposition(base, factor)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_AMOUNT')
    }
  })

  it('suma varias compras (lista vacía = todo cero) y propaga la marca de régimen', () => {
    const second = must(decomposePurchase(taxed(1190, 'GROSS', false), REGISTERED))
    const overridden = must(decomposePurchase(taxed(500, 'NET', true), NOT_REGISTERED))
    const total = sumDecompositions([base, second])
    expect(total.economicCost).toBeCloseTo(1000 + 1190, 9)
    expect(total.vatRecoverable).toBeCloseTo(190, 9)
    expect(total.vatAsCost).toBeCloseTo(190, 9)
    expect(total.recoverabilityOverriddenByRegime).toBe(false)
    expect(sumDecompositions([base, overridden]).recoverabilityOverriddenByRegime).toBe(true)
    expect(sumDecompositions([]).economicCost).toBe(0)
  })
})

describe('roundCostTax: CLP enteros con identidades exactas', () => {
  const rounded = (amount: number, basis: 'NET' | 'GROSS', recoverable: boolean, tax = REGISTERED) =>
    roundCostTax(must(decomposePurchase(taxed(amount, basis, recoverable), tax)))

  it('bruto recuperable: costo = neto redondeado; crédito = IVA redondeado; desembolso = bruto', () => {
    const r = rounded(1000, 'GROSS', true)
    expect(r.economicCost).toBe(840) // 840,336…
    expect(r.vatRecoverable).toBe(160) // 159,663…
    expect(r.netBase).toBe(840)
    expect(r.vatAsCost).toBe(0)
    expect(r.vatPaid).toBe(160)
    expect(r.cashPaid).toBe(1000)
  })

  it('bruto NO recuperable: todo el desembolso es costo', () => {
    const r = rounded(1000, 'GROSS', false)
    expect(r.economicCost).toBe(1000)
    expect(r.vatRecoverable).toBe(0)
    expect(r.netBase).toBe(840)
    expect(r.vatAsCost).toBe(160)
    expect(r.cashPaid).toBe(1000)
  })

  it('mitades se redondean alejándose de cero (política única)', () => {
    const r = rounded(187.5, 'NET', true)
    expect(r.economicCost).toBe(188) // 187,5
    expect(r.vatRecoverable).toBe(36) // 35,625
  })

  it('las identidades se cumplen exactamente para montos con decimales', () => {
    for (const amount of [0, 0.4, 0.5, 1.49, 33.33, 187.5, 999.99, 12345.67]) {
      for (const basis of ['NET', 'GROSS'] as const) {
        for (const recoverable of [true, false]) {
          const r = rounded(amount, basis, recoverable)
          expect(r.netBase + r.vatAsCost).toBe(r.economicCost)
          expect(r.vatRecoverable + r.vatAsCost).toBe(r.vatPaid)
          expect(r.economicCost + r.vatRecoverable).toBe(r.cashPaid)
          expect(r.vatAsCost).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('el costo redondeado coincide con roundToClp del costo exacto (igual que CostItem.amount)', () => {
    const d = must(decomposePurchase(taxed(777.77, 'GROSS', true), REGISTERED))
    expect(roundCostTax(d).economicCost).toBe(roundToClp(d.economicCost))
  })
})

describe('cargo fijo del canal', () => {
  it('usa su propio TaxedAmount (base y recuperabilidad)', () => {
    const ch = channel({ fixedFee: { amount: 119, basis: 'GROSS', vatRecoverable: true } })
    const d = must(economicFixedFee(ch, REGISTERED))
    expect(d.economicCost).toBeCloseTo(100, 9)
    expect(d.vatRecoverable).toBeCloseTo(19, 9)
    const nonRec = must(economicFixedFee(channel({ fixedFee: { amount: 119, basis: 'GROSS', vatRecoverable: false } }), REGISTERED))
    expect(nonRec.economicCost).toBeCloseTo(119, 9)
  })
})
