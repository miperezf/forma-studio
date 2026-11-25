export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type Result<T, E> = Ok<T> | Err<E>

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  return result.ok ? result : err(fn(result.error))
}

export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result
}

/**
 * Violación de una invariante interna (error de programación, no de datos de
 * entrada). Los datos externos se validan antes y devuelven `Result`; esta
 * excepción solo aparece si el código rompe sus propias garantías.
 */
export class InvariantViolation extends Error {
  readonly invariant: string

  constructor(invariant: string, detail: string) {
    super(`${invariant}: ${detail}`)
    this.name = 'InvariantViolation'
    this.invariant = invariant
  }
}
