import { describe, expect, it } from 'vitest'
import { seededRandom } from '../../testing/random'
import type { DiscountTier } from '../../contracts/parameters'
import { allocateInteger, allocateProportional, gridStep, resolveVolumeDiscount, roundToGrid } from './index'
import { parseClp, parseFraction, parseQuantity } from '../../../../core/money'

const clpOf = (n: number) => {
  const r = parseClp(n, 'n')
  if (!r.ok) throw new Error('clp inválido')
  return r.value
}
const stepStrategy = (step: number, direction: 'UP' | 'DOWN' | 'NEAREST') => ({ mode: 'STEP' as const, step: clpOf(step), direction, target: 'GROSS' as const })
const NONE = { mode: 'NONE' as const }

describe('redondeo a la grilla comercial', () => {
  const cases: [string, number, number, 'UP' | 'DOWN' | 'NEAREST', number][] = [
    ['UP sube', 25420.23, 100, 'UP', 25500],
    ['DOWN baja', 25420.23, 100, 'DOWN', 25400],
    ['NEAREST al más cercano (abajo)', 25420.23, 100, 'NEAREST', 25400],
    ['NEAREST al más cercano (arriba)', 25460, 100, 'NEAREST', 25500],
    ['NEAREST en la mitad se aleja de cero', 25450, 100, 'NEAREST', 25500],
    ['ya está en la grilla: UP no se mueve', 25500, 100, 'UP', 25500],
    ['ya está en la grilla: DOWN no se mueve', 25500, 100, 'DOWN', 25500],
    ['paso 10', 1234.1, 10, 'UP', 1240],
    ['paso 500', 25420, 500, 'UP', 25500],
    ['paso 1.000', 25420, 1000, 'UP', 26000],
    ['paso 1.000 DOWN', 25999, 1000, 'DOWN', 25000],
    ['cero', 0, 100, 'UP', 0],
    ['menos que un paso, UP', 0.01, 100, 'UP', 100],
    ['menos que un paso, DOWN', 99, 100, 'DOWN', 0],
  ]
  it.each(cases)('%s', (_name, value, step, direction, expected) => {
    expect(roundToGrid(value, stepStrategy(step, direction))).toBe(expected)
  })

  it('el error binario no mueve un precio que ya está sobre la grilla (25.500,000000000004 → 25.500)', () => {
    expect(roundToGrid(25500.000000000004, stepStrategy(100, 'UP'))).toBe(25500)
    expect(roundToGrid(25499.999999999996, stepStrategy(100, 'UP'))).toBe(25500)
    expect(roundToGrid(25499.999999999996, stepStrategy(100, 'DOWN'))).toBe(25500)
    expect(roundToGrid(0.1 + 0.2, stepStrategy(1, 'UP'))).toBe(1)
  })

  it('sin redondeo comercial: al peso más cercano', () => {
    expect(roundToGrid(25420.23, NONE)).toBe(25420)
    expect(roundToGrid(25420.5, NONE)).toBe(25421)
    expect(roundToGrid(0, NONE)).toBe(0)
    expect(gridStep(NONE)).toBe(1)
    expect(gridStep(stepStrategy(500, 'UP'))).toBe(500)
  })

  it('valores fuera de dominio (negativo, NaN, infinito) son defectos internos', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => roundToGrid(value, stepStrategy(100, 'UP'))).toThrow()
    }
  })

  it('propiedades (3.000 casos con semilla): el resultado está en la grilla, UP ≥ valor ≥ DOWN, y NEAREST entre ambos', () => {
    const random = seededRandom(77)
    for (let i = 0; i < 3000; i += 1) {
      const value = random() * 2_000_000
      const step = [1, 10, 100, 500, 1000][Math.floor(random() * 5)] ?? 100
      const up = roundToGrid(value, stepStrategy(step, 'UP'))
      const down = roundToGrid(value, stepStrategy(step, 'DOWN'))
      const nearest = roundToGrid(value, stepStrategy(step, 'NEAREST'))
      for (const result of [up, down, nearest]) expect(result % step).toBe(0)
      // un valor a menos de la tolerancia binaria de la grilla (≈ 0,002 pesos) se considera sobre ella
      expect(up).toBeGreaterThanOrEqual(value - 0.01)
      expect(down).toBeLessThanOrEqual(value + 0.01)
      expect(up - down).toBeLessThanOrEqual(step)
      expect(nearest === up || nearest === down).toBe(true)
      expect(Math.abs(nearest - value)).toBeLessThanOrEqual(step / 2 + 0.01)
    }
  })

  it('es monótono: un valor mayor nunca produce un precio menor', () => {
    for (const direction of ['UP', 'DOWN', 'NEAREST'] as const) {
      let previous = -1
      for (let value = 0; value <= 5000; value += 7) {
        const rounded = roundToGrid(value, stepStrategy(100, direction))
        expect(rounded).toBeGreaterThanOrEqual(previous)
        previous = rounded
      }
    }
  })
})

