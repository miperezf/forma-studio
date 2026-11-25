import { describe, expect, it } from 'vitest'
import { roundToClp, type Clp } from '../../../../core/money'
import { checkCostBreakdownInvariants } from '../../contracts/invariants'
import { codes, costOf, costSpecRaw, item } from '../../testing/cost-helpers'
import { mutated, validRequestRaw, without } from '../../testing/fixtures'
import { buildTaxLedger, checkLedgerInvariants, splitFromGross } from '../tax'

/**
 * IVA recuperable y desgaste. Principios que estos tests protegen:
 *  1. El IVA de la máquina se recuperó (o no) en su ADQUISICIÓN; el desgaste no lo reconoce de nuevo por impresión.
 *  2. `recoverableVat` es un indicador del IVA contenido en las COMPRAS CONSUMIDAS (material, electricidad,
 *     insumos de servicios, costos adicionales); no es un crédito nuevo por cada costo calculado.
 *  3. El crédito de la comisión sí es nuevo (compra a causa de la venta) y se mantiene aparte.
 */
const MACHINE = 'params.machines.printer-1'
const noFailures = (raw = validRequestRaw()) => mutated('params.costProfile.failure.rate', 0, raw)

/** Máquina con desgaste derivado de una compra (en vez del override de $250/h). */
function derivedWear(purchase: { amount: number; basis: 'NET' | 'GROSS'; vatRecoverable: boolean }, raw = validRequestRaw()) {
  let r = without(`${MACHINE}.wearPerHourOverride`, raw)
  r = mutated(`${MACHINE}.purchasePrice`, purchase, r)
  r = mutated(`${MACHINE}.lifetimeHours`, 8000, r)
  return r
}

const recoverableGross = { amount: 450000, basis: 'GROSS' as const, vatRecoverable: true }

describe('el desgaste no reconoce crédito fiscal', () => {
  const purchases: [string, { amount: number; basis: 'NET' | 'GROSS'; vatRecoverable: boolean }][] = [
    ['compra bruta recuperable', recoverableGross],
    ['compra neta recuperable', { amount: 378151.26, basis: 'NET', vatRecoverable: true }],
    ['compra bruta NO recuperable', { amount: 450000, basis: 'GROSS', vatRecoverable: false }],
    ['compra neta NO recuperable', { amount: 378151.26, basis: 'NET', vatRecoverable: false }],
  ]
  it.each(purchases)('%s: vatRecoverable del desgaste y de su falla = 0', (_name, purchase) => {
    const calc = costOf(derivedWear(purchase))
    expect(item(calc, 'wear:plate-1').vatRecoverable).toBe(0)
    expect(item(calc, 'failure:wear:plate-1').vatRecoverable).toBe(0)
  })

  it('con override de desgaste también es 0', () => {
    const calc = costOf(validRequestRaw())
    expect(item(calc, 'wear:plate-1').vatRecoverable).toBe(0)
  })

  it('el IVA de una máquina enorme no aparece en recoverableVat', () => {
    const huge = { amount: 119_000_000, basis: 'GROSS' as const, vatRecoverable: true } // IVA de $19.000.000
    const withHuge = costOf(derivedWear(huge))
    const withOverride = costOf(validRequestRaw())
    expect(withHuge.breakdown.recoverableVat).toBe(withOverride.breakdown.recoverableVat)
    expect(withHuge.breakdown.recoverableVat).toBe(670)
  })

  it('imprimir más NO vuelve a reconocer el IVA de la máquina: el costo escala, el crédito no', () => {
    for (const plates of [1, 2, 10, 100]) {
      let raw = derivedWear(recoverableGross, noFailures())
      raw = mutated('input.quantity', plates, raw) // una pieza por placa → `plates` placas
      const calc = costOf(raw)
      const wear = item(calc, 'wear:plate-1')
      expect(wear.basis.multiplier).toBe(plates)
      expect(wear.amount).toBe(Math.round(378.151260504 * plates)) // el costo sí se distribuye por placa
      expect(wear.vatRecoverable).toBe(0) // el crédito de la compra original no se repite
    }
  })

  it('el desgaste de una compra bruta recuperable usa el costo NETO; si no es recuperable, el costo completo', () => {
    const recoverable = item(costOf(noFailures(derivedWear(recoverableGross))), 'wear:plate-1')
    expect(recoverable.basis.unitCost).toBeCloseTo(450000 / 1.19 / 8000, 9)
    const notRecoverable = item(costOf(noFailures(derivedWear({ amount: 450000, basis: 'GROSS', vatRecoverable: false }))), 'wear:plate-1')
    expect(notRecoverable.basis.unitCost).toBeCloseTo(450000 / 8000, 9) // el IVA es costo real
    expect(notRecoverable.amount).toBeGreaterThan(recoverable.amount)
  })

  it('régimen no afecto: el costo del desgaste incluye el IVA y tampoco hay crédito', () => {
    let raw = mutated('params.taxProfile.regime', 'NOT_REGISTERED', noFailures(derivedWear(recoverableGross)))
    raw = mutated('params.taxProfile.vatRate', 0, raw)
    const wear = item(costOf(raw), 'wear:plate-1')
    expect(wear.basis.unitCost).toBeCloseTo(450000 / 8000, 9)
    expect(wear.vatRecoverable).toBe(0)
  })

  it('el valor residual tampoco aporta crédito', () => {
    const raw = mutated(`${MACHINE}.residualValue`, { amount: 119000, basis: 'GROSS', vatRecoverable: true }, derivedWear(recoverableGross))
    expect(item(costOf(raw), 'wear:plate-1').vatRecoverable).toBe(0)
  })

  it('la autoverificación acepta el desgaste sin crédito (identidades del desglose)', () => {
    const calc = costOf(derivedWear(recoverableGross))
    expect(checkCostBreakdownInvariants(calc.breakdown, calc.quantities.units)).toEqual([])
  })
})

