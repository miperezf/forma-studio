import type { Clp, Fraction } from '../../../core/money'
import type { RecoveryConfig } from './cost-spec'
import type {
  DiscountOverrideMode,
  FailureOverrideMode,
  OverrideKind,
} from './enums'
import type { RoundingStrategy } from './parameters'

interface OverrideBase {
  /** Justificación obligatoria: la decisión excepcional queda auditada. */
  readonly reason: string
}

/**
 * Decisiones comerciales excepcionales de UNA cotización. No modifican el
 * `ParameterSnapshot`: se registran aparte y marcan el resultado.
 * Lista cerrada: solo se puede sobrescribir lo previsto aquí.
 */
export type OverrideEntry =
  | (OverrideBase & { readonly kind: typeof OverrideKind.TARGET_MARGIN; readonly value: Fraction })
  | (OverrideBase & { readonly kind: typeof OverrideKind.MIN_MARGIN; readonly value: Fraction })
  | (OverrideBase & {
      readonly kind: typeof OverrideKind.DISCOUNT
      readonly value:
        | { readonly mode: typeof DiscountOverrideMode.NONE }
        | { readonly mode: typeof DiscountOverrideMode.MANUAL; readonly pct: Fraction }
    })
  | (OverrideBase & {
      readonly kind: typeof OverrideKind.FAILURE_RATE
      readonly value:
        | { readonly mode: typeof FailureOverrideMode.RATE; readonly rate: Fraction }
        | { readonly mode: typeof FailureOverrideMode.DISABLED }
    })
  | (OverrideBase & { readonly kind: typeof OverrideKind.ROUNDING; readonly value: RoundingStrategy })
  | (OverrideBase & {
      readonly kind: typeof OverrideKind.ITEM_RECOVERY
      readonly itemCode: string
      readonly value: RecoveryConfig
    })
  | (OverrideBase & {
      readonly kind: typeof OverrideKind.FIXED_UNIT_PRICE
      readonly value: { readonly customerUnitPrice: Clp }
    })
  | (OverrideBase & {
      readonly kind: typeof OverrideKind.FIXED_LINE_PRICE
      readonly itemCode: string
      readonly value: { readonly customerPrice: Clp }
    })
