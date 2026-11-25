import { err, ok, type Result } from '../../../../core/result'
import { CommissionBase } from '../../contracts/enums'
import type { ChannelValues, CommissionTaxTreatment, TaxProfileValues } from '../../contracts/parameters'
import { decomposePurchase, type CostTaxDecomposition } from './cost-normalization'
import { taxError, type TaxError } from './errors'
import { isRate, isVatEffectivelyRecoverable, purchaseVatRateOf, salesVatRateOf } from './rates'

/** Descomposición de la comisión de una plataforma (decimales exactos). */
export interface CommissionTaxResult {
  /** Comisión sin IVA (lo que la plataforma declara cobrar). */
  readonly feeNet: number
  /** IVA que la plataforma agrega sobre su comisión (0 si no cobra IVA). */
  readonly vatCharged: number
  /** Parte de ese IVA que es crédito fiscal (NO es costo). */
  readonly vatRecoverable: number
  /** Parte de ese IVA que no se recupera (SÍ es costo). */
  readonly vatAsCost: number
  /** Costo económico de la comisión = feeNet + vatAsCost. */
  readonly economicFee: number
  readonly recoverabilityOverriddenByRegime: boolean
}

/**
 * Multiplicador del costo de la comisión por su IVA:
 *  - la plataforma no cobra IVA            → 1
 *  - cobra IVA y es crédito fiscal efectivo → 1  (el IVA no es costo)
 *  - cobra IVA y no es recuperable          → 1 + tasa de compras (el IVA es costo)
 */
export function commissionVatFactor(
  treatment: CommissionTaxTreatment,
  tax: TaxProfileValues,
): Result<number, TaxError> {
  const rate = purchaseVatRateOf(tax)
  if (!rate.ok) return rate
  if (!treatment.vatCharged) return ok(1)
  return ok(isVatEffectivelyRecoverable(tax, treatment.vatRecoverable) ? 1 : 1 + rate.value)
}

/**
 * Tasa económica de la comisión expresada sobre el precio NETO (la que usa la fórmula del margen):
 *   c_eff = c × (base GROSS ? 1 + IVA de venta : 1) × commissionVatFactor
 * El cargo fijo NO está incluido: se trata aparte con `economicFixedFee`.
 */
export function effectiveCommissionRate(channel: ChannelValues, tax: TaxProfileValues): Result<number, TaxError> {
  if (!isRate(channel.commission)) {
    return err(taxError('INVALID_RATE', 'commission', 'Debe ser finita y estar en [0, 1)'))
  }
  const sales = salesVatRateOf(tax)
  if (!sales.ok) return sales
  const factor = commissionVatFactor(channel.commissionTax, tax)
  if (!factor.ok) return factor
  const baseFactor = channel.commissionBase === CommissionBase.GROSS ? 1 + sales.value : 1
  return ok(channel.commission * baseFactor * factor.value)
}

/** Descompone una comisión ya calculada (sin IVA) según el tratamiento de IVA del canal. */
export function decomposeCommission(
  feeNet: number,
  treatment: CommissionTaxTreatment,
  tax: TaxProfileValues,
): Result<CommissionTaxResult, TaxError> {
  if (!Number.isFinite(feeNet) || feeNet < 0) {
    return err(taxError('INVALID_AMOUNT', 'feeNet', 'Debe ser un número finito no negativo'))
  }
  const rate = purchaseVatRateOf(tax)
  if (!rate.ok) return rate
  const vatCharged = treatment.vatCharged ? feeNet * rate.value : 0
  const recoverable = treatment.vatCharged && isVatEffectivelyRecoverable(tax, treatment.vatRecoverable)
  const vatRecoverable = recoverable ? vatCharged : 0
  const vatAsCost = vatCharged - vatRecoverable
  return ok({
    feeNet,
    vatCharged,
    vatRecoverable,
    vatAsCost,
    economicFee: feeNet + vatAsCost,
    recoverabilityOverriddenByRegime: treatment.vatCharged && treatment.vatRecoverable && !recoverable,
  })
}

/** Cargo fijo por transacción: su IVA se trata con su propio `TaxedAmount` (base y recuperabilidad). */
export function economicFixedFee(
  channel: ChannelValues,
  tax: TaxProfileValues,
): Result<CostTaxDecomposition, TaxError> {
  return decomposePurchase(channel.fixedFee, tax)
}
