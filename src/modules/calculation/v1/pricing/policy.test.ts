import { describe, expect, it } from 'vitest'
import { blockingFlags, isIssuable } from '../../contracts'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { fullOf, override, priceResult } from '../../testing/pricing-helpers'

const PLATE_6 = (n: number, raw = validRequestRaw()) => mutated('input.plates[0].partsPerPlate', 6, mutated('input.quantity', n, raw))
const withPolicy = (policy: 'WARN' | 'CAP' | 'BLOCK', raw: Record<string, unknown>) => mutated('params.pricingProfile.onBelowMin', policy, raw)
const codes = (raw: unknown) => fullOf(raw).output.flags.map((f) => f.code)

/** N = 50 en placas de 6 → costo $111.624, tramo del 15 %: el margen cae a 24,1 %, bajo el mínimo de 25 %. */
const BELOW_MIN_CASE = PLATE_6(50)

describe('WARN (por defecto): advierte pero no impide ninguna decisión comercial', () => {
  const { pricing, flags } = fullOf(BELOW_MIN_CASE).output
  it('aplica el descuento completo y el precio sigue siendo el calculado', () => {
    expect(pricing.discount).toEqual({ applied: 0.15 })
    expect(pricing.customerUnitPrice).toBe(3500)
    expect(pricing.netTotal).toBe(147059)
    expect(pricing.commercialUtility).toBe(35435)
  })
  it('margen efectivo 24,0958 % < mínimo 25 %: BELOW_MIN (advertencia) y BELOW_TARGET (informativa)', () => {
    expect(pricing.commercialMargin).toBeCloseTo(0.240958, 6)
    expect(flags.map((f) => [f.code, f.severity])).toEqual([
      ['BELOW_TARGET', 'INFO'],
      ['BELOW_MIN', 'WARNING'],
    ])
  })
  it('se puede emitir: WARN nunca bloquea', () => {
    expect(isIssuable(flags)).toBe(true)
    expect(blockingFlags(flags)).toEqual([])
  })
})

describe('BLOCK: impide EMITIR, no calcular el borrador', () => {
  const raw = withPolicy('BLOCK', BELOW_MIN_CASE)

  it('el cálculo se completa y entrega el mismo precio que WARN', () => {
    const result = priceResult(raw)
    expect(result.ok).toBe(true)
    const blocked = fullOf(raw).output.pricing
    const warned = fullOf(BELOW_MIN_CASE).output.pricing
    expect(blocked).toEqual(warned)
  })

  it('bajo el mínimo: BLOCKED (severidad BLOCKING) además de BELOW_MIN, y no es emitible', () => {
    const { flags } = fullOf(raw).output
    expect(flags.map((f) => [f.code, f.severity])).toEqual([
      ['BELOW_TARGET', 'INFO'],
      ['BELOW_MIN', 'WARNING'],
      ['BLOCKED', 'BLOCKING'],
    ])
    expect(isIssuable(flags)).toBe(false)
    expect(blockingFlags(flags).map((f) => f.code)).toEqual(['BLOCKED'])
  })

  it('con margen sobre el mínimo no bloquea', () => {
    const { flags } = fullOf(withPolicy('BLOCK', validRequestRaw())).output
    expect(codes(withPolicy('BLOCK', validRequestRaw()))).not.toContain('BLOCKED')
    expect(isIssuable(flags)).toBe(true)
  })

  it('el borrador sigue siendo editable: cambiar el descuento levanta el bloqueo', () => {
    const fixed = mutated('overrides', [override('DISCOUNT', { value: { mode: 'NONE' } })], raw)
    const { flags, pricing } = fullOf(fixed).output
    expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.25)
    expect(isIssuable(flags)).toBe(true)
  })

  it('un precio fijo bajo el mínimo también queda bloqueado para emitir', () => {
    const cheap = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 14000 } })], withPolicy('BLOCK', validRequestRaw()))
    const out = fullOf(cheap).output
    expect(out.pricing.mode).toBe('FIXED_PRICE')
    expect(isIssuable(out.flags)).toBe(false)
  })
})

