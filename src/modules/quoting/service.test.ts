import { describe, expect, it } from 'vitest'
import { createQuoteCalculator, isIssuable } from '../calculation'
import { customerQuoteText, CUSTOMER_QUOTE_KEYS } from '../customer-quote'
import { createQuoteService, PREVIEW_ID, TAX_REGIME_NOTICE } from './service'
import { context, form, FORBIDDEN_KEYS, FORBIDDEN_WORDS } from './testing/shop-fixtures'

const service = createQuoteService({ calculator: createQuoteCalculator() })
const preview = (raw = form(), extras: string[] = [], settings: Record<string, unknown> = {}) => {
  const result = service.preview(raw, extras, context(settings))
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}
const draft = (raw = form(), extras: string[] = [], settings: Record<string, unknown> = {}, id = 'COT-0005') => {
  const result = service.createDraft(raw, extras, context(settings), { id })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

/** Recorre recursivamente un valor y devuelve todas sus claves. */
function allKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out))
  else if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      out.push(key)
      allKeys(v, out)
    }
  }
  return out
}

describe('golden: el cotizador de la Beta con el motor v1 (verificados a mano)', () => {
  it('G1 · formulario por defecto (8 u, 4/placa, 340 g, 5,5 h, PLA $22.000/kg, venta directa) → $6.000 c/u, $48.000', () => {
    // material 22.000/1,19/1000 × 340 × 2 placas = 12.571 · electricidad 0,095 × 11 h × 210/1,19 = 184
    // desgaste (380.000/1,19/5.000 + 12) × 11 = 835 · supervisión 0,15 × 11 × 4.500 = 7.425 · preparación 1.500
    // embalaje 350/1,19 × 8 = 2.353 · fallas 5/95 de (material+electricidad+desgaste+supervisión) = 1.107
    // pool 25.975 → 25.975/0,65 × 1,19 / 8 = 5.944,3 → $6.000
    const p = preview()
    expect(p.output.breakdown.pricingPool).toBe(25975)
    expect(p.summary).toMatchObject({ plates: 2, totalPrintHours: 11, batches: 1, unitPrice: 6000, grossTotal: 48000, netTotal: 40336, vatTotal: 7664, commercialUtility: 14361, commission: 0 })
    expect(p.customer.lines).toEqual([{ description: 'Macetero geométrico', quantity: 8, unitPrice: 6000, total: 48000 }])
    expect(p.customer.total).toBe(48000)
    expect(p.customer.taxTreatment).toBe('VAT_INCLUDED')
  })

  it('G2 · no afecto (IVA 0 %): las compras son costo bruto, sin IVA de venta → $5.600 c/u', () => {
    // material 22 × 340 × 2 = 14.960 · electricidad 219 · desgaste 968 · embalaje 2.800 → pool 29.113 → /0,65/8 = 5.598,7 → $5.600
    const p = preview(form(), [], { taxRegime: 'NOT_REGISTERED', taxRate: 0 })
    expect(p.output.breakdown.pricingPool).toBe(29113)
    expect(p.summary).toMatchObject({ unitPrice: 5600, grossTotal: 44800, netTotal: 44800, vatTotal: 0, commercialUtility: 15687 })
    expect(p.customer.taxTreatment).toBe('NOT_SUBJECT')
    expect(customerQuoteText(p.customer)).not.toContain('IVA incluido')
  })

  it('G3 · marketplace 12 % + $250: el margen se mantiene DESPUÉS de la comisión → $7.400 c/u', () => {
    // (25.975 + 250)/(1 − 0,12 − 0,35) = 49.481 neto × 1,19 / 8 = 7.360 → $7.400; comisión 0,12 × 49.748 + 250 = 6.220
    const p = preview(form({ channel: 'marketplace' }))
    expect(p.summary).toMatchObject({ unitPrice: 7400, grossTotal: 59200, netTotal: 49748, commission: 6220, commercialUtility: 17553 })
    expect(p.summary.commercialMarginPct ?? 0).toBeGreaterThanOrEqual(35)
  })

  it('G4 · NRE + acabados + ensamblaje + 2 piezas/producto + 3 lotes + 15 g extra', () => {
    // placas ceil(8×2/4) = 4 · gramos 355/placa · preparación 3 lotes × 1.500 = 4.500 (PER_BATCH, no × N)
    // acabados 8 × 10/60 × 4.500 = 6.000 · ensamblaje 8 piezas extra × 5/60 × 4.500 = 3.000 · diseño 30.000 UNA vez
    // pool 91.264 = principal 61.264 + diseño 30.000 → objetivo 140.406 neto repartido por costo:
    // principal 94.252/8 × 1,19 = 14.020 → $14.100 · diseño 46.154 × 1,19 = 54.923 → $55.000
    const p = preview(
      form({ oneOffDesignCost: '30000', finishingMinutesPerUnit: '10', assemblyMinutesPerExtraPart: '5', partsPerUnit: '2', batches: '3', extraGrPerPlate: '15' }),
      ['design', 'finishing', 'assembly', 'planning'],
    )
    const amount = (code: string) => p.output.breakdown.items.find((item) => item.code === code)?.amount
    expect(p.summary.plates).toBe(4)
    expect(amount('setup:job')).toBe(4500)
    expect(amount('service:finishing')).toBe(6000)
    expect(amount('service:assembly')).toBe(3000)
    expect(amount('extra:design')).toBe(30000)
    expect(p.output.breakdown.pricingPool).toBe(91264)
    expect(p.customer.lines).toEqual([
      { description: 'Macetero geométrico', quantity: 8, unitPrice: 14100, total: 112800 },
      { description: 'Diseño 3D personalizado (único)', quantity: 1, unitPrice: 55000, total: 55000 },
    ])
    expect(p.customer.total).toBe(167800)
  })

  it('G5 · margen 50 % para esta venta (override auditado): $7.800 c/u; vigencia y condiciones propias', () => {
    const p = preview(form({ targetMargin: '50', validDays: '10', terms: 'Pago 50 % anticipado' }), ['sales'])
    expect(p.summary.unitPrice).toBe(7800)
    expect(p.request.overrides).toEqual([{ kind: 'TARGET_MARGIN', value: 0.5, reason: 'Ajuste en el cotizador' }])
    expect(p.customer).toMatchObject({ validDays: 10, terms: 'Pago 50 % anticipado' })
  })

  it('embalaje especial reemplaza al habitual; extra apagado = habitual del perfil', () => {
    const special = preview(form({ packagingPerUnit: '1190' }), ['packing'])
    expect(special.output.breakdown.items.find((i) => i.code === 'extra:packaging')?.amount).toBe(8000) // 1.190/1,19 × 8
    const usual = preview(form({ packagingPerUnit: '1190' }), [])
    expect(usual.output.breakdown.items.find((i) => i.code === 'extra:packaging')?.amount).toBe(2353)
  })

  it('cantidades: las horas son por placa (nunca × piezas); el material crece por placas completas', () => {
    const one = preview(form({ quantity: '1' }))
    const four = preview(form({ quantity: '4' }))
    const five = preview(form({ quantity: '5' }))
    expect([one.summary.plates, four.summary.plates, five.summary.plates]).toEqual([1, 1, 2])
    expect(one.summary.totalPrintHours).toBe(5.5)
    expect(four.summary.totalPrintHours).toBe(5.5)
    const material = (p: typeof one) => p.output.breakdown.items.find((i) => i.component === 'MATERIAL')?.amount
    expect(material(one)).toBe(material(four))
  })
})

