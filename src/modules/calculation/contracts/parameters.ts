import type {
  Clp,
  Fraction,
  Grams,
  Hours,
  Minutes,
  MoneyAmount,
  Quantity,
  Ratio,
  TaxedAmount,
  Watts,
} from '../../../core/money'
import type { EntityRef, IsoDateTime } from '../../../core/versioning'
import type { CostSpec, RecoveryConfig } from './cost-spec'
import type {
  BelowMinPolicyId,
  ChannelKind,
  CommissionBase,
  CostBehavior,
  CostComponent,
  CustomerPriceMode,
  FailureModelId,
  LaborKind,
  RoundingDirection,
  RoundingMode,
  RoundingTarget,
  ServiceKind,
  TaxRegime,
} from './enums'

// ── CostProfile ─────────────────────────────────────────────────────────────

export interface FailureParams {
  readonly modelId: FailureModelId
  /** Tasa de falla p ∈ [0, MAX_FAILURE_RATE]. */
  readonly rate: Fraction
  /** Fracción del costo consumida por intento fallido (1 = costo completo). */
  readonly costFraction: Fraction
  readonly affectedComponents: readonly CostComponent[]
}

export interface CostProfileValues {
  readonly ref: EntityRef
  readonly labor: {
    readonly ratePerHour: MoneyAmount
    readonly rateByKind?: Readonly<Partial<Record<LaborKind, MoneyAmount>>>
  }
  readonly supervision: { readonly hoursPerPrintHour: Ratio }
  readonly preparation: {
    readonly jobSetupMinutes: Minutes
    readonly plateChangeoverMinutes: Minutes
  }
  readonly energy: { readonly kwhPrice: TaxedAmount }
  readonly materialWaste: { readonly fraction: Fraction }
  readonly failure: FailureParams
  readonly auxiliaryCosts: readonly CostSpec[]
}

// ── PricingProfile ──────────────────────────────────────────────────────────

export interface DiscountTier {
  readonly minQty: Quantity
  /** `null` = sin tope superior. */
  readonly maxQty: Quantity | null
  readonly discount: Fraction
}

export type RoundingStrategy =
  | { readonly mode: typeof RoundingMode.NONE }
  | {
      readonly mode: typeof RoundingMode.STEP
      readonly step: Clp
      readonly direction: RoundingDirection
      readonly target: RoundingTarget
    }

export interface PricingProfileValues {
  readonly ref: EntityRef
  /** Margen objetivo: utilidad / precio neto. Estrategia principal de precio. */
  readonly targetMargin: Fraction
  readonly minMargin: Fraction
  readonly onBelowMin: BelowMinPolicyId
  readonly discountTiers: readonly DiscountTier[]
  readonly rounding: RoundingStrategy
}

// ── TaxProfile ──────────────────────────────────────────────────────────────

/**
 * Configuración tributaria (no sustituye asesoría tributaria).
 *  - `regime`: VAT_REGISTERED (afecto: cobra IVA en ventas y puede recuperar crédito fiscal) o
 *    NOT_REGISTERED (no afecto: no cobra IVA y no recupera crédito).
 *  - `vatRate`: tasa del IVA que se COBRA en ventas. Con NOT_REGISTERED debe ser 0.
 *  - `purchaseVatRate`: tasa del IVA que cobran los PROVEEDORES. Es independiente del régimen:
 *    un negocio no afecto igual paga 19 % en sus compras, y la necesita para descomponer montos.
 *  - `customerPriceMode`: si el cliente ve precio neto o bruto.
 */
export interface TaxProfileValues {
  readonly ref: EntityRef
  readonly regime: TaxRegime
  readonly vatRate: Fraction
  readonly purchaseVatRate: Fraction
  readonly customerPriceMode: CustomerPriceMode
}

// ── SalesChannel ────────────────────────────────────────────────────────────

/** IVA asociado a la comisión de la plataforma. */
export interface CommissionTaxTreatment {
  /** La plataforma cobra IVA sobre su comisión. */
  readonly vatCharged: boolean
  /** Ese IVA es crédito fiscal (false = es costo real). */
  readonly vatRecoverable: boolean
}

export interface ChannelValues {
  readonly ref: EntityRef
  readonly name: string
  readonly kind: ChannelKind
  readonly commission: Fraction
  readonly fixedFee: TaxedAmount
  readonly commissionBase: CommissionBase
  readonly commissionTax: CommissionTaxTreatment
}

// ── Material / Machine / Service ────────────────────────────────────────────

export interface MaterialValues {
  readonly ref: EntityRef
  readonly name: string
  readonly brand: string
  readonly spool: { readonly price: TaxedAmount; readonly netGrams: Grams }
  readonly wasteFractionOverride?: Fraction
  readonly failureRateOverride?: Fraction
}

export interface MachineValues {
  readonly ref: EntityRef
  readonly name: string
  readonly avgPowerW?: Watts
  readonly electricityPerHourOverride?: TaxedAmount
  readonly purchasePrice?: TaxedAmount
  readonly residualValue?: TaxedAmount
  readonly lifetimeHours?: Hours
  readonly maintenanceReservePerHour?: MoneyAmount
  readonly wearPerHourOverride?: MoneyAmount
  readonly supervisionRatioOverride?: Ratio
  readonly failureRateOverride?: Fraction
}

export interface ServiceValues {
  readonly ref: EntityRef
  readonly name: string
  readonly kind: ServiceKind
  readonly behavior: CostBehavior
  readonly component: CostComponent
  readonly supplyCost: TaxedAmount
  readonly laborMinutes: Minutes
  readonly laborKind: LaborKind
  readonly laborRateOverride?: MoneyAmount
  readonly defaultRecovery: RecoveryConfig
}

// ── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Parámetros RESUELTOS (valores, no solo referencias) usados por un cálculo.
 * Es lo que se persiste con la cotización para reproducirla exactamente.
 */
export interface ParameterSnapshot {
  readonly costProfile: CostProfileValues
  readonly pricingProfile: PricingProfileValues
  readonly taxProfile: TaxProfileValues
  readonly channel: ChannelValues
  /** Indexados por `ref.id`. */
  readonly materials: Readonly<Record<string, MaterialValues>>
  readonly machines: Readonly<Record<string, MachineValues>>
  readonly services: Readonly<Record<string, ServiceValues>>
  /** Instante en que se resolvieron las revisiones (lo inyecta Application con el Clock). */
  readonly resolvedAt: IsoDateTime
  readonly currency: 'CLP'
}
