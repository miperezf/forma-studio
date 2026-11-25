import { issue } from '../../../../core/validation'
import type { CalculationError } from '../../contracts/errors'
import type { IssueCode } from '../../../../core/validation'
import type { TaxError } from '../tax'

/** Entrada que el motor no puede aceptar (el llamador puede corregirla). */
export function invalidInput(path: string, code: IssueCode, message: string): CalculationError {
  return { code: 'INVALID_INPUT', issues: [issue(path, code, message)] }
}

export function inconsistentSnapshot(detail: string): CalculationError {
  return { code: 'INCONSISTENT_SNAPSHOT', detail }
}

export function missingParameter(path: string): CalculationError {
  return { code: 'MISSING_PARAMETER', path }
}

/** Un error de tax sobre un snapshot ya validado indica datos que eludieron el validador. */
export function fromTaxError(error: TaxError): CalculationError {
  return inconsistentSnapshot(`tax.${error.code}:${error.field}: ${error.detail}`)
}
