import { err, ok, type Result } from '../../../../core/result'
import type { MoneyAmount, TaxedAmount } from '../../../../core/money'
import type { CalculationError } from '../../contracts/errors'
import type { LaborKind } from '../../contracts/enums'
import type { CostProfileValues, TaxProfileValues } from '../../contracts/parameters'
import { decomposePurchase, type CostTaxDecomposition } from '../tax'
import { fromTaxError, missingParameter } from './errors'

/** Costo económico e IVA de una compra (envoltorio de tax con errores del motor). */
export function purchase(amount: TaxedAmount, tax: TaxProfileValues): Result<CostTaxDecomposition, CalculationError> {
  const decomposition = decomposePurchase(amount, tax)
  return decomposition.ok ? decomposition : err(fromTaxError(decomposition.error))
}

/** Tarifa de mano de obra: override del servicio > tarifa del tipo > tarifa base del perfil. */
export function laborRate(profile: CostProfileValues, kind: LaborKind, override?: MoneyAmount): number {
  return override ?? profile.labor.rateByKind?.[kind] ?? profile.labor.ratePerHour
}

export function required<T>(value: T | undefined, path: string): Result<T, CalculationError> {
  return value === undefined ? err(missingParameter(path)) : ok(value)
}
