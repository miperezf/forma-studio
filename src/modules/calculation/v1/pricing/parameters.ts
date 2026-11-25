import type { Clp } from '../../../../core/money'
import { DiscountOverrideMode, OverrideKind, type BelowMinPolicyId } from '../../contracts/enums'
import type { OverrideEntry } from '../../contracts/overrides'
import type { DiscountTier, ParameterSnapshot, RoundingStrategy } from '../../contracts/parameters'

/** Parámetros de precio efectivos: el perfil con los overrides de la cotización ya aplicados. */
export interface EffectivePricing {
  readonly targetMargin: number
  readonly minMargin: number
  readonly policy: BelowMinPolicyId
  readonly tiers: readonly DiscountTier[]
  readonly rounding: RoundingStrategy
  /** TIER: por tramo según N · NONE: sin descuento · MANUAL: `pct`. */
  readonly discount: { readonly kind: 'TIER' | 'NONE' | 'MANUAL'; readonly pct?: number }
  /** Precio unitario FINAL fijado por el usuario para la línea principal (en el modo de precio del cliente). */
  readonly fixedUnitPrice?: Clp
  /** Precio FINAL fijado para líneas separadas, por código de línea. */
  readonly fixedLinePrices: Readonly<Record<string, Clp>>
}

export function resolvePricingParameters(
  params: ParameterSnapshot,
  overrides: readonly OverrideEntry[],
): EffectivePricing {
  const profile = params.pricingProfile
  let targetMargin: number = profile.targetMargin
  let minMargin: number = profile.minMargin
  let rounding = profile.rounding
  let discount: EffectivePricing['discount'] = { kind: 'TIER' }
  let fixedUnitPrice: Clp | undefined
  const fixedLinePrices: Record<string, Clp> = {}

  for (const override of overrides) {
    switch (override.kind) {
      case OverrideKind.TARGET_MARGIN:
        targetMargin = override.value
        break
      case OverrideKind.MIN_MARGIN:
        minMargin = override.value
        break
      case OverrideKind.ROUNDING:
        rounding = override.value
        break
      case OverrideKind.DISCOUNT:
        discount =
          override.value.mode === DiscountOverrideMode.NONE
            ? { kind: 'NONE' }
            : { kind: 'MANUAL', pct: override.value.pct }
        break
      case OverrideKind.FIXED_UNIT_PRICE:
        fixedUnitPrice = override.value.customerUnitPrice
        break
      case OverrideKind.FIXED_LINE_PRICE:
        fixedLinePrices[override.itemCode] = override.value.customerPrice
        break
      case OverrideKind.FAILURE_RATE:
      case OverrideKind.ITEM_RECOVERY:
        break // ya aplicados por la capa de costos
    }
  }
  return {
    targetMargin,
    minMargin,
    policy: profile.onBelowMin,
    tiers: profile.discountTiers,
    rounding,
    discount,
    fixedLinePrices,
    ...(fixedUnitPrice === undefined ? {} : { fixedUnitPrice }),
  }
}
