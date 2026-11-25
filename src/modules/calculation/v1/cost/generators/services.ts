import { err, ok } from '../../../../../core/result'
import { MINUTES_PER_HOUR } from '../constants'
import type { CostDraft } from '../context'
import { makeDraft } from '../draft'
import { quantityFor } from '../quantities'
import { laborRate, purchase, required } from '../purchases'
import type { CostItemGenerator } from './types'

/**
 * Servicios activos (postproceso, ensamblaje, NRE como modelado 3D…), en el orden de la entrada.
 *   costo por conductor = costo económico del insumo + minutos / 60 × tarifa
 *   monto = ese costo × quantityFor(service.behavior)
 * El ensamblaje es un servicio PER_EXTRA_PART: se cobra una sola vez y solo por las piezas adicionales
 * (N × (Σ partsPerUnit − 1)); con una sola pieza por unidad el multiplicador es 0 y el monto es 0.
 */
export const servicesGenerator: CostItemGenerator = (context) => {
  const { input, params, quantities } = context
  const drafts: CostDraft[] = []
  for (const selection of input.services) {
    if (!selection.active) continue
    const service = required(params.services[selection.serviceId], `params.services.${selection.serviceId}`)
    if (!service.ok) return err(service.error)
    const supply = purchase(service.value.supplyCost, params.taxProfile)
    if (!supply.ok) return err(supply.error)
    // Minutos: los de la cotización si los indicó (cantidad de trabajo), si no los del servicio. Tarifa: siempre del perfil.
    const minutes = selection.laborMinutes ?? service.value.laborMinutes
    const labor =
      (minutes / MINUTES_PER_HOUR) *
      laborRate(params.costProfile, service.value.laborKind, service.value.laborRateOverride)
    drafts.push(
      makeDraft({
        code: `service:${service.value.ref.id}`,
        label: service.value.name,
        component: service.value.component,
        behavior: service.value.behavior,
        quantity: 1,
        unit: 'u',
        unitCost: supply.value.economicCost + labor,
        multiplier: quantityFor(service.value.behavior, quantities),
        vatPerUnit: supply.value.vatRecoverable,
        recoveryConfig: service.value.defaultRecovery,
      }),
    )
  }
  return ok(drafts)
}