describe('las compras consumidas conservan su IVA recuperable (según régimen y datos de origen)', () => {
  it('material y electricidad: IVA contenido en lo consumido, prorrateado', () => {
    const calc = costOf(noFailures())
    expect(item(calc, 'material:plate-1:pla-basic').vatRecoverable).toBe(342)
    expect(item(calc, 'electricity:plate-1').vatRecoverable).toBe(274)
    expect(calc.breakdown.recoverableVat).toBe(616)
  })

  it('servicios y costos adicionales con insumos comprados', () => {
    let raw = mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], noFailures())
    raw = mutated('input.extraCosts', [costSpecRaw('box', 119, 'PER_UNIT', { basis: 'GROSS', vatRecoverable: true })], raw)
    const calc = costOf(raw)
    expect(item(calc, 'service:modeling-3d').vatRecoverable).toBe(5130)
    expect(item(calc, 'extra:box').vatRecoverable).toBe(19)
    expect(calc.breakdown.recoverableVat).toBe(616 + 5130 + 19)
  })

  it('un ítem no recuperable o de un régimen no afecto no aporta crédito', () => {
    const raw = mutated('params.materials.pla-basic.spool.price', { amount: 15000, basis: 'NET', vatRecoverable: false }, noFailures())
    expect(item(costOf(raw), 'material:plate-1:pla-basic').vatRecoverable).toBe(0)
    let notRegistered = mutated('params.taxProfile.regime', 'NOT_REGISTERED', noFailures())
    notRegistered = mutated('params.taxProfile.vatRate', 0, notRegistered)
    expect(costOf(notRegistered).breakdown.recoverableVat).toBe(0)
  })

  it('las fallas de compras consumidas traen su IVA proporcional (más material consumido); las del desgaste, 0', () => {
    const calc = costOf(validRequestRaw())
    expect(item(calc, 'failure:material:plate-1:pla-basic').vatRecoverable).toBe(30)
    expect(item(calc, 'failure:electricity:plate-1').vatRecoverable).toBe(24)
    expect(item(calc, 'failure:wear:plate-1').vatRecoverable).toBe(0)
    expect(item(calc, 'failure:supervision:plate-1').vatRecoverable).toBe(0)
    expect(calc.breakdown.recoverableVat).toBe(670)
  })

  it('un ítem ABSORBED conserva el IVA de lo que consumió (no depende de la recuperación del costo)', () => {
    const raw = mutated('overrides', [{ kind: 'ITEM_RECOVERY', itemCode: 'material:plate-1:pla-basic', value: { recovery: 'ABSORBED' }, reason: 'prueba' }], noFailures())
    const material = item(costOf(raw), 'material:plate-1:pla-basic')
    expect(material.pooledAmount).toBe(0)
    expect(material.vatRecoverable).toBe(342)
  })

  it('el IVA contenido escala con el consumo (placas), no con el desgaste ni con las unidades de otros costos', () => {
    const calc = costOf(mutated('input.quantity', 10, mutated('input.plates[0].partsPerPlate', 6, noFailures())))
    expect(item(calc, 'material:plate-1:pla-basic').vatRecoverable).toBe(684) // 2 placas
    expect(calc.breakdown.recoverableVat).toBe(684 + 547) // 273,6 × 2 = 547,2
  })
})

