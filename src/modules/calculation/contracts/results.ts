import type { Clp, Fraction, Quantity } from '../../../core/money'
import type { RecoveryConfig } from './cost-spec'
import type {
  CostBehavior,
  CostComponent,
  CustomerPriceMode,
  FailureModelId,
  FailureRateSource,
  FlagCode,
  FlagSeverity,
  LineKind,
  PricingMode,
  Recovery,
} from './enums'

/**
 * Trazabilidad del cálculo de un ítem: `rawAmount = quantity × unitCost × multiplier`.
 *  - `quantity`: cantidad física o monetaria POR unidad del conductor (p. ej. gramos por placa).
 *  - `unitCost`: costo económico por `unit` (ya sin IVA recuperable).
 *  - `multiplier`: cuántas veces aplica según `behavior` (placas requeridas, lotes, unidades,
 *    piezas extra, o 1). Es la ÚNICA magnitud por la que se multiplicó el ítem.
 */
export interface CostItemBasis {
  readonly quantity: number
  readonly unit: string
  readonly unitCost: number
  readonly multiplier: number
}

/**
 * Un costo ya calculado. Relación entre `amount`, `recoveryConfig`, `behavior` y `pooledAmount`
 * (la define `expectedPooledAmount` en `invariants.ts`; el motor y los tests usan esa única fuente):
 *
 *  - `amount` = redondeo a CLP de `rawAmount`: el costo económico COMPLETO del ítem en la cotización.
 *    `behavior` ya está aplicado (cuánto se multiplicó); `pooledAmount` no vuelve a multiplicar nada.
 *  - `pooledAmount` = la parte de `amount` que entra al pool de precio `C`:
 *      ABSORBED                          → 0        (el negocio lo asume; ver `absorbedCost`)
 *      SEPARATE_LINE                     → amount   (se precifica en SU línea, no en la principal)
 *      IN_PRICE sin amortización         → amount   (se precifica en la línea principal)
 *      IN_PRICE con amortización (solo ONE_OFF) → round(rawAmount × N / overUnits), tope `amount`;
 *        el resto, `amount − pooledAmount`, queda diferido (ver `deferredCost`).
 *  - Cada ítem pertenece a UNA sola línea de precio (principal o la suya) o a ninguna: no hay doble conteo.
 *
 * Identidad contable por cotización: Σ amount = pricingPool + absorbedCost + deferredCost.
 */
export interface CostItem {
  readonly code: string
  readonly label: string
  readonly component: CostComponent
  readonly behavior: CostBehavior
  readonly basis: CostItemBasis
  /** Valor exacto, sin redondear (base de la transformación de fallas). */
  readonly rawAmount: number
  /** Valor redondeado a CLP (se suma para los totales). */
  readonly amount: Clp
  readonly recoveryConfig: RecoveryConfig
  /** Parte de `amount` que entra al pool de precio (amortización aplicada; 0 si ABSORBED). */
  readonly pooledAmount: Clp
  /**
   * IVA recuperable CONTENIDO en las compras que consume este ítem (material, electricidad, insumos de
   * servicios, costos adicionales), prorrateado a su consumo y redondeado. Es un indicador informativo:
   *  - NO es un crédito fiscal nuevo generado por el costo calculado. El crédito real nace en la compra
   *    original (factura del proveedor) y el ledger tributario del negocio lo reconoce UNA sola vez.
   *  - El desgaste de equipos SIEMPRE es 0: el IVA de la máquina se recuperó (o no) en su adquisición y no
   *    se vuelve a reconocer por impresión. Distribuirlo con fines analíticos exigiría un indicador aparte.
   *  - No es costo ni utilidad, y no depende de `recoveryConfig`.
   */
  readonly vatRecoverable: Clp
  readonly plateId?: string
  /** En ítems FAILURE: código del ítem que los originó. */
  readonly derivedFrom?: string
}

/**
 * Tasa de falla efectiva y de dónde salió. Precedencia: override de la cotización > override de
 * material > override de máquina > perfil. Con varios materiales en la placa se toma el MAYOR override
 * (política conservadora: el material más delicado manda sobre el riesgo de toda la placa).
 */
export interface ResolvedFailureRate {
  readonly scope: 'PLATE' | 'GLOBAL'
  readonly plateId?: string
  readonly modelId: FailureModelId
  readonly rate: number
  readonly costFraction: number
  readonly source: FailureRateSource
  /** Id del material o de la máquina que aportó la tasa (o del perfil de costos). */
  readonly sourceId?: string
  /** `false` si la transformación de fallas no se aplicó (modo TEST u override DISABLED). */
  readonly applied: boolean
  readonly inactiveReason?: 'TEST_MODE' | 'OVERRIDE_DISABLED'
}

export interface PlatesRequired {
  readonly plateId: string
  /** Placas físicas: ceil(piezas / piezas por placa). En v2 = completas + (1 si hay restante). */
  readonly platesRequired: Quantity
  /** v2: placas COMPLETAS (floor). */
  readonly fullPlates?: number
  /** v2: piezas de la última placa incompleta (0 = todas completas). */
  readonly remainderParts?: number
  /**
   * v2: cómo se valoró la última placa. SLICED = datos de Bambu Studio (ítems con `plateId` = `lastRunPlateId`);
   * ESTIMATED_FULL_PLATE = estimación conservadora (como una placa completa, igual que v1).
   */
  readonly lastRun?: { readonly source: 'SLICED' | 'ESTIMATED_FULL_PLATE'; readonly parts: number; readonly lastRunPlateId?: string }
}

