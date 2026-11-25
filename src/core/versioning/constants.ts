/** Fecha-hora ISO 8601 en UTC: AAAA-MM-DDTHH:mm:ss[.s{1,3}]Z */
export const ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/

export const MONTHS_PER_YEAR = 12
export const HOURS_PER_DAY = 24
export const MINUTES_PER_HOUR = 60
export const SECONDS_PER_MINUTE = 60
export const MILLIS_DIGITS = 3

/** Días por mes en año no bisiesto (índice 0 = enero). */
export const DAYS_IN_MONTH: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
export const FEBRUARY_INDEX = 1
export const LEAP_DAY_COUNT = 29

export const LEAP_EVERY = 4
export const NOT_LEAP_EVERY = 100
export const LEAP_AGAIN_EVERY = 400
