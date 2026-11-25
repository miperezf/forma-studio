import { describe, expect, it } from 'vitest'
import { checkCostBreakdownInvariants } from '../../contracts/invariants'
import type { CostItem } from '../../contracts/results'
import { costOf, costSpecRaw, item } from '../../testing/cost-helpers'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { pick, seededRandom } from '../../testing/random'
import type { CostCalculation } from './index'

/**
 * Semántica de los cinco comportamientos. Un "probe" de cada comportamiento (costos auxiliares con
 * montos distintos) permite verificar, para cualquier combinación de N, B y geometría de placa,
 * que cada costo se multiplica EXACTAMENTE por su magnitud y por ninguna otra.
 */
const PROBES = [
  costSpecRaw('probe-unit', 100, 'PER_UNIT'),
  costSpecRaw('probe-plate', 200, 'PER_PLATE'),
  costSpecRaw('probe-batch', 300, 'PER_BATCH'),
  costSpecRaw('probe-oneoff', 400, 'ONE_OFF'),
  costSpecRaw('probe-extra', 500, 'PER_EXTRA_PART'),
]

interface Shape {
  n: number
  b: number
  perPlate: number
  perUnit: number
}

function rawFor(shape: Shape, base = validRequestRaw()) {
  let raw = mutated('params.costProfile.auxiliaryCosts', PROBES, base)
  raw = mutated('input.quantity', shape.n, raw)
  raw = mutated('input.batches', shape.b, raw)
  raw = mutated('input.plates[0].partsPerPlate', shape.perPlate, raw)
  raw = mutated('input.plates[0].partsPerUnit', shape.perUnit, raw)
  return raw
}

/** Oráculo independiente del motor: aritmética entera simple. */
function expectedMultipliers(shape: Shape) {
  const plates = Math.ceil((shape.n * shape.perUnit) / shape.perPlate)
  return {
    'aux:probe-unit': shape.n,
    'aux:probe-plate': plates,
    'aux:probe-batch': shape.b,
    'aux:probe-oneoff': 1,
    'aux:probe-extra': shape.n * (shape.perUnit - 1),
  }
}

function probeMultipliers(calc: CostCalculation) {
  const out: Record<string, number> = {}
  for (const code of Object.keys(expectedMultipliers({ n: 1, b: 1, perPlate: 1, perUnit: 1 }))) {
    out[code] = item(calc, code).basis.multiplier
  }
  return out
}

const SHAPES: [string, Shape][] = [
  ['1 unidad, 1 lote, pieza por placa', { n: 1, b: 1, perPlate: 1, perUnit: 1 }],
  ['10 unidades en placas de 6', { n: 10, b: 1, perPlate: 6, perUnit: 1 }],
  ['10 unidades, 3 lotes, 3 piezas por unidad', { n: 10, b: 3, perPlate: 6, perUnit: 3 }],
  ['más lotes que unidades', { n: 2, b: 9, perPlate: 1, perUnit: 2 }],
  ['más lotes que placas', { n: 20, b: 40, perPlate: 10, perUnit: 1 }],
  ['una placa enorme', { n: 100, b: 2, perPlate: 100000, perUnit: 4 }],
  ['placas de una pieza, unidad de 5 piezas', { n: 7, b: 1, perPlate: 1, perUnit: 5 }],
  ['N = 1000, lotes 50', { n: 1000, b: 50, perPlate: 24, perUnit: 2 }],
]

describe('cada comportamiento usa UNA sola magnitud', () => {
  it.each(SHAPES)('%s', (_name, shape) => {
    const calc = costOf(rawFor(shape))
    expect(probeMultipliers(calc)).toEqual(expectedMultipliers(shape))
    for (const code of Object.keys(expectedMultipliers(shape))) {
      const found = item(calc, code)
      expect(found.amount).toBe(found.basis.unitCost * found.basis.multiplier)
    }
  })

  it('PER_UNIT = N (no placas, no lotes)', () => {
    const calc = costOf(rawFor({ n: 10, b: 3, perPlate: 6, perUnit: 3 }))
    expect(item(calc, 'aux:probe-unit').amount).toBe(1000)
  })

  it('PER_PLATE = placas (no unidades, no lotes, no piezas extra)', () => {
    const calc = costOf(rawFor({ n: 10, b: 3, perPlate: 6, perUnit: 3 }))
    expect(item(calc, 'aux:probe-plate').amount).toBe(1000) // 5 placas
  })

  it('PER_BATCH = B (no placas, no unidades)', () => {
    const calc = costOf(rawFor({ n: 10, b: 3, perPlate: 6, perUnit: 3 }))
    expect(item(calc, 'aux:probe-batch').amount).toBe(900)
  })

  it('ONE_OFF = 1 (ni N, ni B, ni placas)', () => {
    const calc = costOf(rawFor({ n: 1000, b: 50, perPlate: 1, perUnit: 3 }))
    expect(item(calc, 'aux:probe-oneoff').amount).toBe(400)
  })

  it('PER_EXTRA_PART = N × (piezas por unidad − 1) (no placas, no lotes)', () => {
    const calc = costOf(rawFor({ n: 10, b: 3, perPlate: 6, perUnit: 3 }))
    expect(item(calc, 'aux:probe-extra').amount).toBe(10000) // 20 piezas extra
  })
})

