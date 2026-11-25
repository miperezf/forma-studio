import { describe, expect, it } from 'vitest'
import { roundToClp, type Clp } from '../../../../core/money'
import { pick, seededRandom } from '../../testing/random'
import { taxed, taxProfile } from '../../testing/tax-fixtures'
import {
  buildTaxLedger,
  checkLedgerInvariants,
  checkSplitInvariant,
  decomposePurchase,
  roundCostTax,
  splitFromGross,
  splitFromNet,
} from './index'

const ITERATIONS = 2000
const RATES = [0, 0.05, 0.1, 0.19, 0.21, 0.33, 0.5]

function randomAmount(random: () => number): number {
  const magnitude = pick([1, 10, 100, 10_000, 1_000_000, 100_000_000], random)
  // mezcla enteros y decimales, incluida la franja de mitades
  const raw = random() * magnitude
  return random() < 0.5 ? Math.round(raw) : Math.round(raw * 100) / 100
}

describe('propiedades (barrido con semilla fija, 2.000 casos cada una)', () => {
  it('costos: las identidades contables se cumplen para cualquier monto, base, régimen y tasa', () => {
    const random = seededRandom(20261009)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rate = pick(RATES, random)
      const regime = pick(['VAT_REGISTERED', 'NOT_REGISTERED'] as const, random)
      const tax = taxProfile({ regime, purchaseVatRate: rate })
      const amount = randomAmount(random)
      const basis = pick(['NET', 'GROSS'] as const, random)
      const recoverable = random() < 0.5
      const result = decomposePurchase(taxed(amount, basis, recoverable), tax)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const d = result.value
      const eps = 1e-9 * Math.max(1, amount)
      expect(Math.abs(d.vatPaid - (d.vatRecoverable + d.vatAsCost))).toBeLessThan(eps)
      expect(Math.abs(d.economicCost - (d.netBase + d.vatAsCost))).toBeLessThan(eps)
      expect(Math.abs(d.cashPaid - (d.netBase + d.vatPaid))).toBeLessThan(eps)
      expect(Math.abs(d.cashPaid - (d.economicCost + d.vatRecoverable))).toBeLessThan(eps)
      for (const value of [d.netBase, d.vatPaid, d.vatRecoverable, d.vatAsCost, d.economicCost, d.cashPaid]) {
        expect(value).toBeGreaterThanOrEqual(0)
      }
      // el costo económico nunca supera al desembolso ni baja del neto
      expect(d.economicCost).toBeLessThan(d.cashPaid + eps)
      expect(d.economicCost + eps).toBeGreaterThan(d.netBase)
      // sin crédito fiscal efectivo todo el IVA es costo; con crédito no hay IVA como costo
      if (regime === 'NOT_REGISTERED' || !recoverable) expect(d.vatRecoverable).toBe(0)
      else expect(Math.abs(d.vatAsCost)).toBeLessThan(eps)
    }
  })

  it('costos redondeados: las identidades en CLP son exactas y cada parte difiere ≤ 1,5 del valor exacto', () => {
    const random = seededRandom(7)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const tax = taxProfile({ regime: pick(['VAT_REGISTERED', 'NOT_REGISTERED'] as const, random), purchaseVatRate: pick(RATES, random) })
      const amount = randomAmount(random)
      const result = decomposePurchase(taxed(amount, pick(['NET', 'GROSS'] as const, random), random() < 0.5), tax)
      if (!result.ok) throw new Error('se esperaba éxito')
      const exact = result.value
      const r = roundCostTax(exact)
      expect(r.netBase + r.vatAsCost).toBe(r.economicCost)
      expect(r.vatRecoverable + r.vatAsCost).toBe(r.vatPaid)
      expect(r.economicCost + r.vatRecoverable).toBe(r.cashPaid)
      expect(Math.abs(r.economicCost - exact.economicCost)).toBeLessThan(0.5000001)
      expect(Math.abs(r.vatRecoverable - exact.vatRecoverable)).toBeLessThan(0.5000001)
      expect(Math.abs(r.netBase - exact.netBase)).toBeLessThan(1.5)
      expect(Math.abs(r.vatAsCost - exact.vatAsCost)).toBeLessThan(1.5)
      expect(Math.abs(r.cashPaid - exact.cashPaid)).toBeLessThan(1.5)
    }
  })

  it('costos: neto y bruto equivalentes producen el mismo costo económico', () => {
    const random = seededRandom(99)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rate = pick(RATES, random)
      const tax = taxProfile({ regime: pick(['VAT_REGISTERED', 'NOT_REGISTERED'] as const, random), purchaseVatRate: rate })
      const amount = randomAmount(random)
      const recoverable = random() < 0.5
      const net = decomposePurchase(taxed(amount, 'NET', recoverable), tax)
      const gross = decomposePurchase(taxed(amount * (1 + rate), 'GROSS', recoverable), tax)
      if (!net.ok || !gross.ok) throw new Error('se esperaba éxito')
      expect(Math.abs(net.value.economicCost - gross.value.economicCost)).toBeLessThan(1e-6 * Math.max(1, amount))
      expect(Math.abs(net.value.vatRecoverable - gross.value.vatRecoverable)).toBeLessThan(1e-6 * Math.max(1, amount))
    }
  })

  it('venta: neto + IVA = bruto, y el invariante de redondeo se cumple, en ambos sentidos', () => {
    const random = seededRandom(31337)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rate = pick(RATES, random)
      const value = roundToClp(randomAmount(random))
      for (const split of [splitFromNet(value, rate), splitFromGross(value, rate)]) {
        expect(split.ok).toBe(true)
        if (!split.ok) return
        expect(split.value.net + split.value.vat).toBe(split.value.gross)
        expect(checkSplitInvariant(split.value, rate)).toBeUndefined()
      }
    }
  })

  it('venta: neto → bruto → neto recupera el neto (nunca se pierde un peso)', () => {
    const random = seededRandom(555)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const rate = pick(RATES, random)
      const net = roundToClp(randomAmount(random))
      const forward = splitFromNet(net, rate)
      if (!forward.ok) throw new Error('se esperaba éxito')
      const back = splitFromGross(forward.value.gross, rate)
      expect(back.ok && back.value.net === net).toBe(true)
    }
  })

  it('ledger: la utilidad no depende del IVA de venta ni del crédito fiscal', () => {
    const random = seededRandom(2024)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const net = roundToClp(randomAmount(random))
      const cost = roundToClp(randomAmount(random))
      const commission = roundToClp(randomAmount(random) / 10)
      const rateA = pick(RATES, random)
      const rateB = pick(RATES, random)
      const creditA = roundToClp(randomAmount(random) / 5)
      const creditB = roundToClp(randomAmount(random) / 5)
      const saleA = splitFromNet(net, rateA)
      const saleB = splitFromNet(net, rateB)
      if (!saleA.ok || !saleB.ok) throw new Error('se esperaba éxito')
      const zero = roundToClp(0)
      const a = buildTaxLedger({ sale: saleA.value, economicCost: cost, commission, purchaseVatRecoverable: creditA, commissionVatRecoverable: zero }, rateA)
      const b = buildTaxLedger({ sale: saleB.value, economicCost: cost, commission, purchaseVatRecoverable: creditB, commissionVatRecoverable: zero }, rateB)
      if (!a.ok || !b.ok) throw new Error('se esperaba éxito')
      expect(a.value.utility).toBe(b.value.utility)
      expect(a.value.utility).toBe(net - commission - cost)
      expect(checkLedgerInvariants(a.value)).toEqual([])
      expect(checkLedgerInvariants(b.value)).toEqual([])
    }
  })

  it('el barrido es reproducible: misma semilla, mismos valores', () => {
    const first = seededRandom(1)
    const second = seededRandom(1)
    for (let i = 0; i < 100; i += 1) expect(first()).toBe(second())
  })

  it('un monto Clp aleatorio nunca produce un IVA negativo', () => {
    const random = seededRandom(8)
    for (let i = 0; i < ITERATIONS; i += 1) {
      const value: Clp = roundToClp(randomAmount(random))
      const split = splitFromGross(value, pick(RATES, random))
      expect(split.ok && split.value.vat >= 0 && split.value.net >= 0).toBe(true)
    }
  })
})
