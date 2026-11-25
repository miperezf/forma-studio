import { parseClp, parseFraction } from '../../../../core/money'
import {
  childPath,
  indexPath,
  isRecord,
  issue,
  ITEM_CODE_PATTERN,
  readArray,
  readEnum,
  readPattern,
  readRecord,
  readString,
  take,
  type Issue,
} from '../../../../core/validation'
import { MAX_OVERRIDES, MAX_REASON_LENGTH } from '../constants'
import { DiscountOverrideMode, FailureOverrideMode, OverrideKind } from '../enums'
import type { OverrideEntry } from '../overrides'
import { readRecoveryConfig } from './cost-spec'
import { readFailureRate, readRoundingStrategy } from './parameters'

const BASE_KEYS = ['kind', 'value', 'reason'] as const

function allowedKeys(kind: OverrideKind): readonly string[] {
  return kind === OverrideKind.ITEM_RECOVERY || kind === OverrideKind.FIXED_LINE_PRICE
    ? [...BASE_KEYS, 'itemCode']
    : BASE_KEYS
}

function readItemCode(issues: Issue[], path: string, value: unknown): string | undefined {
  return readPattern(issues, childPath(path, 'itemCode'), value, ITEM_CODE_PATTERN, 'letras, números, _ . : -')
}

function readOverride(issues: Issue[], path: string, value: unknown): OverrideEntry | undefined {
  if (!isRecord(value)) {
    issues.push(issue(path, value === undefined ? 'REQUIRED' : 'TYPE', 'Debe ser un objeto'))
    return undefined
  }
  const kind = readEnum(issues, childPath(path, 'kind'), value.kind, OverrideKind)
  if (kind === undefined) return undefined
  const record = readRecord(issues, path, value, allowedKeys(kind))
  if (record === undefined) return undefined
  const reason = readString(issues, childPath(path, 'reason'), record.reason, MAX_REASON_LENGTH)
  const valuePath = childPath(path, 'value')

  switch (kind) {
    case OverrideKind.TARGET_MARGIN:
    case OverrideKind.MIN_MARGIN: {
      const margin = take(issues, parseFraction(record.value, valuePath, 'EXCLUSIVE'))
      return reason === undefined || margin === undefined ? undefined : { kind, value: margin, reason }
    }
    case OverrideKind.DISCOUNT: {
      const body = readRecord(issues, valuePath, record.value, ['mode', 'pct'])
      if (body === undefined) return undefined
      const mode = readEnum(issues, childPath(valuePath, 'mode'), body.mode, DiscountOverrideMode)
      if (mode === DiscountOverrideMode.NONE) {
        if (body.pct !== undefined) {
          issues.push(issue(childPath(valuePath, 'pct'), 'INCONSISTENT', 'pct no aplica con mode NONE'))
          return undefined
        }
        return reason === undefined ? undefined : { kind, value: { mode }, reason }
      }
      if (mode === DiscountOverrideMode.MANUAL) {
        const pct = take(issues, parseFraction(body.pct, childPath(valuePath, 'pct'), 'EXCLUSIVE'))
        return reason === undefined || pct === undefined ? undefined : { kind, value: { mode, pct }, reason }
      }
      return undefined
    }
    case OverrideKind.FAILURE_RATE: {
      const body = readRecord(issues, valuePath, record.value, ['mode', 'rate'])
      if (body === undefined) return undefined
      const mode = readEnum(issues, childPath(valuePath, 'mode'), body.mode, FailureOverrideMode)
      if (mode === FailureOverrideMode.DISABLED) {
        if (body.rate !== undefined) {
          issues.push(issue(childPath(valuePath, 'rate'), 'INCONSISTENT', 'rate no aplica con mode DISABLED'))
          return undefined
        }
        return reason === undefined ? undefined : { kind, value: { mode }, reason }
      }
      if (mode === FailureOverrideMode.RATE) {
        const rate = readFailureRate(issues, childPath(valuePath, 'rate'), body.rate)
        return reason === undefined || rate === undefined ? undefined : { kind, value: { mode, rate }, reason }
      }
      return undefined
    }
    case OverrideKind.ROUNDING: {
      const rounding = readRoundingStrategy(issues, valuePath, record.value)
      return reason === undefined || rounding === undefined ? undefined : { kind, value: rounding, reason }
    }
    case OverrideKind.ITEM_RECOVERY: {
      const itemCode = readItemCode(issues, path, record.itemCode)
      const recovery = readRecoveryConfig(issues, valuePath, record.value, undefined)
      return reason === undefined || itemCode === undefined || recovery === undefined
        ? undefined
        : { kind, itemCode, value: recovery, reason }
    }
    case OverrideKind.FIXED_UNIT_PRICE: {
      const body = readRecord(issues, valuePath, record.value, ['customerUnitPrice'])
      const price =
        body === undefined
          ? undefined
          : take(issues, parseClp(body.customerUnitPrice, childPath(valuePath, 'customerUnitPrice'), 'POSITIVE'))
      return reason === undefined || price === undefined
        ? undefined
        : { kind, value: { customerUnitPrice: price }, reason }
    }
    case OverrideKind.FIXED_LINE_PRICE: {
      const itemCode = readItemCode(issues, path, record.itemCode)
      const body = readRecord(issues, valuePath, record.value, ['customerPrice'])
      const price =
        body === undefined
          ? undefined
          : take(issues, parseClp(body.customerPrice, childPath(valuePath, 'customerPrice'), 'POSITIVE'))
      return reason === undefined || itemCode === undefined || price === undefined
        ? undefined
        : { kind, itemCode, value: { customerPrice: price }, reason }
    }
  }
}

export function readOverrides(issues: Issue[], path: string, value: unknown): readonly OverrideEntry[] | undefined {
  const raw = readArray(issues, path, value, { min: 0, max: MAX_OVERRIDES })
  if (raw === undefined) return undefined
  const entries: OverrideEntry[] = []
  raw.forEach((item, index) => {
    const entry = readOverride(issues, indexPath(path, index), item)
    if (entry !== undefined) entries.push(entry)
  })
  const seen = new Set<string>()
  entries.forEach((entry, index) => {
    const key = 'itemCode' in entry ? `${entry.kind}:${entry.itemCode}` : entry.kind
    if (seen.has(key)) {
      issues.push(issue(indexPath(path, index), 'DUPLICATE', `Override repetido: ${key}`))
    }
    seen.add(key)
  })
  return entries.length === raw.length ? entries : undefined
}