describe('CAP: garantiza el margen mínimo sobre el precio EFECTIVO (después de IVA y redondeo)', () => {
  const raw = withPolicy('CAP', BELOW_MIN_CASE)
  const { pricing, flags } = fullOf(raw).output

  it('limita el descuento: el precio unitario sube de $3.500 a $3.600 (primer múltiplo de $100 que cumple 25 %)', () => {
    expect(pricing.customerUnitPrice).toBe(3600)
    expect(pricing.grossTotal).toBe(180000)
    expect(pricing.netTotal).toBe(151261)
    expect(pricing.commercialMargin).toBeCloseTo(0.262044, 6)
    expect(pricing.commercialMargin).toBeGreaterThanOrEqual(0.25)
  })

  it('informa el descuento efectivo y el del tramo original', () => {
    expect(pricing.discount.applied).toBeCloseTo(0.11916, 4) // 1 − (3.600 / 1,19) / 3.434,58
    expect(pricing.discount.applied).toBeLessThan(0.15)
    expect(pricing.discount.cappedFrom).toBe(0.15)
  })

  it('DISCOUNT_CAPPED (informativa); ya no hay BELOW_MIN y se puede emitir', () => {
    expect(flags.map((f) => [f.code, f.severity])).toEqual([
      ['DISCOUNT_CAPPED', 'INFO'],
      ['BELOW_TARGET', 'INFO'],
    ])
    expect(isIssuable(flags)).toBe(true)
  })

  it('no toca un descuento que ya cumple el mínimo', () => {
    const ok = fullOf(withPolicy('CAP', PLATE_6(10))).output
    const plain = fullOf(PLATE_6(10)).output
    expect(ok.pricing).toEqual(plain.pricing)
    expect(ok.flags.map((f) => f.code)).not.toContain('DISCOUNT_CAPPED')
  })

  it('el redondeo hacia abajo no puede romper el mínimo: CAP sube el precio, WARN solo advierte', () => {
    // mínimo = objetivo = 35 %; $25.420 se redondea a $25.400 (margen 34,95 %) con DOWN
    let base = mutated('params.pricingProfile.minMargin', 0.35, validRequestRaw())
    base = mutated('params.pricingProfile.rounding.direction', 'DOWN', base)
    const warn = fullOf(withPolicy('WARN', base)).output
    expect(warn.pricing.customerUnitPrice).toBe(25400)
    expect(warn.flags.map((f) => f.code)).toContain('BELOW_MIN')

    const cap = fullOf(withPolicy('CAP', base)).output
    expect(cap.pricing.customerUnitPrice).toBe(25500)
    expect(cap.pricing.commercialMargin).toBeGreaterThanOrEqual(0.35)
    expect(cap.flags.map((f) => f.code)).not.toContain('BELOW_MIN')
    expect(cap.pricing.discount.cappedFrom).toBeUndefined() // no había descuento: solo se corrigió el redondeo
  })

  it('con redondeo grueso (paso de $1.000, al más cercano) también cumple', () => {
    let base = mutated('params.pricingProfile.rounding', { mode: 'STEP', step: 1000, direction: 'NEAREST', target: 'GROSS' }, validRequestRaw())
    base = mutated('params.pricingProfile.minMargin', 0.35, base)
    const out = fullOf(withPolicy('CAP', base)).output
    expect(out.pricing.commercialMargin).toBeGreaterThanOrEqual(0.35)
    expect(out.pricing.customerUnitPrice % 1000).toBe(0)
  })

  it('un descuento manual enorme (90 %) se limita al mínimo, aunque requiera muchos pasos', () => {
    const big = mutated('overrides', [override('DISCOUNT', { value: { mode: 'MANUAL', pct: 0.9 } })], withPolicy('CAP', validRequestRaw()))
    const out = fullOf(big).output
    expect(out.pricing.commercialMargin).toBeGreaterThanOrEqual(0.25)
    expect(out.pricing.discount.cappedFrom).toBe(0.9)
    expect(out.pricing.discount.applied).toBeLessThan(0.3)
    const warn = fullOf(withPolicy('WARN', mutated('overrides', [override('DISCOUNT', { value: { mode: 'MANUAL', pct: 0.9 } })], validRequestRaw()))).output
    expect(warn.pricing.commercialMargin).toBeLessThan(0.25)
  })

  it('con comisión y cargo fijo el mínimo también se cumple sobre el precio efectivo', () => {
    let channelCase = mutated('params.channel.commission', 0.2, BELOW_MIN_CASE)
    channelCase = mutated('params.channel.fixedFee', { amount: 800, basis: 'NET', vatRecoverable: true }, channelCase)
    const out = fullOf(withPolicy('CAP', channelCase)).output
    expect(out.pricing.commercialMargin).toBeGreaterThanOrEqual(0.25)
  })

  it('CAP no corrige un precio FIJO fijado por el usuario: se respeta, pero como no protege el mínimo bloquea la emisión', () => {
    const fixed = mutated('overrides', [override('FIXED_UNIT_PRICE', { value: { customerUnitPrice: 14000 } })], withPolicy('CAP', validRequestRaw()))
    const out = fullOf(fixed).output
    expect(out.pricing.customerUnitPrice).toBe(14000)
    expect(out.flags.map((f) => f.code)).toContain('BELOW_MIN')
    expect(out.flags.map((f) => f.code)).toContain('BLOCKED')
    expect(isIssuable(out.flags)).toBe(false)
  })
})

describe('el margen mínimo y el objetivo pueden ajustarse por cotización', () => {
  it('MIN_MARGIN 20 % por override: el mismo caso ya no queda bajo el mínimo', () => {
    const raw = mutated('overrides', [override('MIN_MARGIN', { value: 0.2 })], BELOW_MIN_CASE)
    const { flags } = fullOf(raw).output
    expect(flags.map((f) => f.code)).not.toContain('BELOW_MIN')
  })
})
