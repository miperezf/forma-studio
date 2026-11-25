/**
 * Errores de la capa tax. Son errores de ENTRADA (tasa o monto inválido, combinación incoherente):
 * el llamador decide cómo exponerlos. Las violaciones de invariantes internas, en cambio, lanzan
 * `InvariantViolation` (el motor las convierte en `INTERNAL_INVARIANT`).
 */
export type TaxErrorCode = 'INVALID_RATE' | 'INVALID_AMOUNT' | 'INVALID_COMBINATION'

export interface TaxError {
  readonly code: TaxErrorCode
  readonly field: string
  readonly detail: string
}

export function taxError(code: TaxErrorCode, field: string, detail: string): TaxError {
  return { code, field, detail }
}
