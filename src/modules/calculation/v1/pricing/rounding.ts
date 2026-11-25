import { InvariantViolation } from '../../../../core/result'
import { roundHalfAwayFromZero, roundToClp, type Clp } from '../../../../core/money'
import { RoundingDirection, RoundingMode } from '../../contracts/enums'
import type { RoundingStrategy } from '../../contracts/parameters'
import { STEP_TOLERANCE } from './constants'

/** Paso de la grilla comercial: el del redondeo, o 1 peso si no hay redondeo comercial. */
export function gridStep(strategy: RoundingStrategy): number {
  return strategy.mode === RoundingMode.STEP ? strategy.step : 1
}

/**
 * Lleva `value` (≥ 0) a la grilla comercial y lo devuelve en CLP entero.
 *  - NONE: al peso más cercano (el CLP es entero; no hay redondeo comercial).
 *  - STEP UP / DOWN / NEAREST: al múltiplo del paso. Un valor que ya está sobre un múltiplo (salvo error
 *    binario) no se mueve: 25.500,000000000004 con paso 100 UP es 25.500, no 25.600.
 */
export function roundToGrid(value: number, strategy: RoundingStrategy): Clp {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvariantViolation('pricing.rounding', `valor fuera de dominio: ${String(value)}`)
  }
  if (strategy.mode === RoundingMode.NONE) return roundToClp(value)
  const quotient = value / strategy.step
  const nearest = roundHalfAwayFromZero(quotient)
  const onGrid = Math.abs(quotient - nearest) <= STEP_TOLERANCE * Math.max(1, Math.abs(quotient))
  let steps = nearest
  if (!onGrid) {
    if (strategy.direction === RoundingDirection.UP) steps = Math.ceil(quotient)
    else if (strategy.direction === RoundingDirection.DOWN) steps = Math.floor(quotient)
  }
  return roundToClp(steps * strategy.step)
}
