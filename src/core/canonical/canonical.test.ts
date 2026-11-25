import { describe, expect, it } from 'vitest'
import { canonicalize } from './index'

/** Generador pseudoaleatorio con semilla fija (tests reproducibles, sin dependencias). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = copy[i] as T
    copy[i] = copy[j] as T
    copy[j] = a
  }
  return copy
}

function buildObject(entries: readonly (readonly [string, unknown])[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of entries) result[key] = value
  return result
}

describe('canonicalize', () => {
  it('ordena claves y no deja espacios', () => {
    expect(canonicalize({ b: 1, a: { d: true, c: null }, e: [3, 'x'] })).toEqual({
      ok: true,
      value: '{"a":{"c":null,"d":true},"b":1,"e":[3,"x"]}',
    })
  })

  it('el orden de inserción de las claves no cambia el resultado (propiedad, 200 casos)', () => {
    const random = seededRandom(20261008)
    const entries: [string, unknown][] = [
      ['quantity', 10],
      ['batches', 1],
      ['channelId', 'direct'],
      ['nested', { z: 1, y: [1, 2, { k: 'v', a: 0 }], x: null }],
      ['flag', false],
      ['label', 'Placa ñandú'],
    ]
    const reference = canonicalize(buildObject(entries))
    expect(reference.ok).toBe(true)
    for (let i = 0; i < 200; i += 1) {
      const attempt = canonicalize(buildObject(shuffled(entries, random)))
      expect(attempt).toEqual(reference)
    }
  })

  it('normaliza -0 a 0 y omite claves undefined', () => {
    expect(canonicalize({ a: -0, b: undefined, c: 1 })).toEqual({ ok: true, value: '{"a":0,"c":1}' })
  })

  it('serializa números con la representación estándar de JSON', () => {
    expect(canonicalize([0.35, 1e21, 25000, -1.5])).toEqual({ ok: true, value: '[0.35,1e+21,25000,-1.5]' })
  })

  it('escapa texto con comillas y caracteres de control', () => {
    expect(canonicalize({ t: 'a"b\n' })).toEqual({ ok: true, value: '{"t":"a\\"b\\n"}' })
  })

  const failures: [string, unknown, string, string][] = [
    ['NaN', { a: Number.NaN }, 'NON_FINITE_NUMBER', 'a'],
    ['Infinity', [Number.POSITIVE_INFINITY], 'NON_FINITE_NUMBER', '[0]'],
    ['undefined en lista', [1, undefined], 'UNDEFINED_IN_ARRAY', '[1]'],
    ['undefined raíz', undefined, 'UNSUPPORTED_VALUE', ''],
    ['función', { f: () => 1 }, 'UNSUPPORTED_VALUE', 'f'],
    ['bigint', { n: 10n }, 'UNSUPPORTED_VALUE', 'n'],
    ['Date', { d: new Date(0) }, 'NON_PLAIN_OBJECT', 'd'],
    ['Map', { m: new Map() }, 'NON_PLAIN_OBJECT', 'm'],
  ]
  it.each(failures)('rechaza %s', (_name, value, code, path) => {
    expect(canonicalize(value)).toEqual({ ok: false, error: { code, path } })
  })

  it('un ciclo termina con TOO_DEEP en vez de colgarse', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const result = canonicalize(cyclic)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOO_DEEP')
  })

  it('es determinista entre invocaciones', () => {
    const value = { a: [1, { b: 2 }], c: 'x' }
    expect(canonicalize(value)).toEqual(canonicalize(value))
  })
})
