/** Límites defensivos y patrones del contrato. Único lugar con números sueltos del módulo. */
export const MAX_PLATES = 64
export const MAX_FILAMENTS_PER_PLATE = 8
export const MAX_SERVICES = 64
export const MAX_EXTRA_COSTS = 64
export const MAX_AUXILIARY_COSTS = 64
export const MAX_DISCOUNT_TIERS = 32
export const MAX_OVERRIDES = 32
export const MAX_CATALOG_ENTRIES = 256

export const MAX_LABEL_LENGTH = 120
export const MAX_REASON_LENGTH = 500

/** Tasa de falla máxima aceptada: con p → 1 el costo esperado diverge. */
export const MAX_FAILURE_RATE = 0.95
export const MAX_ROUNDING_STEP = 1_000_000

export const SUPPORTED_CURRENCY = 'CLP'

export const CALCULATION_VERSION_PATTERN = /^v[1-9][0-9]*$/

/** Tolerancia relativa al comparar valores decimales derivados (p. ej. unitCost). */
export const FLOAT_TOLERANCE = 1e-9
