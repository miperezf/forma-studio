import { err, ok, type Result } from '../result'
import { issue, type Issue } from '../validation'

export type NumberBound = 'NON_NEGATIVE' | 'POSITIVE'

/** Número finito dentro de la cota. Normaliza -0 a 0. `undefined` es REQUIRED. */
export function parseFiniteNumber(
  value: unknown,
  path: string,
  bound: NumberBound = 'NON_NEGATIVE',
): Result<number, Issue> {
  if (value === undefined) return err(issue(path, 'REQUIRED', 'Campo requerido'))
  if (typeof value !== 'number') return err(issue(path, 'TYPE', 'Debe ser un número'))
  if (!Number.isFinite(value)) return err(issue(path, 'NOT_FINITE', 'Debe ser un número finito'))
  const invalid = bound === 'POSITIVE' ? value <= 0 : value < 0
  if (invalid) {
    return err(
      issue(path, 'RANGE', bound === 'POSITIVE' ? 'Debe ser mayor que 0' : 'No puede ser negativo'),
    )
  }
  return ok(value === 0 ? 0 : value)
}

export function parseSafeInteger(
  value: unknown,
  path: string,
  bound: NumberBound = 'NON_NEGATIVE',
): Result<number, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  if (!parsed.ok) return parsed
  if (!Number.isSafeInteger(parsed.value)) {
    return err(issue(path, 'NOT_INTEGER', 'Debe ser un entero'))
  }
  return parsed
}
