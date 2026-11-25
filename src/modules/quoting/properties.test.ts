import { describe, expect, it } from 'vitest'
import { checkPricingInvariants, createQuoteCalculator, isIssuable } from '../calculation'
import { customerQuoteText } from '../customer-quote'
import { createQuoteService } from './service'
import { context, form, FORBIDDEN_KEYS, FORBIDDEN_WORDS } from './testing/shop-fixtures'

/**
 * Barrido pseudoaleatorio determinista (semilla fija; fast-check no se pudo instalar en este entorno).
 * Propiedades: o hay un error explicado o el documento cuadra con el motor, no filtra nada interno, la emisión
 * coincide con las advertencias BLOCKING y el snapshot se reproduce idéntico.
 */
function lcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}
const pick = <T>(random: () => number, values: readonly T[]): T => values[Math.floor(random() * values.length)] as T

const service = createQuoteService({ calculator: createQuoteCalculator() })
const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap(keysOf) : value !== null && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keysOf(v)]) : []

describe('propiedades del cotizador integrado (400 casos)', () => {
  it('documento = motor, sin fugas, emisión coherente, replay idéntico', () => {
    const random = lcg(20261020)
    let calculated = 0
    let explained = 0
    for (let n = 0; n < 400; n += 1) {
      const extras = ['design', 'finishing', 'assembly', 'packing', 'planning', 'sales'].filter(() => random() < 0.4)
      const raw = form({
        quantity: String(pick(random, [1, 2, 3, 7, 8, 12, 25, 50, 99, 240])),
        partsPerPlate: String(pick(random, [1, 2, 4, 6, 9])),
        plateWeightGr: String(pick(random, [0.5, 12.5, 80, 340, 900])),
        plateHours: String(pick(random, [0.2, 1, 5.5, 14])),
        materialId: pick(random, ['MAT-001', 'MAT-002']),
        channel: pick(random, ['direct', 'instagram', 'web', 'marketplace']),
        oneOffDesignCost: String(pick(random, [0, 15000, 30000])),
        finishingMinutesPerUnit: String(pick(random, [0, 3, 10])),
        assemblyMinutesPerExtraPart: String(pick(random, [0, 5])),
        packagingPerUnit: String(pick(random, [0, 350, 900])),
        partsPerUnit: String(pick(random, [1, 2, 3])),
        batches: String(pick(random, [1, 2, 5])),
        extraGrPerPlate: String(pick(random, [0, 10])),
        targetMargin: String(pick(random, [10, 20, 35, 60, 85])),
        validDays: '7',
        terms: '',
      })
      const settings = {
        onBelowMin: pick(random, ['WARN', 'CAP', 'BLOCK']),
        ...pick(random, [{ taxRegime: 'NOT_REGISTERED', taxRate: 0 }, { taxRegime: 'VAT_REGISTERED', taxRate: 19 }]),
        priceRounding: pick(random, [0, 10, 100, 1000]),
      }
      const result = service.createDraft(raw, extras, context(settings), { id: `COT-${String(n + 1).padStart(4, '0')}` })
      if (!result.ok) {
        // única causa aceptable en este espacio: margen + comisión inviables
        if (result.error.kind !== 'CALCULATION') throw new Error(JSON.stringify({ error: result.error, raw, extras, settings }))
        if (result.error.kind === 'CALCULATION') expect(['INFEASIBLE_MARGIN', 'NO_FEASIBLE_PRICE']).toContain(result.error.error.code)
        explained += 1
        continue
      }
      calculated += 1
      const { internal, customer } = result.value
      const pricing = internal.calculation.output.pricing
      if (pricing === null) throw new Error('pricing')
      expect(checkPricingInvariants(pricing, internal.calculation.output.breakdown)).toEqual([])
      expect(customer.total).toBe(pricing.grossTotal)
      expect(customer.lines.reduce((s, l) => s + l.total, 0) + (customer.vatAmount ?? 0)).toBe(customer.total)
      expect(customer.lines.every((l) => l.total === l.unitPrice * l.quantity)).toBe(true)
      expect(internal.issuance.issuable).toBe(isIssuable(internal.calculation.output.flags))
      if (settings.onBelowMin === 'CAP' && pricing.commercialMargin !== null) expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.25 - 1e-12)
      const keys = keysOf(customer)
      for (const forbidden of FORBIDDEN_KEYS) expect(keys.includes(forbidden)).toBe(false)
      expect(FORBIDDEN_WORDS.test(customerQuoteText(customer))).toBe(false)
      if (n % 10 === 0) {
        const replay = service.replay(JSON.parse(JSON.stringify(internal)))
        expect(replay.ok && replay.value.identical).toBe(true)
      }
    }
    expect(calculated + explained).toBe(400)
    expect(calculated).toBeGreaterThan(300)
  })
})