describe('descuento por volumen por tramos', () => {
  const tier = (minQty: number, maxQty: number | null, discount: number): DiscountTier => {
    const min = parseQuantity(minQty, 'q')
    const max = maxQty === null ? null : parseQuantity(maxQty, 'q')
    const d = parseFraction(discount, 'd', 'EXCLUSIVE')
    if (!min.ok || (max !== null && !max.ok) || !d.ok) throw new Error('tramo inválido')
    return { minQty: min.value, maxQty: max === null ? null : (max as { ok: true; value: typeof min.value }).value, discount: d.value }
  }
  const tiers = [tier(1, 4, 0), tier(5, 9, 0.05), tier(10, 24, 0.08), tier(25, 49, 0.12), tier(50, null, 0.15)]

  const cases: [number, number][] = [
    [1, 0], [4, 0], [5, 0.05], [9, 0.05], [10, 0.08], [24, 0.08], [25, 0.12], [49, 0.12], [50, 0.15], [51, 0.15], [1_000_000, 0.15],
  ]
  it.each(cases)('cantidad %s → descuento %s (límites inclusivos)', (quantity, expected) => {
    expect(resolveVolumeDiscount(quantity, tiers)).toBe(expected)
  })

  it('sin tramos no hay descuento; fuera de todos los tramos tampoco', () => {
    expect(resolveVolumeDiscount(10, [])).toBe(0)
    expect(resolveVolumeDiscount(100, [tier(1, 9, 0.1)])).toBe(0)
  })
})

describe('reparto proporcional', () => {
  it('allocateInteger suma exactamente el total y respeta la proporción (mayor resto)', () => {
    expect(allocateInteger(63025, [25500, 49500])).toEqual([21429, 41596])
    expect(allocateInteger(10, [1, 1, 1])).toEqual([4, 3, 3]) // el resto va al menor índice
    expect(allocateInteger(0, [5, 5])).toEqual([0, 0])
    expect(allocateInteger(7, [0, 5])).toEqual([0, 7])
    expect(allocateInteger(0, [0, 0])).toEqual([0, 0])
  })

  it('con pesos todos 0 y total ≠ 0 es un defecto', () => {
    expect(() => allocateInteger(5, [0, 0])).toThrow()
    expect(() => allocateInteger(-1, [1])).toThrow()
    expect(() => allocateInteger(1.5, [1])).toThrow()
  })

  it('propiedad (2.000 casos): suma exacta, no negativo y cada parte a menos de 1 de su proporción exacta', () => {
    const random = seededRandom(5150)
    for (let i = 0; i < 2000; i += 1) {
      const count = 1 + Math.floor(random() * 5)
      const weights = Array.from({ length: count }, () => Math.floor(random() * 1_000_000))
      if (!weights.some((w) => w > 0)) weights[0] = 1
      const total = Math.floor(random() * 1_000_000_000)
      const parts = allocateInteger(total, weights)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
      const sum = weights.reduce((a, b) => a + b, 0)
      parts.forEach((part, index) => {
        expect(part).toBeGreaterThanOrEqual(0)
        expect(Math.abs(part - (total * (weights[index] ?? 0)) / sum)).toBeLessThan(1)
      })
    }
  })

  it('allocateProportional: proporcional; pesos 0 → todo al primero; vacío → []', () => {
    expect(allocateProportional(100, [1, 3])).toEqual([25, 75])
    expect(allocateProportional(100, [0, 0])).toEqual([100, 0])
    expect(allocateProportional(100, [])).toEqual([])
    expect(allocateProportional(0, [2, 2])).toEqual([0, 0])
  })
})
