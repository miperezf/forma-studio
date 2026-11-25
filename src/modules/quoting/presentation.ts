import type { CalculationError, CalculationFlag, CalculationOutput } from '../calculation'
import { FIRST_EXTRA_PLATE, MAX_ISSUES_IN_MESSAGE, PERCENT } from './constants'
import type { QuoteFormState } from './form'

/** Textos en español para las advertencias del motor (solo vista INTERNA). */
export const FLAG_TEXT: Readonly<Record<string, string>> = {
  BELOW_TARGET: 'El precio queda bajo el margen objetivo.',
  BELOW_MIN: 'El margen queda bajo el mínimo permitido.',
  BLOCKED: 'Política de precios: no se puede emitir al cliente con este margen. Puedes guardarla como borrador.',
  DISCOUNT_CAPPED: 'El descuento se limitó para respetar el margen mínimo.',
  NEGATIVE_UTILITY: 'Con este precio el trabajo pierde dinero.',
  REAL_MARGIN_BELOW_MIN: 'Los costos absorbidos dejan el margen real bajo el mínimo.',
  PRICING_POOL_EMPTY: 'No hay costos que cobrar.',
  ASSEMBLY_WITHOUT_EXTRA_PARTS: 'Ensamblaje activo, pero el producto tiene una sola pieza (activa «Planificación especial»).',
  OVERRIDE_APPLIED: 'Se aplicó un ajuste particular a esta venta.',
  UNKNOWN_OVERRIDE_TARGET: 'Un ajuste no encontró a qué aplicarse.',
  LAST_PLATE_ESTIMATED: 'Última placa incompleta estimada como placa completa (estimación conservadora). Rebánala en Bambu Studio e ingresa sus datos para precisar.',
}

export function flagMessages(flags: readonly CalculationFlag[]): string[] {
  return flags.filter((flag) => flag.severity !== 'INFO' || flag.code === 'BELOW_TARGET').map((flag) => FLAG_TEXT[flag.code] ?? flag.code)
}

/** Mensaje accionable para un error del motor. */
export function calculationErrorMessage(error: CalculationError): string {
  switch (error.code) {
    case 'INFEASIBLE_MARGIN':
      return `No hay precio posible: la comisión del canal (${(error.effectiveCommission * PERCENT).toFixed(1)} %) más el margen (${(error.margin * PERCENT).toFixed(1)} %) llegan o superan el 100 %.`
    case 'NO_FEASIBLE_PRICE':
      return 'No existe un precio emitible que respete el margen mínimo con este redondeo. Revisa el margen mínimo o el redondeo.'
    case 'INVALID_INPUT':
      return `Revisa los datos: ${error.issues.map((item) => item.message).slice(0, MAX_ISSUES_IN_MESSAGE).join(' · ')}`
    case 'MISSING_PARAMETER':
      return `Falta un parámetro de configuración (${error.path}).`
    case 'INCONSISTENT_SNAPSHOT':
      return `Los perfiles guardados no son coherentes: ${error.detail}`
    case 'UNKNOWN_CALCULATION_VERSION':
      return `Versión de cálculo desconocida: ${error.version}.`
    case 'INTERNAL_INVARIANT':
      return 'Error interno del motor de cálculo. No se puede cotizar con estos datos; repórtalo.'
  }
}

const COMPONENT_GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ['Material', ['MATERIAL']],
  ['Electricidad', ['ELECTRICITY']],
  ['Desgaste y mantenimiento de máquina', ['WEAR']],
  ['Supervisión y preparación', ['SUPERVISION', 'SETUP']],
  ['Fallas esperadas', ['FAILURE']],
  ['Acabados y ensamblaje', ['POSTPROCESS', 'ASSEMBLY']],
  ['Embalaje', ['PACKAGING']],
  ['Diseño único', ['DESIGN']],
  ['Otros', ['AUXILIARY', 'SHIPPING', 'OTHER']],
]

/** Resumen INTERNO para la UI (KPIs y desglose). Nunca se usa para el cliente. */
export interface InternalSummary {
  readonly grossTotal: number
  readonly netTotal: number
  readonly vatTotal: number
  readonly unitPrice: number
  readonly economicCost: number
  readonly absorbedCost: number
  readonly deferredCost: number
  readonly commission: number
  readonly commercialUtility: number
  readonly commercialMarginPct: number | null
  readonly realMarginPct: number | null
  readonly plates: number
  /** Placas completas y última placa incompleta (v2). `lastRun` null = todas completas. */
  readonly fullPlates: number
  readonly lastRun: { readonly parts: number; readonly source: 'SLICED' | 'ESTIMATED_FULL_PLATE' } | null
  readonly totalPrintHours: number
  /** Desglose por placa (producto con varias placas): placas físicas, horas y gramos por placa, costo directo. */
  readonly plateBreakdown: readonly PlateLine[]
  readonly batches: number
  readonly discountPct: number
  readonly breakdown: readonly { readonly label: string; readonly amount: number }[]
  readonly floorNetTotal: number
  readonly messages: readonly string[]
}

