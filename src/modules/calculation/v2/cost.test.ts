import { describe, expect, it } from 'vitest'
import { createQuoteCalculator, ENGINE_V1, ENGINE_V2 } from '../calculator'
import { isIssuable } from '../contracts/flags'
import { validateCalculationRequest } from '../contracts/validate/request'
import type { CalculationOutput } from '../contracts/request'
import type { CostItem } from '../contracts/results'
import { requestOf } from '../testing/cost-helpers'
import { mutated, validRequestRaw, type RawRecord } from '../testing/fixtures'
import { pick, seededRandom } from '../testing/random'

const PETG = {
  ref: { id: 'petg', revision: 1 },
  name: 'PETG',
  brand: 'Genérica',
  spool: { price: { amount: 18000, basis: 'NET', vatRecoverable: true }, netGrams: 1000 },
}

/** Solicitud v2: N unidades, piezas por placa, gramos/horas de la placa completa y última placa opcional. */
function request(options: {
  version?: 'v1' | 'v2'
  quantity: number
  partsPerPlate: number
  partsPerUnit?: number
  grams?: number
  hours?: number
  filaments?: { materialId: string; grams: number }[]
  lastRun?: unknown
  changeoverMinutes?: number
  failureRate?: number
  batches?: number
}): RawRecord {
  let raw = validRequestRaw()
  raw = mutated('calculationVersion', options.version ?? 'v2', raw)
  raw = mutated('input.quantity', options.quantity, raw)
  raw = mutated('input.batches', options.batches ?? 1, raw)
  raw = mutated('input.plates[0].partsPerPlate', options.partsPerPlate, raw)
  raw = mutated('input.plates[0].partsPerUnit', options.partsPerUnit ?? 1, raw)
  raw = mutated('input.plates[0].weightIncludesWaste', true, raw)
  raw = mutated('input.plates[0].printHours', options.hours ?? 6, raw)
  raw = mutated('input.plates[0].filaments', options.filaments ?? [{ materialId: 'pla-basic', grams: options.grams ?? 300 }], raw)
  raw = mutated('params.materials.petg', PETG, raw)
  raw = mutated('params.costProfile.preparation.plateChangeoverMinutes', options.changeoverMinutes ?? 0, raw)
  raw = mutated('params.costProfile.failure.rate', options.failureRate ?? 0, raw)
  if (options.lastRun !== undefined) raw = mutated('input.plates[0].lastRun', options.lastRun, raw)
  return raw
}

const calculator = createQuoteCalculator()
function run(raw: RawRecord): CalculationOutput {
  const result = calculator.calculate(requestOf(raw))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}
const amounts = (output: CalculationOutput) => output.breakdown.items.map((i: CostItem) => [i.code, i.amount, i.pooledAmount])
const itemOf = (output: CalculationOutput, code: string) => {
  const found = output.breakdown.items.find((i) => i.code === code)
  if (found === undefined) throw new Error(`falta ${code}: ${output.breakdown.items.map((i) => i.code).join(', ')}`)
  return found
}
const invalid = (raw: RawRecord) => {
  const result = validateCalculationRequest(raw)
  return result.ok ? [] : result.error.map((i) => `${i.path}:${i.code}`)
}

describe('motor v2 · equivalencia con v1 (placas completas o sin datos de la última placa)', () => {
  it('8 unidades / 4 por placa: mismos ítems, totales y precio que v1', () => {
    const v1 = run(request({ version: 'v1', quantity: 8, partsPerPlate: 4 }))
    const v2 = run(request({ quantity: 8, partsPerPlate: 4 }))
    expect(amounts(v2)).toEqual(amounts(v1))
    expect(v2.pricing).toEqual(v1.pricing)
    expect(v2.breakdown.totals).toEqual(v1.breakdown.totals)
    expect(v2.calculationVersion).toBe('v2')
    expect(v2.breakdown.platesRequired).toEqual([{ plateId: 'plate-1', platesRequired: 2, fullPlates: 2, remainderParts: 0 }])
    expect(v2.flags.map((f) => f.code)).toEqual(v1.flags.map((f) => f.code))
  })

  it('propiedad (300 casos): sin última placa con datos, v2 ≡ v1 en ítems, totales y precio', () => {
    const random = seededRandom(20261021)
    for (let i = 0; i < 300; i += 1) {
      const options = {
        quantity: pick([1, 2, 3, 4, 5, 7, 8, 12, 25, 60], random),
        partsPerPlate: pick([1, 2, 3, 4, 6, 9], random),
        partsPerUnit: pick([1, 1, 2, 3], random),
        grams: pick([12.5, 80, 300, 912.3], random),
        hours: pick([0.4, 2, 5.5, 11.25], random),
        changeoverMinutes: pick([0, 5, 12], random),
        failureRate: pick([0, 0.05, 0.12], random),
        batches: pick([1, 2], random),
      }
      const v1 = run(request({ ...options, version: 'v1' }))
      const v2 = run(request(options))
      expect(amounts(v2)).toEqual(amounts(v1))
      expect(v2.pricing).toEqual(v1.pricing)
    }
  })
})