describe('aislamiento: variar una magnitud solo mueve los costos que le corresponden', () => {
  const BASE: Shape = { n: 10, b: 3, perPlate: 100000, perUnit: 3 } // una sola placa mientras N crece

  const rawOf = (calc: CostCalculation): Map<string, number> => new Map(calc.breakdown.items.map((i: CostItem) => [i.code, i.rawAmount]))
  const behaviorOf = (calc: CostCalculation): Map<string, string> => new Map(calc.breakdown.items.map((i: CostItem) => [i.code, i.behavior]))

  function changedBehaviors(a: Shape, b: Shape): { changed: string[]; behaviors: Map<string, string> } {
    const first = costOf(rawFor(a))
    const second = costOf(rawFor(b))
    const x = rawOf(first)
    const y = rawOf(second)
    expect([...x.keys()]).toEqual([...y.keys()])
    const changed = [...x.keys()].filter((code) => Math.abs((x.get(code) ?? 0) - (y.get(code) ?? 0)) > 1e-9)
    return { changed, behaviors: behaviorOf(first) }
  }

  const behaviorsOfChanged = (shapeA: Shape, shapeB: Shape): Set<string> => {
    const { changed, behaviors } = changedBehaviors(shapeA, shapeB)
    return new Set(changed.map((code) => behaviors.get(code) ?? '?'))
  }

  it('variar B solo mueve PER_BATCH', () => {
    for (const b of [1, 2, 7, 50]) {
      expect([...behaviorsOfChanged(BASE, { ...BASE, b })].filter((x) => x !== 'PER_BATCH')).toEqual([])
    }
    expect(behaviorsOfChanged(BASE, { ...BASE, b: 9 }).has('PER_BATCH')).toBe(true)
  })

  it('variar N (con placas constantes) solo mueve PER_UNIT y PER_EXTRA_PART', () => {
    for (const n of [1, 5, 50, 99]) {
      const moved = behaviorsOfChanged(BASE, { ...BASE, n })
      expect([...moved].filter((x) => x !== 'PER_UNIT' && x !== 'PER_EXTRA_PART')).toEqual([])
    }
  })

  it('variar partsPerPlate solo mueve PER_PLATE', () => {
    for (const perPlate of [1, 2, 3, 7, 30]) {
      const moved = behaviorsOfChanged({ ...BASE, perPlate: 100000 }, { ...BASE, perPlate })
      expect([...moved].filter((x) => x !== 'PER_PLATE')).toEqual([])
    }
  })

  it('variar partsPerUnit solo mueve PER_PLATE y PER_EXTRA_PART', () => {
    for (const perUnit of [1, 2, 5]) {
      const moved = behaviorsOfChanged({ ...BASE, perPlate: 4 }, { ...BASE, perPlate: 4, perUnit })
      expect([...moved].filter((x) => x !== 'PER_PLATE' && x !== 'PER_EXTRA_PART')).toEqual([])
    }
  })

  it('ONE_OFF no cambia con NINGUNA magnitud (N, B, placas, piezas)', () => {
    const variants: Shape[] = [
      { ...BASE, n: 500 },
      { ...BASE, b: 40 },
      { ...BASE, perPlate: 1 },
      { ...BASE, perUnit: 9 },
      { n: 999, b: 99, perPlate: 1, perUnit: 7 },
    ]
    for (const variant of variants) {
      const calc = costOf(rawFor(variant))
      expect(item(calc, 'aux:probe-oneoff').rawAmount).toBe(400)
      expect(item(costOf(mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], rawFor(variant))), 'service:modeling-3d').amount).toBe(27000)
    }
  })

  it('B no altera las placas requeridas (ni el material, ni la electricidad)', () => {
    const a = costOf(rawFor({ ...BASE, perPlate: 4, b: 1 }))
    const b = costOf(rawFor({ ...BASE, perPlate: 4, b: 25 }))
    expect(a.quantities.plates).toEqual(b.quantities.plates)
    expect(item(a, 'material:plate-1:pla-basic').amount).toBe(item(b, 'material:plate-1:pla-basic').amount)
    expect(item(a, 'electricity:plate-1').amount).toBe(item(b, 'electricity:plate-1').amount)
  })

  it('N no altera el costo de preparación del trabajo', () => {
    const a = costOf(rawFor({ ...BASE, n: 1 }))
    const b = costOf(rawFor({ ...BASE, n: 1000 }))
    expect(item(a, 'setup:job').amount).toBe(item(b, 'setup:job').amount)
  })
})

