/** Enumeraciones como objetos `as const` (compatibles con `erasableSyntaxOnly`). */

export const CostBehavior = {
  PER_UNIT: 'PER_UNIT',
  PER_PLATE: 'PER_PLATE',
  PER_BATCH: 'PER_BATCH',
  ONE_OFF: 'ONE_OFF',
  /** Variante de PER_UNIT: unidades × (partes por unidad − 1). */
  PER_EXTRA_PART: 'PER_EXTRA_PART',
} as const
export type CostBehavior = (typeof CostBehavior)[keyof typeof CostBehavior]

export const CostComponent = {
  MATERIAL: 'MATERIAL',
  ELECTRICITY: 'ELECTRICITY',
  WEAR: 'WEAR',
  SUPERVISION: 'SUPERVISION',
  SETUP: 'SETUP',
  ASSEMBLY: 'ASSEMBLY',
  POSTPROCESS: 'POSTPROCESS',
  PACKAGING: 'PACKAGING',
  SHIPPING: 'SHIPPING',
  DESIGN: 'DESIGN',
  AUXILIARY: 'AUXILIARY',
  /** Generado por el modelo de fallas; no se puede declarar en entradas. */
  FAILURE: 'FAILURE',
  OTHER: 'OTHER',
} as const
export type CostComponent = (typeof CostComponent)[keyof typeof CostComponent]

export const Recovery = {
  IN_PRICE: 'IN_PRICE',
  SEPARATE_LINE: 'SEPARATE_LINE',
  ABSORBED: 'ABSORBED',
} as const
export type Recovery = (typeof Recovery)[keyof typeof Recovery]

export const TaxRegime = {
  VAT_REGISTERED: 'VAT_REGISTERED',
  NOT_REGISTERED: 'NOT_REGISTERED',
} as const
export type TaxRegime = (typeof TaxRegime)[keyof typeof TaxRegime]

export const CustomerPriceMode = {
  NET: 'NET',
  GROSS: 'GROSS',
} as const
export type CustomerPriceMode = (typeof CustomerPriceMode)[keyof typeof CustomerPriceMode]

export const CommissionBase = {
  NET: 'NET',
  GROSS: 'GROSS',
} as const
export type CommissionBase = (typeof CommissionBase)[keyof typeof CommissionBase]

export const CalculationMode = {
  QUOTE: 'QUOTE',
  TEST: 'TEST',
} as const
export type CalculationMode = (typeof CalculationMode)[keyof typeof CalculationMode]

export const PricingMode = {
  TARGET_MARGIN: 'TARGET_MARGIN',
  FIXED_PRICE: 'FIXED_PRICE',
} as const
export type PricingMode = (typeof PricingMode)[keyof typeof PricingMode]

export const BelowMinPolicyId = {
  WARN: 'WARN',
  CAP: 'CAP',
  BLOCK: 'BLOCK',
} as const
export type BelowMinPolicyId = (typeof BelowMinPolicyId)[keyof typeof BelowMinPolicyId]

export const PlateSource = {
  MANUAL: 'MANUAL',
  TEST: 'TEST',
  SLICER_IMPORT: 'SLICER_IMPORT',
} as const
export type PlateSource = (typeof PlateSource)[keyof typeof PlateSource]

export const RoundingMode = {
  NONE: 'NONE',
  STEP: 'STEP',
} as const
export type RoundingMode = (typeof RoundingMode)[keyof typeof RoundingMode]

export const RoundingDirection = {
  UP: 'UP',
  NEAREST: 'NEAREST',
  DOWN: 'DOWN',
} as const
export type RoundingDirection = (typeof RoundingDirection)[keyof typeof RoundingDirection]

export const RoundingTarget = {
  NET: 'NET',
  GROSS: 'GROSS',
} as const
export type RoundingTarget = (typeof RoundingTarget)[keyof typeof RoundingTarget]

export const FailureModelId = {
  GEOMETRIC_RETRY: 'GEOMETRIC_RETRY',
} as const
export type FailureModelId = (typeof FailureModelId)[keyof typeof FailureModelId]

