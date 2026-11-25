import { err, ok, type Result } from '../result'
import { childPath, readBoolean, readEnum, readRecord, take, type Issue } from '../validation'
import { parseMoneyAmount, type MoneyAmount } from './units'
import { TaxBasis } from './tax-basis'

/**
 * Monto de compra con su base de IVA. `vatRecoverable` indica si el IVA de este
 * monto es crédito fiscal (no es costo) o si constituye costo real.
 * La regla que lo convierte en costo económico vive en `calculation/v1/tax`.
 */
export interface TaxedAmount {
  readonly amount: MoneyAmount
  readonly basis: TaxBasis
  readonly vatRecoverable: boolean
}

export function parseTaxedAmount(value: unknown, path: string): Result<TaxedAmount, readonly Issue[]> {
  const issues: Issue[] = []
  const record = readRecord(issues, path, value, ['amount', 'basis', 'vatRecoverable'])
  if (record === undefined) return err(issues)
  const amount = take(issues, parseMoneyAmount(record.amount, childPath(path, 'amount')))
  const basis = readEnum(issues, childPath(path, 'basis'), record.basis, TaxBasis)
  const vatRecoverable = readBoolean(issues, childPath(path, 'vatRecoverable'), record.vatRecoverable)
  if (amount === undefined || basis === undefined || vatRecoverable === undefined) return err(issues)
  return ok({ amount, basis, vatRecoverable })
}
