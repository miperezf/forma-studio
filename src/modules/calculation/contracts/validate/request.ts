import { err, ok, type Result } from '../../../../core/result'
import { readEnum, readRecord, take, type Issue } from '../../../../core/validation'
import { CalculationMode } from '../enums'
import type { CalculationRequest } from '../request'
import type { ParameterSnapshot } from '../parameters'
import type { QuoteInput } from '../quote-input'
import { parseCalculationVersion } from '../version'
import { checkRequestConsistency } from './consistency'
import { readOverrides } from './overrides'
import { readParameterSnapshot } from './parameters'
import { readQuoteInput } from './quote-input'

/**
 * Valida y construye una solicitud tipada desde datos no confiables (JSON,
 * Firestore, formularios). Dos fases: estructura y luego consistencia cruzada.
 * Devuelve TODOS los problemas encontrados, no solo el primero.
 */
export function validateCalculationRequest(raw: unknown): Result<CalculationRequest, readonly Issue[]> {
  const issues: Issue[] = []
  const record = readRecord(issues, '', raw, ['calculationVersion', 'mode', 'input', 'params', 'overrides'])
  if (record === undefined) return err(issues)
  const calculationVersion = take(issues, parseCalculationVersion(record.calculationVersion, 'calculationVersion'))
  const mode = readEnum(issues, 'mode', record.mode, CalculationMode)
  const input = readQuoteInput(issues, 'input', record.input)
  const params = readParameterSnapshot(issues, 'params', record.params)
  const overrides = readOverrides(issues, 'overrides', record.overrides)
  if (
    issues.length > 0 ||
    calculationVersion === undefined ||
    mode === undefined ||
    input === undefined ||
    params === undefined ||
    overrides === undefined
  ) {
    return err(issues)
  }
  const request: CalculationRequest = { calculationVersion, mode, input, params, overrides }
  const crossIssues = checkRequestConsistency(request)
  return crossIssues.length > 0 ? err(crossIssues) : ok(request)
}

export function validateQuoteInput(raw: unknown): Result<QuoteInput, readonly Issue[]> {
  const issues: Issue[] = []
  const input = readQuoteInput(issues, 'input', raw)
  return issues.length > 0 || input === undefined ? err(issues) : ok(input)
}

export function validateParameterSnapshot(raw: unknown): Result<ParameterSnapshot, readonly Issue[]> {
  const issues: Issue[] = []
  const params = readParameterSnapshot(issues, 'params', raw)
  return issues.length > 0 || params === undefined ? err(issues) : ok(params)
}
