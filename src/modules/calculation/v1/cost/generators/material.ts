import { err, ok } from '../../../../../core/result'
import { CostBehavior, CostComponent } from '../../../contracts/enums'
import type { CostDraft } from '../context'
import { makeDraft } from '../draft'
import { quantityFor } from '../quantities'
import { purchase, required } from '../purchases'
import type { CostItemGenerator } from './types'

/**
 * Material, por placa y por filamento (PER_PLATE).
 *   gramos usados por placa = grams × (1 + merma)   (merma = 0 si el peso ya la incluye)
 *   costo por gramo         = costo económico del rollo / gramos netos del rollo
 *   monto = gramos usados × costo por gramo × placas requeridas de ESA placa
 * Merma: override del material > merma del perfil.
 */
export const materialGenerator: CostItemGenerator = (context) => {
  const { input, params, quantities } = context
  const drafts: CostDraft[] = []
  for (const plate of input.plates) {
    for (const filament of plate.filaments) {
      const material = required(params.materials[filament.materialId], `params.materials.${filament.materialId}`)
      if (!material.ok) return err(material.error)
      const spool = purchase(material.value.spool.price, params.taxProfile)
      if (!spool.ok) return err(spool.error)
      const waste = plate.weightIncludesWaste
        ? 0
        : (material.value.wasteFractionOverride ?? params.costProfile.materialWaste.fraction)
      const netGrams: number = material.value.spool.netGrams
      drafts.push(
        makeDraft({
          code: `material:${plate.id}:${material.value.ref.id}`,
          label: `Material ${material.value.name} (${plate.label})`,
          component: CostComponent.MATERIAL,
          behavior: CostBehavior.PER_PLATE,
          quantity: filament.grams * (1 + waste),
          unit: 'g',
          unitCost: spool.value.economicCost / netGrams,
          multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
          vatPerUnit: spool.value.vatRecoverable / netGrams,
          recoveryConfig: { recovery: 'IN_PRICE' },
          plateId: plate.id,
        }),
      )
    }
  }
  return ok(drafts)
}
