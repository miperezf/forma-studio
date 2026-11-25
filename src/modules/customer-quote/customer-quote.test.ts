import { describe, expect, it } from 'vitest'
import {
  buildCustomerQuote,
  CUSTOMER_QUOTE_KEYS,
  CUSTOMER_QUOTE_LINE_KEYS,
  customerQuoteText,
  formatClp,
  migrateLegacyCustomerQuote,
  type CommercialQuoteData,
  type CustomerQuoteLine,
} from './index'

const base: CommercialQuoteData = {
  id: 'COT-0005',
  clientName: 'Camila Rodríguez',
  project: 'Macetero geométrico',
  createdAt: '2026-10-20',
  validDays: 7,
  terms: 'Pago contra entrega.',
  taxTreatment: 'VAT_INCLUDED',
  lines: [
    { description: 'Macetero geométrico', quantity: 8, unitPrice: 14100, total: 112800 },
    { description: 'Diseño 3D personalizado (único)', quantity: 1, unitPrice: 55000, total: 55000 },
  ],
  vatAmount: null,
  total: 167800,
}

const built = (data: CommercialQuoteData) => {
  const result = buildCustomerQuote(data)
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('CustomerQuote: whitelist exacta', () => {
  it('tiene exactamente las claves permitidas, en el documento y en cada línea', () => {
    const quote = built(base)
    expect(Object.keys(quote).sort()).toEqual([...CUSTOMER_QUOTE_KEYS].sort())
    for (const line of quote.lines) expect(Object.keys(line).sort()).toEqual([...CUSTOMER_QUOTE_LINE_KEYS].sort())
  })

  it('no copia claves extra aunque el llamador las pase (no se esparce el objeto de entrada)', () => {
    const polluted = { ...base, economicCost: 91264, margin: 0.35, lines: base.lines.map((l) => ({ ...l, costBasis: 1 })) } as unknown as CommercialQuoteData
    const quote = built(polluted)
    expect(JSON.stringify(quote)).not.toContain('economicCost')
    expect(JSON.stringify(quote)).not.toContain('costBasis')
    expect(JSON.stringify(quote)).not.toContain('margin')
  })

  it('es inmutable', () => {
    const quote = built(base)
    expect(Object.isFrozen(quote) && Object.isFrozen(quote.lines) && Object.isFrozen(quote.lines[0])).toBe(true)
  })

  it('precio unitario y cantidad del producto principal salen de la primera línea', () => {
    const quote = built(base)
    expect(quote.quantity).toBe(8)
    expect(quote.unitPrice).toBe(14100)
  })
})

describe('CustomerQuote: los montos cuadran o no se construye', () => {
  const [mainLine, designLine] = base.lines as readonly [CustomerQuoteLine, CustomerQuoteLine]
  it.each([
    ['línea ≠ cantidad × unitario', { ...base, lines: [{ ...mainLine, total: 112801 }, designLine], total: 167801 }],
    ['líneas ≠ total', { ...base, total: 167900 }],
    ['IVA con VAT_INCLUDED', { ...base, vatAmount: 100 }],
    ['VAT_ADDED sin IVA', { ...base, taxTreatment: 'VAT_ADDED' as const }],
    ['monto no entero', { ...base, lines: [{ description: 'x', quantity: 1, unitPrice: 10.5, total: 10.5 }], total: 10.5 }],
    ['sin líneas', { ...base, lines: [], total: 0 }],
    ['fecha inválida', { ...base, createdAt: '20/10/2026' }],
    ['vigencia 0', { ...base, validDays: 0 }],
  ])('rechaza: %s', (_name, data) => {
    expect(buildCustomerQuote(data as CommercialQuoteData).ok).toBe(false)
  })

  it('VAT_ADDED: líneas netas + IVA = total', () => {
    const quote = built({ ...base, taxTreatment: 'VAT_ADDED', vatAmount: 31882, total: 199682 })
    expect(customerQuoteText(quote)).toContain('IVA: $31.882')
    expect(customerQuoteText(quote)).toContain('TOTAL: $199.682 (más IVA)')
  })
})

describe('texto para WhatsApp / copiar', () => {
  it('solo información comercial', () => {
    const text = customerQuoteText(built(base))
    expect(text).toContain('Macetero geométrico: 8 × $14.100 = $112.800')
    expect(text).toContain('TOTAL: $167.800 (IVA incluido)')
    expect(text).toMatch(/Validez: 7 días desde 2026-10-20/)
    expect(text).not.toMatch(/costo|margen|comisi|utilidad|markup|desgaste|fallas?|supervisi|electricidad/i)
  })

  it('no afecto: nunca dice «IVA incluido»', () => {
    const text = customerQuoteText(built({ ...base, taxTreatment: 'NOT_SUBJECT' }))
    expect(text).not.toContain('IVA incluido')
    expect(text).toContain('emisor no afecto a IVA')
  })

  const formats: [number, string][] = [
    [0, '$0'],
    [999, '$999'],
    [1000, '$1.000'],
    [167800, '$167.800'],
    [1234567, '$1.234.567'],
    [-2500, '-$2.500'],
  ]
  it.each(formats)('formatClp(%s) = %s', (value, text) => {
    expect(formatClp(value)).toBe(text)
  })
})

describe('migración del documento embebido de la Beta 0.5.2 (sin recalcular)', () => {
  it('seed COT-0203 (unitario aproximado, sin líneas): un renglón por el total acordado', () => {
    const legacy = { id: 'COT-0203', clientName: 'Camila Rodríguez', project: 'Macetero geométrico', quantity: 8, unitGross: 8563, gross: 68500, createdAt: '2026-10-14', status: 'Aceptada' }
    const result = migrateLegacyCustomerQuote(legacy, 'Condiciones')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.total).toBe(68500)
    expect(result.value.lines).toEqual([{ description: 'Macetero geométrico (8 unidad(es))', quantity: 1, unitPrice: 68500, total: 68500 }])
    expect(JSON.stringify(result.value)).not.toContain('status')
  })

  it('líneas guardadas que cuadran se conservan', () => {
    const legacy = { id: 'COT-0300', clientName: 'Ana', project: 'Llavero', gross: 12000, quantity: 4, createdAt: '2026-10-18', validDays: 10, terms: 'T', lines: [{ description: 'Llavero', quantity: 4, total: 12000 }] }
    const result = migrateLegacyCustomerQuote(legacy, 'X')
    expect(result.ok && result.value.lines[0]?.unitPrice === 3000 && result.value.validDays === 10).toBe(true)
  })

  it('basura → error, nunca un documento inventado', () => {
    expect(migrateLegacyCustomerQuote(null, 'x').ok).toBe(false)
    expect(migrateLegacyCustomerQuote({ id: '', gross: 'abc' }, 'x').ok).toBe(false)
  })
})
