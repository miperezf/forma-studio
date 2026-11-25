import { describe, expect, it } from 'vitest'
import { roundToClp, type Clp } from '../../../../core/money'
import {
  buildTaxLedger,
  checkLedgerInvariants,
  splitFromGross,
  splitFromNet,
  type SaleSplit,
  type TaxLedger,
  type TaxLedgerInput,
} from './index'

const clp = (n: number): Clp => roundToClp(n)

function sale(result: ReturnType<typeof splitFromGross>): SaleSplit {
  if (!result.ok) throw new Error('separación inválida en el test')
  return result.value
}

function ledger(input: TaxLedgerInput, rate = 0.19): TaxLedger {
  const result = buildTaxLedger(input, rate)
  if (!result.ok) throw new Error(`se esperaba éxito: ${JSON.stringify(result.error)}`)
  return result.value
}

const base = (over: Partial<TaxLedgerInput> = {}): TaxLedgerInput => ({
  sale: sale(splitFromGross(clp(25500), 0.19)), // neto 21.429 · IVA 4.071
  economicCost: clp(13884),
  commission: clp(0),
  purchaseVatRecoverable: clp(0),
  commissionVatRecoverable: clp(0),
  ...over,
})

describe('ledger: venta directa (caso de referencia del diseño, margen 35 %)', () => {
  const l = ledger(base({ purchaseVatRecoverable: clp(330) }))

  it('separa neto, IVA de venta y bruto', () => {
    expect(l.netRevenue).toBe(21429)
    expect(l.saleVat).toBe(4071)
    expect(l.grossRevenue).toBe(25500)
  })

  it('la utilidad sale del NETO: no incluye el IVA de venta', () => {
    expect(l.utility).toBe(7545) // 21.429 − 0 − 13.884
    expect(l.utility).not.toBe(l.grossRevenue - l.economicCost)
  })

  it('el crédito fiscal no es costo ni utilidad: solo reduce el IVA a pagar', () => {
    expect(l.recoverableVat).toBe(330)
    expect(l.vatPayable).toBe(3741) // 4.071 − 330
    expect(l.economicCost).toBe(13884)
  })

  it('las identidades se cumplen', () => {
    expect(checkLedgerInvariants(l)).toEqual([])
  })
})

describe('ledger: marketplace con comisión', () => {
  it('la comisión se resta del neto y se mantiene separada de costo y utilidad', () => {
    const l = ledger(base({ sale: sale(splitFromGross(clp(31800), 0.19)), commission: clp(3474) }))
    expect(l.netRevenue).toBe(26723)
    expect(l.saleVat).toBe(5077)
    expect(l.commission).toBe(3474)
    expect(l.utility).toBe(9365) // 26.723 − 3.474 − 13.884
    expect(checkLedgerInvariants(l)).toEqual([])
  })

  it('el crédito fiscal de la comisión se suma al de las compras', () => {
    const l = ledger(base({ purchaseVatRecoverable: clp(300), commissionVatRecoverable: clp(660), commission: clp(3474) }))
    expect(l.recoverableVat).toBe(960)
    expect(l.vatPayable).toBe(4071 - 960)
  })
})

describe('IVA de venta separado de costo y utilidad', () => {
  it('con el mismo neto, cambiar la tasa de IVA cambia bruto e IVA pero NO la utilidad', () => {
    const net = clp(21429)
    const at19 = ledger(base({ sale: sale(splitFromNet(net, 0.19)) }), 0.19)
    const at21 = ledger(base({ sale: sale(splitFromNet(net, 0.21)) }), 0.21)
    const exempt = ledger(base({ sale: sale(splitFromNet(net, 0)) }), 0)
    expect(at19.saleVat).not.toBe(at21.saleVat)
    expect(at19.grossRevenue).not.toBe(at21.grossRevenue)
    expect(at19.utility).toBe(at21.utility)
    expect(at19.utility).toBe(exempt.utility)
    expect(exempt.saleVat).toBe(0)
  })

  it('el crédito fiscal no altera la utilidad ni el costo económico', () => {
    const without = ledger(base())
    const withCredit = ledger(base({ purchaseVatRecoverable: clp(5000), commissionVatRecoverable: clp(700) }))
    expect(withCredit.utility).toBe(without.utility)
    expect(withCredit.economicCost).toBe(without.economicCost)
    expect(withCredit.vatPayable).toBe(without.vatPayable - 5700)
  })

  it('el IVA que SÍ es costo reduce la utilidad solo porque viene dentro del costo económico', () => {
    // mismo desembolso en compras (1.190 con IVA): recuperable → costo 1.000; no recuperable → costo 1.190
    const recoverable = ledger(base({ economicCost: clp(1000), purchaseVatRecoverable: clp(190) }))
    const notRecoverable = ledger(base({ economicCost: clp(1190), purchaseVatRecoverable: clp(0) }))
    expect(recoverable.utility - notRecoverable.utility).toBe(190)
    expect(recoverable.vatPayable).toBe(notRecoverable.vatPayable - 190)
  })

  it('saldo a favor: si el crédito supera al débito, el IVA a pagar es negativo', () => {
    const l = ledger(base({ sale: sale(splitFromGross(clp(1190), 0.19)), purchaseVatRecoverable: clp(500) }))
    expect(l.saleVat).toBe(190)
    expect(l.vatPayable).toBe(-310)
    expect(checkLedgerInvariants(l)).toEqual([])
  })

  it('negocio no afecto: sin IVA de venta, utilidad = neto − comisión − costo', () => {
    const l = ledger(base({ sale: sale(splitFromGross(clp(25500), 0)), economicCost: clp(16521) }), 0)
    expect(l.saleVat).toBe(0)
    expect(l.netRevenue).toBe(l.grossRevenue)
    expect(l.utility).toBe(25500 - 16521)
    expect(l.vatPayable).toBe(0)
  })

  it('utilidad negativa es posible (precio bajo el costo) y sigue siendo coherente', () => {
    const l = ledger(base({ economicCost: clp(30000) }))
    expect(l.utility).toBe(21429 - 30000)
    expect(checkLedgerInvariants(l)).toEqual([])
  })

  it('venta cero: todo en cero, sin errores', () => {
    const l = ledger(base({ sale: sale(splitFromGross(clp(0), 0.19)), economicCost: clp(0) }))
    expect(l.utility).toBe(0)
    expect(l.vatPayable).toBe(0)
  })
})

