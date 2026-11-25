import { canonicalize } from '../../core/canonical'
import { err, ok, type Result } from '../../core/result'
import { calculateFromRaw, type CalculationError, type CalculationOutput, type CalculationRequest, type QuoteCalculator } from '../calculation'
import { buildCustomerQuote, type CustomerQuote, type CustomerQuoteLine, type CustomerTaxTreatment } from '../customer-quote'
import { EXTRA_CODES, MAX_PATHS_IN_MESSAGE } from './constants'
import { parseQuoteForm, type FormIssue, type QuoteFormState } from './form'
import { issuanceOf, type InternalQuote, type Issuance } from './internal-quote'
import { buildCalculationRequest } from './mapper'
import { calculationErrorMessage, internalSummary, type InternalSummary } from './presentation'
import { resolveShopProfiles, type ProfileIssue, type ShopProfiles } from './profiles'
import type { ShopData } from './shop-data'

export type QuotingFailure =
  | { readonly kind: 'FORM'; readonly issues: readonly FormIssue[] }
  | { readonly kind: 'PROFILE'; readonly issues: readonly ProfileIssue[] }
  | { readonly kind: 'REQUEST'; readonly issues: readonly { readonly path: string; readonly message: string }[] }
  | { readonly kind: 'CALCULATION'; readonly error: CalculationError }
  | { readonly kind: 'CUSTOMER'; readonly issues: readonly { readonly path: string; readonly message: string }[] }

export function failureMessage(failure: QuotingFailure): string {
  switch (failure.kind) {
    case 'FORM':
      return failure.issues[0]?.message ?? 'Revisa los datos del formulario.'
    case 'PROFILE':
      return `Configuración del taller inválida: ${failure.issues.map((item) => `${item.path} (${item.message})`).slice(0, MAX_PATHS_IN_MESSAGE).join(' · ')}`
    case 'REQUEST':
      return `Datos no válidos para el motor: ${failure.issues.map((item) => `${item.path}: ${item.message}`).slice(0, MAX_PATHS_IN_MESSAGE).join(' · ')}`
    case 'CALCULATION':
      return calculationErrorMessage(failure.error)
    case 'CUSTOMER':
      return 'No se pudo armar el documento comercial con estos montos.'
  }
}

/** Reloj y contexto inyectados por la UI: la aplicación no lee la hora ni el almacenamiento. */
export interface QuoteContext {
  readonly shop: ShopData
  readonly clientName: string
  /** Instante ISO en que se resuelven los perfiles (Clock). */
  readonly resolvedAt: string
  /** Fecha local AAAA-MM-DD del documento. */
  readonly today: string
}

export interface QuotePreview {
  readonly form: QuoteFormState
  readonly profiles: ShopProfiles
  readonly request: CalculationRequest
  readonly output: CalculationOutput
  readonly summary: InternalSummary
  readonly customer: CustomerQuote
  readonly issuance: Issuance
  readonly taxRegimeConfirmed: boolean
  readonly notices: readonly string[]
}

export const PREVIEW_ID = 'VISTA-PREVIA'
export const TAX_REGIME_NOTICE =
  'Régimen tributario por confirmar: se usa el IVA configurado en el taller. No reemplaza asesoría tributaria.'

/** Descripción comercial de cada línea separada (nunca el código interno del ítem). */
const SEPARATE_LINE_TEXT: Readonly<Record<string, string>> = {
  [`extra:${EXTRA_CODES.design}`]: 'Diseño 3D personalizado (único)',
}

function taxTreatmentOf(profiles: ShopProfiles): CustomerTaxTreatment {
  if (profiles.tax.regime === 'NOT_REGISTERED') return 'NOT_SUBJECT'
  return profiles.tax.customerPriceMode === 'GROSS' ? 'VAT_INCLUDED' : 'VAT_ADDED'
}

export interface DraftOptions {
  readonly id: string
  readonly revisionOf?: string
  readonly revision?: number
  readonly fromQuote?: string
}

export interface QuoteService {
  preview(raw: Readonly<Record<string, unknown>>, extras: Iterable<string>, context: QuoteContext): Result<QuotePreview, QuotingFailure>
  createDraft(
    raw: Readonly<Record<string, unknown>>,
    extras: Iterable<string>,
    context: QuoteContext,
    options: DraftOptions,
  ): Result<{ readonly internal: InternalQuote; readonly customer: CustomerQuote; readonly preview: QuotePreview }, QuotingFailure>
  /** Recalcula el request guardado (con su versión) y compara canónicamente con el resultado guardado. */
  replay(internal: Pick<InternalQuote, 'calculation'>): Result<{ readonly identical: boolean }, QuotingFailure>
}

