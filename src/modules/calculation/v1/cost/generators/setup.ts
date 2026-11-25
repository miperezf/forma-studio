import { ok } from '../../../../../core/result'
import { CostBehavior, CostComponent, LaborKind } from '../../../contracts/enums'
import { MINUTES_PER_HOUR } from '../constants'
import { makeDraft } from '../draft'
import { quantityFor } from '../quantities'
import { laborRate } from '../purchases'
import type { CostItemGenerator } from './types'

/**
 * Preparación (mano de obra, tarifa PREPARATION):
 *  - `setup:job`        PER_BATCH: minutos del trabajo / 60 × tarifa × B. Por LOTE de trabajo, no por pieza ni por placa.
 *  - `setup:changeover` PER_PLATE: minutos de cambio de placa / 60 × tarifa × Σ placas requeridas (0 min por defecto).
 */
export const setupGenerator: CostItemGenerator = (context) => {
  const { params, quantities } = context
  const { jobSetupMinutes, plateChangeoverMinutes } = params.costProfile.preparation
  const rate = laborRate(params.costProfile, LaborKind.PREPARATION)
  return ok([
    makeDraft({
      code: 'setup:job',
      label: 'Preparación del trabajo',
      component: CostComponent.SETUP,
      behavior: CostBehavior.PER_BATCH,
      quantity: jobSetupMinutes / MINUTES_PER_HOUR,
      unit: 'h MO',
      unitCost: rate,
      multiplier: quantityFor(CostBehavior.PER_BATCH, quantities),
      vatPerUnit: 0,
      recoveryConfig: { recovery: 'IN_PRICE' },
    }),
    makeDraft({
      code: 'setup:changeover',
      label: 'Cambio de placa',
      component: CostComponent.SETUP,
      behavior: CostBehavior.PER_PLATE,
      quantity: plateChangeoverMinutes / MINUTES_PER_HOUR,
      unit: 'h MO',
      unitCost: rate,
      multiplier: quantityFor(CostBehavior.PER_PLATE, quantities),
      vatPerUnit: 0,
      recoveryConfig: { recovery: 'IN_PRICE' },
    }),
  ])
}
