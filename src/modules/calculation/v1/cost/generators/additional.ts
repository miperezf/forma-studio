import { err, ok } from '../../../../../core/result'
import type { CostSpec } from '../../../contracts/cost-spec'
import type { CostDraft } from '../context'
import { makeDraft } from '../draft'
import { quantityFor } from '../quantities'
import { purchase } from '../purchases'
import type { CostItemGenerator } from './types'
import type { Result } from '../../../../../core/result'
import type { CalculationError } from '../../../contracts/errors'
import type { CostContext } from '../context'

function fromSpecs(
  context: CostContext,
  specs: readonly CostSpec[],
  prefix: string,
): Result<readonly CostDraft[], CalculationError> {
  const drafts: CostDraft[] = []
  for (const spec of specs) {
    const amount = purchase(spec.amount, context.params.taxProfile)
    if (!amount.ok) return err(amount.error)
    drafts.push(
      makeDraft({
        code: `${prefix}:${spec.code}`,
        label: spec.label,
        component: spec.component,
        behavior: spec.behavior,
        quantity: 1,
        unit: 'u',
        unitCost: amount.value.economicCost,
        multiplier: quantityFor(spec.behavior, context.quantities),
        vatPerUnit: amount.value.vatRecoverable,
        recoveryConfig: spec.recoveryConfig,
      }),
    )
  }
  return ok(drafts)
}

/** Costos auxiliares del perfil (`aux:<code>`): reglas permanentes que aplican a toda cotización. */
export const auxiliaryGenerator: CostItemGenerator = (context) =>
  fromSpecs(context, context.params.costProfile.auxiliaryCosts, 'aux')

/** Costos adicionales de la cotización (`extra:<code>`): los declara quien cotiza. */
export const extraCostsGenerator: CostItemGenerator = (context) =>
  fromSpecs(context, context.input.extraCosts, 'extra')
