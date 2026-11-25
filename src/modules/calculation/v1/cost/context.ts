import type { Quantity } from '../../../../core/money'
import type { RecoveryConfig } from '../../contracts/cost-spec'
import type { CalculationMode, CostBehavior, CostComponent } from '../../contracts/enums'
import type { OverrideEntry } from '../../contracts/overrides'
import type { ParameterSnapshot } from '../../contracts/parameters'
import type { QuoteInput } from '../../contracts/quote-input'
import type { CostItemBasis } from '../../contracts/results'

/** Cantidades derivadas de UNA placa (ver `resolveQuantities`). */
export interface PlateQuantity {
  readonly plateId: string
  /** Piezas de esta placa que necesitan las unidades vendidas: N × partsPerUnit. */
  readonly requiredParts: number
  readonly partsPerPlate: Quantity
  /** ceil(requiredParts / partsPerPlate), política WHOLE_PLATES. */
  readonly platesRequired: Quantity
  /** platesRequired × partsPerPlate. */
  readonly producedParts: number
  /** producedParts − requiredParts: piezas que sobran de la última placa (informativo). */
  readonly surplusParts: number
}

/**
 * Las cinco magnitudes que pueden multiplicar un costo. Cada `CostBehavior` usa exactamente una:
 *   PER_UNIT → units · PER_PLATE → plates · PER_BATCH → batches · ONE_OFF → 1 · PER_EXTRA_PART → extraParts
 */
export interface ResolvedQuantities {
  /** N: unidades vendidas. */
  readonly units: Quantity
  /** B: lotes de trabajo. Independiente de las placas. */
  readonly batches: Quantity
  readonly plates: readonly PlateQuantity[]
  /** Σ platesRequired de todas las placas. */
  readonly totalPlates: number
  /** Σ partsPerUnit: piezas que componen UNA unidad vendida. */
  readonly partsPerUnitTotal: number
  /** max(0, partsPerUnitTotal − 1): piezas a ensamblar por unidad (la primera no se ensambla). */
  readonly extraPartsPerUnit: number
  /** N × extraPartsPerUnit. */
  readonly extraParts: number
}

/** Entrada inmutable de generadores y transformaciones. */
export interface CostContext {
  readonly mode: CalculationMode
  readonly input: QuoteInput
  readonly params: ParameterSnapshot
  readonly overrides: readonly OverrideEntry[]
  readonly quantities: ResolvedQuantities
}

/** Ítem antes de redondear (valores exactos). `finalize` lo convierte en `CostItem`. */
export interface CostDraft {
  readonly code: string
  readonly label: string
  readonly component: CostComponent
  readonly behavior: CostBehavior
  readonly basis: CostItemBasis
  /** quantity × unitCost × multiplier, sin redondear. */
  readonly rawAmount: number
  /** IVA recuperable prorrateado, sin redondear. */
  readonly vatRecoverableRaw: number
  readonly recoveryConfig: RecoveryConfig
  readonly plateId?: string
  readonly derivedFrom?: string
}
