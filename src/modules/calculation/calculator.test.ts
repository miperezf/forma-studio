import { describe, expect, it } from 'vitest'
import { canonicalize } from '../../core/canonical'
import { calculateFromRaw, createQuoteCalculator, ENGINE_V1, type VersionedEngine } from './calculator'
import type { CalculationVersion } from './contracts/version'
import { requestOf } from './testing/cost-helpers'
import { mutated, validRequestRaw } from './testing/fixtures'
import { fullOf } from './testing/pricing-helpers'

const calculator = createQuoteCalculator()

describe('QuoteCalculator (registro de versiones)', () => {
  it('declara las versiones soportadas', () => {
    expect(calculator.supportedVersions()).toEqual(['v1', 'v2'])
  })

  it('v1 QUOTE = calculateCost + calculatePricing, con las advertencias de ambas etapas', () => {
    const raw = mutated('input.plates[0].partsPerPlate', 6, mutated('input.quantity', 10, validRequestRaw()))
    const result = calculator.calculate(requestOf(raw))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const direct = fullOf(raw)
    expect(result.value.calculationVersion).toBe('v1')
    expect(result.value.breakdown).toEqual(direct.cost.breakdown)
    expect(result.value.pricing).toEqual(direct.output.pricing)
    expect(result.value.flags).toEqual([...direct.cost.flags, ...direct.output.flags])
    expect(result.value.appliedOverrides).toEqual([])
  })

  it('TEST: solo costos, pricing null', () => {
    const result = calculator.calculate(requestOf(mutated('mode', 'TEST', validRequestRaw())))
    expect(result.ok && result.value.pricing === null).toBe(true)
  })

  it('versión desconocida → UNKNOWN_CALCULATION_VERSION; nunca se usa otra versión en su lugar', () => {
    const result = calculator.calculate({ ...requestOf(validRequestRaw()), calculationVersion: 'v9' as CalculationVersion })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toEqual({ code: 'UNKNOWN_CALCULATION_VERSION', version: 'v9' })
  })

  it('rechaza versiones duplicadas en el registro', () => {
    expect(() => createQuoteCalculator([ENGINE_V1, ENGINE_V1])).toThrow()
  })

  it('despacha a la versión pedida (v2 de prueba no altera v1)', () => {
    const fake: VersionedEngine = { version: 'v2' as CalculationVersion, calculate: () => ({ ok: false, error: { code: 'MISSING_PARAMETER', path: 'v2' } }) }
    const both = createQuoteCalculator([ENGINE_V1, fake])
    expect(both.supportedVersions()).toEqual(['v1', 'v2'])
    expect(both.calculate(requestOf(validRequestRaw())).ok).toBe(true)
    const v2 = both.calculate({ ...requestOf(validRequestRaw()), calculationVersion: 'v2' as CalculationVersion })
    expect(!v2.ok && v2.error.code === 'MISSING_PARAMETER').toBe(true)
  })
})

describe('replay desde JSON persistido', () => {
  it('serializar la solicitud y recalcularla da exactamente el mismo resultado (canónico)', () => {
    const raw = mutated('input.quantity', 7, validRequestRaw())
    const first = calculateFromRaw(calculator, raw)
    const replay = calculateFromRaw(calculator, JSON.parse(JSON.stringify(raw)))
    expect(first.ok && replay.ok).toBe(true)
    if (first.ok && replay.ok) expect(canonicalize(replay.value)).toEqual(canonicalize(first.value))
  })

  it('un JSON inválido devuelve INVALID_INPUT con las rutas del problema', () => {
    const result = calculateFromRaw(calculator, mutated('input.quantity', 0, validRequestRaw()))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT')
  })
})
