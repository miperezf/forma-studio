import { err, ok, type Result } from '../../../../core/result'
import { isClp, roundToClp, type Clp } from '../../../../core/money'
import { taxError, type TaxError } from './errors'
import { checkSplitInvariant, type SaleSplit } from './sale-split'

/**
 * Entradas ya en CLP enteros. Cada concepto llega por separado y NUNCA se mezcla con otro:
 *  - `economicCost`: costo económico de producción (sin IVA recuperable).
 *  - `commission`: comisión económica (incluye su IVA solo si ese IVA es costo real).
 *  - `purchaseVatRecoverable`: IVA recuperable contenido en las compras que consume la cotización
 *    (`CostBreakdown.recoverableVat`; indicador prorrateado, excluye el desgaste). No es un crédito nuevo.
 *  - `commissionVatRecoverable`: crédito de la factura de la comisión. Ese sí es un crédito NUEVO: la
 *    compra (el servicio de la plataforma) ocurre a causa de esta venta.
 *  - `sale`: precio de venta separado en neto, IVA de venta (débito fiscal) y bruto.
 */
export interface TaxLedgerInput {
  readonly sale: SaleSplit
  readonly economicCost: Clp
  readonly commission: Clp
  readonly purchaseVatRecoverable: Clp
  readonly commissionVatRecoverable: Clp
}

export interface TaxLedger {
  readonly netRevenue: Clp
  /** IVA de venta (débito fiscal): dinero del fisco que el cliente paga; no es ingreso del negocio. */
  readonly saleVat: Clp
  readonly grossRevenue: Clp
  readonly economicCost: Clp
  readonly commission: Clp
  readonly purchaseVatRecoverable: Clp
  readonly commissionVatRecoverable: Clp
  /** purchaseVatRecoverable + commissionVatRecoverable: no es costo ni utilidad. */
  readonly recoverableVat: Clp
  /**
   * saleVat − recoverableVat. INDICATIVO por cotización: no es la declaración de IVA. La declaración se hace
   * por período con los créditos de las compras reales (reconocidos una sola vez, en la compra) y los
   * débitos de todas las ventas. Negativo = saldo a favor en esta cotización.
   */
  readonly vatPayable: Clp
  /**
   * Definición ÚNICA de utilidad (v1): neto − comisión − costo económico.
   * El IVA de venta y el crédito fiscal no intervienen; el IVA no recuperable ya está dentro del costo.
   */
  readonly utility: Clp
}

export function buildTaxLedger(input: TaxLedgerInput, saleRate: number): Result<TaxLedger, TaxError> {
  const violation = checkSplitInvariant(input.sale, saleRate)
  if (violation !== undefined) {
    return err(taxError('INVALID_COMBINATION', 'sale', violation))
  }
  for (const [field, value] of [
    ['economicCost', input.economicCost],
    ['commission', input.commission],
    ['purchaseVatRecoverable', input.purchaseVatRecoverable],
    ['commissionVatRecoverable', input.commissionVatRecoverable],
  ] as const) {
    if (!isClp(value) || value < 0) {
      return err(taxError('INVALID_AMOUNT', field, 'Debe ser un entero CLP no negativo'))
    }
  }
  const recoverableVat = roundToClp(input.purchaseVatRecoverable + input.commissionVatRecoverable)
  return ok({
    netRevenue: input.sale.net,
    saleVat: input.sale.vat,
    grossRevenue: input.sale.gross,
    economicCost: input.economicCost,
    commission: input.commission,
    purchaseVatRecoverable: input.purchaseVatRecoverable,
    commissionVatRecoverable: input.commissionVatRecoverable,
    recoverableVat,
    vatPayable: roundToClp(input.sale.vat - recoverableVat),
    utility: roundToClp(input.sale.net - input.commission - input.economicCost),
  })
}

/** Verifica las identidades del ledger. Devuelve los incumplimientos (vacío = coherente). */
export function checkLedgerInvariants(ledger: TaxLedger): readonly string[] {
  const problems: string[] = []
  if (ledger.netRevenue + ledger.saleVat !== ledger.grossRevenue) {
    problems.push('netRevenue + saleVat debe ser grossRevenue')
  }
  if (ledger.utility !== ledger.netRevenue - ledger.commission - ledger.economicCost) {
    problems.push('utility debe ser netRevenue − commission − economicCost (sin IVA)')
  }
  if (ledger.recoverableVat !== ledger.purchaseVatRecoverable + ledger.commissionVatRecoverable) {
    problems.push('recoverableVat debe ser purchaseVatRecoverable + commissionVatRecoverable')
  }
  if (ledger.vatPayable !== ledger.saleVat - ledger.recoverableVat) {
    problems.push('vatPayable debe ser saleVat − recoverableVat')
  }
  return problems
}
