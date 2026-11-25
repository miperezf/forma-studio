import { err, ok, type Result } from '../result'
import { MAX_CANONICAL_DEPTH } from './constants'

export type CanonicalErrorCode =
  | 'NON_FINITE_NUMBER'
  | 'UNSUPPORTED_VALUE'
  | 'UNDEFINED_IN_ARRAY'
  | 'NON_PLAIN_OBJECT'
  | 'TOO_DEEP'

export interface CanonicalError {
  readonly code: CanonicalErrorCode
  readonly path: string
}

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function write(value: unknown, path: string, depth: number, out: string[]): CanonicalError | undefined {
  if (depth > MAX_CANONICAL_DEPTH) return { code: 'TOO_DEEP', path }
  if (value === null) {
    out.push('null')
    return undefined
  }
  switch (typeof value) {
    case 'boolean':
      out.push(value ? 'true' : 'false')
      return undefined
    case 'number':
      if (!Number.isFinite(value)) return { code: 'NON_FINITE_NUMBER', path }
      out.push(Object.is(value, -0) ? '0' : JSON.stringify(value))
      return undefined
    case 'string':
      out.push(JSON.stringify(value))
      return undefined
    case 'object':
      break
    default:
      return { code: 'UNSUPPORTED_VALUE', path }
  }

  if (Array.isArray(value)) {
    const items: readonly unknown[] = value
    out.push('[')
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const itemPath = `${path}[${String(index)}]`
      if (item === undefined) return { code: 'UNDEFINED_IN_ARRAY', path: itemPath }
      if (index > 0) out.push(',')
      const failure = write(item, itemPath, depth + 1, out)
      if (failure !== undefined) return failure
    }
    out.push(']')
    return undefined
  }

  if (!isPlainObject(value)) return { code: 'NON_PLAIN_OBJECT', path }
  const record = value as Readonly<Record<string, unknown>>
  out.push('{')
  let first = true
  for (const key of Object.keys(record).sort()) {
    const entry = record[key]
    if (entry === undefined) continue
    if (!first) out.push(',')
    first = false
    out.push(JSON.stringify(key), ':')
    const failure = write(entry, path === '' ? key : `${path}.${key}`, depth + 1, out)
    if (failure !== undefined) return failure
  }
  out.push('}')
  return undefined
}

/**
 * Serialización JSON canónica y determinista: claves ordenadas, sin espacios,
 * `-0` como `0`, claves con `undefined` omitidas. Es la base del `inputsHash`
 * (el hash en sí lo calcula el port `Hasher`, fuera del dominio).
 */
export function canonicalize(value: unknown): Result<string, CanonicalError> {
  const out: string[] = []
  const failure = write(value, '', 0, out)
  return failure === undefined ? ok(out.join('')) : err(failure)
}
