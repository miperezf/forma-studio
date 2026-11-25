import type { TaxedAmount } from '../../../core/money'
import type { Quantity } from '../../../core/money'
import type { CostBehavior, CostComponent, Recovery } from './enums'

/** Amortización explícita de un costo ONE_OFF sobre `overUnits` unidades esperadas. */
export interface Amortization {
  readonly overUnits: Quantity
}

/**
 * Cómo se recupera un costo. Con `IN_PRICE` y `amortization`, al pool de precio
 * entra la fracción `amount × N / overUnits` (tope: el monto completo).
 * Sin `amortization`, un ONE_OFF `IN_PRICE` entra completo (nunca × N).
 */
export interface RecoveryConfig {
  readonly recovery: Recovery
  readonly amortization?: Amortization
}

/** Definición de un costo adicional: ítems extra de la cotización y costos auxiliares del perfil. */
export interface CostSpec {
  readonly code: string
  readonly label: string
  readonly component: CostComponent
  readonly behavior: CostBehavior
  readonly amount: TaxedAmount
  readonly recoveryConfig: RecoveryConfig
}
