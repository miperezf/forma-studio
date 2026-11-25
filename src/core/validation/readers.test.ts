import { describe, expect, it } from 'vitest'
import {
  ID_PATTERN,
  readArray,
  readBoolean,
  readEnum,
  readPattern,
  readRecord,
  readString,
  type Issue,
} from './index'

const Colors = { RED: 'RED', BLUE: 'BLUE' } as const

describe('readers', () => {
  it('readRecord rechaza claves desconocidas pero sigue devolviendo el objeto', () => {
    const issues: Issue[] = []
    const record = readRecord(issues, 'a', { x: 1, margen: 60 }, ['x'])
    expect(record).toEqual({ x: 1, margen: 60 })
    expect(issues).toEqual([{ path: 'a.margen', code: 'UNKNOWN_KEY', message: 'Campo no permitido: margen' }])
  })

  const recordCases: [unknown, string][] = [
    [undefined, 'REQUIRED'],
    [null, 'TYPE'],
    [[], 'TYPE'],
    ['texto', 'TYPE'],
  ]
  it.each(recordCases)('readRecord(%s) → %s', (value, code) => {
    const issues: Issue[] = []
    expect(readRecord(issues, 'p', value, [])).toBeUndefined()
    expect(issues[0]?.code).toBe(code)
  })

  it('readArray valida tipo y límites', () => {
    const issues: Issue[] = []
    expect(readArray(issues, 'l', [1, 2], { min: 1, max: 3 })).toEqual([1, 2])
    expect(readArray(issues, 'l', [], { min: 1, max: 3 })).toBeUndefined()
    expect(readArray(issues, 'l', [1, 2, 3, 4], { min: 1, max: 3 })).toBeUndefined()
    expect(readArray(issues, 'l', 'x', { min: 0, max: 3 })).toBeUndefined()
    expect(issues.map((i) => i.code)).toEqual(['EMPTY', 'TOO_MANY', 'TYPE'])
  })

  it('readString recorta espacios y valida vacío y largo', () => {
    const issues: Issue[] = []
    expect(readString(issues, 's', '  hola  ', 10)).toBe('hola')
    expect(readString(issues, 's', '   ', 10)).toBeUndefined()
    expect(readString(issues, 's', '   ', 10, true)).toBe('')
    expect(readString(issues, 's', 'x'.repeat(11), 10)).toBeUndefined()
    expect(readString(issues, 's', 5, 10)).toBeUndefined()
    expect(issues.map((i) => i.code)).toEqual(['EMPTY', 'TOO_LONG', 'TYPE'])
  })

  it('readEnum y readBoolean', () => {
    const issues: Issue[] = []
    expect(readEnum(issues, 'c', 'RED', Colors)).toBe('RED')
    expect(readEnum(issues, 'c', 'GREEN', Colors)).toBeUndefined()
    expect(readBoolean(issues, 'b', true)).toBe(true)
    expect(readBoolean(issues, 'b', 'true')).toBeUndefined()
    expect(issues.map((i) => i.code)).toEqual(['ENUM', 'TYPE'])
  })

  const idCases: [string, boolean][] = [
    ['pla-basic', true],
    ['A1', true],
    ['a.b_c-d', true],
    ['', false],
    ['.oculto', false],
    ['a/b', false],
    ['con espacio', false],
    ['x'.repeat(129), false],
  ]
  it.each(idCases)('ID_PATTERN(%s) = %s', (value, valid) => {
    expect(ID_PATTERN.test(value)).toBe(valid)
    const issues: Issue[] = []
    const read = readPattern(issues, 'id', value, ID_PATTERN, 'id')
    expect(read !== undefined).toBe(valid)
  })
})