describe('motor v2 · última placa con datos de Bambu Studio', () => {
  const SLICED = { parts: 1, filaments: [{ materialId: 'pla-basic', grams: 105 }], printHours: 2.3 }

  it('4 u / 3 por placa: 1 placa completa (300 g, 6 h) + última real (105 g, 2,3 h)', () => {
    const v2 = run(request({ quantity: 4, partsPerPlate: 3, lastRun: SLICED, changeoverMinutes: 10 }))
    const full = itemOf(v2, 'material:plate-1:pla-basic')
    const last = itemOf(v2, 'material:plate-1.last:pla-basic')
    expect(full.rawAmount).toBeCloseTo(300 * 15, 6)
    expect(last.rawAmount).toBeCloseTo(105 * 15, 6)
    expect(itemOf(v2, 'electricity:plate-1').rawAmount).toBeCloseTo(6 * 180, 6)
    expect(itemOf(v2, 'electricity:plate-1.last').rawAmount).toBeCloseTo(2.3 * 180, 6)
    expect(itemOf(v2, 'wear:plate-1.last').rawAmount).toBeCloseTo(2.3 * 250, 6)
    // cambio de placa: costo FIJO por placa física (2 corridas), no proporcional a las piezas
    expect(itemOf(v2, 'setup:changeover').rawAmount).toBeCloseTo((10 / 60) * 5000 * 2, 6)
    expect(v2.breakdown.platesRequired).toEqual([
      { plateId: 'plate-1', platesRequired: 2, fullPlates: 1, remainderParts: 1, lastRun: { source: 'SLICED', parts: 1, lastRunPlateId: 'plate-1.last' } },
    ])
    expect(v2.flags.some((f) => f.code === 'LAST_PLATE_ESTIMATED')).toBe(false)
  })

  it('solo cambia el precio cuando hay datos reales de la última placa (y baja frente a la estimación)', () => {
    const estimated = run(request({ quantity: 4, partsPerPlate: 3 }))
    const sliced = run(request({ quantity: 4, partsPerPlate: 3, lastRun: SLICED }))
    expect(sliced.breakdown.pricingPool).toBeLessThan(estimated.breakdown.pricingPool)
    expect(sliced.pricing?.grossTotal ?? 0).toBeLessThanOrEqual(estimated.pricing?.grossTotal ?? 0)
  })

  it('AMS: purga real por filamento; un color ausente en la última placa no se cobra', () => {
    const filaments = [{ materialId: 'pla-basic', grams: 280 }, { materialId: 'petg', grams: 40 }]
    const v2 = run(request({ quantity: 5, partsPerPlate: 4, filaments, lastRun: { parts: 1, filaments: [{ materialId: 'pla-basic', grams: 90 }], printHours: 1.9 } }))
    expect(itemOf(v2, 'material:plate-1:petg').rawAmount).toBeCloseTo(40 * 18, 6)
    expect(itemOf(v2, 'material:plate-1.last:pla-basic').rawAmount).toBeCloseTo(90 * 15, 6)
    expect(v2.breakdown.items.some((i) => i.code === 'material:plate-1.last:petg')).toBe(false)
    const withPurge = run(request({ quantity: 5, partsPerPlate: 4, filaments, lastRun: { parts: 1, filaments: [{ materialId: 'pla-basic', grams: 90 }, { materialId: 'petg', grams: 22 }], printHours: 2.1 } }))
    expect(itemOf(withPurge, 'material:plate-1.last:petg').rawAmount).toBeCloseTo(22 * 18, 6)
  })

  it('tiempo NO proporcional: una última placa más lenta por pieza se respeta tal cual', () => {
    const v2 = run(request({ quantity: 4, partsPerPlate: 3, hours: 6, lastRun: { ...SLICED, printHours: 2.9 } }))
    expect(itemOf(v2, 'electricity:plate-1.last').rawAmount).toBeCloseTo(2.9 * 180, 6)
  })

  it('costos por lote, por unidad y únicos no cambian con la división de placas (sin doble conteo)', () => {
    const base = { quantity: 4, partsPerPlate: 3, batches: 2 }
    const estimated = run(request(base))
    const sliced = run(request({ ...base, lastRun: SLICED }))
    expect(itemOf(sliced, 'setup:job')).toEqual(itemOf(estimated, 'setup:job'))
    const plateCodes = sliced.breakdown.items.filter((i) => i.behavior !== 'PER_PLATE').map((i) => [i.code, i.amount])
    expect(plateCodes).toEqual(estimated.breakdown.items.filter((i) => i.behavior !== 'PER_PLATE').map((i) => [i.code, i.amount]))
    const sum = sliced.breakdown.items.reduce((total, i) => total + i.pooledAmount, 0)
    expect(sum).toBe(sliced.breakdown.pricingPool)
  })

  it('falla: la misma tasa por placa se aplica a la última placa; con tasa 0 no hay ítems de falla', () => {
    const withFailure = run(request({ quantity: 4, partsPerPlate: 3, lastRun: SLICED, failureRate: 0.1 }))
    expect(withFailure.breakdown.items.some((i) => i.code === 'failure:material:plate-1.last:pla-basic')).toBe(true)
    const rates = withFailure.breakdown.failureRates.filter((r) => r.scope === 'PLATE').map((r) => [r.plateId, r.rate])
    expect(rates).toEqual([['plate-1', 0.1], ['plate-1.last', 0.1]])
    const none = run(request({ quantity: 4, partsPerPlate: 3, lastRun: SLICED, failureRate: 0 }))
    expect(none.breakdown.items.some((i) => i.code.startsWith('failure:'))).toBe(false)
  })

  it('productos de varias piezas: el restante se calcula sobre PIEZAS (3 u × 2 piezas / 4 por placa = 1 + 2)', () => {
    const v2 = run(request({ quantity: 3, partsPerUnit: 2, partsPerPlate: 4, lastRun: { ...SLICED, parts: 2 } }))
    expect(v2.breakdown.platesRequired[0]).toMatchObject({ fullPlates: 1, remainderParts: 2, platesRequired: 2 })
  })

  it('1 unidad con placa de 6: 0 completas + solo la última placa', () => {
    const v2 = run(request({ quantity: 1, partsPerPlate: 6, lastRun: SLICED }))
    expect(v2.breakdown.items.some((i) => i.code === 'material:plate-1:pla-basic')).toBe(false)
    expect(itemOf(v2, 'material:plate-1.last:pla-basic').rawAmount).toBeCloseTo(105 * 15, 6)
    expect(v2.breakdown.platesRequired[0]).toMatchObject({ fullPlates: 0, remainderParts: 1, platesRequired: 1 })
  })

  it('restante = piezas por placa − 1', () => {
    const v2 = run(request({ quantity: 11, partsPerPlate: 6, lastRun: { ...SLICED, parts: 5 } }))
    expect(v2.breakdown.platesRequired[0]).toMatchObject({ fullPlates: 1, remainderParts: 5 })
  })
})

