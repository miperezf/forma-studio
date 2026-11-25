import { describe, expect, it } from 'vitest'
import { createQuoteCalculator } from '../calculation'
import { parseQuoteForm, toRawForm } from './form'
import { lastRunOf, remainderParts } from './mapper'
import { createQuoteService } from './service'
import { context, form } from './testing/shop-fixtures'

const service = createQuoteService({ calculator: createQuoteCalculator() })
const preview = (raw: Record<string, string>, extras: string[] = []) => {
  const result = service.preview(raw, extras, context())
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}
// 4 unidades, 3 por placa: 1 placa completa + última placa con 1 pieza
const PARTIAL = { quantity: '4', partsPerPlate: '3', plateWeightGr: '300', plateHours: '6' }

describe('cotizador v2 · última placa incompleta', () => {
  it('formulario: tiempo y gramos por color; ida y vuelta exacta; vacío = sin datos', () => {
    const empty = parseQuoteForm(form(PARTIAL), [])
    expect(empty.ok && empty.value.lastRun).toBe(null)
    const parsed = parseQuoteForm(form({ ...PARTIAL, lastRunHours: '2.3', lastRunGrams1: '105' }), [])
    expect(parsed.ok && parsed.value.lastRun).toEqual({ printHours: 2.3, grams: [105] })
    if (!parsed.ok) return
    const again = parseQuoteForm(toRawForm(parsed.value), parsed.value.extras)
    expect(again.ok && again.value).toEqual(parsed.value)
  })

  it('datos incompletos de la última placa → error claro (no se inventan)', () => {
    const noHours = parseQuoteForm(form({ ...PARTIAL, lastRunGrams1: '105' }), [])
    expect(!noHours.ok && noHours.error[0]?.field).toBe('lastRunHours')
    const noGrams = parseQuoteForm(form({ ...PARTIAL, lastRunHours: '2' }), [])
    expect(!noGrams.ok && noGrams.error[0]?.field).toBe('lastRunGrams1')
  })

  it('restante y última placa para el motor: solo con piezas restantes Y datos', () => {
    const state = (over: Record<string, string>) => {
      const parsed = parseQuoteForm(form(over), [])
      if (!parsed.ok) throw new Error('form')
      return parsed.value
    }
    expect(remainderParts(state(PARTIAL))).toBe(1)
    expect(lastRunOf(state(PARTIAL))).toBe(null)
    expect(lastRunOf(state({ ...PARTIAL, lastRunHours: '2.3', lastRunGrams1: '105' }))).toEqual({ parts: 1, filaments: [{ materialId: 'MAT-001', grams: 105 }], printHours: 2.3 })
    // si la cantidad pasa a llenar las placas, los datos de la última placa se ignoran
    expect(lastRunOf(state({ ...PARTIAL, quantity: '6', lastRunHours: '2.3', lastRunGrams1: '105' }))).toBe(null)
  })

  it('AMS: gramos de la última placa por color; un color en 0 no se envía', () => {
    const parsed = parseQuoteForm(form({ ...PARTIAL, amsMaterial2: 'MAT-002', amsGrams2: '30', lastRunHours: '2', lastRunGrams1: '100', lastRunGrams2: '0' }), ['multicolor'])
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.error))
    expect(lastRunOf(parsed.value)?.filaments).toEqual([{ materialId: 'MAT-001', grams: 100 }])
  })

  it('sin datos: estimación conservadora (= placa completa), aviso y resumen «estimada»', () => {
    const p = preview(form(PARTIAL))
    expect(p.request.calculationVersion).toBe('v2')
    expect(p.summary.lastRun).toEqual({ parts: 1, source: 'ESTIMATED_FULL_PLATE' })
    expect(p.summary.fullPlates).toBe(1)
    expect(p.summary.plates).toBe(2)
    expect(p.summary.totalPrintHours).toBe(12)
    expect(p.summary.messages.some((m) => m.includes('estimación conservadora'))).toBe(true)
    expect(p.issuance.issuable).toBe(true)
  })

  it('con datos de Bambu Studio: usa gramos y horas reales; el precio baja y el aviso desaparece', () => {
    const estimated = preview(form(PARTIAL))
    const sliced = preview(form({ ...PARTIAL, lastRunHours: '2.3', lastRunGrams1: '105' }))
    expect(sliced.summary.lastRun).toEqual({ parts: 1, source: 'SLICED' })
    expect(sliced.summary.totalPrintHours).toBe(8.3)
    expect(sliced.summary.grossTotal).toBeLessThan(estimated.summary.grossTotal)
    expect(sliced.summary.messages.some((m) => m.includes('estimación conservadora'))).toBe(false)
    expect(sliced.request.input.plates[0]?.lastRun).toEqual({ parts: 1, filaments: [{ materialId: 'MAT-001', grams: 105 }], printHours: 2.3 })
  })

  it('placas completas (8 u / 4 por placa): mismo precio que el golden v1 ($48.000)', () => {
    expect(preview(form()).summary.grossTotal).toBe(48000)
  })

  it('trazabilidad: el borrador guarda v2 y los datos de la última placa en el snapshot; se reproduce idéntico', () => {
    const created = service.createDraft(form({ ...PARTIAL, lastRunHours: '2.3', lastRunGrams1: '105' }), [], context(), { id: 'COT-0100' })
    if (!created.ok) throw new Error(JSON.stringify(created.error))
    const internal = created.value.internal
    expect(internal.calculationVersion).toBe('v2')
    expect(internal.calculation.request.input.plates[0]?.lastRun?.printHours).toBe(2.3)
    expect(internal.formState.lastRun).toEqual({ printHours: 2.3, grams: [105] })
    const replay = service.replay(internal)
    expect(replay.ok && replay.value.identical).toBe(true)
  })

  it('cotización histórica v1: se reproduce con v1, sin cambios', () => {
    const created = service.createDraft(form(PARTIAL), [], context(), { id: 'COT-0101' })
    if (!created.ok) throw new Error(JSON.stringify(created.error))
    const v1 = JSON.parse(JSON.stringify(created.value.internal.calculation)) as typeof created.value.internal.calculation
    const asV1 = { ...v1, request: { ...v1.request, calculationVersion: 'v1' }, output: { ...v1.output, calculationVersion: 'v1', breakdown: { ...v1.output.breakdown, platesRequired: [{ plateId: 'plate-1', platesRequired: 2 }] }, flags: v1.output.flags.filter((f) => f.code !== 'LAST_PLATE_ESTIMATED') } }
    const replay = service.replay({ calculation: asV1 as unknown as typeof v1 })
    expect(replay.ok && replay.value.identical).toBe(true)
  })
})
