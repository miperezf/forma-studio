import type { Brand } from '../types'
import { err, ok, type Result } from '../result'
import { issue, type Issue } from '../validation'
import { MAX_QUANTITY } from './constants'
import { parseFiniteNumber, parseSafeInteger, type NumberBound } from './parse-number'

export type Hours = Brand<number, 'Hours'>
export type Minutes = Brand<number, 'Minutes'>
export type Grams = Brand<number, 'Grams'>
export type Watts = Brand<number, 'Watts'>
/** Razón adimensional no negativa (p. ej. horas de supervisión por hora de impresión). */
export type Ratio = Brand<number, 'Ratio'>
/** Monto decimal en CLP sin redondear (parámetros como precio del kWh). No es un `Clp`. */
export type MoneyAmount = Brand<number, 'MoneyAmount'>
/** Entero ≥ 1. */
export type Quantity = Brand<number, 'Quantity'>

export function parseHours(value: unknown, path: string, bound?: NumberBound): Result<Hours, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  return parsed.ok ? ok(parsed.value as Hours) : parsed
}

export function parseMinutes(value: unknown, path: string, bound?: NumberBound): Result<Minutes, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  return parsed.ok ? ok(parsed.value as Minutes) : parsed
}

export function parseGrams(value: unknown, path: string, bound?: NumberBound): Result<Grams, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  return parsed.ok ? ok(parsed.value as Grams) : parsed
}

export function parseWatts(value: unknown, path: string, bound?: NumberBound): Result<Watts, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  return parsed.ok ? ok(parsed.value as Watts) : parsed
}

export function parseRatio(value: unknown, path: string, bound?: NumberBound): Result<Ratio, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  return parsed.ok ? ok(parsed.value as Ratio) : parsed
}

export function parseMoneyAmount(
  value: unknown,
  path: string,
  bound?: NumberBound,
): Result<MoneyAmount, Issue> {
  const parsed = parseFiniteNumber(value, path, bound)
  return parsed.ok ? ok(parsed.value as MoneyAmount) : parsed
}

export function parseQuantity(value: unknown, path: string): Result<Quantity, Issue> {
  const parsed = parseSafeInteger(value, path, 'POSITIVE')
  if (!parsed.ok) return parsed
  if (parsed.value > MAX_QUANTITY) {
    return err(issue(path, 'RANGE', `Máximo ${String(MAX_QUANTITY)}`))
  }
  return ok(parsed.value as Quantity)
}
