import { err, InvariantViolation, ok, type Result } from '../../../../core/result'
import type { CalculationError } from '../../contracts/errors'
import {
  CalculationMode,
  FailureModelId,
  FailureOverrideMode,
  FailureRateSource,
  OverrideKind,
} from '../../contracts/enums'
import type { ResolvedFailureRate } from '../../contracts/results'
import type { CostContext, CostDraft } from './context'
import { inconsistentSnapshot } from './errors'

/**
 * Estrategia intercambiable del modelo de fallas. Solo define cuánto costo ADICIONAL genera una falla
 * respecto del costo de una impresión exitosa; el resto (qué ítems, qué tasa) lo resuelve `applyFailures`.
 */
export interface FailureModel {
  readonly id: FailureModelId
  /** ¿La tasa pertenece al dominio del modelo? Es la validación de tasas de cada estrategia. */
  acceptsRate(rate: number): boolean
  /**
   * Costo adicional como múltiplo del costo base del ítem. Requiere `acceptsRate(rate)`; con una tasa fuera
   * de dominio lanza `InvariantViolation` (los llamadores validan antes con `acceptsRate`).
   */
  extraCostFactor(rate: number, costFraction: number): number
}

/**
 * GEOMETRIC_RETRY: se reintenta hasta lograr una impresión buena. Intentos esperados = 1 / (1 − p),
 * es decir, p / (1 − p) intentos fallidos esperados, cada uno consume `costFraction` del costo base.
 *   costo esperado = costo × (1 + p / (1 − p) × costFraction)      (con costFraction = 1: costo / (1 − p))
 */
export const GEOMETRIC_RETRY: FailureModel = {
  id: FailureModelId.GEOMETRIC_RETRY,
  // p / (1 − p) no está definida en p = 1 (y diverge cerca de 1): el dominio es [0, 1).
  acceptsRate: (rate) => Number.isFinite(rate) && rate >= 0 && rate < 1,
  extraCostFactor: (rate, costFraction) => {
    if (!GEOMETRIC_RETRY.acceptsRate(rate)) {
      throw new InvariantViolation('failure.geometric-retry.rate', `tasa fuera de [0, 1): ${String(rate)}`)
    }
    return (rate / (1 - rate)) * costFraction
  },
}

export const FAILURE_MODELS: Readonly<Record<FailureModelId, FailureModel>> = {
  [FailureModelId.GEOMETRIC_RETRY]: GEOMETRIC_RETRY,
}

/** Tasa de falla efectiva y de dónde salió. */
export interface FailureRateResolution {
  readonly rate: number
  readonly source: FailureRateSource
  /** Id del material o máquina que la aportó, o del perfil de costos. */
  readonly sourceId: string
}

/**
 * Tasa de falla de una placa. Una falla ocurre por placa (se pierden todos sus filamentos), así que
 * todos los ítems de la placa comparten tasa. Precedencia:
 *   override de la cotización > material > máquina > perfil.
 * Con varios materiales con override en la misma placa se toma el MAYOR: política CONSERVADORA (el material
 * más delicado manda sobre el riesgo de toda la placa; en empate, el primero en el orden de filamentos).
 * Los ítems sin placa usan el override de la cotización o, si no hay, la del perfil.
 */
export function resolveFailureRate(context: CostContext, plateId: string | undefined): FailureRateResolution {
  const { params, overrides, input } = context
  for (const override of overrides) {
    if (override.kind === OverrideKind.FAILURE_RATE && override.value.mode === FailureOverrideMode.RATE) {
      return { rate: override.value.rate, source: FailureRateSource.QUOTE_OVERRIDE, sourceId: 'quote' }
    }
  }
  const plate = plateId === undefined ? undefined : input.plates.find((candidate) => candidate.id === plateId)
  if (plate !== undefined) {
    let best: FailureRateResolution | undefined
    for (const filament of plate.filaments) {
      const rate = params.materials[filament.materialId]?.failureRateOverride
      if (rate !== undefined && (best === undefined || rate > best.rate)) {
        best = { rate, source: FailureRateSource.MATERIAL_OVERRIDE, sourceId: filament.materialId }
      }
    }
    if (best !== undefined) return best
    const machineRate = params.machines[plate.machineId]?.failureRateOverride
    if (machineRate !== undefined) {
      return { rate: machineRate, source: FailureRateSource.MACHINE_OVERRIDE, sourceId: plate.machineId }
    }
  }
  return { rate: params.costProfile.failure.rate, source: FailureRateSource.PROFILE, sourceId: params.costProfile.ref.id }
}

