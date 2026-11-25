import { err, ok, type Result } from '../../core/result'
import { CALCULATION_V2, validateCalculationRequest, type CalculationRequest } from '../calculation'
import { EXTRA_CODES, FIRST_EXTRA_PLATE, PERCENT, PROFILE_IDS, TARGET_MARGIN_REASON } from './constants'
import type { QuoteFormState } from './form'
import { purchaseAmount, toParameterSnapshotRaw, type ProfileIssue, type ShopProfiles } from './profiles'

/** Placa base del formulario; las adicionales (producto con varias placas) son `plate-2` … `plate-8`. */
const PLATE_ID = 'plate-1'
export const plateIdOf = (index: number): string => `plate-${String(index + 1)}`

/** Filamentos de una placa adicional: un material repetido se suma en una sola línea. */
function sumByMaterial(slots: readonly { materialId: string; grams: number }[]): { materialId: string; grams: number }[] {
  const byMaterial = new Map<string, number>()
  for (const slot of slots) byMaterial.set(slot.materialId, (byMaterial.get(slot.materialId) ?? 0) + slot.grams)
  return [...byMaterial.entries()].map(([materialId, grams]) => ({ materialId, grams }))
}

/** Todos los materiales de la cotización (placa base + adicionales), sin repetir, en orden de aparición. */
export function allMaterialIds(form: Pick<QuoteFormState, 'materialId' | 'plateWeightGr' | 'extraGrPerPlate' | 'extraFilaments' | 'extraPlates'>): string[] {
  const ids = plateFilaments(form).map((f) => f.materialId)
  for (const plate of form.extraPlates ?? []) for (const slot of plate.filaments) if (!ids.includes(slot.materialId)) ids.push(slot.materialId)
  return ids
}

/**
 * Filamentos de la placa: el principal (+ material no incluido) y, si es multicolor (AMS), los adicionales.
 * Un mismo material en dos posiciones del AMS se suma en una sola línea (el motor exige ids únicos por placa).
 */
/** Piezas de la última placa incompleta (0 = todas las placas van llenas). */
export function remainderParts(form: Pick<QuoteFormState, 'quantity' | 'partsPerUnit' | 'partsPerPlate'>): number {
  return (form.quantity * form.partsPerUnit) % form.partsPerPlate
}

/**
 * Última placa para el motor v2: solo si hay piezas restantes Y datos de Bambu Studio. Los gramos por color se
 * asignan al material de ese color (un material repetido se suma) y los colores en 0 se omiten.
 */
export function lastRunOf(form: QuoteFormState): { parts: number; filaments: { materialId: string; grams: number }[]; printHours: number } | null {
  const parts = remainderParts(form)
  if (parts === 0 || !form.lastRun) return null
  const colors = [form.materialId, ...(form.extraFilaments ?? []).map((slot) => slot.materialId)]
  const byMaterial = new Map<string, number>()
  form.lastRun.grams.forEach((grams, index) => {
    const materialId = colors[index]
    if (materialId !== undefined && grams > 0) byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + grams)
  })
  return { parts, filaments: [...byMaterial.entries()].map(([materialId, grams]) => ({ materialId, grams })), printHours: form.lastRun.printHours }
}

export function plateFilaments(form: Pick<QuoteFormState, 'materialId' | 'plateWeightGr' | 'extraGrPerPlate' | 'extraFilaments'>): { materialId: string; grams: number }[] {
  const byMaterial = new Map<string, number>()
  const add = (materialId: string, grams: number) => byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + grams)
  add(form.materialId, form.plateWeightGr + form.extraGrPerPlate)
  for (const slot of form.extraFilaments ?? []) add(slot.materialId, slot.grams)
  return [...byMaterial.entries()].map(([materialId, grams]) => ({ materialId, grams }))
}

/**
 * Mapper PURO formulario + perfiles → `CalculationRequest` (JSON plano). No calcula nada: solo traslada cantidades
 * y referencias. Toda cifra sale del motor.
 *  - gramos y horas son POR PLACA; el material no incluido (g/placa) se suma a los gramos y se marca
 *    `weightIncludesWaste` para no aplicar merma dos veces;
 *  - acabados (min/unidad) y ensamblaje (min/pieza extra) son servicios con minutos de la cotización;
 *  - embalaje: costo PER_UNIT (el de la cotización o el habitual del perfil);
 *  - diseño único: costo ONE_OFF en línea separada (nunca × N);
 *  - margen objetivo de esta venta: override TARGET_MARGIN con motivo auditable.
 */
