import type { Brand } from '../types'
import { err, ok, type Result } from '../result'
import { issue, type Issue } from '../validation'
import {
  DAYS_IN_MONTH,
  FEBRUARY_INDEX,
  HOURS_PER_DAY,
  ISO_DATE_TIME_PATTERN,
  LEAP_AGAIN_EVERY,
  LEAP_DAY_COUNT,
  LEAP_EVERY,
  MILLIS_DIGITS,
  MINUTES_PER_HOUR,
  MONTHS_PER_YEAR,
  NOT_LEAP_EVERY,
  SECONDS_PER_MINUTE,
} from './constants'

/**
 * Instante en UTC con formato canónico `AAAA-MM-DDTHH:mm:ss.sssZ`.
 * Al tener siempre la misma forma, la comparación de texto equivale a la cronológica.
 */
export type IsoDateTime = Brand<string, 'IsoDateTime'>

function isLeapYear(year: number): boolean {
  if (year % LEAP_AGAIN_EVERY === 0) return true
  if (year % NOT_LEAP_EVERY === 0) return false
  return year % LEAP_EVERY === 0
}

function daysInMonth(year: number, month: number): number {
  if (month - 1 === FEBRUARY_INDEX && isLeapYear(year)) return LEAP_DAY_COUNT
  return DAYS_IN_MONTH[month - 1] ?? 0
}

export function parseIsoDateTime(value: unknown, path: string): Result<IsoDateTime, Issue> {
  if (value === undefined) return err(issue(path, 'REQUIRED', 'Campo requerido'))
  if (typeof value !== 'string') return err(issue(path, 'TYPE', 'Debe ser texto'))
  const match = ISO_DATE_TIME_PATTERN.exec(value)
  if (match === null) {
    return err(issue(path, 'FORMAT', 'Formato esperado: AAAA-MM-DDTHH:mm:ss[.sss]Z (UTC)'))
  }
  const [, y, mo, d, h, mi, s, fraction] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = Number(h)
  const minute = Number(mi)
  const second = Number(s)
  const valid =
    month >= 1 &&
    month <= MONTHS_PER_YEAR &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour < HOURS_PER_DAY &&
    minute < MINUTES_PER_HOUR &&
    second < SECONDS_PER_MINUTE
  if (!valid) return err(issue(path, 'RANGE', 'Fecha u hora inexistente'))
  const millis = (fraction ?? '').padEnd(MILLIS_DIGITS, '0')
  return ok(`${y}-${mo}-${d}T${h}:${mi}:${s}.${millis}Z` as IsoDateTime)
}

export function compareIsoDateTime(a: IsoDateTime, b: IsoDateTime): -1 | 0 | 1 {
  if (a === b) return 0
  return a < b ? -1 : 1
}
