import { describe, expect, it } from 'vitest'
import { parseQuoteForm, toRawForm } from './form'
import { allMaterialIds } from './mapper'
import { createQuoteService } from './service'
import { context, form } from './testing/shop-fixtures'
import { createQuoteCalculator } from '../calculation'

const service = createQuoteService({ calculator: createQuoteCalculator() })
const preview = (raw: Record<string, string>, extras: string[] = []) => {
  const result = service.preview(raw, extras, context())
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}
/** Placa 2 de 6,1 g (dos colores), 1 h 12 min, 1 unidad por placa. */
const PLATE2 = { plate2Units: '1', plate2Hours: '1.2', plate2Mat1: 'MAT-001', plate2Grams1: '5.2', plate2Mat2: 'MAT-002', plate2Grams2: '0.9' }
/** Placa 3 de un color, 2 unidades por placa. */
const PLATE3 = { plate3Units: '2', plate3Hours: '0.5', plate3Mat1: 'MAT-002', plate3Grams1: '12.4' }

describe('producto con varias placas (perfiles de MakerWorld)', () => {
  it('formulario: placas 2..n con unidades, tiempo y filamentos; ida y vuelta exacta', () => {
    const parsed = parseQuoteForm(form({ ...PLATE2, ...PLATE3 }), [])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.extraPlates).toEqual([
      { unitsPerPlate: 1, printHours: 1.2, filaments: [{ materialId: 'MAT-001', grams: 5.2 }, { materialId: 'MAT-002', grams: 0.9 }] },
      { unitsPerPlate: 2, printHours: 0.5, filaments: [{ materialId: 'MAT-002', grams: 12.4 }] },
    ])
    const again = parseQuoteForm(toRawForm(parsed.value), parsed.value.extras)
    expect(again.ok && again.value).toEqual(parsed.value)
  })

  it('sin placas adicionales el formState queda igual que antes (extraPlates vacío, sin importación)', () => {
    const parsed = parseQuoteForm(form(), [])
    expect(parsed.ok && parsed.value.extraPlates).toEqual([])
    expect(parsed.ok && parsed.value.importedFrom).toBeNull()
  })

  it('errores con el campo exacto: tiempo, unidades, filamento y gramos de cada placa', () => {
    const fields = (raw: Record<string, string>) => {
      const parsed = parseQuoteForm(form(raw), [])
      return parsed.ok ? [] : parsed.error.map((issue) => issue.field)
    }
    expect(fields({ ...PLATE2, plate2Hours: '' })).toEqual(['plate2Hours'])
    expect(fields({ ...PLATE2, plate2Units: '0' })).toEqual(['plate2Units'])
    expect(fields({ ...PLATE2, plate2Units: '1.5' })).toEqual(['plate2Units'])
    expect(fields({ ...PLATE2, plate2Mat2: '' })).toEqual(['plate2Mat2'])
    expect(fields({ ...PLATE2, plate2Grams2: '' })).toEqual(['plate2Grams2'])
    expect(fields({ plate2Units: '1', plate2Hours: '1' })).toEqual(['plate2Grams1'])
  })

  it('con varias placas, «Piezas por producto» de la placa 1 debe quedar en 1', () => {
    const parsed = parseQuoteForm(form({ ...PLATE2, partsPerUnit: '3', batches: '1', extraGrPerPlate: '0' }), ['planning'])
    expect(!parsed.ok && parsed.error.map((issue) => issue.field)).toEqual(['partsPerUnit'])
  })

  it('motor: una placa por tipo con sus horas y gramos; placas requeridas = ceil(N / unidades por placa)', () => {
    const p = preview(form({ quantity: '3', partsPerPlate: '1', ...PLATE2, ...PLATE3 }))
    const plates = p.request.input.plates
    expect(plates.map((plate) => [plate.id, plate.label, plate.partsPerPlate, plate.partsPerUnit, plate.printHours])).toEqual([
      ['plate-1', 'Placa 1', 1, 1, 5.5],
      ['plate-2', 'Placa 2', 1, 1, 1.2],
      ['plate-3', 'Placa 3', 2, 1, 0.5],
    ])
    expect(p.output.breakdown.platesRequired.map((entry) => [entry.plateId, entry.platesRequired])).toEqual([['plate-1', 3], ['plate-2', 3], ['plate-3', 2]])
    expect(p.summary.plates).toBe(8)
    // 3 × 5,5 h + 3 × 1,2 h + 2 × 0,5 h (la última placa 3 lleva 1 de 2 unidades: estimada como completa)
    expect(p.summary.totalPrintHours).toBe(21.1)
    expect(p.summary.plateBreakdown.map((line) => [line.label, line.physical, line.hoursEach, line.gramsEach])).toEqual([
      ['Placa 1', 3, 5.5, 340],
      ['Placa 2', 3, 1.2, 6.1],
      ['Placa 3', 2, 0.5, 12.4],
    ])
    expect(p.summary.plateBreakdown.every((line) => line.directCost > 0)).toBe(true)
    expect(p.output.flags.some((flag) => flag.code === 'LAST_PLATE_ESTIMATED')).toBe(true)
  })

  it('agregar una placa sube el costo y el precio; el snapshot incluye todos los materiales', () => {
    const one = preview(form({ quantity: '2', partsPerPlate: '1', plateWeightGr: '24.7' }))
    const two = preview(form({ quantity: '2', partsPerPlate: '1', plateWeightGr: '24.7', ...PLATE2 }))
    expect(two.summary.economicCost).toBeGreaterThan(one.summary.economicCost)
    expect(two.summary.grossTotal).toBeGreaterThan(one.summary.grossTotal)
    expect(Object.keys(two.request.params.materials).sort()).toEqual(['MAT-001', 'MAT-002'])
  })

  it('ensamblaje: con 3 placas por producto hay 2 piezas a unir por unidad', () => {
    const p = preview(form({ quantity: '2', partsPerPlate: '1', ...PLATE2, ...PLATE3, plate3Units: '1', assemblyMinutesPerExtraPart: '5' }), ['assembly'])
    const assembly = p.output.breakdown.items.find((item) => item.code.includes('assembly'))
    expect(assembly?.basis.multiplier).toBe(4)
  })

  it('importación: origen SLICER_IMPORT en todas las placas y trazabilidad del archivo en el formState', () => {
    const raw = form({ ...PLATE2, importFile: 'Color_Test.gcode.3mf', importSlicer: 'BambuStudio 02.08.02.61', importPrinter: 'Bambu Lab A1' })
    const p = preview(raw)
    expect(p.request.input.plates.every((plate) => plate.source === 'SLICER_IMPORT')).toBe(true)
    expect(p.form.importedFrom).toEqual({ fileName: 'Color_Test.gcode.3mf', slicer: 'BambuStudio 02.08.02.61', printer: 'Bambu Lab A1' })
    expect(toRawForm(p.form).importFile).toBe('Color_Test.gcode.3mf')
  })

  it('asistente por componentes guarda la composición sin cambiar el resultado económico', () => {
    const base = form({ quantity: '4', partsPerPlate: '2', ...PLATE2, plate2Units: '4' })
    const extra = {
      component1Name: 'Base', component1Required: '1', component1Produced: '2',
      component2Name: 'Laterales', component2Required: '2', component2Produced: '8',
    }
    const p = preview({ ...base, ...extra })
    const legacy = preview(base)
    expect(p.form.plateComposition).toEqual([
      { name: 'Base', required: 1, produced: 2 },
      { name: 'Laterales', required: 2, produced: 8 },
    ])
    expect(p.summary.economicCost).toBe(legacy.summary.economicCost)
    expect(p.summary.grossTotal).toBe(legacy.summary.grossTotal)
    const raw = toRawForm(p.form)
    expect(raw.component2Produced).toBe('8')
    const restored = parseQuoteForm(raw, p.form.extras)
    expect(restored.ok && restored.value).toEqual(p.form)
  })

  it('rechaza componentes incompletos o capacidades incoherentes antes de cotizar', () => {
    const base = form({ ...PLATE2, partsPerPlate: '2' })
    const bad = parseQuoteForm({ ...base, component1Required: '1', component1Produced: '1', component2Required: '2', component2Produced: '8' }, [])
    expect(bad.ok).toBe(false)
    if (bad.ok) return
    expect(bad.error.map((x) => x.field)).toContain('component1Produced')
    const blank = parseQuoteForm({ ...base, component1Required: '', component1Produced: '2', component2Required: '1', component2Produced: '1' }, [])
    expect(blank.ok).toBe(false)
    if (!blank.ok) expect(blank.error.map((x) => x.field)).toContain('component1Required')
  })

  it('materiales de todas las placas sin repetir', () => {
    const parsed = parseQuoteForm(form({ ...PLATE2, ...PLATE3 }), [])
    if (!parsed.ok) throw new Error('form')
    expect(allMaterialIds(parsed.value)).toEqual(['MAT-001', 'MAT-002'])
  })
})
