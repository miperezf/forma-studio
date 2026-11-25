import { err, ok, type Result } from '../../../../core/result'
import { roundToClp, TaxBasis, type Clp, type TaxedAmount } from '../../../../core/money'
import type { TaxProfileValues } from '../../contracts/parameters'
import { taxError, type TaxError } from './errors'
import { isVatEffectivelyRecoverable, purchaseVatRateOf } from './rates'

/**
 * Descomposición de una COMPRA (valores decimales exactos, sin redondear).
 *
 *  - `netBase`:        importe sin IVA.
 *  - `vatPaid`:        IVA pagado al proveedor (= netBase × tasa de compras).
 *  - `vatRecoverable`: parte del IVA pagado que es crédito fiscal (NO es costo).
 *  - `vatAsCost`:      parte del IVA pagado que no se recupera (SÍ es costo real).
 *  - `economicCost`:   costo económico = netBase + vatAsCost.
 *  - `cashPaid`:       lo que sale del bolsillo = netBase + vatPaid.
 *
 * Identidades: vatPaid = vatRecoverable + vatAsCost · economicCost + vatRecoverable = cashPaid.
 */
export interface CostTaxDecomposition {
  readonly netBase: number
  readonly vatPaid: number
  readonly vatRecoverable: number
  readonly vatAsCost: number
  readonly economicCost: number
  readonly cashPaid: number
  /** El monto se declaró recuperable pero el régimen no permite crédito fiscal. */
  readonly recoverabilityOverriddenByRegime: boolean
}

function invalidAmount(detail: string): TaxError {
  return taxError('INVALID_AMOUNT', 'amount', detail)
}

/**
 * Convierte un monto de compra (`TaxedAmount`) en su costo económico y su IVA.
 *
 * | basis | recuperable | costo económico | IVA recuperable |
 * |-------|-------------|-----------------|-----------------|
 * | NET   | sí          | a               | a × p           |
 * | NET   | no          | a × (1 + p)     | 0               |
 * | GROSS | sí          | a / (1 + p)     | a − a / (1 + p) |
 * | GROSS | no          | a               | 0               |
 *
 * Con régimen NOT_REGISTERED la columna "recuperable" es siempre "no".
 */
export function decomposePurchase(
  amount: TaxedAmount,
  tax: TaxProfileValues,
): Result<CostTaxDecomposition, TaxError> {
  const value: number = amount.amount
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return err(invalidAmount('Debe ser un número finito no negativo'))
  }
  if (amount.basis !== TaxBasis.NET && amount.basis !== TaxBasis.GROSS) {
    return err(taxError('INVALID_COMBINATION', 'basis', 'La base debe ser NET o GROSS'))
  }
  const rate = purchaseVatRateOf(tax)
  if (!rate.ok) return rate

  const netBase = amount.basis === TaxBasis.NET ? value : value / (1 + rate.value)
  const vatPaid = amount.basis === TaxBasis.NET ? value * rate.value : value - netBase
  const recoverable = isVatEffectivelyRecoverable(tax, amount.vatRecoverable)
  const vatRecoverable = recoverable ? vatPaid : 0
  const vatAsCost = vatPaid - vatRecoverable
  return ok({
    netBase,
    vatPaid,
    vatRecoverable,
    vatAsCost,
    economicCost: netBase + vatAsCost,
    cashPaid: amount.basis === TaxBasis.GROSS ? value : netBase + vatPaid,
    recoverabilityOverriddenByRegime: amount.vatRecoverable && !recoverable,
  })
}

/** Multiplica una descomposición por un factor (p. ej. cantidad de placas). */
export function scaleDecomposition(
  decomposition: CostTaxDecomposition,
  factor: number,
): Result<CostTaxDecomposition, TaxError> {
  if (!Number.isFinite(factor) || factor < 0) {
    return err(taxError('INVALID_AMOUNT', 'factor', 'El factor debe ser finito y no negativo'))
  }
  return ok({
    netBase: decomposition.netBase * factor,
    vatPaid: decomposition.vatPaid * factor,
    vatRecoverable: decomposition.vatRecoverable * factor,
    vatAsCost: decomposition.vatAsCost * factor,
    economicCost: decomposition.economicCost * factor,
    cashPaid: decomposition.cashPaid * factor,
    recoverabilityOverriddenByRegime: decomposition.recoverabilityOverriddenByRegime,
  })
}

export function sumDecompositions(list: readonly CostTaxDecomposition[]): CostTaxDecomposition {
  const total = {
    netBase: 0,
    vatPaid: 0,
    vatRecoverable: 0,
    vatAsCost: 0,
    economicCost: 0,
    cashPaid: 0,
    recoverabilityOverriddenByRegime: false,
  }
  for (const item of list) {
    total.netBase += item.netBase
    total.vatPaid += item.vatPaid
    total.vatRecoverable += item.vatRecoverable
    total.vatAsCost += item.vatAsCost
    total.economicCost += item.economicCost
    total.cashPaid += item.cashPaid
    total.recoverabilityOverriddenByRegime ||= item.recoverabilityOverriddenByRegime
  }
  return total
}

/** Descomposición en CLP enteros. Las identidades se cumplen EXACTAMENTE. */
export interface RoundedCostTax {
  readonly netBase: Clp
  readonly vatAsCost: Clp
  readonly vatRecoverable: Clp
  readonly vatPaid: Clp
  readonly economicCost: Clp
  readonly cashPaid: Clp
}

/**
 * Redondea con la política única, anclando en `economicCost` (igual que `CostItem.amount`) y en
 * `vatRecoverable`; el resto se deriva para que las identidades sean exactas:
 *   netBase + vatAsCost = economicCost · vatRecoverable + vatAsCost = vatPaid · economicCost + vatRecoverable = cashPaid.
 * Cada componente difiere del exacto en a lo más ~1 peso por el redondeo.
 */
export function roundCostTax(decomposition: CostTaxDecomposition): RoundedCostTax {
  const economicCost = roundToClp(decomposition.economicCost)
  const vatRecoverable = roundToClp(decomposition.vatRecoverable)
  const netBaseRounded = roundToClp(decomposition.netBase)
  const netBase = (netBaseRounded > economicCost ? economicCost : netBaseRounded) as Clp
  const vatAsCost = roundToClp(economicCost - netBase)
  return {
    netBase,
    vatAsCost,
    vatRecoverable,
    vatPaid: roundToClp(vatRecoverable + vatAsCost),
    economicCost,
    cashPaid: roundToClp(economicCost + vatRecoverable),
  }
}
