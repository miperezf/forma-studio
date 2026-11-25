import type { DiscountTier } from '../../contracts/parameters'

/** Descuento por volumen: el del tramo que contiene `quantity`; 0 si no hay tramos o ninguno lo contiene. */
export function resolveVolumeDiscount(quantity: number, tiers: readonly DiscountTier[]): number {
  for (const tier of tiers) {
    if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) return tier.discount
  }
  return 0
}
