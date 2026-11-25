import type { Result } from '../result'

export const IssueCode = {
  REQUIRED: 'REQUIRED',
  TYPE: 'TYPE',
  NOT_FINITE: 'NOT_FINITE',
  NOT_INTEGER: 'NOT_INTEGER',
  RANGE: 'RANGE',
  ENUM: 'ENUM',
  FORMAT: 'FORMAT',
  EMPTY: 'EMPTY',
  TOO_LONG: 'TOO_LONG',
  TOO_MANY: 'TOO_MANY',
  DUPLICATE: 'DUPLICATE',
  UNKNOWN_KEY: 'UNKNOWN_KEY',
  UNKNOWN_REFERENCE: 'UNKNOWN_REFERENCE',
  INCONSISTENT: 'INCONSISTENT',
} as const

export type IssueCode = (typeof IssueCode)[keyof typeof IssueCode]

/** Problema de validación. La UI traduce por `code`; `message` es para logs y desarrolladores. */
export interface Issue {
  readonly path: string
  readonly code: IssueCode
  readonly message: string
}

export function issue(path: string, code: IssueCode, message: string): Issue {
  return { path, code, message }
}

/** Extrae el valor de un Result; si falla, acumula el problema y devuelve `undefined`. */
export function take<T>(issues: Issue[], result: Result<T, Issue>): T | undefined {
  if (result.ok) return result.value
  issues.push(result.error)
  return undefined
}

/** Igual que `take` para parsers que devuelven varios problemas. */
export function takeMany<T>(issues: Issue[], result: Result<T, readonly Issue[]>): T | undefined {
  if (result.ok) return result.value
  issues.push(...result.error)
  return undefined
}
