/**
 * Pruebas de tipos del contrato (se verifican con `tsc -p tsconfig.test.json`).
 */
import type { Clp } from '../../../core/money'
import type {
  CalculationOutput,
  CostBehavior,
  OverrideEntry,
  PricingResult,
  QuoteInput,
} from './index'

/** Si se agrega un comportamiento nuevo sin tratarlo aquí, deja de compilar. */
export function exhaustiveBehavior(behavior: CostBehavior): number {
  switch (behavior) {
    case 'PER_UNIT':
      return 1
    case 'PER_PLATE':
      return 2
    case 'PER_BATCH':
      return 3
    case 'ONE_OFF':
      return 4
    case 'PER_EXTRA_PART':
      return 5
    default: {
      const unreachable: never = behavior
      return unreachable
    }
  }
}

/** Idem para los overrides: el `switch` debe cubrir los 8 tipos. */
export function exhaustiveOverride(override: OverrideEntry): string {
  switch (override.kind) {
    case 'TARGET_MARGIN':
    case 'MIN_MARGIN':
    case 'DISCOUNT':
    case 'FAILURE_RATE':
    case 'ROUNDING':
    case 'ITEM_RECOVERY':
    case 'FIXED_UNIT_PRICE':
    case 'FIXED_LINE_PRICE':
      return override.reason
    default: {
      const unreachable: never = override
      return unreachable
    }
  }
}

declare const input: QuoteInput
declare const pricing: PricingResult
declare const output: CalculationOutput

// @ts-expect-error la entrada es inmutable
input.quantity = input.quantity

// @ts-expect-error el resultado de precios es inmutable
pricing.commercialUtility = pricing.commercialUtility

// @ts-expect-error las colecciones de entrada son de solo lectura
input.plates.push(input.plates[0])

// @ts-expect-error un número plano no es Clp (los montos finales son enteros con marca)
export const price: Clp = 25500

export const margin: number | null = pricing.commercialMargin
// @ts-expect-error el margen puede ser null (neto 0): obliga a tratar el caso indefinido
export const marginUnchecked: number = pricing.commercialMargin
export const markup: number | null = pricing.commercialMarkup

// `pricing` es nulo en modo TEST: obliga a tratar la ausencia
// @ts-expect-error posible null
export const utility: Clp = output.pricing.commercialUtility