describe('motor v2 · estimación conservadora sin datos de la última placa', () => {
  it('se valora como placa completa (igual que v1), con aviso interno WARNING y emitible', () => {
    const v1 = run(request({ version: 'v1', quantity: 4, partsPerPlate: 3 }))
    const v2 = run(request({ quantity: 4, partsPerPlate: 3 }))
    expect(amounts(v2)).toEqual(amounts(v1))
    expect(v2.flags.filter((f) => f.code === 'LAST_PLATE_ESTIMATED')).toEqual([{ code: 'LAST_PLATE_ESTIMATED', severity: 'WARNING', path: 'input.plates[0].lastRun' }])
    expect(isIssuable(v2.flags)).toBe(isIssuable(v1.flags))
    expect(v2.breakdown.platesRequired[0]?.lastRun).toEqual({ source: 'ESTIMATED_FULL_PLATE', parts: 1 })
  })
})

describe('motor v2 · validación y versiones', () => {
  const SLICED = { parts: 1, filaments: [{ materialId: 'pla-basic', grams: 105 }], printHours: 2.3 }
  it('última placa en v1 → rechazada (no se cambia el comportamiento histórico)', () => {
    expect(invalid(request({ version: 'v1', quantity: 4, partsPerPlate: 3, lastRun: SLICED }))).toEqual(['input.plates[0].lastRun:INCONSISTENT'])
  })
  it('sin placa incompleta, con piezas distintas al restante, gramos/horas en 0 o material ajeno → rechazada', () => {
    expect(invalid(request({ quantity: 6, partsPerPlate: 3, lastRun: SLICED }))).toEqual(['input.plates[0].lastRun:INCONSISTENT'])
    expect(invalid(request({ quantity: 5, partsPerPlate: 3, lastRun: SLICED }))).toEqual(['input.plates[0].lastRun.parts:INCONSISTENT'])
    expect(invalid(request({ quantity: 4, partsPerPlate: 3, lastRun: { ...SLICED, printHours: 0 } })).length).toBeGreaterThan(0)
    expect(invalid(request({ quantity: 4, partsPerPlate: 3, lastRun: { ...SLICED, filaments: [{ materialId: 'pla-basic', grams: 0 }] } })).length).toBeGreaterThan(0)
    expect(invalid(request({ quantity: 4, partsPerPlate: 3, lastRun: { ...SLICED, filaments: [{ materialId: 'petg', grams: 5 }] } }))).toEqual(['input.plates[0].lastRun.filaments[0].materialId:INCONSISTENT'])
  })
  it('reproducción: una solicitud v1 da exactamente lo mismo con el registro v1+v2 que con ENGINE_V1', () => {
    const raw = request({ version: 'v1', quantity: 5, partsPerPlate: 4, failureRate: 0.08, changeoverMinutes: 5 })
    const direct = ENGINE_V1.calculate(requestOf(raw))
    expect(calculator.calculate(requestOf(raw))).toEqual(direct)
    expect(ENGINE_V2.version).toBe('v2')
  })
})
