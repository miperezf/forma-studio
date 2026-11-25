import { err, ok, type Result } from '../../../../core/result'
import { TaxRegime } from '../../contracts/enums'
import type { TaxProfileValues } from '../../contracts/parameters'
import { taxError, type TaxError } from './errors'

/** Una tasa válida es finita y está en [0, 1). */
export function isRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 1
}

/** Tasa del IVA que cobran los proveedores (independiente del régimen propio). */
export function purchaseVatRateOf(tax: TaxProfileValues): Result<number, TaxError> {
  if (!isRate(tax.purchaseVatRate)) {
    return err(taxError('INVALID_RATE', 'purchaseVatRate', 'Debe ser finita y estar en [0, 1)'))
  }
  return ok(tax.purchaseVatRate)
}

/**
 * Tasa del IVA que se COBRA en las ventas: `vatRate` si el régimen es afecto; 0 si no lo es.
 * Un perfil NOT_REGISTERED con `vatRate ≠ 0` es incoherente y se rechaza (no se corrige en silencio).
 */
export function salesVatRateOf(tax: TaxProfileValues): Result<number, TaxError> {
  if (!isRate(tax.vatRate)) {
    return err(taxError('INVALID_RATE', 'vatRate', 'Debe ser finita y estar en [0, 1)'))
  }
  if (tax.regime === TaxRegime.NOT_REGISTERED) {
    if (tax.vatRate !== 0) {
      return err(taxError('INVALID_COMBINATION', 'vatRate', 'Con régimen NOT_REGISTERED la tasa de venta debe ser 0'))
    }
    return ok(0)
  }
  return ok(tax.vatRate)
}

/** Solo un negocio afecto a IVA puede recuperar crédito fiscal. */
export function canRecoverVat(tax: TaxProfileValues): boolean {
  return tax.regime === TaxRegime.VAT_REGISTERED
}

/** El régimen manda sobre el indicador del monto: sin régimen afecto, el IVA nunca es recuperable. */
export function isVatEffectivelyRecoverable(tax: TaxProfileValues, flag: boolean): boolean {
  return canRecoverVat(tax) && flag
}
