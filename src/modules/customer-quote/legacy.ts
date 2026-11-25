import { err, ok, type Result } from '../../core/result'
import { issue, type Issue } from '../../core/validation'
import { LEGACY_DEFAULT_VALID_DAYS } from './constants'
import { buildCustomerQuote, type CustomerQuote } from './customer-quote'

/**
 * Migra el `customerQuote` embebido de la Beta 0.5.2 ({id, clientName, project, quantity, unitGross, gross, lines?,
 * validDays?, terms?, createdAt}) al documento comercial v1. NO recalcula: conserva los montos acordados.
 * Si las líneas guardadas no cuadran (la Beta aproximaba el unitario), se emite una sola línea con el total.
 */
export function migrateLegacyCustomerQuote(raw: unknown, fallbackTerms: string): Result<CustomerQuote, readonly Issue[]> {
  if (raw === null || typeof raw !== 'object') return err([issue('customerQuote', 'TYPE', 'Documento comercial ausente')])
  const record = raw as Record<string, unknown>
  const gross = Number(record.gross)
  const quantity = Number(record.quantity)
  const base = {
    id: String(record.id ?? ''),
    clientName: String(record.clientName ?? ''),
    project: String(record.project ?? ''),
    createdAt: String(record.createdAt ?? ''),
    validDays: Number(record.validDays ?? LEGACY_DEFAULT_VALID_DAYS),
    terms: String(record.terms ?? fallbackTerms),
    taxTreatment: 'VAT_INCLUDED' as const,
    vatAmount: null,
    total: gross,
  }
  const legacyLines = Array.isArray(record.lines) ? record.lines : []
  const lines = legacyLines.map((line: unknown) => {
    const l = (line ?? {}) as Record<string, unknown>
    const total = Number(l.total)
    const qty = Number(l.quantity)
    return { description: String(l.description ?? ''), quantity: qty, unitPrice: qty > 0 && Number.isSafeInteger(total / qty) ? total / qty : Number.NaN, total }
  })
  const exact = lines.length > 0 ? buildCustomerQuote({ ...base, lines }) : undefined
  if (exact?.ok) return exact
  // Un renglón por el total acordado: cantidad 1 × total ("N unidades" queda en la descripción).
  const single = buildCustomerQuote({
    ...base,
    lines: [{ description: `${base.project} (${String(quantity)} unidad(es))`, quantity: 1, unitPrice: gross, total: gross }],
  })
  return single.ok ? ok(single.value) : single
}
