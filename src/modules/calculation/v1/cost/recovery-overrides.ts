import { err, ok, type Result } from '../../../../core/result'
import { issue } from '../../../../core/validation'
import type { CalculationError } from '../../contracts/errors'
import { CostBehavior, OverrideKind } from '../../contracts/enums'
import type { OverrideEntry } from '../../contracts/overrides'
import type { CostDraft } from './context'

/**
 * Aplica los overrides ITEM_RECOVERY a los ítems cuyo código coincide. Registra en `matched` los códigos
 * encontrados (se llama dos veces: ítems base y, tras el modelo de fallas, ítems FAILURE).
 * Una amortización solo es válida sobre un ítem ONE_OFF; si no, la entrada es inválida.
 */
export function applyItemRecoveryOverrides(
  drafts: readonly CostDraft[],
  overrides: readonly OverrideEntry[],
  matched: Set<string>,
): Result<readonly CostDraft[], CalculationError> {
  const byCode = new Map<string, { override: Extract<OverrideEntry, { kind: 'ITEM_RECOVERY' }>; index: number }>()
  overrides.forEach((override, index) => {
    if (override.kind === OverrideKind.ITEM_RECOVERY) byCode.set(override.itemCode, { override, index })
  })
  if (byCode.size === 0) return ok(drafts)

  const result: CostDraft[] = []
  for (const draft of drafts) {
    const found = byCode.get(draft.code)
    if (found === undefined) {
      result.push(draft)
      continue
    }
    matched.add(draft.code)
    if (found.override.value.amortization !== undefined && draft.behavior !== CostBehavior.ONE_OFF) {
      return err({
        code: 'INVALID_INPUT',
        issues: [
          issue(
            `overrides[${String(found.index)}].value.amortization`,
            'INCONSISTENT',
            `La amortización solo aplica a ítems ONE_OFF; ${draft.code} es ${draft.behavior}`,
          ),
        ],
      })
    }
    result.push({ ...draft, recoveryConfig: found.override.value })
  }
  return ok(result)
}

/** Códigos de ITEM_RECOVERY que no coincidieron con ningún ítem, con su índice en `overrides`. */
export function unmatchedRecoveryOverrides(
  overrides: readonly OverrideEntry[],
  matched: ReadonlySet<string>,
): readonly { itemCode: string; index: number }[] {
  const unmatched: { itemCode: string; index: number }[] = []
  overrides.forEach((override, index) => {
    if (override.kind === OverrideKind.ITEM_RECOVERY && !matched.has(override.itemCode)) {
      unmatched.push({ itemCode: override.itemCode, index })
    }
  })
  return unmatched
}
