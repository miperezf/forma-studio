import { err, ok, type Result } from '../../core/result'
import { CalculationMode } from './contracts/enums'
import type { CalculationError } from './contracts/errors'
import type { CalculationOutput, CalculationRequest, CalculationResult, QuoteCalculator } from './contracts/request'
import { validateCalculationRequest } from './contracts/validate'
import { CALCULATION_V1, CALCULATION_V2, type CalculationVersion } from './contracts/version'
import { calculateCost, type CostCalculation } from './v1/cost'
import { calculateCostV2 } from './v2/cost'
import { calculatePricing } from './v1/pricing'

/** Un motor completo para UNA versión de cálculo. Puro y determinista. */
export interface VersionedEngine {
  readonly version: CalculationVersion
  calculate(request: CalculationRequest): CalculationResult
}

function engineWith(version: CalculationVersion, cost: (request: CalculationRequest) => Result<CostCalculation, CalculationError>): VersionedEngine {
  return {
    version,
    calculate(request) {
      const costs = cost(request)
      if (!costs.ok) return costs
      const base = {
        calculationVersion: request.calculationVersion,
        breakdown: costs.value.breakdown,
        appliedOverrides: request.overrides,
      }
      if (request.mode === CalculationMode.TEST) {
        const output: CalculationOutput = { ...base, pricing: null, flags: costs.value.flags }
        return ok(output)
      }
      const pricing = calculatePricing(request, costs.value)
      if (!pricing.ok) return pricing
      const output: CalculationOutput = {
        ...base,
        pricing: pricing.value.pricing,
        flags: [...costs.value.flags, ...pricing.value.flags],
      }
      return ok(output)
    },
  }
}

/**
 * v1: costos → (si es QUOTE) precios. Las advertencias se concatenan en orden de etapa (costos, luego precios).
 * En modo TEST no hay precio: `pricing` es `null`. Política de placas WHOLE_PLATES.
 */
export const ENGINE_V1: VersionedEngine = engineWith(CALCULATION_V1, (request) => calculateCost(request))

/**
 * v2: igual a v1 + última placa incompleta con datos propios de Bambu Studio (o estimación conservadora marcada).
 * Mismo cálculo de precios. Las cotizaciones v1 se siguen reproduciendo con ENGINE_V1.
 */
export const ENGINE_V2: VersionedEngine = engineWith(CALCULATION_V2, calculateCostV2)

/**
 * Registro de versiones → fachada `QuoteCalculator`. Despacha por `calculationVersion`; una versión desconocida
 * es `UNKNOWN_CALCULATION_VERSION` (nunca se recalcula con otra versión). Agregar v2 = agregar un motor aquí,
 * sin tocar v1: así una cotización emitida con v1 se reproduce siempre con v1.
 */
export function createQuoteCalculator(engines: readonly VersionedEngine[] = [ENGINE_V1, ENGINE_V2]): QuoteCalculator {
  const registry = new Map<string, VersionedEngine>()
  for (const engine of engines) {
    if (registry.has(engine.version)) throw new Error(`Versión de cálculo duplicada en el registro: ${engine.version}`)
    registry.set(engine.version, engine)
  }
  const versions = [...registry.keys()] as CalculationVersion[]
  return {
    calculate(request) {
      const engine = registry.get(request.calculationVersion)
      if (engine === undefined) return err({ code: 'UNKNOWN_CALCULATION_VERSION', version: request.calculationVersion })
      return engine.calculate(request)
    },
    supportedVersions: () => versions,
  }
}

/**
 * Valida un JSON plano (formulario, snapshot persistido) y lo calcula. Es la ruta de REPLAY: un snapshot guardado
 * pasa por el mismo validador que una solicitud nueva antes de recalcularse.
 */
export function calculateFromRaw(calculator: QuoteCalculator, raw: unknown): CalculationResult {
  const request = validateCalculationRequest(raw)
  if (!request.ok) {
    const error: CalculationError = { code: 'INVALID_INPUT', issues: request.error }
    return err(error)
  }
  return calculator.calculate(request.value)
}
