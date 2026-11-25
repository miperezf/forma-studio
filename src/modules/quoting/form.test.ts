import { describe, expect, it } from 'vitest'
import { parseQuoteForm, toRawForm } from './form'
import { form } from './testing/shop-fixtures'

describe('parseQuoteForm (Zod): un único cotizador con extras bajo demanda', () => {
  it('convierte los textos del formulario a números', () => {
    const result = parseQuoteForm(form(), [])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toMatchObject({ quantity: 8, partsPerPlate: 4, plateWeightGr: 340, plateHours: 5.5, channelId: 'direct' })
    expect(result.value).toMatchObject({ partsPerUnit: 1, batches: 1, extraGrPerPlate: 0, oneOffDesignCost: null, packagingPerUnit: null, targetMarginPct: null })
  })

  it('un extra APAGADO no aporta nada aunque el borrador tenga valores (ni siquiera se valida)', () => {
    const result = parseQuoteForm(form({ oneOffDesignCost: '50000', partsPerUnit: '3', batches: 'basura', targetMargin: '80' }), [])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toMatchObject({ oneOffDesignCost: null, partsPerUnit: 1, batches: 1, targetMarginPct: null })
  })

  it('un extra ENCENDIDO se valida y se usa', () => {
    const result = parseQuoteForm(form({ partsPerUnit: '2', batches: '3', extraGrPerPlate: '15' }), ['planning'])
    expect(result.ok && result.value.partsPerUnit === 2 && result.value.batches === 3 && result.value.extraGrPerPlate === 15).toBe(true)
  })

  it('vacío NO es cero: un campo vacío se rechaza; "0" es un valor válido donde el negocio lo permite', () => {
    expect(parseQuoteForm(form({ plateWeightGr: '' }), []).ok).toBe(false)
    expect(parseQuoteForm(form({ plateWeightGr: '0' }), []).ok).toBe(false) // una placa siempre consume filamento (contrato del motor)
    expect(parseQuoteForm(form({ extraGrPerPlate: '0', partsPerUnit: '1', batches: '1' }), ['planning']).ok).toBe(true)
    expect(parseQuoteForm(form({ oneOffDesignCost: '' }), ['design']).ok).toBe(false)
    const zero = parseQuoteForm(form({ oneOffDesignCost: '0' }), ['design'])
    expect(zero.ok && zero.value.oneOffDesignCost === 0).toBe(true)
  })

  it.each([
    ['quantity', '0'],
    ['quantity', '2.5'],
    ['partsPerPlate', '-1'],
    ['plateHours', '0'],
    ['plateHours', 'abc'],
    ['project', '   '],
    ['clientId', ''],
  ])('rechaza %s = %j con un mensaje para el operador', (field, value) => {
    const result = parseQuoteForm(form({ [field]: value }), [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error[0]?.message.length ?? 0).toBeGreaterThan(5)
  })

  it('margen de la venta fuera de rango (> 90 %) se rechaza', () => {
    expect(parseQuoteForm(form({ targetMargin: '95', validDays: '7', terms: '' }), ['sales']).ok).toBe(false)
  })

  it('toRawForm es la inversa de parseQuoteForm (para «Nueva revisión y recotizar»)', () => {
    const extras = ['design', 'finishing', 'assembly', 'packing', 'planning', 'sales']
    const raw = form({ oneOffDesignCost: '30000', finishingMinutesPerUnit: '10', assemblyMinutesPerExtraPart: '5', packagingPerUnit: '500', partsPerUnit: '2', batches: '3', extraGrPerPlate: '15', targetMargin: '40', validDays: '10', terms: 'Pago 50 %' })
    const first = parseQuoteForm(raw, extras)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const again = parseQuoteForm(toRawForm(first.value), first.value.extras)
    expect(again.ok && JSON.stringify(again.value) === JSON.stringify(first.value)).toBe(true)
  })
})
