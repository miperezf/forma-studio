import { err, ok } from '../../../../../core/result'
import { CostBehavior, CostComponent } from '../../../contracts/enums'
import type { CostDraft } from '../context'
import { WATTS_PER_KILOWATT } from '../constants'
import { makeDraft } from '../draft'
import { missingParameter } from '../errors'
import { quantityFor } from '../quantities'
import { purchase, required } from '../purchases'
import type { CostItemGenerator } from './types'

/**
 * Electricidad, por placa (PER_PLATE).
 *   costo por hora = override de la máquina  — o —  (potencia W / 1.000) × costo económico del kWh
 *   monto = horas de la placa × costo por hora × placas requeridas de ESA placa
 * El override de la máquina prevalece sobre la potencia.
 */
export const electricityGenerator: CostItemGenerator = (context) => {
  const { input, params, quantities } = context
  const drafts: CostDraft[] = []
  for (const plate of input.plates) {
    const machine = required(params.machines[plate.machineId], `params.machines.${plate.machineId}`)
    if (!machine.ok) return err(machine.error)
    let perHour: number
    let vatPerHour: number
    if (machine.value.electricityPerHourOverride !== undefined) {
      const hourly = purchase(machine.value.electricityPerHourOverride, params.taxProfile)
      if (!hourly.ok) return err(hourly.error)
      perHour = hourly.value.economicCost
      vatPerHour = hourly.value.vatRecoverable
    } else if (machine.value.avgPowerW !== undefined) {
      const kwh = purchase(params.costProfile.energy.kwhPrice, params.taxProfile)
      if (!kwh.ok) return err(kwh.error)
      const kilowatts = machine.value.avgPowerW / WATTS_PER_KILOWATT
      perHour = kilowatts * kwh.value.economicCost
      vatPerHour = kilowatts * kwh.value.vatRecoverable
    } else {
      return err(missingParameter(`params.machines.${plate.machineId}.avgPowerW`))
    }
    drafts.push(
      makeDraft({
        code: `electricity:${plate.id}`,
        label: `Electricidad (${plate.label})`,
        component: CostComponent.ELECTRICITY,
        behavior: CostBehavior.PER_PLATE,
        quantity: plate.printHours,
        unit: 'h',
        unitCost: perHour,
        multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
        vatPerUnit: vatPerHour,
        recoveryConfig: { recovery: 'IN_PRICE' },
        plateId: plate.id,
      }),
    )
  }
  return ok(drafts)
}
