import { err, ok, type Result } from '../../core/result'
import { issue, type Issue } from '../../core/validation'
import {
  CUSTOMER_QUOTE_SCHEMA_VERSION,
  DATE_PATTERN,
  MAX_LINES,
  MAX_TEXT_LENGTH,
  MAX_VALID_DAYS,
  THOUSANDS_GROUP,
  THOUSANDS_SEPARATOR,
} from './constants'

/**
 * Cómo se presenta el IVA al cliente. Lo decide la capa de aplicación a partir del perfil tributario; este módulo
 * NO conoce el motor de cálculo (regla R3: la fuga de costos se corta por construcción).
 *  - VAT_INCLUDED: precios con IVA incluido (régimen afecto, modo bruto).
 *  - VAT_ADDED: precios netos; el IVA se suma al final (régimen afecto, modo neto).
 *  - NOT_SUBJECT: el emisor no es afecto a IVA; el total no incluye IVA.
 */
export type CustomerTaxTreatment = 'VAT_INCLUDED' | 'VAT_ADDED' | 'NOT_SUBJECT'

export interface CustomerQuoteLine {
  readonly description: string
  readonly quantity: number
  readonly unitPrice: number
  readonly total: number
}

/**
 * Documento comercial para el cliente: WHITELIST explícita. Es lo ÚNICO que consumen WhatsApp, PDF/impresión,
 * email o un futuro enlace público. Nunca contiene costos, comisión, utilidad, margen, desglose, snapshot ni perfiles.
 */
export interface CustomerQuote {
  readonly kind: 'CustomerQuote'
  readonly schemaVersion: typeof CUSTOMER_QUOTE_SCHEMA_VERSION
  readonly id: string
  readonly clientName: string
  readonly project: string
  readonly createdAt: string
  readonly validDays: number
  readonly terms: string
  readonly currency: 'CLP'
  readonly taxTreatment: CustomerTaxTreatment
  readonly lines: readonly CustomerQuoteLine[]
  /** Unidades del producto principal (primera línea). */
  readonly quantity: number
  /** Precio unitario del producto principal, en el modo que ve el cliente. */
  readonly unitPrice: number
  /** IVA a sumar: solo con VAT_ADDED; `null` en los demás casos. */
  readonly vatAmount: number | null
  /** Lo que paga el cliente. */
  readonly total: number
}

/** Campos permitidos, en orden. Cualquier otra clave es una fuga y se rechaza en los tests de contrato. */
export const CUSTOMER_QUOTE_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'clientName',
  'project',
  'createdAt',
  'validDays',
  'terms',
  'currency',
  'taxTreatment',
  'lines',
  'quantity',
  'unitPrice',
  'vatAmount',
  'total',
] as const satisfies readonly (keyof CustomerQuote)[]

export const CUSTOMER_QUOTE_LINE_KEYS = ['description', 'quantity', 'unitPrice', 'total'] as const satisfies readonly (keyof CustomerQuoteLine)[]

/** Datos comerciales de entrada. Se copian campo por campo: nunca se esparce (`...`) un objeto interno. */
export interface CommercialQuoteData {
  readonly id: string
  readonly clientName: string
  readonly project: string
  readonly createdAt: string
  readonly validDays: number
  readonly terms: string
  readonly taxTreatment: CustomerTaxTreatment
  readonly lines: readonly CustomerQuoteLine[]
  readonly vatAmount: number | null
  readonly total: number
}

const isClp = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

function text(issues: Issue[], path: string, value: string, required: boolean): string {
  const trimmed = String(value).trim()
  if (required && trimmed.length === 0) issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
  if (trimmed.length > MAX_TEXT_LENGTH) issues.push(issue(path, 'RANGE', 'Texto demasiado largo'))
  return trimmed
}

/**
 * Construye el documento comercial copiando SOLO los campos permitidos y verificando que cuadra:
 *  - cada línea: total = cantidad × precio unitario, enteros CLP;
 *  - Σ líneas (+ IVA si VAT_ADDED) = total; IVA presente solo con VAT_ADDED.
 */
