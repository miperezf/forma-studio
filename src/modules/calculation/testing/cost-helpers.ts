import type { Result } from '../../../core/result'
import type { CalculationError } from '../contracts/errors'
import type { CalculationRequest } from '../contracts/request'
import type { CostItem } from '../contracts/results'
import { validateCalculationRequest } from '../contracts/validate/request'
import { calculateCost, type CostCalculation } from '../v1/cost/engine'

/** Valida una solicitud JSON de prueba; si no es válida, falla el test con los problemas. */
export function requestOf(raw: unknown): CalculationRequest {
  const result = validateCalculationRequest(raw)
  if (!result.ok) throw new Error(`solicitud de prueba inválida: ${JSON.stringify(result.error)}`)
  return result.value
}

export function costResult(raw: unknown): Result<CostCalculation, CalculationError> {
  return calculateCost(requestOf(raw))
}

export function costOf(raw: unknown): CostCalculation {
  const result = costResult(raw)
  if (!result.ok) throw new Error(`cálculo de prueba falló: ${JSON.stringify(result.error)}`)
  return result.value
}

export function item(calculation: CostCalculation, code: string): CostItem {
  const found = calculation.breakdown.items.find((candidate) => candidate.code === code)
  if (found === undefined) {
    throw new Error(`ítem inexistente: ${code}; hay: ${calculation.breakdown.items.map((i) => i.code).join(', ')}`)
  }
  return found
}

export function codes(calculation: CostCalculation): string[] {
  return calculation.breakdown.items.map((i) => i.code)
}

/** Especificación cruda de un costo (extra o auxiliar) para tests. */
export function costSpecRaw(
  code: string,
  amount: number,
  behavior: string,
  over: { component?: string; recoveryConfig?: unknown; basis?: 'NET' | 'GROSS'; vatRecoverable?: boolean } = {},
): Record<string, unknown> {
  return {
    code,
    label: code,
    component: over.component ?? 'OTHER',
    behavior,
    amount: { amount, basis: over.basis ?? 'NET', vatRecoverable: over.vatRecoverable ?? true },
    recoveryConfig: over.recoveryConfig ?? { recovery: 'IN_PRICE' },
  }
}
