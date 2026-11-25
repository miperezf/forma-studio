import { FlagSeverity } from './enums'
import type { CalculationFlag } from './results'

/** Advertencias que impiden EMITIR la cotización al cliente (política BLOCK). No impiden calcularla ni guardarla como borrador. */
export function blockingFlags(flags: readonly CalculationFlag[]): readonly CalculationFlag[] {
  return flags.filter((flag) => flag.severity === FlagSeverity.BLOCKING)
}

/** ¿Puede emitirse al cliente? El cálculo y la edición del borrador siempre son posibles. */
export function isIssuable(flags: readonly CalculationFlag[]): boolean {
  return blockingFlags(flags).length === 0
}
