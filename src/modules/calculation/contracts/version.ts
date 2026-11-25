import { err, ok, type Result } from '../../../core/result'
import type { Brand } from '../../../core/types'
import { issue, type Issue } from '../../../core/validation'
import { CALCULATION_VERSION_PATTERN } from './constants'

/** Versión del motor completo (costos + precios + impuestos). Ej.: `v1`. */
export type CalculationVersion = Brand<string, 'CalculationVersion'>

export const CALCULATION_V1 = 'v1' as CalculationVersion
/** v2: placas completas + última placa real (o estimación conservadora marcada). Igual a v1 sin placa incompleta con datos. */
export const CALCULATION_V2 = 'v2' as CalculationVersion

export function parseCalculationVersion(value: unknown, path: string): Result<CalculationVersion, Issue> {
  if (value === undefined) return err(issue(path, 'REQUIRED', 'Campo requerido'))
  if (typeof value !== 'string') return err(issue(path, 'TYPE', 'Debe ser texto'))
  if (!CALCULATION_VERSION_PATTERN.test(value)) {
    return err(issue(path, 'FORMAT', 'Formato esperado: v1, v2, ...'))
  }
  return ok(value as CalculationVersion)
}
