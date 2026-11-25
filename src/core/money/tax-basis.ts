/** Cómo viene expresado un monto: sin IVA (NET) o con IVA incluido (GROSS). */
export const TaxBasis = {
  NET: 'NET',
  GROSS: 'GROSS',
} as const

export type TaxBasis = (typeof TaxBasis)[keyof typeof TaxBasis]
