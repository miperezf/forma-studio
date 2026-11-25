import type { CalculationFlag, CalculationOutput, CalculationRequest } from '../calculation'
import type { QuoteFormState } from './form'
import type { ProfileRef } from './profiles'

/** Por qué no se puede emitir al cliente. */
export type BlockingReason =
  | 'MARGIN_POLICY_BLOCK' // advertencia BLOCKING del motor (política BLOCK o CAP inviable)
  | 'LEGACY_DEMO_PRICE' // precio calculado con el estimador demo de la Beta (D11)
  | 'MISSING_CUSTOMER_QUOTE'

export interface Issuance {
  readonly issuable: boolean
  readonly blockingReasons: readonly BlockingReason[]
  /** Códigos de advertencia del motor (para mostrarlas internamente). */
  readonly warnings: readonly string[]
}

/**
 * Cotización INTERNA (nunca se envía al cliente). Guarda el snapshot completo para reproducirla:
 * `calculation.request` (entrada + parámetros resueltos con revisión + overrides) y `calculation.output`.
 * Los montos comerciales (`net`, `vat`, `gross`, `unitPrice`) quedan congelados: el pedido toma `gross`.
 * Compatibilidad con la Beta: `inputSnapshot` = `formState` (lo usa «Nueva revisión y recotizar»).
 */
export interface InternalQuote {
  readonly kind: 'InternalQuote'
  readonly id: string
  readonly clientId: string
  readonly project: string
  readonly quantity: number
  readonly status: 'Borrador'
  readonly createdAt: string
  readonly events: readonly { readonly type: string; readonly at: string; readonly fromQuote?: string }[]
  readonly revisionOf?: string
  readonly revision?: number
  readonly net: number
  readonly vat: number
  readonly gross: number
  readonly unitPrice: number
  readonly validDays: number
  readonly terms: string
  readonly calculationVersion: string
  readonly formState: QuoteFormState
  readonly inputSnapshot: QuoteFormState
  readonly calculation: { readonly request: CalculationRequest; readonly output: CalculationOutput }
  readonly profileRefs: Readonly<Record<'cost' | 'pricing' | 'tax' | 'channel' | 'material' | 'machine', ProfileRef>>
  readonly taxRegimeConfirmed: boolean
  readonly issuance: Issuance
  /** El documento comercial vive en OTRA colección; aquí solo su id. */
  readonly customerQuoteId: string
}

export function issuanceOf(flags: readonly CalculationFlag[], hasCustomerQuote: boolean): Issuance {
  const reasons: BlockingReason[] = []
  if (flags.some((flag) => flag.severity === 'BLOCKING')) reasons.push('MARGIN_POLICY_BLOCK')
  if (!hasCustomerQuote) reasons.push('MISSING_CUSTOMER_QUOTE')
  return {
    issuable: reasons.length === 0,
    blockingReasons: reasons,
    warnings: flags.filter((flag) => flag.severity !== 'INFO').map((flag) => flag.code),
  }
}
