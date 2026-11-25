import type { RecoveryConfig } from '../../contracts/cost-spec'
import type { CostBehavior, CostComponent } from '../../contracts/enums'
import type { CostDraft } from './context'

export interface DraftSpec {
  readonly code: string
  readonly label: string
  readonly component: CostComponent
  readonly behavior: CostBehavior
  /** Cantidad por unidad del conductor (g por placa, h por placa, 1…). */
  readonly quantity: number
  readonly unit: string
  /** Costo económico por `unit`. */
  readonly unitCost: number
  /** Cuántas veces aplica según `behavior`. */
  readonly multiplier: number
  /** IVA recuperable por `unit`. */
  readonly vatPerUnit: number
  readonly recoveryConfig: RecoveryConfig
  readonly plateId?: string
}

/**
 * Única forma de construir un ítem: garantiza `rawAmount = quantity × unitCost × multiplier`
 * (misma expresión que verifica `checkCostItemInvariants`) y el IVA prorrateado con los mismos factores.
 */
export function makeDraft(spec: DraftSpec): CostDraft {
  return {
    code: spec.code,
    label: spec.label,
    component: spec.component,
    behavior: spec.behavior,
    basis: { quantity: spec.quantity, unit: spec.unit, unitCost: spec.unitCost, multiplier: spec.multiplier },
    rawAmount: spec.quantity * spec.unitCost * spec.multiplier,
    vatRecoverableRaw: spec.quantity * spec.vatPerUnit * spec.multiplier,
    recoveryConfig: spec.recoveryConfig,
    ...(spec.plateId === undefined ? {} : { plateId: spec.plateId }),
  }
}
