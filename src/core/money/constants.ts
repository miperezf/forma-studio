/** Tolerancia para que 1234,4999999999998 (error binario) redondee como 1234,5. */
export const ROUNDING_EPSILON = 1e-9

export const HALF = 0.5

/** Solo para la frontera de UI: 35 (%) ↔ 0,35. */
export const PERCENT_SCALE = 100

/** Tope defensivo de unidades por cotización. */
export const MAX_QUANTITY = 1_000_000
