import { describe, expect, it } from 'vitest'
import { andThen, err, InvariantViolation, map, mapErr, ok, type Result } from './index'

const failing = (): Result<number, string> => err('boom')
const succeeding = (n: number): Result<number, string> => ok(n)

describe('Result', () => {
  it('ok y err construyen las dos ramas', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 })
    expect(err('x')).toEqual({ ok: false, error: 'x' })
  })

  it('map transforma solo el éxito', () => {
    expect(map(succeeding(2), (n) => n * 3)).toEqual({ ok: true, value: 6 })
    expect(map(failing(), (n) => n * 3)).toEqual({ ok: false, error: 'boom' })
  })

  it('mapErr transforma solo el error', () => {
    expect(mapErr(failing(), (e) => e.length)).toEqual({ ok: false, error: 4 })
    expect(mapErr(succeeding(1), (e) => e.length)).toEqual({ ok: true, value: 1 })
  })

  it('andThen encadena y corta en el primer error', () => {
    const half = (n: number): Result<number, string> => (n % 2 === 0 ? ok(n / 2) : err('impar'))
    expect(andThen(succeeding(8), half)).toEqual({ ok: true, value: 4 })
    expect(andThen(andThen(succeeding(6), half), half)).toEqual({ ok: false, error: 'impar' })
  })

  it('InvariantViolation conserva la invariante y es un Error', () => {
    const violation = new InvariantViolation('clp.finite', 'NaN')
    expect(violation instanceof Error).toBe(true)
    expect(violation.invariant).toBe('clp.finite')
    expect(violation.message).toBe('clp.finite: NaN')
  })
})
