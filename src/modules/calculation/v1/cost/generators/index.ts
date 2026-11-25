import { auxiliaryGenerator, extraCostsGenerator } from './additional'
import { electricityGenerator } from './electricity'
import { materialGenerator } from './material'
import { servicesGenerator } from './services'
import { setupGenerator } from './setup'
import { supervisionGenerator } from './supervision'
import type { CostItemGenerator } from './types'
import { wearGenerator } from './wear'

/** Orden fijo y documentado: define el orden de los ítems del desglose (determinismo). */
export const COST_GENERATORS: readonly CostItemGenerator[] = [
  materialGenerator,
  electricityGenerator,
  wearGenerator,
  supervisionGenerator,
  setupGenerator,
  servicesGenerator,
  auxiliaryGenerator,
  extraCostsGenerator,
]

export type { CostItemGenerator } from './types'
export {
  auxiliaryGenerator,
  electricityGenerator,
  extraCostsGenerator,
  materialGenerator,
  servicesGenerator,
  setupGenerator,
  supervisionGenerator,
  wearGenerator,
}