describe('entradas inválidas e invariantes del ledger', () => {
  it('una separación de venta que no suma se rechaza', () => {
    const corrupted: SaleSplit = { net: clp(1000), vat: clp(190), gross: clp(1191) }
    const result = buildTaxLedger(base({ sale: corrupted }), 0.19)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_COMBINATION')
      expect(result.error.field).toBe('sale')
    }
  })

  it('un IVA de venta calculado con otra tasa se rechaza', () => {
    const wrongRate: SaleSplit = { net: clp(1000), vat: clp(210), gross: clp(1210) }
    expect(buildTaxLedger(base({ sale: wrongRate }), 0.19).ok).toBe(false)
  })

  const fields: (keyof Omit<TaxLedgerInput, 'sale'>)[] = [
    'economicCost',
    'commission',
    'purchaseVatRecoverable',
    'commissionVatRecoverable',
  ]
  it.each(fields.map((f): [string] => [f]))('%s negativo o decimal → INVALID_AMOUNT', (field) => {
    for (const value of [-1, 10.5, Number.NaN]) {
      const result = buildTaxLedger(base({ [field]: value as Clp }), 0.19)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_AMOUNT')
        expect(result.error.field).toBe(field)
      }
    }
  })

  it('checkLedgerInvariants detecta un ledger manipulado', () => {
    const good = ledger(base({ purchaseVatRecoverable: clp(330) }))
    expect(checkLedgerInvariants({ ...good, utility: clp(good.utility + 1) })).toHaveLength(1)
    expect(checkLedgerInvariants({ ...good, grossRevenue: clp(good.grossRevenue + 1) })).toHaveLength(1)
    expect(checkLedgerInvariants({ ...good, vatPayable: clp(0) })).toHaveLength(1)
    // utilidad calculada sobre el bruto (error típico): se detecta
    expect(checkLedgerInvariants({ ...good, utility: clp(good.grossRevenue - good.economicCost) }).length).toBeGreaterThan(0)
  })

  it('es determinista', () => {
    expect(buildTaxLedger(base(), 0.19)).toEqual(buildTaxLedger(base(), 0.19))
  })
})

describe('créditos de compras y de comisión se mantienen separados', () => {
  it('el ledger expone cada componente y su suma', () => {
    const l = ledger(base({ purchaseVatRecoverable: clp(670), commissionVatRecoverable: clp(660), commission: clp(3474) }))
    expect(l.purchaseVatRecoverable).toBe(670)
    expect(l.commissionVatRecoverable).toBe(660)
    expect(l.recoverableVat).toBe(1330)
    expect(checkLedgerInvariants(l)).toEqual([])
  })

  it('checkLedgerInvariants detecta un total de crédito que no es la suma de sus componentes', () => {
    const good = ledger(base({ purchaseVatRecoverable: clp(670), commissionVatRecoverable: clp(660) }))
    expect(checkLedgerInvariants({ ...good, recoverableVat: clp(good.recoverableVat + 1) }).length).toBeGreaterThan(0)
    expect(checkLedgerInvariants({ ...good, purchaseVatRecoverable: clp(good.purchaseVatRecoverable + 100) }).length).toBeGreaterThan(0)
  })

  it('el IVA a pagar es indicativo: usa el crédito prorrateado de la cotización, no el período completo', () => {
    const l = ledger(base({ purchaseVatRecoverable: clp(670) }))
    expect(l.vatPayable).toBe(l.saleVat - 670)
  })
})