describe('política bajo el mínimo (margen de la venta 20 % < mínimo 25 %)', () => {
  const low = form({ targetMargin: '20', validDays: '7', terms: '' })
  it('WARN: borrador emitible con advertencia', () => {
    const p = preview(low, ['sales'])
    expect(p.output.flags.map((f) => f.code)).toContain('BELOW_MIN')
    expect(p.issuance.issuable).toBe(true)
  })
  it('CAP: el precio sube hasta respetar el mínimo efectivo', () => {
    const warn = preview(low, ['sales'])
    const cap = preview(low, ['sales'], { onBelowMin: 'CAP' })
    expect(cap.summary.unitPrice).toBeGreaterThan(warn.summary.unitPrice)
    expect(cap.summary.commercialMarginPct ?? 0).toBeGreaterThanOrEqual(25)
    expect(cap.issuance.issuable).toBe(true)
  })
  it('BLOCK: se puede guardar como borrador, pero NO emitir', () => {
    const { internal, customer } = draft(low, ['sales'], { onBelowMin: 'BLOCK' })
    expect(internal.status).toBe('Borrador')
    expect(internal.issuance).toMatchObject({ issuable: false, blockingReasons: ['MARGIN_POLICY_BLOCK'] })
    expect(isIssuable(internal.calculation.output.flags)).toBe(false)
    expect(customer.total).toBe(internal.gross) // el documento existe (borrador), pero el flujo no deja enviarlo
  })
})

