import {
  multiplyClp,
  parseQuantity,
  roundToClp,
  sumClp,
  type Clp,
  type Quantity,
} from '../../../../core/money'
import { CommissionBase, CustomerPriceMode, type LineKind } from '../../contracts/enums'
import type { ParameterSnapshot } from '../../contracts/parameters'
import type { CostBreakdown, PricedLine } from '../../contracts/results'
import {
  buildTaxLedger,
  decomposeCommission,
  economicFixedFee,
  splitFromGross,
  splitFromNet,
  type SaleSplit,
  type TaxLedger,
} from '../tax'
import { allocateInteger } from './allocation'
import { unwrap } from './unwrap'

/** Línea con su precio ya fijado (en el modo de precio del cliente). */
export interface LineSpec {
  readonly code: string
  readonly kind: LineKind
  readonly quantity: Quantity
  readonly customerUnitPrice: Clp
  readonly costBasis: Clp
  readonly sourceItemCodes: readonly string[]
}

export interface OutcomeContext {
  readonly params: ParameterSnapshot
  readonly salesRate: number
  readonly breakdown: CostBreakdown
}

export interface Outcome {
  readonly lines: readonly PricedLine[]
  readonly split: SaleSplit
  readonly commission: Clp
  readonly ledger: TaxLedger
  /** Margen comercial: utilidad / neto efectivo; `null` si el neto es ≤ 0 (indefinido). */
  readonly margin: number | null
  /**
   * Margen para decidir la política: igual a `margin`, o −∞ si no hay neto (sin venta no se alcanza ningún
   * mínimo positivo). Nunca se expone en el resultado.
   */
  readonly policyMargin: number
}

export function oneUnit(): Quantity {
  return unwrap(parseQuantity(1, 'quantity'), 'one-unit')
}

/**
 * Consecuencias económicas de un conjunto de precios: separa neto, IVA y bruto a nivel de documento,
 * calcula la comisión sobre el precio EFECTIVO (ya redondeado), y obtiene la utilidad del ledger de IVA
 * (definición única). Todo se recalcula desde los precios finales: no se hereda nada del cálculo teórico.
 */
export function evaluateOutcome(context: OutcomeContext, specs: readonly LineSpec[]): Outcome {
  const { params, salesRate, breakdown } = context
  const mode = params.taxProfile.customerPriceMode
  const totals = specs.map((spec) => multiplyClp(spec.customerUnitPrice, spec.quantity))
  const customerTotal = sumClp(totals)

  const split =
    mode === CustomerPriceMode.GROSS
      ? unwrap(splitFromGross(customerTotal, salesRate), 'sale-split')
      : unwrap(splitFromNet(customerTotal, salesRate), 'sale-split')

  // Neto e IVA por línea: el que ve el cliente es exacto; el otro se reparte (mayor resto) para que las líneas sumen el documento.
  let nets: number[]
  let vats: number[]
  if (mode === CustomerPriceMode.GROSS) {
    nets = allocateInteger(split.net, totals)
    vats = totals.map((total, index) => total - (nets[index] ?? 0))
  } else {
    vats = allocateInteger(split.vat, totals)
    nets = totals.map((total) => total)
  }

  const lines: PricedLine[] = specs.map((spec, index) => {
    const net = roundToClp(nets[index] ?? 0)
    const vat = roundToClp(vats[index] ?? 0)
    return {
      code: spec.code,
      kind: spec.kind,
      quantity: spec.quantity,
      customerUnitPrice: spec.customerUnitPrice,
      customerLineTotal: totals[index] ?? roundToClp(0),
      netLineTotal: net,
      vatLineTotal: vat,
      grossLineTotal: roundToClp(net + vat),
      costBasis: spec.costBasis,
      sourceItemCodes: spec.sourceItemCodes,
    }
  })

  // Comisión: porcentaje sobre la base del canal (neto o bruto) + cargo fijo por transacción; su IVA según el canal.
  const channel = params.channel
  const base = channel.commissionBase === CommissionBase.GROSS ? split.gross : split.net
  const percentage = unwrap(decomposeCommission(channel.commission * base, channel.commissionTax, params.taxProfile), 'commission')
  const fixed = unwrap(economicFixedFee(channel, params.taxProfile), 'fixed-fee')
  const commission = roundToClp(percentage.economicFee + fixed.economicCost)
  const commissionVatRecoverable = roundToClp(percentage.vatRecoverable + fixed.vatRecoverable)

  const ledger = unwrap(
    buildTaxLedger(
      {
        sale: split,
        economicCost: breakdown.pricingPool,
        commission,
        purchaseVatRecoverable: breakdown.recoverableVat,
        commissionVatRecoverable,
      },
      salesRate,
    ),
    'ledger',
  )
  return {
    lines,
    split,
    commission,
    ledger,
    margin: split.net > 0 ? ledger.utility / split.net : null,
    policyMargin: split.net > 0 ? ledger.utility / split.net : Number.NEGATIVE_INFINITY,
  }
}
