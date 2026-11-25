import { InvariantViolation } from '../../../../core/result'

/**
 * Reparte un total ENTERO en partes enteras proporcionales a `weights` (enteros ≥ 0) por el método del mayor
 * resto, con aritmética exacta (BigInt); el empate lo gana el índice menor. Siempre suma exactamente `total`.
 * Si todos los pesos son 0 el total debe ser 0.
 */
export function allocateInteger(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new InvariantViolation('pricing.allocation', 'total y pesos deben ser enteros seguros no negativos')
  }
  const sumWeights = weights.reduce((acc, w) => acc + BigInt(w), 0n)
  if (sumWeights === 0n) {
    if (total !== 0) throw new InvariantViolation('pricing.allocation', 'no hay pesos para repartir un total distinto de 0')
    return weights.map(() => 0)
  }
  const bigTotal = BigInt(total)
  const parts = weights.map((w) => ({ base: (bigTotal * BigInt(w)) / sumWeights, rest: (bigTotal * BigInt(w)) % sumWeights }))
  let leftover = bigTotal - parts.reduce((acc, part) => acc + part.base, 0n)
  const order = parts.map((part, index) => ({ index, rest: part.rest })).sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1))
  const result = parts.map((part) => part.base)
  for (const { index } of order) {
    if (leftover === 0n) break
    result[index] = (result[index] ?? 0n) + 1n
    leftover -= 1n
  }
  return result.map((value) => Number(value))
}

/** Reparte un total decimal proporcionalmente a `weights` (≥ 0). Con pesos todos 0, todo al primer elemento. */
export function allocateProportional(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0)
  if (weights.length === 0) return []
  if (sum === 0) return weights.map((_, index) => (index === 0 ? total : 0))
  return weights.map((w) => (total * w) / sum)
}
