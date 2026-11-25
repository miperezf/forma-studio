import { describe, expect, it } from 'vitest'
import { channel, taxProfile } from '../../testing/tax-fixtures'
import type { ChannelValues, TaxProfileValues } from '../../contracts/parameters'
import {
  commissionVatFactor,
  decomposeCommission,
  effectiveCommissionRate,
  type CommissionTaxResult,
} from './index'

const REGISTERED = taxProfile()
const NOT_REGISTERED = taxProfile({ regime: 'NOT_REGISTERED' })

function rate(ch: ChannelValues, tax: TaxProfileValues): number {
  const result = effectiveCommissionRate(ch, tax)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

function fee(feeNet: number, treatment: { vatCharged: boolean; vatRecoverable: boolean }, tax: TaxProfileValues): CommissionTaxResult {
  const result = decomposeCommission(feeNet, treatment, tax)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('commissionVatFactor', () => {
  type Case = [string, TaxProfileValues, boolean, boolean, number]
  const cases: Case[] = [
    ['sin IVA en la comisión', REGISTERED, false, false, 1],
    ['sin IVA (aunque se declare recuperable)', REGISTERED, false, true, 1],
    ['con IVA recuperable (afecto): el IVA no es costo', REGISTERED, true, true, 1],
    ['con IVA NO recuperable (afecto): el IVA es costo', REGISTERED, true, false, 1.19],
    ['con IVA declarado recuperable pero régimen no afecto: es costo', NOT_REGISTERED, true, true, 1.19],
    ['con IVA no recuperable, no afecto', NOT_REGISTERED, true, false, 1.19],
    ['sin IVA, no afecto', NOT_REGISTERED, false, false, 1],
  ]
  it.each(cases)('%s', (_name, tax, vatCharged, vatRecoverable, expected) => {
    const result = commissionVatFactor({ vatCharged, vatRecoverable }, tax)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBeCloseTo(expected, 12)
  })

  it('usa la tasa de compras, no la de ventas', () => {
    const tax = taxProfile({ vatRate: 0.19, purchaseVatRate: 0.21 })
    const result = commissionVatFactor({ vatCharged: true, vatRecoverable: false }, tax)
    expect(result.ok && Math.abs(result.value - 1.21) < 1e-12).toBe(true)
  })
})

describe('effectiveCommissionRate (sobre el precio neto)', () => {
  type Case = [string, ChannelValues, TaxProfileValues, number]
  const cases: Case[] = [
    ['13 % sobre neto, sin IVA', channel({ commission: 0.13 }), REGISTERED, 0.13],
    ['13 % sobre BRUTO, sin IVA: ×1,19', channel({ commission: 0.13, commissionBase: 'GROSS' }), REGISTERED, 0.1547],
    ['13 % sobre neto, IVA no recuperable: ×1,19', channel({ commission: 0.13, vatCharged: true, vatRecoverable: false }), REGISTERED, 0.1547],
    ['13 % sobre neto, IVA recuperable: sin efecto', channel({ commission: 0.13, vatCharged: true, vatRecoverable: true }), REGISTERED, 0.13],
    ['13 % sobre bruto con IVA no recuperable: ×1,19 ×1,19', channel({ commission: 0.13, commissionBase: 'GROSS', vatCharged: true, vatRecoverable: false }), REGISTERED, 0.184093],
    ['13 % sobre bruto con IVA recuperable: solo la base', channel({ commission: 0.13, commissionBase: 'GROSS', vatCharged: true, vatRecoverable: true }), REGISTERED, 0.1547],
    ['no afecto: la base bruta no agrega IVA de venta (se vende sin IVA)', channel({ commission: 0.13, commissionBase: 'GROSS' }), NOT_REGISTERED, 0.13],
    ['no afecto con IVA en la comisión (es costo)', channel({ commission: 0.13, vatCharged: true, vatRecoverable: true }), NOT_REGISTERED, 0.1547],
    ['comisión 0', channel({ commission: 0, commissionBase: 'GROSS', vatCharged: true }), REGISTERED, 0],
  ]
  it.each(cases)('%s', (_name, ch, tax, expected) => {
    expect(rate(ch, tax)).toBeCloseTo(expected, 12)
  })

  it('la tasa de venta de un perfil afecto se aplica a la base bruta (21 %)', () => {
    const tax = taxProfile({ vatRate: 0.21 })
    expect(rate(channel({ commission: 0.1, commissionBase: 'GROSS' }), tax)).toBeCloseTo(0.121, 12)
  })

  it('comisión inválida y perfil incoherente se rechazan', () => {
    for (const commission of [-0.1, 1, 13, Number.NaN]) {
      const bad = { ...channel(), commission } as unknown as ChannelValues
      const result = effectiveCommissionRate(bad, REGISTERED)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_RATE')
    }
    const incoherent = { ...NOT_REGISTERED, vatRate: 0.19 } as unknown as TaxProfileValues
    const result = effectiveCommissionRate(channel(), incoherent)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_COMBINATION')
  })
})

describe('decomposeCommission', () => {
  it('sin IVA: el costo económico es la comisión', () => {
    const d = fee(3000, { vatCharged: false, vatRecoverable: false }, REGISTERED)
    expect(d).toEqual({ feeNet: 3000, vatCharged: 0, vatRecoverable: 0, vatAsCost: 0, economicFee: 3000, recoverabilityOverriddenByRegime: false })
  })

  it('con IVA recuperable (afecto): el IVA es crédito fiscal y NO es costo', () => {
    const d = fee(3000, { vatCharged: true, vatRecoverable: true }, REGISTERED)
    expect(d.vatCharged).toBeCloseTo(570, 9)
    expect(d.vatRecoverable).toBeCloseTo(570, 9)
    expect(d.vatAsCost).toBe(0)
    expect(d.economicFee).toBe(3000)
  })

  it('con IVA no recuperable: el IVA SÍ es costo', () => {
    const d = fee(3000, { vatCharged: true, vatRecoverable: false }, REGISTERED)
    expect(d.vatRecoverable).toBe(0)
    expect(d.vatAsCost).toBeCloseTo(570, 9)
    expect(d.economicFee).toBeCloseTo(3570, 9)
  })

  it('régimen no afecto: lo declarado recuperable no se recupera (se marca)', () => {
    const d = fee(3000, { vatCharged: true, vatRecoverable: true }, NOT_REGISTERED)
    expect(d.vatRecoverable).toBe(0)
    expect(d.economicFee).toBeCloseTo(3570, 9)
    expect(d.recoverabilityOverriddenByRegime).toBe(true)
    expect(fee(3000, { vatCharged: false, vatRecoverable: true }, NOT_REGISTERED).recoverabilityOverriddenByRegime).toBe(false)
  })

  it('la tasa efectiva coincide con la descomposición: feeNet × factor = costo económico', () => {
    for (const treatment of [
      { vatCharged: false, vatRecoverable: false },
      { vatCharged: true, vatRecoverable: true },
      { vatCharged: true, vatRecoverable: false },
    ]) {
      for (const tax of [REGISTERED, NOT_REGISTERED]) {
        const factor = commissionVatFactor(treatment, tax)
        expect(factor.ok).toBe(true)
        if (factor.ok) expect(fee(1234, treatment, tax).economicFee).toBeCloseTo(1234 * factor.value, 9)
      }
    }
  })

  it('comisión cero es válida; negativa o no finita se rechaza', () => {
    expect(fee(0, { vatCharged: true, vatRecoverable: false }, REGISTERED).economicFee).toBe(0)
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = decomposeCommission(bad, { vatCharged: true, vatRecoverable: false }, REGISTERED)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.code).toBe('INVALID_AMOUNT')
    }
    const badTax = { ...REGISTERED, purchaseVatRate: 2 } as unknown as TaxProfileValues
    const result = decomposeCommission(100, { vatCharged: true, vatRecoverable: false }, badTax)
    expect(result.ok).toBe(false)
  })
})
