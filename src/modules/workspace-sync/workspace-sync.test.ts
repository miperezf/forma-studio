import { describe, expect, it } from 'vitest'
import { createQuoteCalculator } from '../calculation'
import { createQuoteService } from '../quoting'
import { context, form } from '../quoting/testing/shop-fixtures'
import { chunk, fromWorkspaceDocuments, planWrites, toWorkspaceDocuments, type WorkspaceDocument } from './index'

const service = createQuoteService({ calculator: createQuoteCalculator() })
function stateWithQuote() {
  const draft = service.createDraft(form({ oneOffDesignCost: '30000' }), ['design'], context(), { id: 'COT-0001' })
  if (!draft.ok) throw new Error('draft')
  return {
    clients: [{ id: 'CLI-001', name: 'Camila Rodríguez', createdAt: '2026-10-02' }],
    materials: [{ id: 'MAT-001', name: 'PLA', priceKg: 22000, revision: 1 }],
    printers: [],
    projects: [],
    orders: [{ id: 'PED-0001', quoteId: 'COT-0001', amount: draft.value.internal.gross, payments: [], events: [], extra: undefined }],
    quotes: [draft.value.internal],
    customerQuotes: [draft.value.customer],
    products: [{ id: 'PRD-0001', name: 'Llavero', createdAt: '2026-10-22T10:00:00Z', formState: { quantity: 4 } }],
    shopSettings: { revision: 1, targetMargin: 35 },
    meta: { schema: 2 },
  }
}
const docs = (state: Record<string, unknown>): readonly WorkspaceDocument[] => {
  const result = toWorkspaceDocuments(state)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('estado de la app ⇄ documentos Firestore', () => {
  it('una InternalQuote real del motor (con snapshot completo) es un documento válido: sin listas anidadas ni undefined', () => {
    const result = toWorkspaceDocuments(stateWithQuote())
    expect(result.ok).toBe(true)
  })

  it('material del catálogo de filamentos (rangos, rasgos, referencia) es un documento válido', () => {
    const material = {
      id: 'MAT-005', name: 'PLA Basic Black', brand: 'Bambu Lab', type: 'PLA', color: 'Black', hex: '#000000', priceKg: 22000, stockKg: 2.4,
      pricePerSpool: 22000, spools: 2, openRemainingG: 400, spoolNetG: 1000, emptySpoolG: null, gtin: '6975337031383', diameter: 1.75, density: 1.24,
      nozzleC: [null, 220], bedC: null, maxDryC: null, traits: ['matte'], dataSheetUrl: 'https://example.com/tds.pdf',
      catalogRef: { source: 'OFD', lineId: 'bambu_lab/PLA/basic', colorId: 'black', sizeKey: '1000', snapshot: '2026-10-21' }, revision: 1,
    }
    const result = toWorkspaceDocuments({ materials: [material] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[0]?.collection).toBe('materials')
    const [restored] = fromWorkspaceDocuments(result.value).materials as readonly unknown[]
    expect(restored).toMatchObject({ nozzleC: [null, 220], catalogRef: { lineId: 'bambu_lab/PLA/basic' } })
  })

  it('cotización interna y documento comercial quedan en colecciones DISTINTAS', () => {
    const collections = docs(stateWithQuote()).map((d) => `${d.collection}/${d.id}`)
    expect(collections).toContain('internalQuotes/COT-0001')
    expect(collections).toContain('customerQuotes/COT-0001')
    expect(collections).toContain('settings/shop')
    expect(collections).toContain('settings/meta')
  })

  it('ida y vuelta sin pérdida (los undefined desaparecen, como en JSON)', () => {
    const state = stateWithQuote()
    const back = fromWorkspaceDocuments(docs(state))
    expect(JSON.parse(JSON.stringify(back))).toEqual(JSON.parse(JSON.stringify(state)))
  })

  const invalid: [string, Record<string, unknown>][] = [
    ['sin id', { clients: [{ name: 'x' }] }],
    ['id con barra', { clients: [{ id: 'a/b' }] }],
    ['id duplicado', { clients: [{ id: 'CLI-1' }, { id: 'CLI-1' }] }],
    ['lista dentro de lista', { clients: [{ id: 'CLI-1', grid: [[1, 2]] }] }],
    ['colección que no es lista', { clients: { id: 'CLI-1' } }],
  ]
  it.each(invalid)('rechaza datos que Firestore no puede guardar: %s', (_name, state) => {
    expect(toWorkspaceDocuments(state).ok).toBe(false)
  })
})

describe('planWrites: solo lo que cambió', () => {
  it('sin cambios ⇒ 0 escrituras', () => {
    const d = docs(stateWithQuote())
    expect(planWrites(d, docs(stateWithQuote()))).toEqual([])
  })

  it('un cambio de estado ⇒ 1 escritura de ese documento; el orden de claves no importa', () => {
    const before = stateWithQuote()
    const after = stateWithQuote()
    ;(after.quotes[0] as { status: string }).status = 'Enviada'
    const ops = planWrites(docs(before), docs(after))
    expect(ops.map((o) => `${o.kind}:${o.collection}/${o.id}`)).toEqual(['set:internalQuotes/COT-0001'])
  })

  it('alta y baja', () => {
    const before = stateWithQuote()
    const after = stateWithQuote()
    after.clients = [{ id: 'CLI-002', name: 'Nuevo', createdAt: '2026-10-21' }]
    const ops = planWrites(docs(before), docs(after)).map((o) => `${o.kind}:${o.collection}/${o.id}`)
    expect(ops).toEqual(['set:clients/CLI-002', 'delete:clients/CLI-001'])
  })

  it('chunk respeta el tamaño de lote', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
