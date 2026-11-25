import { parseQuantity, parseTaxedAmount } from '../../../../core/money'
import {
  childPath,
  issue,
  ITEM_CODE_PATTERN,
  readEnum,
  readPattern,
  readRecord,
  readString,
  take,
  takeMany,
  type Issue,
} from '../../../../core/validation'
import { MAX_LABEL_LENGTH } from '../constants'
import type { CostSpec, RecoveryConfig } from '../cost-spec'
import { CostBehavior, CostComponent, Recovery } from '../enums'

/**
 * `behavior` es opcional: cuando se desconoce (p. ej. un override de recuperación
 * sobre un ítem aún no generado) la regla de amortización solo exige IN_PRICE.
 */
export function readRecoveryConfig(
  issues: Issue[],
  path: string,
  value: unknown,
  behavior: CostBehavior | undefined,
): RecoveryConfig | undefined {
  const record = readRecord(issues, path, value, ['recovery', 'amortization'])
  if (record === undefined) return undefined
  const recovery = readEnum(issues, childPath(path, 'recovery'), record.recovery, Recovery)
  if (record.amortization === undefined) {
    return recovery === undefined ? undefined : { recovery }
  }
  const amortizationPath = childPath(path, 'amortization')
  const amortizationRecord = readRecord(issues, amortizationPath, record.amortization, ['overUnits'])
  const overUnits =
    amortizationRecord === undefined
      ? undefined
      : take(issues, parseQuantity(amortizationRecord.overUnits, childPath(amortizationPath, 'overUnits')))
  if (recovery !== undefined && recovery !== Recovery.IN_PRICE) {
    issues.push(issue(amortizationPath, 'INCONSISTENT', 'La amortización solo aplica con recovery IN_PRICE'))
  }
  if (behavior !== undefined && behavior !== CostBehavior.ONE_OFF) {
    issues.push(issue(amortizationPath, 'INCONSISTENT', 'La amortización solo aplica a costos ONE_OFF'))
  }
  if (recovery === undefined || overUnits === undefined) return undefined
  return { recovery, amortization: { overUnits } }
}

export function readCostSpec(issues: Issue[], path: string, value: unknown): CostSpec | undefined {
  const record = readRecord(issues, path, value, [
    'code',
    'label',
    'component',
    'behavior',
    'amount',
    'recoveryConfig',
  ])
  if (record === undefined) return undefined
  const code = readPattern(
    issues,
    childPath(path, 'code'),
    record.code,
    ITEM_CODE_PATTERN,
    'letras, números, _ . : -',
  )
  const label = readString(issues, childPath(path, 'label'), record.label, MAX_LABEL_LENGTH)
  const component = readEnum(issues, childPath(path, 'component'), record.component, CostComponent)
  const behavior = readEnum(issues, childPath(path, 'behavior'), record.behavior, CostBehavior)
  const amount = takeMany(issues, parseTaxedAmount(record.amount, childPath(path, 'amount')))
  const recoveryConfig = readRecoveryConfig(
    issues,
    childPath(path, 'recoveryConfig'),
    record.recoveryConfig,
    behavior,
  )
  if (component === CostComponent.FAILURE) {
    issues.push(
      issue(childPath(path, 'component'), 'INCONSISTENT', 'FAILURE lo genera el modelo de fallas; no se declara'),
    )
  }
  if (
    code === undefined ||
    label === undefined ||
    component === undefined ||
    behavior === undefined ||
    amount === undefined ||
    recoveryConfig === undefined
  ) {
    return undefined
  }
  return { code, label, component, behavior, amount, recoveryConfig }
}

/** Reporta códigos repetidos en una lista de CostSpec. */
export function checkUniqueCodes(issues: Issue[], path: string, specs: readonly CostSpec[]): void {
  const seen = new Set<string>()
  specs.forEach((spec, index) => {
    if (seen.has(spec.code)) {
      issues.push(issue(`${path}[${String(index)}].code`, 'DUPLICATE', `Código repetido: ${spec.code}`))
    }
    seen.add(spec.code)
  })
}
