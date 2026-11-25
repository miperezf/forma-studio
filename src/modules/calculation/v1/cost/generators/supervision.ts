import { err, ok } from '../../../../../core/result'
import { CostBehavior, CostComponent, LaborKind } from '../../../contracts/enums'
import type { CostDraft } from '../context'
import { makeDraft } from '../draft'
import { quantityFor } from '../quantities'
import { laborRate, required } from '../purchases'
import type { CostItemGenerator } from './types'

/**
 * Supervisión de impresión, por placa (PER_PLATE).
 *   horas de mano de obra por placa = horas de la placa × ratio de supervisión
 *   monto = esas horas × tarifa (tipo SUPERVISION) × placas requeridas de ESA placa
 * Ratio: override de la máquina > ratio del perfil (0,15 h por hora de impresión al inicio).
 */
export const supervisionGenerator: CostItemGenerator = (context) => {
  const { input, params, quantities } = context
  const drafts: CostDraft[] = []
  for (const plate of input.plates) {
    const machine = required(params.machines[plate.machineId], `params.machines.${plate.machineId}`)
    if (!machine.ok) return err(machine.error)
    const ratio: number = machine.value.supervisionRatioOverride ?? params.costProfile.supervision.hoursPerPrintHour
    drafts.push(
      makeDraft({
        code: `supervision:${plate.id}`,
        label: `Supervisión (${plate.label})`,
        component: CostComponent.SUPERVISION,
        behavior: CostBehavior.PER_PLATE,
        quantity: plate.printHours * ratio,
        unit: 'h MO',
        unitCost: laborRate(params.costProfile, LaborKind.SUPERVISION),
        multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
        vatPerUnit: 0,
        recoveryConfig: { recovery: 'IN_PRICE' },
        plateId: plate.id,
      }),
    )
  }
  return ok(drafts)
}