export interface PlateLine {
  readonly plateId: string
  readonly label: string
  /** Placas físicas a imprimir de este tipo (incluye la última incompleta). */
  readonly physical: number
  readonly hoursEach: number
  readonly gramsEach: number
  /** Suma de los costos asignados a la placa (material, máquina, energía, fallas…; sin costos por unidad o lote). */
  readonly directCost: number
}

/** Horas y gramos POR PLACA según el formulario (placa base o adicional `plate-n`). */
function plateData(form: QuoteFormState, plateId: string): { hours: number; grams: number } {
  if (plateId === 'plate-1') {
    const grams = form.plateWeightGr + form.extraGrPerPlate + (form.extraFilaments ?? []).reduce((sum, slot) => sum + slot.grams, 0)
    return { hours: form.plateHours, grams }
  }
  const plate = (form.extraPlates ?? [])[Number(plateId.replace('plate-', '')) - FIRST_EXTRA_PLATE]
  return { hours: plate?.printHours ?? 0, grams: (plate?.filaments ?? []).reduce((sum, slot) => sum + slot.grams, 0) }
}

export function internalSummary(output: CalculationOutput, form: QuoteFormState): InternalSummary | null {
  const pricing = output.pricing
  if (pricing === null) return null
  const items = output.breakdown.items
  const plates = output.breakdown.platesRequired.reduce((sum, plate) => sum + plate.platesRequired, 0)
  // v1 (histórico) no trae fullPlates: todas se consideran completas (como se calcularon).
  const fullPlates = output.breakdown.platesRequired.reduce((sum, plate) => sum + (plate.fullPlates ?? plate.platesRequired), 0)
  const last = output.breakdown.platesRequired.find((plate) => plate.lastRun !== undefined)?.lastRun
  const lastRun = last === undefined ? null : { parts: last.parts, source: last.source }
  // Horas totales: placas completas × horas de SU placa + la última (rebanada o estimada como completa).
  let totalHours = 0
  const plateBreakdown = output.breakdown.platesRequired.map((entry) => {
    const data = plateData(form, entry.plateId)
    const full = entry.fullPlates ?? entry.platesRequired
    const lastHours = entry.lastRun === undefined ? 0 : entry.lastRun.source === 'SLICED' && entry.plateId === 'plate-1' ? (form.lastRun?.printHours ?? 0) : data.hours
    totalHours += full * data.hours + lastHours
    const directCost = items.filter((item) => item.plateId === entry.plateId || (item.plateId ?? '').startsWith(`${entry.plateId}.`)).reduce((sum, item) => sum + item.amount, 0)
    const label = entry.plateId === 'plate-1' ? ((form.extraPlates ?? []).length > 0 ? 'Placa 1' : 'Placa principal') : `Placa ${entry.plateId.replace('plate-', '')}`
    return { plateId: entry.plateId, label, physical: entry.platesRequired, hoursEach: data.hours, gramsEach: Math.round(data.grams * PERCENT) / PERCENT, directCost }
  })
  const breakdown = COMPONENT_GROUPS.map(([label, components]) => ({
    label,
    amount: items.filter((item) => components.includes(item.component)).reduce((sum, item) => sum + item.amount, 0),
  })).filter((group) => group.amount > 0)
  return {
    grossTotal: pricing.grossTotal,
    netTotal: pricing.netTotal,
    vatTotal: pricing.vatTotal,
    unitPrice: pricing.customerUnitPrice,
    economicCost: output.breakdown.pricingPool,
    absorbedCost: output.breakdown.absorbedCost,
    deferredCost: output.breakdown.deferredCost,
    commission: pricing.commission,
    commercialUtility: pricing.commercialUtility,
    commercialMarginPct: pricing.commercialMargin === null ? null : pricing.commercialMargin * PERCENT,
    realMarginPct: pricing.realMargin === null ? null : pricing.realMargin * PERCENT,
    plates,
    fullPlates,
    lastRun,
    totalPrintHours: Math.round(totalHours * PERCENT) / PERCENT,
    plateBreakdown,
    batches: form.batches,
    discountPct: pricing.discount.applied * PERCENT,
    breakdown,
    floorNetTotal: pricing.floorNetTotal,
    messages: flagMessages(output.flags),
  }
}