export function buildCustomerQuote(data: CommercialQuoteData): Result<CustomerQuote, readonly Issue[]> {
  const issues: Issue[] = []
  const id = text(issues, 'id', data.id, true)
  const clientName = text(issues, 'clientName', data.clientName, true)
  const project = text(issues, 'project', data.project, true)
  const terms = text(issues, 'terms', data.terms, false)
  if (!DATE_PATTERN.test(data.createdAt)) issues.push(issue('createdAt', 'FORMAT', 'Fecha AAAA-MM-DD'))
  if (!Number.isSafeInteger(data.validDays) || data.validDays < 1 || data.validDays > MAX_VALID_DAYS) {
    issues.push(issue('validDays', 'RANGE', `Entre 1 y ${String(MAX_VALID_DAYS)} días`))
  }
  if (data.lines.length === 0 || data.lines.length > MAX_LINES) issues.push(issue('lines', 'RANGE', 'Debe tener entre 1 y 50 líneas'))
  const lines: CustomerQuoteLine[] = data.lines.map((line, index) => {
    const path = `lines[${String(index)}]`
    const description = text(issues, `${path}.description`, line.description, true)
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) issues.push(issue(`${path}.quantity`, 'RANGE', 'Entero ≥ 1'))
    if (!isClp(line.unitPrice) || !isClp(line.total)) issues.push(issue(path, 'TYPE', 'Montos enteros CLP no negativos'))
    if (line.unitPrice * line.quantity !== line.total) issues.push(issue(path, 'INCONSISTENT', 'total debe ser cantidad × precio unitario'))
    return Object.freeze({ description, quantity: line.quantity, unitPrice: line.unitPrice, total: line.total })
  })
  const linesTotal = lines.reduce((sum, line) => sum + line.total, 0)
  if (!isClp(data.total)) issues.push(issue('total', 'TYPE', 'Monto entero CLP no negativo'))
  if (data.taxTreatment === 'VAT_ADDED') {
    if (data.vatAmount === null || !isClp(data.vatAmount)) issues.push(issue('vatAmount', 'REQUIRED', 'IVA requerido cuando se suma al final'))
    else if (linesTotal + data.vatAmount !== data.total) issues.push(issue('total', 'INCONSISTENT', 'líneas + IVA debe ser el total'))
  } else {
    if (data.vatAmount !== null) issues.push(issue('vatAmount', 'INCONSISTENT', 'Solo se informa IVA cuando se suma al final'))
    if (linesTotal !== data.total) issues.push(issue('total', 'INCONSISTENT', 'Las líneas deben sumar el total'))
  }
  if (issues.length > 0) return err(issues)
  const main = lines[0]
  if (main === undefined) return err([issue('lines', 'RANGE', 'Debe tener al menos una línea')])
  const quote: CustomerQuote = {
    kind: 'CustomerQuote',
    schemaVersion: CUSTOMER_QUOTE_SCHEMA_VERSION,
    id,
    clientName,
    project,
    createdAt: data.createdAt,
    validDays: data.validDays,
    terms,
    currency: 'CLP',
    taxTreatment: data.taxTreatment,
    lines: Object.freeze(lines),
    quantity: main.quantity,
    unitPrice: main.unitPrice,
    vatAmount: data.vatAmount,
    total: data.total,
  }
  return ok(Object.freeze(quote))
}

/** $1.234.567 (sin Intl: este módulo es puro y determinista en cualquier entorno). */
export function formatClp(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const digits = String(Math.abs(Math.round(amount)))
  let grouped = ''
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index
    grouped += digits[index] ?? ''
    if (fromEnd > 1 && (fromEnd - 1) % THOUSANDS_GROUP === 0) grouped += THOUSANDS_SEPARATOR
  }
  return `${sign}$${grouped}`
}

export function taxLabel(treatment: CustomerTaxTreatment): string {
  if (treatment === 'VAT_INCLUDED') return 'IVA incluido'
  if (treatment === 'VAT_ADDED') return 'más IVA'
  return 'emisor no afecto a IVA'
}

/** Texto para WhatsApp/copiar: se arma SOLO desde CustomerQuote. */
export function customerQuoteText(quote: CustomerQuote): string {
  const out = [
    'FORMA STUDIO · COTIZACIÓN',
    `N°: ${quote.id}`,
    `Cliente: ${quote.clientName}`,
    `Proyecto: ${quote.project}`,
    '',
  ]
  for (const line of quote.lines) {
    out.push(`${line.description}: ${String(line.quantity)} × ${formatClp(line.unitPrice)} = ${formatClp(line.total)}`)
  }
  if (quote.taxTreatment === 'VAT_ADDED' && quote.vatAmount !== null) {
    out.push(`Subtotal neto: ${formatClp(quote.total - quote.vatAmount)}`, `IVA: ${formatClp(quote.vatAmount)}`)
  }
  out.push(
    `TOTAL: ${formatClp(quote.total)} (${taxLabel(quote.taxTreatment)})`,
    `Validez: ${String(quote.validDays)} días desde ${quote.createdAt}`,
  )
  if (quote.terms.length > 0) out.push(quote.terms)
  out.push('', 'Gracias por tu interés. Sujeto a confirmación antes de iniciar producción.')
  return out.join('\n')
}
