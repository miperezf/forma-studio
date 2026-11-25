import type { Brand } from '../types'
import { err, ok, type Result } from '../result'
import { issue, type Issue } from '../validation'
import { PERCENT_SCALE } from './constants'
import { parseFiniteNumber } from './parse-number'

/** Proporción 0–1 (0,35 = 35 %). Nunca un porcentaje: la conversión es explícita y de frontera. */
export type Fraction = Brand<number, 'Fraction'>

export type FractionUpperBound = 'INCLUSIVE' | 'EXCLUSIVE'

export const ZERO_FRACTION = 0 as Fraction

export function parseFraction(
  value: unknown,
  path: string,
  upper: FractionUpperBound = 'INCLUSIVE',
): Result<Fraction, Issue> {
  const parsed = parseFiniteNumber(value, path, 'NON_NEGATIVE')
  if (!parsed.ok) return parsed
  const exceeds = upper === 'EXCLUSIVE' ? parsed.value >= 1 : parsed.value > 1
  if (exceeds) {
    const range = upper === 'EXCLUSIVE' ? '[0, 1)' : '[0, 1]'
    return err(issue(path, 'RANGE', `Debe estar en ${range} (¿se ingresó un porcentaje?)`))
  }
  return ok(parsed.value as Fraction)
}

/** Solo para la frontera de UI. */
export function fractionFromPercent(
  percent: number,
  path: string,
  upper: FractionUpperBound = 'INCLUSIVE',
): Result<Fraction, Issue> {
  return parseFraction(percent / PERCENT_SCALE, path, upper)
}

/** Solo para la frontera de UI. */
export function fractionToPercent(fraction: Fraction): number {
  return fraction * PERCENT_SCALE
}
