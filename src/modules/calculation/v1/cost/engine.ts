import { err, InvariantViolation, ok, type Result } from '../../../../core/result'
import { inconsistentSnapshot } from './errors'
import type { CalculationError } from '../../contracts/errors'
import { FlagCode, FlagSeverity, ServiceKind } from '../../contracts/enums'
import { checkCostBreakdownInvariants } from '../../contracts/invariants'
import type { CalculationRequest } from '../../contracts/request'
import type { CalculationFlag, CostBreakdown } from '../../contracts/results'
import type { CostContext, CostDraft, ResolvedQuantities } from './context'
import { applyFailures, describeFailureRates, FAILURE_MODELS } from './failure'
import { buildBreakdown, finalizeItem } from './finalize'
import { COST_GENERATORS, type CostItemGenerator } from './generators'
import { resolveQuantities } from './quantities'
import { applyItemRecoveryOverrides, unmatchedRecoveryOverrides } from './recovery-overrides'

/** Resultado de la capa de costos: el desglose, las cantidades usadas y las advertencias. */
export interface CostCalculation {
  readonly breakdown: CostBreakdown
  readonly quantities: ResolvedQuantities
  readonly flags: readonly CalculationFlag[]
}

function flagsFor(context: CostContext, unmatched: readonly { itemCode: string; index: number }[]): CalculationFlag[] {
  const flags: CalculationFlag[] = []
  const { input, params, quantities } = context
  input.services.forEach((selection, index) => {
    if (!selection.active) return
    const service = params.services[selection.serviceId]
    if (service?.kind === ServiceKind.ASSEMBLY && quantities.extraParts === 0) {
      flags.push({
        code: FlagCode.ASSEMBLY_WITHOUT_EXTRA_PARTS,
        // Informativa: el ítem queda en 0 y la cotización sigue siendo válida.
        severity: FlagSeverity.INFO,
        path: `input.services[${String(index)}]`,
      })
    }
  })
  for (const item of unmatched) {
    flags.push({
      code: FlagCode.UNKNOWN_OVERRIDE_TARGET,
      severity: FlagSeverity.WARNING,
      path: `overrides[${String(item.index)}]`,
    })
  }
  return flags
}

/** Extensión del motor: por defecto usa el registro de generadores de v1. */
export interface CostEngineOptions {
  readonly generators?: readonly CostItemGenerator[]
  /** Resolución de cantidades. Por defecto la de v1 (WHOLE_PLATES); v2 la usa para separar la última placa. */
  readonly resolveQuantities?: (input: CalculationRequest['input']) => Result<ResolvedQuantities, CalculationError>
}

function run(
  request: CalculationRequest,
  generators: readonly CostItemGenerator[],
  resolve: NonNullable<CostEngineOptions['resolveQuantities']>,
): Result<CostCalculation, CalculationError> {
  const quantities = resolve(request.input)
  if (!quantities.ok) return quantities

  const context: CostContext = {
    mode: request.mode,
    input: request.input,
    params: request.params,
    overrides: request.overrides,
    quantities: quantities.value,
  }

  // ① generadores (orden fijo)
  let drafts: CostDraft[] = []
  for (const generate of generators) {
    const generated = generate(context)
    if (!generated.ok) return generated
    drafts = [...drafts, ...generated.value]
  }
  // Datos corruptos que eludieron el validador (NaN, negativos) son errores de ENTRADA, no del motor.
  for (const draft of drafts) {
    if (!Number.isFinite(draft.rawAmount) || draft.rawAmount < 0 || !Number.isFinite(draft.vatRecoverableRaw)) {
      return err(inconsistentSnapshot(`el ítem ${draft.code} no tiene un monto finito y no negativo`))
    }
  }

  // Las tasas resueltas deben pertenecer al dominio del modelo (GEOMETRIC_RETRY: [0, 1)), en CUALQUIER modo:
  // un snapshot con una tasa fuera de dominio está corrupto aunque la transformación no se aplique.
  const failureRates = describeFailureRates(context)
  const model = FAILURE_MODELS[request.params.costProfile.failure.modelId]
  if (model === undefined) {
    return err(inconsistentSnapshot(`modelo de fallas desconocido: ${String(request.params.costProfile.failure.modelId)}`))
  }
  for (const entry of failureRates) {
    if (!model.acceptsRate(entry.rate)) {
      return err(inconsistentSnapshot(`el modelo ${model.id} no admite la tasa de falla ${String(entry.rate)} (dominio [0, 1))`))
    }
  }

  // ② recuperación por ítem (base) → ③ fallas (heredan la recuperación) → ② recuperación por ítem (FAILURE)
  const matched = new Set<string>()
  const recovered = applyItemRecoveryOverrides(drafts, context.overrides, matched)
  if (!recovered.ok) return recovered
  const withFailures = applyFailures(recovered.value, context)
  if (!withFailures.ok) return withFailures
  const baseCount = recovered.value.length
  const failureDrafts = applyItemRecoveryOverrides(withFailures.value.slice(baseCount), context.overrides, matched)
  if (!failureDrafts.ok) return failureDrafts
  const finalDrafts = [...withFailures.value.slice(0, baseCount), ...failureDrafts.value]

  // ④ redondeo por ítem y agregación
  const items = finalDrafts.map((draft) => finalizeItem(draft, quantities.value))
  const breakdown = buildBreakdown(items, quantities.value, failureRates)

  // ⑤ autoverificación: un fallo aquí es un defecto del motor, no un dato inválido
  const violations = checkCostBreakdownInvariants(breakdown, quantities.value.units)
  if (violations.length > 0) {
    throw new InvariantViolation('cost.breakdown', violations.map((v) => `${v.path}:${v.code}`).join(', '))
  }

  return ok({
    breakdown,
    quantities: quantities.value,
    flags: flagsFor(context, unmatchedRecoveryOverrides(context.overrides, matched)),
  })
}

/**
 * Calcula el desglose de costos de una solicitud YA VALIDADA (`validateCalculationRequest`).
 * Puro y determinista. Errores de entrada → `INVALID_INPUT`, `MISSING_PARAMETER`, `INCONSISTENT_SNAPSHOT`;
 * invariantes internas rotas → `INTERNAL_INVARIANT`.
 */
export function calculateCost(
  request: CalculationRequest,
  options: CostEngineOptions = {},
): Result<CostCalculation, CalculationError> {
  try {
    return run(request, options.generators ?? COST_GENERATORS, options.resolveQuantities ?? resolveQuantities)
  } catch (error) {
    if (error instanceof InvariantViolation) return err({ code: 'INTERNAL_INVARIANT', invariant: error.invariant })
    throw error
  }
}
