import { err, ok } from '../../../../../core/result'
import { CostBehavior, CostComponent } from '../../../contracts/enums'
import type { MachineValues, TaxProfileValues } from '../../../contracts/parameters'
import type { CostDraft } from '../context'
import { makeDraft } from '../draft'
import { inconsistentSnapshot, missingParameter } from '../errors'
import { quantityFor } from '../quantities'
import { purchase, required } from '../purchases'
import type { CostItemGenerator } from './types'
import type { Result } from '../../../../../core/result'
import type { CalculationError } from '../../../contracts/errors'

/**
 * Desgaste por hora de máquina (costo ECONÓMICO distribuido por trabajo):
 *   override de la máquina (monto económico, sin IVA)
 *   — o —  (costo económico de compra − costo económico del valor residual) / vida útil + reserva de mantención
 * El override prevalece. Un valor residual mayor que el precio de compra es inconsistente.
 *
 * IVA: el IVA de la compra de la máquina se recuperó (o no) en la ADQUISICIÓN. Aquí solo interviene para
 * decidir el costo económico (neto si era recuperable; completo si no) y NO genera crédito fiscal por
 * impresión: `vatRecoverable` del desgaste es siempre 0.
 */
function wearPerHour(machine: MachineValues, tax: TaxProfileValues): Result<number, CalculationError> {
  if (machine.wearPerHourOverride !== undefined) return ok(machine.wearPerHourOverride)
  const path = `params.machines.${machine.ref.id}`
  if (machine.purchasePrice === undefined) return err(missingParameter(`${path}.purchasePrice`))
  if (machine.lifetimeHours === undefined) return err(missingParameter(`${path}.lifetimeHours`))
  const bought = purchase(machine.purchasePrice, tax)
  if (!bought.ok) return err(bought.error)
  let residualCost = 0
  if (machine.residualValue !== undefined) {
    const residual = purchase(machine.residualValue, tax)
    if (!residual.ok) return err(residual.error)
    residualCost = residual.value.economicCost
  }
  if (residualCost > bought.value.economicCost) {
    return err(inconsistentSnapshot(`${path}.residualValue supera al precio de compra`))
  }
  const lifetime: number = machine.lifetimeHours
  const reserve: number = machine.maintenanceReservePerHour ?? 0
  return ok((bought.value.economicCost - residualCost) / lifetime + reserve)
}

/** Desgaste, por placa (PER_PLATE): horas de la placa × desgaste por hora × placas requeridas de ESA placa. */
export const wearGenerator: CostItemGenerator = (context) => {
  const { input, params, quantities } = context
  const drafts: CostDraft[] = []
  for (const plate of input.plates) {
    const machine = required(params.machines[plate.machineId], `params.machines.${plate.machineId}`)
    if (!machine.ok) return err(machine.error)
    const perHour = wearPerHour(machine.value, params.taxProfile)
    if (!perHour.ok) return err(perHour.error)
    drafts.push(
      makeDraft({
        code: `wear:${plate.id}`,
        label: `Desgaste (${plate.label})`,
        component: CostComponent.WEAR,
        behavior: CostBehavior.PER_PLATE,
        quantity: plate.printHours,
        unit: 'h',
        unitCost: perHour.value,
        multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
        vatPerUnit: 0,
        recoveryConfig: { recovery: 'IN_PRICE' },
        plateId: plate.id,
      }),
    )
  }
  return ok(drafts)
}