export function createQuoteService(dependencies: { readonly calculator: QuoteCalculator }): QuoteService {
  const { calculator } = dependencies

  function compute(
    raw: Readonly<Record<string, unknown>>,
    extras: Iterable<string>,
    context: QuoteContext,
    documentId: string,
  ): Result<QuotePreview, QuotingFailure> {
    const form = parseQuoteForm(raw, extras)
    if (!form.ok) return err({ kind: 'FORM', issues: form.error })
    const profiles = resolveShopProfiles(context.shop)
    if (!profiles.ok) return err({ kind: 'PROFILE', issues: profiles.error })
    const request = buildCalculationRequest(form.value, profiles.value, context.resolvedAt)
    if (!request.ok) return err(request.error)
    const output = calculator.calculate(request.value)
    if (!output.ok) return err({ kind: 'CALCULATION', error: output.error })
    const pricing = output.value.pricing
    const summary = internalSummary(output.value, form.value)
    if (pricing === null || summary === null) return err({ kind: 'CALCULATION', error: { code: 'INTERNAL_INVARIANT', invariant: 'quote.pricing' } })

    const lines: CustomerQuoteLine[] = pricing.lines.map((line) => ({
      description: line.kind === 'MAIN' ? form.value.project : (SEPARATE_LINE_TEXT[line.code] ?? 'Servicio adicional'),
      quantity: line.quantity,
      unitPrice: line.customerUnitPrice,
      total: line.customerLineTotal,
    }))
    const treatment = taxTreatmentOf(profiles.value)
    const customer = buildCustomerQuote({
      id: documentId,
      clientName: context.clientName,
      project: form.value.project,
      createdAt: context.today,
      validDays: form.value.validDays ?? profiles.value.commercial.validDays,
      terms: form.value.terms ?? profiles.value.commercial.terms,
      taxTreatment: treatment,
      lines,
      vatAmount: treatment === 'VAT_ADDED' ? pricing.vatTotal : null,
      total: pricing.grossTotal,
    })
    if (!customer.ok) return err({ kind: 'CUSTOMER', issues: customer.error.map((item) => ({ path: item.path, message: item.message })) })
    const confirmed = profiles.value.tax.regimeConfirmed
    return ok({
      form: form.value,
      profiles: profiles.value,
      request: request.value,
      output: output.value,
      summary,
      customer: customer.value,
      issuance: issuanceOf(output.value.flags, true),
      taxRegimeConfirmed: confirmed,
      notices: confirmed ? [] : [TAX_REGIME_NOTICE],
    })
  }

  return {
    preview: (raw, extras, context) => compute(raw, extras, context, PREVIEW_ID),

    createDraft(raw, extras, context, options) {
      const computed = compute(raw, extras, context, options.id)
      if (!computed.ok) return computed
      const preview = computed.value
      const pricing = preview.output.pricing
      if (pricing === null) return err({ kind: 'CALCULATION', error: { code: 'INTERNAL_INVARIANT', invariant: 'quote.pricing' } })
      const { profiles, form, request } = preview
      const material = request.params.materials[form.materialId]
      const machine = request.params.machines[form.machineId]
      if (material === undefined || machine === undefined) {
        return err({ kind: 'CALCULATION', error: { code: 'INCONSISTENT_SNAPSHOT', detail: 'material o máquina fuera del snapshot' } })
      }
      // El snapshot se guarda como JSON plano (lo que persistiría Firestore) y se reproduce desde ahí.
      const calculation = JSON.parse(JSON.stringify({ request, output: preview.output })) as InternalQuote['calculation']
      const internal: InternalQuote = {
        kind: 'InternalQuote',
        id: options.id,
        clientId: form.clientId,
        project: form.project,
        quantity: form.quantity,
        status: 'Borrador',
        createdAt: context.today,
        events: [
          options.fromQuote === undefined
            ? { type: 'CREATED', at: context.resolvedAt }
            : { type: 'REVISION_CREATED', at: context.resolvedAt, fromQuote: options.fromQuote },
        ],
        ...(options.revisionOf === undefined ? {} : { revisionOf: options.revisionOf }),
        ...(options.revision === undefined ? {} : { revision: options.revision }),
        net: pricing.netTotal,
        vat: pricing.vatTotal,
        gross: pricing.grossTotal,
        unitPrice: pricing.customerUnitPrice,
        validDays: preview.customer.validDays,
        terms: preview.customer.terms,
        calculationVersion: request.calculationVersion,
        formState: form,
        inputSnapshot: form,
        calculation,
        profileRefs: {
          cost: profiles.cost.ref,
          pricing: profiles.pricing.ref,
          tax: profiles.tax.ref,
          channel: request.params.channel.ref,
          material: material.ref,
          machine: machine.ref,
        },
        taxRegimeConfirmed: preview.taxRegimeConfirmed,
        issuance: preview.issuance,
        customerQuoteId: preview.customer.id,
      }
      return ok({ internal, customer: preview.customer, preview })
    },

    replay(internal) {
      const replayed = calculateFromRaw(calculator, JSON.parse(JSON.stringify(internal.calculation.request)))
      if (!replayed.ok) return err({ kind: 'CALCULATION', error: replayed.error })
      const stored = canonicalize(JSON.parse(JSON.stringify(internal.calculation.output)))
      const fresh = canonicalize(JSON.parse(JSON.stringify(replayed.value)))
      if (!stored.ok || !fresh.ok) return err({ kind: 'CALCULATION', error: { code: 'INTERNAL_INVARIANT', invariant: 'replay.canonical' } })
      return ok({ identical: stored.value === fresh.value })
    },
  }
}