export function failureRateFor(context: CostContext, plateId: string | undefined): number {
  return resolveFailureRate(context, plateId).rate
}

function failuresDisabled(context: CostContext): boolean {
  return (
    context.mode === CalculationMode.TEST ||
    context.overrides.some(
      (override) => override.kind === OverrideKind.FAILURE_RATE && override.value.mode === FailureOverrideMode.DISABLED,
    )
  )
}

/**
 * Transformación de fallas: por cada ítem cuyo componente está afectado, agrega un ítem FAILURE que
 *  - hereda `behavior`, `plateId` y `recoveryConfig` del ítem origen (escala igual y se recupera igual),
 *  - cuesta `rawAmount × extraCostFactor`, e IVA recuperable proporcional,
 *  - indica `derivedFrom` (código del origen). Los ítems FAILURE no se vuelven a afectar.
 * No hay ítems FAILURE en modo TEST, con el override DISABLED, ni con tasa efectiva 0.
 * Los ítems de falla se agregan al final, en el orden de sus orígenes.
 */
export function applyFailures(
  drafts: readonly CostDraft[],
  context: CostContext,
): Result<readonly CostDraft[], CalculationError> {
  if (failuresDisabled(context)) return ok(drafts)
  const { modelId, costFraction, affectedComponents } = context.params.costProfile.failure
  const model: FailureModel | undefined = FAILURE_MODELS[modelId]
  if (model === undefined) return err(inconsistentSnapshot(`modelo de fallas desconocido: ${String(modelId)}`))
  const failures: CostDraft[] = []
  for (const parent of drafts) {
    if (!affectedComponents.includes(parent.component)) continue
    const rate = failureRateFor(context, parent.plateId)
    if (!model.acceptsRate(rate)) {
      return err(inconsistentSnapshot(`el modelo ${model.id} no admite la tasa de falla ${String(rate)} (dominio [0, 1))`))
    }
    const factor = model.extraCostFactor(rate, costFraction)
    if (factor === 0) continue
    failures.push({
      code: `failure:${parent.code}`,
      label: `Fallas: ${parent.label}`,
      component: 'FAILURE',
      behavior: parent.behavior,
      basis: { quantity: parent.rawAmount, unit: 'CLP', unitCost: factor, multiplier: 1 },
      rawAmount: parent.rawAmount * factor,
      vatRecoverableRaw: parent.vatRecoverableRaw * factor,
      recoveryConfig: parent.recoveryConfig,
      derivedFrom: parent.code,
      ...(parent.plateId === undefined ? {} : { plateId: parent.plateId }),
    })
  }
  return ok([...drafts, ...failures])
}

/**
 * Tasa resuelta y procedencia para cada placa y para los ítems sin placa (GLOBAL). Se guarda en el
 * desglose, y por tanto en el snapshot de la cotización. Indica si la transformación se aplicó.
 */
export function describeFailureRates(context: CostContext): readonly ResolvedFailureRate[] {
  const { modelId, costFraction } = context.params.costProfile.failure
  const isTest = context.mode === CalculationMode.TEST
  const disabled = context.overrides.some(
    (override) => override.kind === OverrideKind.FAILURE_RATE && override.value.mode === FailureOverrideMode.DISABLED,
  )
  const entry = (plateId: string | undefined): ResolvedFailureRate => {
    const resolved = resolveFailureRate(context, plateId)
    const base = {
      scope: plateId === undefined ? ('GLOBAL' as const) : ('PLATE' as const),
      modelId,
      costFraction,
      ...(plateId === undefined ? {} : { plateId }),
    }
    if (disabled) {
      return { ...base, rate: 0, source: FailureRateSource.QUOTE_OVERRIDE, sourceId: 'quote', applied: false, inactiveReason: 'OVERRIDE_DISABLED' }
    }
    return {
      ...base,
      rate: resolved.rate,
      source: resolved.source,
      sourceId: resolved.sourceId,
      applied: !isTest,
      ...(isTest ? { inactiveReason: 'TEST_MODE' as const } : {}),
    }
  }
  return [...context.input.plates.map((plate) => entry(plate.id)), entry(undefined)]
}