export function buildCalculationRequestRaw(
  form: QuoteFormState,
  profiles: ShopProfiles,
  resolvedAt: string,
): Result<Record<string, unknown>, readonly ProfileIssue[]> {
  const params = toParameterSnapshotRaw(profiles, { ...form, materialIds: allMaterialIds(form) }, resolvedAt)
  const source = form.importedFrom ? 'SLICER_IMPORT' : 'MANUAL'
  const multi = (form.extraPlates ?? []).length > 0
  if (!params.ok) return params

  const services = [
    { serviceId: PROFILE_IDS.finishing, active: form.finishingMinutesPerUnit !== null, laborMinutes: form.finishingMinutesPerUnit ?? 0 },
    { serviceId: PROFILE_IDS.assembly, active: form.assemblyMinutesPerExtraPart !== null, laborMinutes: form.assemblyMinutesPerExtraPart ?? 0 },
  ]
  const packaging = form.packagingPerUnit ?? profiles.cost.packingPerUnit
  const extraCosts: Record<string, unknown>[] = [
    {
      code: EXTRA_CODES.packaging,
      label: 'Embalaje',
      component: 'PACKAGING',
      behavior: 'PER_UNIT',
      amount: purchaseAmount(packaging),
      recoveryConfig: { recovery: 'IN_PRICE' },
    },
  ]
  if (form.oneOffDesignCost !== null) {
    extraCosts.push({
      code: EXTRA_CODES.design,
      label: 'Diseño 3D personalizado',
      component: 'DESIGN',
      behavior: 'ONE_OFF',
      // Trabajo propio del taller: el monto digitado ES el costo (sin IVA que agregar ni recuperar).
      amount: { amount: form.oneOffDesignCost, basis: 'GROSS', vatRecoverable: false },
      recoveryConfig: { recovery: 'SEPARATE_LINE' },
    })
  }
  const overrides =
    form.targetMarginPct === null
      ? []
      : [{ kind: 'TARGET_MARGIN', value: form.targetMarginPct / PERCENT, reason: TARGET_MARGIN_REASON }]

  return ok({
    calculationVersion: CALCULATION_V2,
    mode: 'QUOTE',
    input: {
      quantity: form.quantity,
      batches: form.batches,
      plates: [
        {
          id: PLATE_ID,
          label: multi ? 'Placa 1' : 'Placa principal',
          filaments: plateFilaments(form),
          machineId: form.machineId,
          printHours: form.plateHours,
          partsPerPlate: form.partsPerPlate,
          partsPerUnit: form.partsPerUnit,
          weightIncludesWaste: true,
          source,
          ...((last) => (last === null ? {} : { lastRun: last }))(lastRunOf(form)),
        },
        // Placas adicionales: «unidades por placa» = piezas de la placa con 1 pieza por unidad vendida.
        ...(form.extraPlates ?? []).map((plate, index) => ({
          id: plateIdOf(index + FIRST_EXTRA_PLATE - 1),
          label: `Placa ${String(index + FIRST_EXTRA_PLATE)}`,
          filaments: sumByMaterial(plate.filaments),
          machineId: form.machineId,
          printHours: plate.printHours,
          partsPerPlate: plate.unitsPerPlate,
          partsPerUnit: 1,
          weightIncludesWaste: true,
          source,
        })),
      ],
      services,
      extraCosts,
      channelId: form.channelId,
    },
    params: params.value,
    overrides,
  })
}

export type MappingFailure =
  | { readonly kind: 'PROFILE'; readonly issues: readonly ProfileIssue[] }
  | { readonly kind: 'REQUEST'; readonly issues: readonly { readonly path: string; readonly message: string }[] }

/** Mapper + validador del motor: lo que sale de aquí es un `CalculationRequest` tipado y válido. */
export function buildCalculationRequest(
  form: QuoteFormState,
  profiles: ShopProfiles,
  resolvedAt: string,
): Result<CalculationRequest, MappingFailure> {
  const raw = buildCalculationRequestRaw(form, profiles, resolvedAt)
  if (!raw.ok) return err({ kind: 'PROFILE', issues: raw.error })
  const request = validateCalculationRequest(raw.value)
  if (!request.ok) return err({ kind: 'REQUEST', issues: request.error.map((item) => ({ path: item.path, message: item.message })) })
  return ok(request.value)
}
