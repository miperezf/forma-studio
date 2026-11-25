import type { Issue } from '../../../core/validation'

export type CalculationError =
  | { readonly code: 'INVALID_INPUT'; readonly issues: readonly Issue[] }
  /**
   * 1 − c_eff − margen ≤ umbral (1e-9): ningún precio finito alcanza el margen.
   *  - EXCEEDS_LIMIT: c_eff + margen > 1 (inviabilidad real de negocio).
   *  - AT_LIMIT: |1 − c_eff − margen| ≤ 1e-9 (el denominador es numéricamente inestable; precio divergente).
   */
  | {
      readonly code: 'INFEASIBLE_MARGIN'
      readonly effectiveCommission: number
      readonly margin: number
      readonly reason: 'EXCEEDS_LIMIT' | 'AT_LIMIT'
    }
  /**
   * La política CAP no encontró un precio emitible que cumpla el margen mínimo:
   *  - PRICE_OUT_OF_RANGE: el precio necesario no es finito o excede el rango seguro de CLP enteros.
   *  - SEARCH_EXHAUSTED: la búsqueda en la grilla de redondeo agotó su tope sin alcanzarlo.
   * Nunca se emite un precio no finito ni con denominador inválido.
   */
  | {
      readonly code: 'NO_FEASIBLE_PRICE'
      readonly minMargin: number
      readonly reason: 'PRICE_OUT_OF_RANGE' | 'SEARCH_EXHAUSTED'
    }
  | { readonly code: 'MISSING_PARAMETER'; readonly path: string }
  | { readonly code: 'INCONSISTENT_SNAPSHOT'; readonly detail: string }
  | { readonly code: 'UNKNOWN_CALCULATION_VERSION'; readonly version: string }
  | { readonly code: 'INTERNAL_INVARIANT'; readonly invariant: string }

/**
 * INPUT: el llamador puede corregirlo (datos, configuración o versión inexistente).
 * INTERNAL: el motor rompió una de sus propias invariantes; es un defecto, no un dato inválido.
 */
export type CalculationErrorCategory = 'INPUT' | 'INTERNAL'

export function calculationErrorCategory(error: CalculationError): CalculationErrorCategory {
  return error.code === 'INTERNAL_INVARIANT' ? 'INTERNAL' : 'INPUT'
}

export function isInternalError(error: CalculationError): boolean {
  return calculationErrorCategory(error) === 'INTERNAL'
}