describe('puente hacia el ledger: sin duplicar créditos', () => {
  const clp = (n: number): Clp => roundToClp(n)
  const sale = (gross: number) => {
    const split = splitFromGross(clp(gross), 0.19)
    if (!split.ok) throw new Error('separación inválida')
    return split.value
  }

  it('el crédito de compras del ledger es exactamente recoverableVat del desglose (sin desgaste)', () => {
    const calc = costOf(derivedWear({ amount: 119_000_000, basis: 'GROSS', vatRecoverable: true }))
    const ledger = buildTaxLedger(
      {
        sale: sale(41400),
        economicCost: calc.breakdown.pricingPool,
        commission: clp(0),
        purchaseVatRecoverable: calc.breakdown.recoverableVat,
        commissionVatRecoverable: clp(0),
      },
      0.19,
    )
    expect(ledger.ok).toBe(true)
    if (!ledger.ok) return
    expect(ledger.value.purchaseVatRecoverable).toBe(670)
    expect(ledger.value.recoverableVat).toBe(670)
    expect(checkLedgerInvariants(ledger.value)).toEqual([])
  })

  it('el crédito de la comisión es nuevo y se mantiene separado del de las compras', () => {
    const calc = costOf(validRequestRaw())
    const ledger = buildTaxLedger(
      {
        sale: sale(61200),
        economicCost: calc.breakdown.pricingPool,
        commission: clp(3474),
        purchaseVatRecoverable: calc.breakdown.recoverableVat,
        commissionVatRecoverable: clp(660),
      },
      0.19,
    )
    expect(ledger.ok).toBe(true)
    if (!ledger.ok) return
    expect(ledger.value.purchaseVatRecoverable).toBe(670)
    expect(ledger.value.commissionVatRecoverable).toBe(660)
    expect(ledger.value.recoverableVat).toBe(1330)
    expect(ledger.value.vatPayable).toBe(ledger.value.saleVat - 1330)
    expect(checkLedgerInvariants(ledger.value)).toEqual([])
  })

  it('el costo económico del ledger no incluye el IVA recuperable (no se suma dos veces)', () => {
    const calc = costOf(noFailures())
    // costo económico + crédito prorrateado = lo que costaron las compras con IVA (material + electricidad)
    const material = item(calc, 'material:plate-1:pla-basic')
    const electricity = item(calc, 'electricity:plate-1')
    expect(material.amount + material.vatRecoverable).toBe(1800 + 342)
    expect(electricity.amount + electricity.vatRecoverable).toBe(1440 + 274)
  })

  it('la lista de ítems no contiene ningún "crédito" como costo: ningún ítem representa IVA', () => {
    expect(codes(costOf(validRequestRaw())).some((c) => c.toLowerCase().includes('vat'))).toBe(false)
  })
})
