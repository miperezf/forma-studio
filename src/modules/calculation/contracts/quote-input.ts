import type { Grams, Hours, Minutes, Quantity } from '../../../core/money'
import type { CostSpec } from './cost-spec'
import type { PlateSource } from './enums'

export interface FilamentUse {
  readonly materialId: string
  /** Gramos por placa (nunca por unidad). */
  readonly grams: Grams
}

/**
 * Última placa INCOMPLETA rebanada en Bambu Studio con las piezas restantes (solo `calculationVersion` ≥ v2).
 * Sus gramos por filamento y su tiempo se usan TAL CUAL: no se asume proporcionalidad con la placa completa
 * (calentamiento, purga del AMS y preparación no escalan con las piezas).
 */
export interface LastRunSpec {
  /** Piezas de la última placa; debe ser igual al restante: (N × partsPerUnit) mod partsPerPlate. */
  readonly parts: Quantity
  /** Gramos POR FILAMENTO de esa placa (subconjunto de los filamentos de la placa completa). */
  readonly filaments: readonly FilamentUse[]
  readonly printHours: Hours
}

/**
 * Una corrida física de impresión. Gramos y horas son SIEMPRE por placa:
 * 6 piezas en una placa de 12 h son 12 h, no 6 × 12 h.
 */
export interface PlateSpec {
  readonly id: string
  readonly label: string
  readonly filaments: readonly FilamentUse[]
  readonly machineId: string
  readonly printHours: Hours
  readonly partsPerPlate: Quantity
  /** Cuántas de estas piezas necesita UNA unidad vendida. */
  readonly partsPerUnit: Quantity
  /** El peso ya incluye purga/soportes (evita contar la merma dos veces). */
  readonly weightIncludesWaste: boolean
  readonly source: PlateSource
  readonly sourceTestId?: string
  /** v2: datos reales de la última placa incompleta. Ausente → estimación conservadora (placa completa). */
  readonly lastRun?: LastRunSpec
}

export interface ServiceSelection {
  readonly serviceId: string
  readonly active: boolean
  /**
   * Minutos de trabajo que ESTE trabajo necesita por unidad del conductor del servicio (unidad vendida,
   * pieza extra, lote…). Es una CANTIDAD de trabajo de la cotización (como gramos u horas), no una tarifa:
   * la tarifa sigue saliendo del perfil. Ausente → `laborMinutes` del servicio en el snapshot.
   */
  readonly laborMinutes?: Minutes
}

export type QuoteExtraCost = CostSpec

/**
 * Modelo de cantidades (tres magnitudes distintas; ninguna se deriva de otra por validación):
 *  - `quantity` (N): unidades vendidas al cliente.
 *  - `batches` (B): trabajos/corridas de producción; solo repite los costos PER_BATCH.
 *  - placas requeridas: se DERIVAN en el motor, `ceil(N × partsPerUnit / partsPerPlate)` por placa;
 *    no son una entrada.
 *
 * El contrato solo valida cada magnitud por separado (entero ≥ 1). No existe una relación
 * universal `batches <= quantity` ni `batches <= placas`: cualquier relación entre ellas se
 * validará en el motor, cuando el modelo de cantidades esté confirmado.
 */
export interface QuoteInput {
  readonly quantity: Quantity
  readonly batches: Quantity
  readonly plates: readonly PlateSpec[]
  readonly services: readonly ServiceSelection[]
  readonly extraCosts: readonly QuoteExtraCost[]
  readonly channelId: string
}
