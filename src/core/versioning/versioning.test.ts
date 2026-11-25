import { describe, expect, it } from 'vitest'
import {
  compareIsoDateTime,
  entityRefKey,
  FIRST_REVISION,
  nextRevision,
  parseEntityRef,
  parseIsoDateTime,
  parseRevision,
  resolveActiveRevision,
  sameEntityRef,
  toEntityRef,
  type IsoDateTime,
  type Revision,
  type VersionMeta,
} from './index'

function iso(value: string): IsoDateTime {
  const parsed = parseIsoDateTime(value, 'd')
  if (!parsed.ok) throw new Error(`fecha inválida en el test: ${value}`)
  return parsed.value
}

function rev(value: number): Revision {
  const parsed = parseRevision(value, 'r')
  if (!parsed.ok) throw new Error('revisión inválida en el test')
  return parsed.value
}

describe('Revision', () => {
  it('es un entero ≥ 1 y avanza de a uno', () => {
    expect(parseRevision(1, 'r').ok).toBe(true)
    expect(parseRevision(0, 'r').ok).toBe(false)
    expect(parseRevision(1.5, 'r').ok).toBe(false)
    expect(nextRevision(FIRST_REVISION)).toBe(2)
  })
})

describe('IsoDateTime', () => {
  const validCases: [string, string][] = [
    ['2026-10-08T12:00:00Z', '2026-10-08T12:00:00.000Z'],
    ['2026-10-08T12:00:00.5Z', '2026-10-08T12:00:00.500Z'],
    ['2026-10-08T12:00:00.123Z', '2026-10-08T12:00:00.123Z'],
    ['2024-02-29T00:00:00Z', '2024-02-29T00:00:00.000Z'],
    ['2000-02-29T23:59:59Z', '2000-02-29T23:59:59.000Z'],
  ]
  it.each(validCases)('acepta y normaliza %s', (input, expected) => {
    expect(parseIsoDateTime(input, 'd')).toEqual({ ok: true, value: expected })
  })

  const invalidCases: [unknown, string][] = [
    ['2026-02-29T00:00:00Z', 'RANGE'],
    ['1900-02-29T00:00:00Z', 'RANGE'],
    ['2026-13-01T00:00:00Z', 'RANGE'],
    ['2026-00-10T00:00:00Z', 'RANGE'],
    ['2026-04-31T00:00:00Z', 'RANGE'],
    ['2026-10-08T24:00:00Z', 'RANGE'],
    ['2026-10-08T12:60:00Z', 'RANGE'],
    ['2026-10-08T12:00:60Z', 'RANGE'],
    ['2026-10-08', 'FORMAT'],
    ['2026-10-08T12:00:00', 'FORMAT'],
    ['2026-10-08T12:00:00-03:00', 'FORMAT'],
    [20261008, 'TYPE'],
    [undefined, 'REQUIRED'],
  ]
  it.each(invalidCases)('rechaza %s → %s', (input, code) => {
    const result = parseIsoDateTime(input, 'd')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe(code)
  })

  it('la comparación de texto equivale a la cronológica (millis normalizados)', () => {
    expect(compareIsoDateTime(iso('2026-01-01T00:00:00Z'), iso('2026-01-01T00:00:00.001Z'))).toBe(-1)
    expect(compareIsoDateTime(iso('2026-01-01T00:00:00.5Z'), iso('2026-01-01T00:00:00.500Z'))).toBe(0)
    expect(compareIsoDateTime(iso('2027-01-01T00:00:00Z'), iso('2026-12-31T23:59:59.999Z'))).toBe(1)
  })
})

describe('EntityRef', () => {
  it('parsea, genera clave y compara', () => {
    const parsed = parseEntityRef({ id: 'pla-basic', revision: 3 }, 'ref')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(entityRefKey(parsed.value)).toBe('pla-basic@3')
      expect(sameEntityRef(parsed.value, { id: 'pla-basic', revision: rev(3) })).toBe(true)
      expect(sameEntityRef(parsed.value, { id: 'pla-basic', revision: rev(4) })).toBe(false)
    }
  })

  it('reporta todos los problemas con su ruta', () => {
    const parsed = parseEntityRef({ id: 'con espacio', revision: 0, x: 1 }, 'ref')
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.error.map((i) => `${i.path}:${i.code}`).sort()).toEqual([
        'ref.id:FORMAT',
        'ref.revision:RANGE',
        'ref.x:UNKNOWN_KEY',
      ])
    }
  })
})

describe('resolveActiveRevision', () => {
  const meta = (revision: number, effectiveFrom: string): VersionMeta => ({
    id: 'cost-default',
    revision: rev(revision),
    effectiveFrom: iso(effectiveFrom),
  })
  const revisions = [meta(1, '2026-01-01T00:00:00Z'), meta(2, '2026-06-01T00:00:00Z'), meta(3, '2026-09-01T00:00:00Z')]

  it('elige la revisión vigente en la fecha pedida', () => {
    expect(resolveActiveRevision(revisions, iso('2026-03-01T00:00:00Z'))?.revision).toBe(1)
    expect(resolveActiveRevision(revisions, iso('2026-06-01T00:00:00Z'))?.revision).toBe(2)
    expect(resolveActiveRevision(revisions, iso('2027-01-01T00:00:00Z'))?.revision).toBe(3)
  })

  it('devuelve undefined si aún no rige ninguna', () => {
    expect(resolveActiveRevision(revisions, iso('2025-12-31T23:59:59Z'))).toBeUndefined()
    expect(resolveActiveRevision([], iso('2026-03-01T00:00:00Z'))).toBeUndefined()
  })

  it('con la misma fecha efectiva gana la mayor revisión, sin depender del orden', () => {
    const tied = [meta(2, '2026-06-01T00:00:00Z'), meta(5, '2026-06-01T00:00:00Z'), meta(3, '2026-06-01T00:00:00Z')]
    expect(resolveActiveRevision(tied, iso('2026-07-01T00:00:00Z'))?.revision).toBe(5)
    expect(resolveActiveRevision([...tied].reverse(), iso('2026-07-01T00:00:00Z'))?.revision).toBe(5)
  })

  it('toEntityRef conserva id y revisión', () => {
    expect(toEntityRef(meta(2, '2026-06-01T00:00:00Z'))).toEqual({ id: 'cost-default', revision: 2 })
  })
})
