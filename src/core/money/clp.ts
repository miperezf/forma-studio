import type { Brand } from '../types'
import { InvariantViolation, ok, type Result } from '../result'
import type { Issue } from '../validation'
import { HALF, ROUNDING_EPSILON } from './constants'
import { parseSafeInteger, type NumberBound } from './parse-number'

/** Pesos chilenos como entero. Es el único tipo para montos finales. */
export type Clp = Brand<number, 'Clp'>

export const ZERO_CLP = 0 as Clp

/** Política única de redondeo: mitad se aleja de cero (2,5 → 3; −2,5 → −3). */
export function roundHalfAwayFromZero(value: number): number {
  const sign = value < 0 ? -1 : 1
  const rounded = sign * Math.floor(Math.abs(value) + HALF + ROUNDING_EPSILON)
  return rounded === 0 ? 0 : rounded
}

/**
 * Convierte un cálculo intermedio a CLP entero con la política única.
 * Un valor no finito es un error de programación: lanza `InvariantViolation`.
 */
export function roundToClp(value: number): Clp {
  if (!Number.isFinite(value)) {
    throw new InvariantViolation('clp.finite', `valor no finito: ${String(value)}`)
  }
  const rounded = roundHalfAwayFromZero(value)
  if (!Number.isSafeInteger(rounded)) {
    throw new InvariantViolation('clp.safe-integer', `fuera de rango seguro: ${String(rounded)}`)
  }
  return rounded as Clp
}

/** Para datos de entrada: debe venir ya entero. No redondea en silencio. */
export function parseClp(
  value: unknown,
  path: string,
  bound: NumberBound = 'NON_NEGATIVE',
): Result<Clp, Issue> {
  const parsed = parseSafeInteger(value, path, bound)
  if (!parsed.ok) return parsed
  return ok(parsed.value as Clp)
}

export function isClp(value: unknown): value is Clp {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function checked(value: number, op: string): Clp {
  if (!Number.isSafeInteger(value)) {
    throw new InvariantViolation('clp.safe-integer', `${op} produjo ${String(value)}`)
  }
  return (value === 0 ? 0 : value) as Clp
}

export function addClp(a: Clp, b: Clp): Clp {
  return checked(a + b, 'addClp')
}

export function subClp(a: Clp, b: Clp): Clp {
  return checked(a - b, 'subClp')
}

export function sumClp(values: readonly Clp[]): Clp {
  return values.reduce<Clp>((acc, value) => addClp(acc, value), ZERO_CLP)
}

/** Multiplica por un entero (p. ej. precio unitario × cantidad). */
export function multiplyClp(a: Clp, factor: number): Clp {
  if (!Number.isSafeInteger(factor)) {
    throw new InvariantViolation('clp.factor', `el factor debe ser entero: ${String(factor)}`)
  }
  return checked(a * factor, 'multiplyClp')
}