/** De dónde salió la tasa de falla efectiva de una placa (procedencia). */
export const FailureRateSource = {
  QUOTE_OVERRIDE: 'QUOTE_OVERRIDE',
  MATERIAL_OVERRIDE: 'MATERIAL_OVERRIDE',
  MACHINE_OVERRIDE: 'MACHINE_OVERRIDE',
  PROFILE: 'PROFILE',
} as const
export type FailureRateSource = (typeof FailureRateSource)[keyof typeof FailureRateSource]

export const LaborKind = {
  SUPERVISION: 'SUPERVISION',
  PREPARATION: 'PREPARATION',
  ASSEMBLY: 'ASSEMBLY',
  POSTPROCESS: 'POSTPROCESS',
} as const
export type LaborKind = (typeof LaborKind)[keyof typeof LaborKind]

export const ChannelKind = {
  DIRECT: 'DIRECT',
  INSTAGRAM: 'INSTAGRAM',
  WEB: 'WEB',
  MARKETPLACE: 'MARKETPLACE',
  OTHER: 'OTHER',
} as const
export type ChannelKind = (typeof ChannelKind)[keyof typeof ChannelKind]

export const ServiceKind = {
  ASSEMBLY: 'ASSEMBLY',
  STANDARD: 'STANDARD',
} as const
export type ServiceKind = (typeof ServiceKind)[keyof typeof ServiceKind]

export const DiscountOverrideMode = {
  NONE: 'NONE',
  MANUAL: 'MANUAL',
} as const
export type DiscountOverrideMode = (typeof DiscountOverrideMode)[keyof typeof DiscountOverrideMode]

export const FailureOverrideMode = {
  RATE: 'RATE',
  DISABLED: 'DISABLED',
} as const
export type FailureOverrideMode = (typeof FailureOverrideMode)[keyof typeof FailureOverrideMode]

export const OverrideKind = {
  TARGET_MARGIN: 'TARGET_MARGIN',
  MIN_MARGIN: 'MIN_MARGIN',
  DISCOUNT: 'DISCOUNT',
  FAILURE_RATE: 'FAILURE_RATE',
  ROUNDING: 'ROUNDING',
  ITEM_RECOVERY: 'ITEM_RECOVERY',
  FIXED_UNIT_PRICE: 'FIXED_UNIT_PRICE',
  FIXED_LINE_PRICE: 'FIXED_LINE_PRICE',
} as const
export type OverrideKind = (typeof OverrideKind)[keyof typeof OverrideKind]

export const LineKind = {
  MAIN: 'MAIN',
  SEPARATE_LINE: 'SEPARATE_LINE',
} as const
export type LineKind = (typeof LineKind)[keyof typeof LineKind]

export const FlagCode = {
  BELOW_TARGET: 'BELOW_TARGET',
  BELOW_MIN: 'BELOW_MIN',
  /** El margen real (descontando costos ABSORBED) queda bajo el mínimo aunque el comercial lo cumpla. Advertencia. */
  REAL_MARGIN_BELOW_MIN: 'REAL_MARGIN_BELOW_MIN',
  BLOCKED: 'BLOCKED',
  DISCOUNT_CAPPED: 'DISCOUNT_CAPPED',
  NEGATIVE_UTILITY: 'NEGATIVE_UTILITY',
  OVERRIDE_APPLIED: 'OVERRIDE_APPLIED',
  PRICING_POOL_EMPTY: 'PRICING_POOL_EMPTY',
  ASSEMBLY_WITHOUT_EXTRA_PARTS: 'ASSEMBLY_WITHOUT_EXTRA_PARTS',
  UNKNOWN_OVERRIDE_TARGET: 'UNKNOWN_OVERRIDE_TARGET',
  /** v2: la última placa incompleta se valoró como placa completa (estimación conservadora, sin datos de Bambu Studio). */
  LAST_PLATE_ESTIMATED: 'LAST_PLATE_ESTIMATED',
} as const
export type FlagCode = (typeof FlagCode)[keyof typeof FlagCode]

export const FlagSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  /** Impide emitir la cotización al cliente (política BLOCK). */
  BLOCKING: 'BLOCKING',
} as const
export type FlagSeverity = (typeof FlagSeverity)[keyof typeof FlagSeverity]