export interface CostTotals {
  readonly byBehavior: Readonly<Record<CostBehavior, Clp>>
  readonly byComponent: Readonly<Partial<Record<CostComponent, Clp>>>
  readonly byRecovery: Readonly<Record<Recovery, Clp>>
}

export interface CostBreakdown {
  readonly items: readonly CostItem[]
  readonly platesRequired: readonly PlatesRequired[]
  readonly totals: CostTotals
  /** C: suma de `pooledAmount` (IN_PRICE amortizado + SEPARATE_LINE). Base del precio. */
  readonly pricingPool: Clp
  /** A: Σ amount de los ítems ABSORBED. Fuera del precio; reduce la utilidad real del negocio. */
  readonly absorbedCost: Clp
  /**
   * Σ (amount − pooledAmount) de los ítems IN_PRICE amortizados: parte de un costo único que esta
   * cotización NO traslada y que se espera recuperar en cotizaciones futuras. No es pérdida de esta cotización.
   * (El seguimiento de lo ya recuperado queda para la fase de BI/inventario.)
   */
  readonly deferredCost: Clp
  /**
   * Σ vatRecoverable de los ítems: IVA recuperable contenido en las compras que consume la cotización
   * (indicador informativo). NO representa un crédito fiscal nuevo generado por cada costo calculado y
   * no debe sumarse a créditos ya reconocidos en las compras originales. Excluye el desgaste.
   */
  readonly recoverableVat: Clp
  /**
   * Tasa de falla resuelta y su procedencia, por placa y global (ítems sin placa). Queda en el snapshot
   * de la cotización para poder auditar de dónde salió cada tasa.
   */
  readonly failureRates: readonly ResolvedFailureRate[]
  /** Informativo: pricingPool / N. */
  readonly unitCost: number
}

/**
 * Una línea comercial del precio. La línea MAIN agrupa los costos `IN_PRICE`; cada línea SEPARATE_LINE
 * agrupa un costo único y TODAS sus fallas derivadas (`derivedFrom`): una falla nunca genera una línea
 * independiente. El detalle completo (ítems de origen y de falla) queda en `sourceItemCodes`, solo para
 * uso INTERNO: la salida al cliente nunca ve costos ni códigos de ítem.
 */
export interface PricedLine {
  /** `main` para la línea principal; para las separadas, el código del ítem origen. */
  readonly code: string
  readonly kind: LineKind
  readonly quantity: Quantity
  readonly customerUnitPrice: Clp
  readonly customerLineTotal: Clp
  readonly netLineTotal: Clp
  readonly vatLineTotal: Clp
  readonly grossLineTotal: Clp
  /** Σ pooledAmount de los ítems de la línea (incluye sus fallas). La suma de todas las líneas = pricingPool. */
  readonly costBasis: Clp
  /** Códigos de los ítems de costo agrupados en la línea (origen + fallas derivadas). Interno. */
  readonly sourceItemCodes: readonly string[]
}

export interface PricingDiscount {
  readonly applied: Fraction
  /** Si CAP limitó el descuento: el que correspondía por tramo. */
  readonly cappedFrom?: Fraction
}

/**
 * Se mantienen separados: costo económico, precio neto, IVA, precio bruto,
 * comisión, utilidad, margen y markup. IVA nunca es utilidad ni costo operativo.
 */
export interface PricingResult {
  readonly mode: PricingMode
  /** Cómo ve el cliente el precio: `customerUnitPrice` y los totales de línea están en este modo. */
  readonly customerPriceMode: CustomerPriceMode
  readonly targetNetTotal: Clp
  readonly lines: readonly PricedLine[]
  readonly discount: PricingDiscount
  readonly customerUnitPrice: Clp
  readonly netTotal: Clp
  readonly vatTotal: Clp
  readonly grossTotal: Clp
  readonly commission: Clp
  /**
   * Utilidad COMERCIAL de esta cotización: netTotal − commission − pricingPool, sobre el precio EFECTIVO
   * (post redondeo). Es la que gobierna la política de precio (objetivo, mínimo, WARN/CAP/BLOCK).
   * Definición única en `v1/tax/ledger.ts`. Los costos diferidos (amortización) no la reducen: se esperan
   * recuperar en cotizaciones futuras.
   */
  readonly commercialUtility: Clp
  /** commercialUtility / netTotal; `null` si netTotal ≤ 0 (margen indefinido). Variable principal de pricing. */
  readonly commercialMargin: number | null
  /** commercialUtility / pricingPool; `null` si pricingPool ≤ 0. Indicador derivado, nunca variable de decisión. */
  readonly commercialMarkup: number | null
  /** Costos ABSORBED: fuera del precio, el negocio los asume. Igual a `breakdown.absorbedCost`. */
  readonly absorbedCost: Clp
  /** Utilidad REAL del negocio: commercialUtility − absorbedCost = netTotal − commission − pricingPool − absorbedCost. */
  readonly realUtility: Clp
  /** realUtility / netTotal; `null` si netTotal ≤ 0. Informativo: si cae bajo el mínimo → `REAL_MARGIN_BELOW_MIN`. */
  readonly realMargin: number | null
  /** realUtility / (pricingPool + absorbedCost); `null` si ese costo es 0. */
  readonly realMarkup: number | null
  /** Precio neto total que deja exactamente el margen mínimo. */
  readonly floorNetTotal: Clp
  /** Precio neto total con utilidad 0. */
  readonly breakEvenNetTotal: Clp
}

export interface CalculationFlag {
  readonly code: FlagCode
  readonly severity: FlagSeverity
  readonly path?: string
}

/** Resultado de la capa de precios: el precio y las advertencias propias de esta etapa. */
export interface PricingOutput {
  readonly pricing: PricingResult
  readonly flags: readonly CalculationFlag[]
}