describe('barrido con semilla fija (400 casos): invariantes y semántica', () => {
  const random = seededRandom(20261010)
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

  function randomRaw() {
    const shape: Shape = { n: between(1, 200), b: between(1, 12), perPlate: between(1, 40), perUnit: between(1, 6) }
    let raw = rawFor(shape)
    raw = mutated('params.costProfile.failure.rate', pick([0, 0.02, 0.08, 0.3, 0.6], random), raw)
    raw = mutated('params.costProfile.failure.costFraction', pick([1, 0.5, 0], random), raw)
    raw = mutated('params.costProfile.preparation.plateChangeoverMinutes', pick([0, 3, 10], random), raw)
    raw = mutated('params.costProfile.materialWaste.fraction', pick([0, 0.03, 0.1], random), raw)
    raw = mutated('params.taxProfile.regime', pick(['VAT_REGISTERED', 'NOT_REGISTERED'] as const, random), raw)
    if ((raw as { params: { taxProfile: { regime: string } } }).params.taxProfile.regime === 'NOT_REGISTERED') {
      raw = mutated('params.taxProfile.vatRate', 0, raw)
    }
    const active = [
      { serviceId: 'assembly', active: random() < 0.5 },
      { serviceId: 'modeling-3d', active: random() < 0.5 },
    ]
    raw = mutated('input.services', active, raw)
    return { shape, raw }
  }

  it('cada caso cumple las identidades, la semántica y es determinista', () => {
    for (let i = 0; i < 400; i += 1) {
      const { shape, raw } = randomRaw()
      const calc = costOf(raw)
      const again = costOf(raw)
      expect(again.breakdown).toEqual(calc.breakdown)

      expect(checkCostBreakdownInvariants(calc.breakdown, calc.quantities.units)).toEqual([])
      expect(probeMultipliers(calc)).toEqual(expectedMultipliers(shape))

      const plate = calc.quantities.plates[0]
      const required = shape.n * shape.perUnit
      expect((plate?.platesRequired ?? 0) * shape.perPlate).toBeGreaterThanOrEqual(required)
      expect(((plate?.platesRequired ?? 0) - 1) * shape.perPlate).toBeLessThan(required)

      expect(item(calc, 'setup:job').basis.multiplier).toBe(shape.b)
      for (const found of calc.breakdown.items) {
        expect(found.amount).toBeGreaterThanOrEqual(0)
        if (found.behavior === 'ONE_OFF') expect(found.basis.multiplier).toBe(1)
        if (found.behavior === 'PER_BATCH') expect(found.basis.multiplier).toBe(shape.b)
        if (found.behavior === 'PER_UNIT') expect(found.basis.multiplier).toBe(shape.n)
      }
      const { pricingPool, absorbedCost, deferredCost } = calc.breakdown
      const total = calc.breakdown.items.reduce((sum, x) => sum + x.amount, 0)
      expect(total).toBe(pricingPool + absorbedCost + deferredCost)
    }
  })

  it('monotonía: más unidades o más lotes nunca bajan el costo', () => {
    for (let i = 0; i < 100; i += 1) {
      const { shape } = randomRaw()
      const poolOf = (s: Shape) => costOf(rawFor(s)).breakdown.pricingPool
      expect(poolOf({ ...shape, n: shape.n + 1 })).toBeGreaterThanOrEqual(poolOf(shape))
      expect(poolOf({ ...shape, b: shape.b + 1 })).toBeGreaterThanOrEqual(poolOf(shape))
      expect(poolOf({ ...shape, perPlate: shape.perPlate + 1 })).toBeLessThanOrEqual(poolOf(shape))
    }
  })
})
