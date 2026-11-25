import { parseTaxedAmount, type TaxedAmount } from '../../../core/money'
import type { Issue } from '../../../core/validation'
import type { ChannelValues, TaxProfileValues } from '../contracts/parameters'
import { readChannel, readTaxProfile } from '../contracts/validate/parameters'

/** Construye un perfil tributario válido pasando por el validador real (nunca por casts). */
export function taxProfile(
  over: {
    regime?: 'VAT_REGISTERED' | 'NOT_REGISTERED'
    vatRate?: number
    purchaseVatRate?: number
    customerPriceMode?: 'NET' | 'GROSS'
  } = {},
): TaxProfileValues {
  const issues: Issue[] = []
  const value = readTaxProfile(issues, 'tax', {
    ref: { id: 'tax-default', revision: 1 },
    regime: over.regime ?? 'VAT_REGISTERED',
    vatRate: over.vatRate ?? (over.regime === 'NOT_REGISTERED' ? 0 : 0.19),
    purchaseVatRate: over.purchaseVatRate ?? 0.19,
    customerPriceMode: over.customerPriceMode ?? 'GROSS',
  })
  if (value === undefined) throw new Error(`perfil tributario de prueba inválido: ${JSON.stringify(issues)}`)
  return value
}

export function taxed(amount: number, basis: 'NET' | 'GROSS', vatRecoverable: boolean): TaxedAmount {
  const parsed = parseTaxedAmount({ amount, basis, vatRecoverable }, 'amount')
  if (!parsed.ok) throw new Error(`monto de prueba inválido: ${JSON.stringify(parsed.error)}`)
  return parsed.value
}

export function channel(
  over: {
    commission?: number
    commissionBase?: 'NET' | 'GROSS'
    vatCharged?: boolean
    vatRecoverable?: boolean
    fixedFee?: { amount: number; basis: 'NET' | 'GROSS'; vatRecoverable: boolean }
  } = {},
): ChannelValues {
  const issues: Issue[] = []
  const value = readChannel(issues, 'channel', {
    ref: { id: 'channel-1', revision: 1 },
    name: 'Canal de prueba',
    kind: 'MARKETPLACE',
    commission: over.commission ?? 0.13,
    fixedFee: over.fixedFee ?? { amount: 0, basis: 'NET', vatRecoverable: true },
    commissionBase: over.commissionBase ?? 'NET',
    commissionTax: { vatCharged: over.vatCharged ?? false, vatRecoverable: over.vatRecoverable ?? false },
  })
  if (value === undefined) throw new Error(`canal de prueba inválido: ${JSON.stringify(issues)}`)
  return value
}
