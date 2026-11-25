import { describe, expect, it } from 'vitest'
import { InvariantViolation } from '../../../../core/result'
import { seededRandom } from '../../testing/random'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { requestOf } from '../../testing/cost-helpers'
import { ceilDiv, quantityFor, resolveQuantities, type ResolvedQuantities } from './index'

function quantitiesOf(raw: unknown): ResolvedQuantities {
  const result = resolveQuantities(requestOf(raw).input)
  if (!result.ok) throw new Error(`se esperaba éxito: ${JSON.stringify(result.error)}`)
  return result.value
}

/** Variante de la solicitud base con N, B, y la geometría de la placa 1. */
function raw(n: number, b: number, partsPerPlate: number, partsPerUnit: number) {
  let r = mutated('input.quantity', n)
  r = mutated('input.batches', b, r)
  r = mutated('input.plates[0].partsPerPlate', partsPerPlate, r)
  r = mutated('input.plates[0].partsPerUnit', partsPerUnit, r)
  return r
}

describe('ceilDiv (división por exceso exacta)', () => {
  const cases: [number, number, number][] = [
    [0, 1, 0],
    [1, 1, 1],
    [10, 5, 2],
    [10, 6, 2],
    [12, 6, 2],
    [13, 6, 3],
    [7, 6, 2],
    [6, 6, 1],
    [1, 1_000_000, 1],
    [999_999, 1_000_000, 1],
    [1_000_000, 1_000_000, 1],
    [1_000_001, 1_000_000, 2],
    [1_000_000_000_000, 7, 142_857_142_858],
    [1_000_000_000_000, 1, 1_000_000_000_000],
  ]
  it.each(cases)('ceilDiv(%s, %s) = %s', (a, b, expected) => {
    expect(ceilDiv(a, b)).toBe(expected)
  })

  it('coincide con la aritmética entera exacta (BigInt) en 20.000 casos con semilla fija', () => {
    const random = seededRandom(424242)
    for (let i = 0; i < 20_000; i += 1) {
      const a = Math.floor(random() * 1e12)
      const b = 1 + Math.floor(random() * 1e6)
      const exact = Number((BigInt(a) + BigInt(b) - 1n) / BigInt(b))
      expect(ceilDiv(a, b)).toBe(exact)
    }
  })
})

describe('resolveQuantities: placas requeridas = ceil(N × partsPerUnit / partsPerPlate)', () => {
  const cases: [string, number, number, number, number, number, number, number][] = [
    // descripción, N, B, partsPerPlate, partsPerUnit, placas, producidas, sobrantes
    ['una unidad, una pieza por placa', 1, 1, 1, 1, 1, 1, 0],
    ['6 piezas caben en 1 placa (no 6 × placa)', 6, 1, 6, 1, 1, 6, 0],
    ['7 unidades en placas de 6: 2 placas, sobran 5', 7, 1, 6, 1, 2, 12, 5],
    ['10 unidades en placas de 6: 2 placas, sobran 2', 10, 1, 6, 1, 2, 12, 2],
    ['la unidad usa 3 piezas, placa de 6: N=4 → 12 piezas → 2 placas', 4, 1, 6, 3, 2, 12, 0],
    ['la unidad usa 3 piezas, placa de 6: N=3 → 9 piezas → 2 placas', 3, 1, 6, 3, 2, 12, 3],
    ['cada pieza ocupa una placa completa', 5, 1, 1, 1, 5, 5, 0],
    ['placa enorme, una sola unidad', 1, 1, 100, 1, 1, 100, 99],
  ]
  it.each(cases)('%s', (_name, n, b, perPlate, perUnit, plates, produced, surplus) => {
    const q = quantitiesOf(raw(n, b, perPlate, perUnit))
    expect(q.units).toBe(n)
    expect(q.plates).toHaveLength(1)
    expect(q.plates[0]?.platesRequired).toBe(plates)
    expect(q.plates[0]?.requiredParts).toBe(n * perUnit)
    expect(q.plates[0]?.producedParts).toBe(produced)
    expect(q.plates[0]?.surplusParts).toBe(surplus)
    expect(q.totalPlates).toBe(plates)
  })

  it('con varias placas, cada una se resuelve por separado y totalPlates es la suma', () => {
    const second = {
      id: 'plate-2',
      label: 'Tapa',
      filaments: [{ materialId: 'pla-basic', grams: 30 }],
      machineId: 'printer-1',
      printHours: 3,
      partsPerPlate: 4,
      partsPerUnit: 2,
      weightIncludesWaste: false,
      source: 'MANUAL',
    }
    let r = mutated('input.plates', [(validRequestRaw().input as { plates: unknown[] }).plates[0], second])
    r = mutated('input.quantity', 5, r)
    const q = quantitiesOf(r)
    expect(q.plates.map((p) => p.platesRequired)).toEqual([5, 3]) // 5 piezas /1 ; 10 piezas / 4 → 3
    expect(q.totalPlates).toBe(8)
    expect(q.partsPerUnitTotal).toBe(3)
    expect(q.extraPartsPerUnit).toBe(2)
    expect(q.extraParts).toBe(10)
  })
})

