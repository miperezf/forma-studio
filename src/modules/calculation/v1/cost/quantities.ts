import { err, InvariantViolation, ok, type Result } from '../../../../core/result'
import { parseQuantity } from '../../../../core/money'
import type { CalculationError } from '../../contracts/errors'
import { CostBehavior } from '../../contracts/enums'
import type { QuoteInput } from '../../contracts/quote-input'
import { MAX_PLATES_REQUIRED } from './constants'
import type { PlateQuantity, ResolvedQuantities } from './context'
import { invalidInput } from './errors'

/**
 * División entera por exceso, exacta (sin depender de la precisión del `/` en coma flotante):
 * el menor entero q tal que q × b ≥ a.  Requiere a ≥ 0 y b ≥ 1, enteros seguros.
 */
export function ceilDiv(a: number, b: number): number {
  let q = Math.trunc(a / b)
  while (q * b > a) q -= 1
  while ((q + 1) * b <= a) q += 1
  return q * b < a ? q + 1 : q
}

/**
 * Determina las magnitudes que multiplican costos.
 *
 *  - N (`quantity`): unidades vendidas.
 *  - B (`batches`): lotes de trabajo. Solo multiplica costos PER_BATCH. NO recalcula placas, no se
 *    asume 1 lote = 1 placa y no se exige que un lote tenga placas.
 *  - Placas requeridas por placa-spec: `ceil(N × partsPerUnit / partsPerPlate)` (política WHOLE_PLATES:
 *    una placa física no se fracciona; la última puede quedar incompleta y sus piezas sobrantes se informan).
 *  - Piezas a ensamblar por unidad: `max(0, Σ partsPerUnit − 1)`; en total, `N × eso`.
 *
 * Una planificación de producción distinta (placas reales, lotes reales) pertenecerá al módulo de
 * producción y NO modifica esta fórmula base de cotización.
 */
export function resolveQuantities(input: QuoteInput): Result<ResolvedQuantities, CalculationError> {
  const units = input.quantity
  const plates: PlateQuantity[] = []
  let totalPlates = 0
  let partsPerUnitTotal = 0

  for (const [index, plate] of input.plates.entries()) {
    const path = `input.plates[${String(index)}]`
    const requiredParts = units * plate.partsPerUnit
    if (!Number.isSafeInteger(requiredParts)) {
      return err(invalidInput(`${path}.partsPerUnit`, 'RANGE', 'N × partsPerUnit excede el rango entero seguro'))
    }
    const required = ceilDiv(requiredParts, plate.partsPerPlate)
    if (required > MAX_PLATES_REQUIRED) {
      return err(invalidInput(path, 'RANGE', `Placas requeridas fuera de rango (máximo ${String(MAX_PLATES_REQUIRED)})`))
    }
    const platesRequired = parseQuantity(required, path)
    if (!platesRequired.ok) return err({ code: 'INVALID_INPUT', issues: [platesRequired.error] })
    const producedParts = platesRequired.value * plate.partsPerPlate
    plates.push({
      plateId: plate.id,
      requiredParts,
      partsPerPlate: plate.partsPerPlate,
      platesRequired: platesRequired.value,
      producedParts,
      surplusParts: producedParts - requiredParts,
    })
    totalPlates += platesRequired.value
    partsPerUnitTotal += plate.partsPerUnit
  }

  const extraPartsPerUnit = Math.max(0, partsPerUnitTotal - 1)
  const extraParts = units * extraPartsPerUnit
  if (!Number.isSafeInteger(extraParts) || !Number.isSafeInteger(totalPlates)) {
    return err(invalidInput('input', 'RANGE', 'Las cantidades derivadas exceden el rango entero seguro'))
  }
  return ok({
    units,
    batches: input.batches,
    plates,
    totalPlates,
    partsPerUnitTotal,
    extraPartsPerUnit,
    extraParts,
  })
}

/**
 * ÚNICA fuente de verdad de "cuántas veces aplica un costo". Cada comportamiento usa UNA magnitud:
 *
 * | behavior       | multiplicador                         | ejemplo                                   |
 * |----------------|---------------------------------------|-------------------------------------------|
 * | PER_UNIT       | N (unidades vendidas)                 | embalaje                                  |
 * | PER_PLATE      | placas requeridas (de `plateId`, o Σ) | material, electricidad, desgaste          |
 * | PER_BATCH      | B (lotes de trabajo)                  | preparación del trabajo                   |
 * | ONE_OFF        | 1, siempre                            | modelado 3D, desarrollo                   |
 * | PER_EXTRA_PART | N × (Σ partsPerUnit − 1)              | ensamblaje                                |
 *
 * `plateId` solo se usa con PER_PLATE (los demás lo ignoran). Un `plateId` desconocido es un defecto
 * interno y lanza `InvariantViolation`.
 */
export function quantityFor(behavior: CostBehavior, quantities: ResolvedQuantities, plateId?: string): number {
  switch (behavior) {
    case CostBehavior.PER_UNIT:
      return quantities.units
    case CostBehavior.PER_PLATE: {
      if (plateId === undefined) return quantities.totalPlates
      const plate = quantities.plates.find((candidate) => candidate.plateId === plateId)
      if (plate === undefined) throw new InvariantViolation('cost.quantities', `placa desconocida: ${plateId}`)
      return plate.platesRequired
    }
    case CostBehavior.PER_BATCH:
      return quantities.batches
    case CostBehavior.ONE_OFF:
      return 1
    case CostBehavior.PER_EXTRA_PART:
      return quantities.extraParts
    default: {
      const unreachable: never = behavior
      throw new InvariantViolation('cost.quantities', `comportamiento no manejado: ${String(unreachable)}`)
    }
  }
}