describe('errores explicables, nunca un precio inválido', () => {
  it('comisión + margen ≥ 100 % → INFEASIBLE_MARGIN con mensaje para el operador', () => {
    const result = service.preview(form({ channel: 'marketplace', targetMargin: '88', validDays: '7', terms: '' }), ['sales'], context())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ kind: 'CALCULATION', error: { code: 'INFEASIBLE_MARGIN' } })
  })
  it('configuración corrupta → PROFILE, sin calcular', () => {
    const result = service.preview(form(), [], context({ laborPerHour: '' }))
    expect(!result.ok && result.error.kind === 'PROFILE').toBe(true)
  })
  it('material borrado del catálogo → PROFILE', () => {
    const result = service.preview(form({ materialId: 'MAT-404' }), [], context())
    expect(!result.ok && result.error.kind === 'PROFILE').toBe(true)
  })
  it('régimen tributario sin confirmar → aviso interno (D2)', () => {
    expect(preview().notices).toEqual([TAX_REGIME_NOTICE])
  })
  it('régimen confirmado por el propietario (no afecto, 0 %) → sin aviso, sin IVA al cliente', () => {
    const result = service.preview(form(), [], context({ taxRegime: 'NOT_REGISTERED', taxRate: 0, taxRegimeConfirmed: true }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.notices).toEqual([])
    expect(result.value.taxRegimeConfirmed).toBe(true)
    expect(result.value.customer.vatAmount).toBeNull()
  })
})

describe('InternalQuote y CustomerQuote separados; sin fuga al cliente', () => {
  const extras = ['design', 'finishing', 'assembly', 'planning', 'packing', 'sales']
  const full = form({ oneOffDesignCost: '30000', finishingMinutesPerUnit: '10', assemblyMinutesPerExtraPart: '5', partsPerUnit: '2', batches: '3', extraGrPerPlate: '15', packagingPerUnit: '500', targetMargin: '40', validDays: '10', terms: 'Pago contra entrega' })

  it('el CustomerQuote tiene solo la whitelist, recursivamente sin ninguna clave interna', () => {
    const { customer } = draft(full, extras)
    expect(Object.keys(customer).sort()).toEqual([...CUSTOMER_QUOTE_KEYS].sort())
    const keys = allKeys(customer)
    for (const forbidden of FORBIDDEN_KEYS) expect(keys).not.toContain(forbidden)
  })

  it('el texto para WhatsApp no contiene palabras ni cifras internas', () => {
    const { customer, internal } = draft(full, extras)
    const text = customerQuoteText(customer)
    expect(text).not.toMatch(FORBIDDEN_WORDS)
    const pricing = internal.calculation.output.pricing
    if (pricing === null) throw new Error('pricing')
    for (const secret of [pricing.commission, pricing.commercialUtility, internal.calculation.output.breakdown.pricingPool, pricing.floorNetTotal]) {
      if (secret > 0) expect(text).not.toContain(String(secret))
    }
  })

  it('la vista previa usa el folio VISTA-PREVIA; el borrador, su folio', () => {
    expect(preview().customer.id).toBe(PREVIEW_ID)
    expect(draft().customer.id).toBe('COT-0005')
  })

  it('el InternalQuote guarda snapshot completo, versión, revisiones de perfiles y NO embebe el documento comercial', () => {
    const { internal } = draft(full, extras, { revision: 3 })
    expect(internal.calculationVersion).toBe('v2')
    expect(internal.profileRefs).toEqual({
      cost: { id: 'cost-shop', revision: 3 },
      pricing: { id: 'pricing-shop', revision: 3 },
      tax: { id: 'tax-shop', revision: 3 },
      channel: { id: 'direct', revision: 1 },
      material: { id: 'MAT-001', revision: 1 },
      machine: { id: 'MAC-001', revision: 1 },
    })
    expect(internal.calculation.request.params.resolvedAt).toBe('2026-10-20T15:00:00.000Z')
    expect(Object.keys(internal)).not.toContain('customerQuote')
    expect(internal.customerQuoteId).toBe('COT-0005')
    expect(internal.gross).toBe(internal.calculation.output.pricing?.grossTotal)
  })
})

describe('replay e inmutabilidad', () => {
  it('el snapshot guardado se recalcula idéntico (canónico)', () => {
    const { internal } = draft(form({ oneOffDesignCost: '30000' }), ['design'])
    const replay = service.replay(JSON.parse(JSON.stringify(internal)))
    expect(replay.ok && replay.value.identical).toBe(true)
  })

  it('cambiar después el precio del material o el margen del perfil NO cambia la cotización guardada', () => {
    const { internal } = draft()
    const cheaper = draft(form(), [], { targetMargin: 50, revision: 2 }, 'COT-0006').internal
    expect(cheaper.gross).not.toBe(internal.gross)
    const replay = service.replay(internal)
    expect(replay.ok && replay.value.identical).toBe(true)
    expect(internal.gross).toBe(48000)
  })

  it('un snapshot adulterado se detecta (no idéntico)', () => {
    const { internal } = draft()
    const tampered = JSON.parse(JSON.stringify(internal))
    tampered.calculation.output.pricing.grossTotal = 1
    const replay = service.replay(tampered)
    expect(replay.ok && replay.value.identical).toBe(false)
  })
})