describe('B (lotes) es independiente de las placas', () => {
  it('cambiar B no cambia placas, piezas ni unidades', () => {
    const base = quantitiesOf(raw(10, 1, 6, 1))
    for (const b of [1, 2, 3, 10, 50, 1000]) {
      const q = quantitiesOf(raw(10, b, 6, 1))
      expect(q.plates).toEqual(base.plates)
      expect(q.totalPlates).toBe(base.totalPlates)
      expect(q.extraParts).toBe(base.extraParts)
      expect(q.batches).toBe(b)
    }
  })

  it('no se asume 1 lote = 1 placa: B puede ser menor, igual o mayor que las placas, y que las unidades', () => {
    expect(quantitiesOf(raw(10, 1, 1, 1)).totalPlates).toBe(10) // 1 lote, 10 placas
    expect(quantitiesOf(raw(10, 10, 1, 1)).totalPlates).toBe(10) // 10 lotes, 10 placas
    expect(quantitiesOf(raw(10, 25, 1, 1)).totalPlates).toBe(10) // más lotes que placas
    expect(quantitiesOf(raw(2, 7, 1, 1)).batches).toBe(7) // más lotes que unidades
    expect(quantitiesOf(raw(1, 1, 100, 1)).totalPlates).toBe(1)
  })

  it('cambiar N cambia placas pero no los lotes', () => {
    expect(quantitiesOf(raw(1, 3, 6, 1)).batches).toBe(3)
    expect(quantitiesOf(raw(100, 3, 6, 1)).batches).toBe(3)
    expect(quantitiesOf(raw(100, 3, 6, 1)).totalPlates).toBe(17)
  })
})

describe('piezas a ensamblar', () => {
  it('con una sola pieza por unidad no hay piezas extra', () => {
    const q = quantitiesOf(raw(10, 1, 6, 1))
    expect(q.partsPerUnitTotal).toBe(1)
    expect(q.extraPartsPerUnit).toBe(0)
    expect(q.extraParts).toBe(0)
  })

  it('la primera pieza no se ensambla: extra = Σ partsPerUnit − 1', () => {
    const q = quantitiesOf(raw(4, 1, 6, 3))
    expect(q.extraPartsPerUnit).toBe(2)
    expect(q.extraParts).toBe(8)
  })

  it('las piezas extra dependen de N y no de las placas ni de B', () => {
    const a = quantitiesOf(raw(4, 1, 6, 3))
    const b = quantitiesOf(raw(4, 9, 1, 3))
    expect(a.extraParts).toBe(b.extraParts)
    expect(quantitiesOf(raw(8, 1, 6, 3)).extraParts).toBe(16)
  })
})

describe('límites y errores', () => {
  it('N y partsPerUnit grandes con placas de 1 pieza superan el tope de placas (INVALID_INPUT)', () => {
    const result = resolveQuantities(requestOf(raw(1_000_000, 1, 1, 1_000_000)).input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT')
      if (result.error.code === 'INVALID_INPUT') expect(result.error.issues[0]?.path).toBe('input.plates[0]')
    }
  })

  it('N × partsPerUnit grande pero con placas grandes sí se resuelve', () => {
    const q = quantitiesOf(raw(1_000_000, 1, 1_000_000, 1_000_000))
    expect(q.plates[0]?.requiredParts).toBe(1_000_000_000_000)
    expect(q.totalPlates).toBe(1_000_000)
  })

  it('es determinista', () => {
    expect(resolveQuantities(requestOf(raw(10, 2, 6, 3)).input)).toEqual(resolveQuantities(requestOf(raw(10, 2, 6, 3)).input))
  })
})

describe('quantityFor: cada comportamiento usa UNA sola magnitud', () => {
  // N=10, B=3, placa de 6 piezas, 3 piezas por unidad → piezas requeridas 30 → 5 placas; extra por unidad 2 → 20
  const q = quantitiesOf(raw(10, 3, 6, 3))

  it('la magnitud de partida es la esperada', () => {
    expect(q.units).toBe(10)
    expect(q.batches).toBe(3)
    expect(q.totalPlates).toBe(5)
    expect(q.extraParts).toBe(20)
  })

  const table: [string, 'PER_UNIT' | 'PER_PLATE' | 'PER_BATCH' | 'ONE_OFF' | 'PER_EXTRA_PART', number][] = [
    ['PER_UNIT multiplica por las unidades vendidas', 'PER_UNIT', 10],
    ['PER_PLATE multiplica por las placas requeridas', 'PER_PLATE', 5],
    ['PER_BATCH multiplica por los lotes', 'PER_BATCH', 3],
    ['ONE_OFF nunca multiplica', 'ONE_OFF', 1],
    ['PER_EXTRA_PART multiplica por N × (piezas por unidad − 1)', 'PER_EXTRA_PART', 20],
  ]
  it.each(table)('%s', (_name, behavior, expected) => {
    expect(quantityFor(behavior, q)).toBe(expected)
  })

  it('PER_PLATE con plateId usa las placas de ESA placa; sin plateId, el total', () => {
    expect(quantityFor('PER_PLATE', q, 'plate-1')).toBe(5)
    expect(quantityFor('PER_PLATE', q)).toBe(q.totalPlates)
  })

  it('plateId se ignora fuera de PER_PLATE', () => {
    expect(quantityFor('PER_UNIT', q, 'plate-1')).toBe(10)
    expect(quantityFor('PER_BATCH', q, 'plate-1')).toBe(3)
    expect(quantityFor('ONE_OFF', q, 'plate-1')).toBe(1)
  })

  it('un plateId desconocido es un defecto interno (InvariantViolation)', () => {
    let thrown: unknown
    try {
      quantityFor('PER_PLATE', q, 'no-existe')
    } catch (error) {
      thrown = error
    }
    expect(thrown instanceof InvariantViolation).toBe(true)
  })

  it('ONE_OFF es 1 aunque N, B y las placas sean enormes', () => {
    const big = quantitiesOf(raw(1_000_000, 1000, 1, 1))
    expect(quantityFor('ONE_OFF', big)).toBe(1)
  })
})
