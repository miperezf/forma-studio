import { describe, expect, it } from 'vitest'
import { parseQuoteForm, toRawForm } from './form'
import { plateFilaments } from './mapper'
import { createQuoteService } from './service'
import { context, form } from './testing/shop-fixtures'
import { createQuoteCalculator } from '../calculation'

const service = createQuoteService({ calculator: createQuoteCalculator() })
const materialCost = (raw: Record<string, string>, extras: string[]) => {
  const result = service.preview(raw, extras, context())
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  const items = result.value.output.breakdown.items.filter((i) => i.component === 'MATERIAL')
  return { total: items.reduce((sum, i) => sum + i.amount, 0), items, result: result.value }
}

describe('placa multicolor (AMS lite): varios filamentos en una placa', () => {
  it('formulario: colores 2..4 con material y gramos; ida y vuelta exacta', () => {
    const parsed = parseQuoteForm(form({ amsMaterial2: 'MAT-002', amsGrams2: '25' }), ['multicolor'])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.extraFilaments).toEqual([{ materialId: 'MAT-002', grams: 25 }])
    const again = parseQuoteForm(toRawForm(parsed.value), parsed.value.extras)
    expect(again.ok && again.value).toEqual(parsed.value)
  })

  it('apagado no aporta nada aunque haya campos; encendido exige al menos un color adicional válido', () => {
    const off = parseQuoteForm(form({ amsMaterial2: 'MAT-002', amsGrams2: '25' }), [])
    expect(off.ok && off.value.extraFilaments).toEqual([])
    const empty = parseQuoteForm(form(), ['multicolor'])
    expect(!empty.ok && empty.error.map((i) => i.field)).toEqual(['amsMaterial2'])
    const noGrams = parseQuoteForm(form({ amsMaterial3: 'MAT-002' }), ['multicolor'])
    expect(!noGrams.ok && noGrams.error[0]?.field).toBe('amsGrams3')
    const noMaterial = parseQuoteForm(form({ amsGrams2: '10' }), ['multicolor'])
    expect(!noMaterial.ok && noMaterial.error[0]?.field).toBe('amsMaterial2')
  })

  it('formState guardado antes del multicolor (sin extraFilaments) sigue funcionando', () => {
    const parsed = parseQuoteForm(form(), [])
    if (!parsed.ok) throw new Error('form')
    const legacy = Object.fromEntries(Object.entries(parsed.value).filter(([key]) => key !== 'extraFilaments')) as unknown as typeof parsed.value
    expect(plateFilaments(legacy)).toEqual([{ materialId: 'MAT-001', grams: 340 }])
    expect(toRawForm(legacy).amsMaterial2).toBeUndefined()
  })

  it('mismo material en dos posiciones del AMS se suma en una sola línea', () => {
    expect(plateFilaments({ materialId: 'MAT-001', plateWeightGr: 300, extraGrPerPlate: 10, extraFilaments: [{ materialId: 'MAT-002', grams: 20 }, { materialId: 'MAT-001', grams: 5 }] }))
      .toEqual([{ materialId: 'MAT-001', grams: 315 }, { materialId: 'MAT-002', grams: 20 }])
  })

  it('costo de material = suma por filamento a su precio; el snapshot incluye ambos materiales', () => {
    const one = materialCost(form({ plateWeightGr: '300' }), [])
    const two = materialCost(form({ plateWeightGr: '300', amsMaterial2: 'MAT-002', amsGrams2: '40' }), ['multicolor'])
    expect(two.items.length).toBe(2)
    expect(two.total).toBeGreaterThan(one.total)
    const petgOnly = materialCost(form({ materialId: 'MAT-002', plateWeightGr: '40' }), [])
    expect(Math.abs(two.total - (one.total + petgOnly.total))).toBeLessThanOrEqual(2)
    expect(Object.keys(two.result.request.params.materials).sort()).toEqual(['MAT-001', 'MAT-002'])
  })

  it('material adicional inexistente → error de perfil en su campo', () => {
    const result = service.preview(form({ amsMaterial2: 'MAT-404', amsGrams2: '10' }), ['multicolor'], context())
    expect(!result.ok && result.error.kind).toBe('PROFILE')
  })
})
