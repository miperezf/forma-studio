import { err, ok, type Result } from '../../../core/result'
import type { Quantity } from '../../../core/money'
import type { CalculationError } from '../contracts/errors'
import { FlagCode, FlagSeverity } from '../contracts/enums'
import type { PlateSpec, QuoteInput } from '../contracts/quote-input'
import type { CalculationRequest } from '../contracts/request'
import type { CalculationFlag, PlatesRequired } from '../contracts/results'
import { calculateCost, type CostCalculation } from '../v1/cost'
import type { PlateQuantity, ResolvedQuantities } from '../v1/cost/context'
import { resolveQuantities } from '../v1/cost/quantities'

/** Sufijo del id de la placa virtual que representa la última placa con datos propios (trazable en ítems y fallas). */
export const LAST_RUN_SUFFIX = '.last'

interface PlateRuns {
  readonly plate: PlateSpec
  readonly index: number
  readonly requiredParts: number
  readonly fullPlates: number
  readonly remainder: number
}

function runsOf(input: QuoteInput): PlateRuns[] {
  return input.plates.map((plate, index) => {
    const requiredParts = input.quantity * plate.partsPerUnit
    const fullPlates = Math.floor(requiredParts / plate.partsPerPlate)
    return { plate, index, requiredParts, fullPlates, remainder: requiredParts - fullPlates * plate.partsPerPlate }
  })
}

/**
 * Entrada «virtual» para el motor de costos v1: cada placa con última placa propia se divide en
 *   · la placa completa (mismo id), multiplicada por las placas COMPLETAS, y
 *   · la última placa (`<id>.last`) con SUS gramos y horas, multiplicada por 1.
 * Las cantidades se construyen a mano (no `ceil`), y `partsPerUnitTotal`/ensamblaje salen de la entrada ORIGINAL
 * (la última placa es la misma pieza, no una pieza adicional del producto).
 */
function splitLastRuns(input: QuoteInput, base: ResolvedQuantities, runs: readonly PlateRuns[]): { input: QuoteInput; quantities: ResolvedQuantities } {
  const plates: PlateSpec[] = []
  const quantities: PlateQuantity[] = []
  for (const run of runs) {
    const { plate } = run
    const original = base.plates[run.index]
    if (original === undefined) continue
    if (plate.lastRun === undefined) {
      plates.push(plate)
      quantities.push(original)
      continue
    }
    if (run.fullPlates > 0) {
      plates.push(plate)
      quantities.push({
        plateId: plate.id,
        requiredParts: run.fullPlates * plate.partsPerPlate,
        partsPerPlate: plate.partsPerPlate,
        platesRequired: run.fullPlates as Quantity,
        producedParts: run.fullPlates * plate.partsPerPlate,
        surplusParts: 0,
      })
    }
    const lastId = `${plate.id}${LAST_RUN_SUFFIX}`
    const { lastRun, ...rest } = plate
    plates.push({ ...rest, id: lastId, label: `${plate.label} · última placa`, filaments: lastRun.filaments, printHours: lastRun.printHours, partsPerPlate: lastRun.parts })
    quantities.push({ plateId: lastId, requiredParts: lastRun.parts, partsPerPlate: lastRun.parts, platesRequired: 1 as Quantity, producedParts: lastRun.parts, surplusParts: 0 })
  }
  const totalPlates = quantities.reduce((sum, plate) => sum + plate.platesRequired, 0)
  return { input: { ...input, plates }, quantities: { ...base, plates: quantities, totalPlates } }
}

/**
 * Costos v2. Sin última placa con datos propios el cálculo ES el de v1 (mismas cantidades e ítems): solo se agrega
 * la trazabilidad de placas completas/restante y, si hay placa incompleta, el aviso de estimación conservadora.
 * Con datos de la última placa, se usan sus gramos y horas reales; costos por unidad, lote y únicos no cambian.
 */
export function calculateCostV2(request: CalculationRequest): Result<CostCalculation, CalculationError> {
  const base = resolveQuantities(request.input)
  if (!base.ok) return base
  const runs = runsOf(request.input)
  const sliced = runs.some((run) => run.plate.lastRun !== undefined)
  let cost: Result<CostCalculation, CalculationError>
  if (!sliced) {
    cost = calculateCost(request)
  } else {
    const split = splitLastRuns(request.input, base.value, runs)
    cost = calculateCost({ ...request, input: split.input }, { resolveQuantities: () => ok(split.quantities) })
  }
  if (!cost.ok) return cost

  const platesRequired: PlatesRequired[] = runs.map((run) => {
    const physical = base.value.plates[run.index]?.platesRequired ?? ((run.fullPlates + (run.remainder > 0 ? 1 : 0)) as Quantity)
    return {
      plateId: run.plate.id,
      platesRequired: physical,
      fullPlates: run.fullPlates,
      remainderParts: run.remainder,
      ...(run.remainder === 0
        ? {}
        : {
            lastRun:
              run.plate.lastRun === undefined
                ? { source: 'ESTIMATED_FULL_PLATE' as const, parts: run.remainder }
                : { source: 'SLICED' as const, parts: run.remainder, lastRunPlateId: `${run.plate.id}${LAST_RUN_SUFFIX}` },
          }),
    }
  })
  const flags: CalculationFlag[] = runs
    .filter((run) => run.remainder > 0 && run.plate.lastRun === undefined)
    .map((run) => ({ code: FlagCode.LAST_PLATE_ESTIMATED, severity: FlagSeverity.WARNING, path: `input.plates[${String(run.index)}].lastRun` }))
  if (platesRequired.length === 0) return err({ code: 'INTERNAL_INVARIANT', invariant: 'v2.plates' })
  return ok({
    breakdown: { ...cost.value.breakdown, platesRequired },
    quantities: base.value,
    flags: [...cost.value.flags, ...flags],
  })
}
