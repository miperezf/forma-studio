import { InvariantViolation, type Result } from '../../../../core/result'

/** Para resultados que ya no pueden fallar por datos (se validaron antes): un fallo es un defecto interno. */
export function unwrap<T, E>(result: Result<T, E>, where: string): T {
  if (result.ok) return result.value
  throw new InvariantViolation(`pricing.${where}`, JSON.stringify(result.error))
}
