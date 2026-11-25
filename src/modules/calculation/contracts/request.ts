import type { Result } from '../../../core/result'
import type { CalculationError } from './errors'
import type { CalculationMode } from './enums'
import type { OverrideEntry } from './overrides'
import type { ParameterSnapshot } from './parameters'
import type { QuoteInput } from './quote-input'
import type { CalculationFlag, CostBreakdown, PricingResult } from './results'
import type { CalculationVersion } from './version'

export interface CalculationRequest {
  readonly calculationVersion: CalculationVersion
  readonly mode: CalculationMode
  readonly input: QuoteInput
  /** Valores resueltos: el motor nunca recibe repositorios ni referencias por resolver. */
  readonly params: ParameterSnapshot
  readonly overrides: readonly OverrideEntry[]
}

export interface CalculationOutput {
  readonly calculationVersion: CalculationVersion
  readonly breakdown: CostBreakdown
  /** `null` en modo TEST. */
  readonly pricing: PricingResult | null
  readonly appliedOverrides: readonly OverrideEntry[]
  readonly flags: readonly CalculationFlag[]
}

export type CalculationResult = Result<CalculationOutput, CalculationError>

/** Fachada del módulo: despacha por `calculationVersion`. Sin I/O, determinista. */
export interface QuoteCalculator {
  calculate(request: CalculationRequest): CalculationResult
  supportedVersions(): readonly CalculationVersion[]
}
