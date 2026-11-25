import { CostBehavior, CostComponent } from '../../contracts/enums'
import type { CostDraft } from './context'
import { makeDraft as build } from './draft'

/** Borrador mínimo y coherente (cantidad 1, PER_UNIT, multiplicador 1) para probar extensibilidad del motor. */
export function makeDraft(spec: { code: string; rawAmount: number }): CostDraft {
  return build({
    code: spec.code,
    label: spec.code,
    component: CostComponent.OTHER,
    behavior: CostBehavior.ONE_OFF,
    quantity: 1,
    unit: 'u',
    unitCost: spec.rawAmount,
    multiplier: 1,
    vatPerUnit: 0,
    recoveryConfig: { recovery: 'IN_PRICE' },
  })
}
