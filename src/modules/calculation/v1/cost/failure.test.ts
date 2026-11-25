import { describe, expect, it } from 'vitest'
import { checkCostBreakdownInvariants } from '../../contracts/invariants'
import { InvariantViolation } from '../../../../core/result'
import { codes, costOf, costResult, costSpecRaw, item, requestOf } from '../../testing/cost-helpers'
import { validateCalculationRequest } from '../../contracts'
import { mutated, validRequestRaw } from '../../testing/fixtures'
import { calculateCost, FAILURE_MODELS, GEOMETRIC_RETRY } from './index'

const reason = 'Decisión comercial de prueba'
const failureCodes = (raw: unknown) => codes(costOf(raw)).filter((c) => c.startsWith('failure:'))
const total = (raw: unknown) => costOf(raw).breakdown.pricingPool
const FACTOR_8 = 0.08 / 0.92

describe('GEOMETRIC_RETRY: costo esperado = costo / (1 − p)', () => {
  it.each([
    [0, 1, 0],
    [0.08, 1, 0.08 / 0.92],
    [0.5, 1, 1], // con 50 % de fallas el costo se duplica
    [0.2, 1, 0.25],
    [0.95, 1, 19],
    [0.08, 0.5, 0.08 / 0.92 / 2],
    [0.5, 0, 0],
  ])('p = %s, costFraction = %s → factor adicional %s', (rate, costFraction, expected) => {
    expect(GEOMETRIC_RETRY.extraCostFactor(rate, costFraction)).toBeCloseTo(expected, 12)
  })

  it('con costFraction 1, costo × (1 + factor) = costo / (1 − p)', () => {
    for (const p of [0.01, 0.08, 0.3, 0.6, 0.9]) {
      expect(1 + GEOMETRIC_RETRY.extraCostFactor(p, 1)).toBeCloseTo(1 / (1 - p), 12)
    }
  })

  it('es creciente en p (más fallas, más costo esperado)', () => {
    let previous = -1
    for (let p = 0; p < 0.95; p += 0.05) {
      const factor = GEOMETRIC_RETRY.extraCostFactor(p, 1)
      expect(factor).toBeGreaterThan(previous)
      previous = factor
    }
  })

  it('el registro de modelos expone GEOMETRIC_RETRY (estrategia intercambiable)', () => {
    expect(FAILURE_MODELS.GEOMETRIC_RETRY).toBe(GEOMETRIC_RETRY)
    expect(FAILURE_MODELS.GEOMETRIC_RETRY.id).toBe('GEOMETRIC_RETRY')
  })
})

describe('qué ítems se afectan', () => {
  it('por defecto: material, electricidad, desgaste y supervisión; NO preparación, ensamblaje ni postproceso', () => {
    const raw = mutated('input.services', [{ serviceId: 'assembly', active: true }, { serviceId: 'modeling-3d', active: true }], validRequestRaw())
    const withParts = mutated('input.plates[0].partsPerUnit', 2, raw)
    expect(failureCodes(withParts)).toEqual([
      'failure:material:plate-1:pla-basic',
      'failure:electricity:plate-1',
      'failure:wear:plate-1',
      'failure:supervision:plate-1',
    ])
  })

  it('los componentes afectados son configurables (no se asume que todos lo estén)', () => {
    const only = mutated('params.costProfile.failure.affectedComponents', ['MATERIAL'], validRequestRaw())
    expect(failureCodes(only)).toEqual(['failure:material:plate-1:pla-basic'])
    const none = mutated('params.costProfile.failure.affectedComponents', [], validRequestRaw())
    expect(failureCodes(none)).toEqual([])
    const setup = mutated('params.costProfile.failure.affectedComponents', ['SETUP'], validRequestRaw())
    expect(failureCodes(setup)).toEqual(['failure:setup:job', 'failure:setup:changeover'])
  })

  it('un ítem FAILURE nunca se vuelve a afectar', () => {
    const calc = costOf(validRequestRaw())
    expect(codes(calc).some((c) => c.startsWith('failure:failure:'))).toBe(false)
  })

  it('el ítem de falla hereda behavior, plateId y recuperación, y declara su origen', () => {
    const calc = costOf(validRequestRaw())
    const parent = item(calc, 'material:plate-1:pla-basic')
    const failure = item(calc, 'failure:material:plate-1:pla-basic')
    expect(failure.component).toBe('FAILURE')
    expect(failure.behavior).toBe(parent.behavior)
    expect(failure.plateId).toBe('plate-1')
    expect(failure.recoveryConfig).toEqual(parent.recoveryConfig)
    expect(failure.derivedFrom).toBe(parent.code)
    expect(failure.basis.quantity).toBeCloseTo(parent.rawAmount, 9)
    expect(failure.basis.unitCost).toBeCloseTo(FACTOR_8, 12)
    expect(failure.basis.multiplier).toBe(1)
  })

  it('el IVA recuperable de la falla es proporcional al del ítem origen', () => {
    const calc = costOf(validRequestRaw())
    expect(item(calc, 'failure:material:plate-1:pla-basic').vatRecoverable).toBe(30) // 342 × 0,0870
    expect(item(calc, 'failure:electricity:plate-1').vatRecoverable).toBe(24) // 273,6 × 0,0870
    expect(item(calc, 'failure:wear:plate-1').vatRecoverable).toBe(0)
  })

  it('las fallas escalan igual que su origen (placas, no unidades)', () => {
    const raw = mutated('input.plates[0].partsPerPlate', 6, mutated('input.quantity', 10, validRequestRaw()))
    const calc = costOf(raw)
    expect(item(calc, 'failure:material:plate-1:pla-basic').amount).toBe(313) // 2 placas × 156,52
    expect(item(calc, 'material:plate-1:pla-basic').basis.multiplier).toBe(2)
  })
})

describe('tasa de falla: de dónde sale', () => {
  it('perfil 8 %: caso base = 978 en fallas (cada ítem se redondea por separado)', () => {
    const calc = costOf(validRequestRaw())
    const amounts = failureCodes(validRequestRaw()).map((c) => item(calc, c).amount)
    expect(amounts).toEqual([157, 125, 174, 522])
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(978)
  })

  it('tasa 0: no se genera ningún ítem de falla', () => {
    const raw = mutated('params.costProfile.failure.rate', 0, validRequestRaw())
    expect(failureCodes(raw)).toEqual([])
    expect(total(raw)).toBe(12907)
  })

  it('p = 50 % duplica el costo de los ítems afectados', () => {
    const raw = mutated('params.costProfile.failure.rate', 0.5, validRequestRaw())
    // afectados: 1.800 + 1.440 + 2.000 + 6.000 = 11.240 → +11.240 ; no afectados: 1.667
    expect(total(raw)).toBe(11240 * 2 + 1667)
  })

  it('costFraction 0,5: cada intento fallido cuesta la mitad', () => {
    const raw = mutated('params.costProfile.failure.costFraction', 0.5, validRequestRaw())
    const amounts = failureCodes(raw).map((c) => item(costOf(raw), c).amount)
    expect(amounts).toEqual([78, 63, 87, 261]) // 156,52/2 · 125,22/2 · 173,91/2 · 521,74/2
  })

  it('costFraction 0 elimina el costo de las fallas', () => {
    const raw = mutated('params.costProfile.failure.costFraction', 0, validRequestRaw())
    expect(failureCodes(raw)).toEqual([])
  })

  it('override de máquina (10 %) prevalece sobre el perfil (8 %)', () => {
    const raw = mutated('params.machines.printer-1.failureRateOverride', 0.1, validRequestRaw())
    const calc = costOf(raw)
    expect(item(calc, 'failure:material:plate-1:pla-basic').basis.unitCost).toBeCloseTo(0.1 / 0.9, 12)
    expect(total(raw)).toBe(14156)
  })

  it('override de material (5 %) prevalece sobre el de máquina (10 %) y el perfil', () => {
    let raw = mutated('params.machines.printer-1.failureRateOverride', 0.1, validRequestRaw())
    raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, raw)
    const calc = costOf(raw)
    for (const c of failureCodes(raw)) expect(item(calc, c).basis.unitCost).toBeCloseTo(0.05 / 0.95, 12)
    expect(total(raw)).toBe(13499)
  })

  it('override en 0 es un override válido (≠ heredar): anula la falla de esa placa', () => {
    const raw = mutated('params.materials.pla-basic.failureRateOverride', 0, validRequestRaw())
    expect(failureCodes(raw)).toEqual([])
  })

  it('placa con varios filamentos: toda la placa usa el MAYOR override de sus materiales', () => {
    const petg = { ref: { id: 'petg', revision: 1 }, name: 'PETG', brand: '', spool: { price: { amount: 20000, basis: 'NET', vatRecoverable: true }, netGrams: 1000 }, failureRateOverride: 0.15 }
    const catalog = { ...(validRequestRaw().params as { materials: object }).materials, petg }
    let raw = mutated('params.materials', catalog, validRequestRaw())
    raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, raw)
    raw = mutated('input.plates[0].filaments', [{ materialId: 'pla-basic', grams: 100 }, { materialId: 'petg', grams: 20 }], raw)
    const calc = costOf(raw)
    for (const c of failureCodes(raw)) expect(item(calc, c).basis.unitCost).toBeCloseTo(0.15 / 0.85, 12)
    expect(failureCodes(raw)).toContain('failure:material:plate-1:petg')
  })

  it('cada placa usa SU tasa (una falla ocurre por placa)', () => {
    const second = { ...(validRequestRaw().input as { plates: Record<string, unknown>[] }).plates[0], id: 'plate-2', label: 'Tapa', filaments: [{ materialId: 'petg', grams: 20 }] }
    const petg = { ref: { id: 'petg', revision: 1 }, name: 'PETG', brand: '', spool: { price: { amount: 20000, basis: 'NET', vatRecoverable: true }, netGrams: 1000 }, failureRateOverride: 0.2 }
    let raw = mutated('params.materials', { ...(validRequestRaw().params as { materials: object }).materials, petg }, validRequestRaw())
    raw = mutated('input.plates', [(validRequestRaw().input as { plates: unknown[] }).plates[0], second], raw)
    const calc = costOf(raw)
    expect(item(calc, 'failure:electricity:plate-1').basis.unitCost).toBeCloseTo(FACTOR_8, 12)
    expect(item(calc, 'failure:electricity:plate-2').basis.unitCost).toBeCloseTo(0.25, 12)
  })
})

describe('overrides de la cotización', () => {
  it('RATE reemplaza cualquier tasa (incluidos overrides de material y máquina)', () => {
    let raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, validRequestRaw())
    raw = mutated('overrides', [{ kind: 'FAILURE_RATE', value: { mode: 'RATE', rate: 0.2 }, reason }], raw)
    expect(total(raw)).toBe(15717) // 12.907 + 11.240 × 0,25
  })

  it('DISABLED elimina las fallas de la cotización sin tocar el perfil', () => {
    const raw = mutated('overrides', [{ kind: 'FAILURE_RATE', value: { mode: 'DISABLED' }, reason }], validRequestRaw())
    expect(failureCodes(raw)).toEqual([])
    expect(total(raw)).toBe(12907)
  })
})

describe('modo TEST', () => {
  it('excluye la transformación de fallas: un test cuenta lo que realmente ocurrió', () => {
    const raw = mutated('mode', 'TEST', validRequestRaw())
    expect(failureCodes(raw)).toEqual([])
    expect(total(raw)).toBe(12907)
  })
})

describe('trazabilidad de la tasa usada', () => {
  it('cada ítem de falla registra el factor aplicado y el monto exacto de origen', () => {
    const calc = costOf(validRequestRaw())
    for (const c of failureCodes(validRequestRaw())) {
      const failure = item(calc, c)
      const parent = item(calc, failure.derivedFrom ?? '')
      expect(failure.rawAmount).toBeCloseTo(failure.basis.quantity * failure.basis.unitCost, 9)
      expect(failure.basis.quantity).toBeCloseTo(parent.rawAmount, 9)
    }
  })

  it('los ítems sin placa usan la tasa del perfil (los overrides de material y máquina son por placa)', () => {
    const extra = {
      code: 'x',
      label: 'x',
      component: 'OTHER',
      behavior: 'PER_UNIT',
      amount: { amount: 1000, basis: 'NET', vatRecoverable: true },
      recoveryConfig: { recovery: 'IN_PRICE' },
    }
    let raw = mutated('params.costProfile.failure.affectedComponents', ['OTHER', 'MATERIAL'], validRequestRaw())
    raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, raw)
    raw = mutated('input.extraCosts', [extra], raw)
    const calc = costOf(raw)
    expect(item(calc, 'failure:extra:x').basis.unitCost).toBeCloseTo(FACTOR_8, 12)
    expect(item(calc, 'failure:extra:x').plateId).toBeUndefined()
    expect(item(calc, 'failure:material:plate-1:pla-basic').basis.unitCost).toBeCloseTo(0.05 / 0.95, 12)
  })
})

const PETG = (rate?: number) => ({
  ref: { id: 'petg', revision: 1 },
  name: 'PETG',
  brand: '',
  spool: { price: { amount: 20000, basis: 'NET', vatRecoverable: true }, netGrams: 1000 },
  ...(rate === undefined ? {} : { failureRateOverride: rate }),
})
const catalogWithPetg = (rate?: number) => ({ ...(validRequestRaw().params as { materials: object }).materials, petg: PETG(rate) })
const ratesOf = (raw: unknown) => costOf(raw).breakdown.failureRates

describe('procedencia de la tasa de falla (queda en el snapshot)', () => {
  it('perfil: una entrada por placa y una global, con el modelo y costFraction usados', () => {
    expect(ratesOf(validRequestRaw())).toEqual([
      { scope: 'PLATE', plateId: 'plate-1', modelId: 'GEOMETRIC_RETRY', rate: 0.08, costFraction: 1, source: 'PROFILE', sourceId: 'cost-default', applied: true },
      { scope: 'GLOBAL', modelId: 'GEOMETRIC_RETRY', rate: 0.08, costFraction: 1, source: 'PROFILE', sourceId: 'cost-default', applied: true },
    ])
  })

  it('máquina > perfil', () => {
    const [plate, global] = ratesOf(mutated('params.machines.printer-1.failureRateOverride', 0.1, validRequestRaw()))
    expect(plate).toMatchObject({ rate: 0.1, source: 'MACHINE_OVERRIDE', sourceId: 'printer-1' })
    expect(global).toMatchObject({ rate: 0.08, source: 'PROFILE' }) // los ítems sin placa no usan overrides de máquina
  })

  it('material > máquina > perfil', () => {
    let raw = mutated('params.machines.printer-1.failureRateOverride', 0.1, validRequestRaw())
    raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, raw)
    expect(ratesOf(raw)[0]).toMatchObject({ rate: 0.05, source: 'MATERIAL_OVERRIDE', sourceId: 'pla-basic' })
  })

  it('override de la cotización > todo lo demás', () => {
    let raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, validRequestRaw())
    raw = mutated('overrides', [{ kind: 'FAILURE_RATE', value: { mode: 'RATE', rate: 0.2 }, reason }], raw)
    const [plate, global] = ratesOf(raw)
    expect(plate).toMatchObject({ rate: 0.2, source: 'QUOTE_OVERRIDE', sourceId: 'quote', applied: true })
    expect(global).toMatchObject({ rate: 0.2, source: 'QUOTE_OVERRIDE' })
  })

  it('varios materiales: se toma el MAYOR override (política conservadora) y se registra cuál lo aportó', () => {
    let raw = mutated('params.materials', catalogWithPetg(0.15), validRequestRaw())
    raw = mutated('params.materials.pla-basic.failureRateOverride', 0.05, raw)
    raw = mutated('input.plates[0].filaments', [{ materialId: 'pla-basic', grams: 100 }, { materialId: 'petg', grams: 20 }], raw)
    expect(ratesOf(raw)[0]).toMatchObject({ rate: 0.15, source: 'MATERIAL_OVERRIDE', sourceId: 'petg' })
    // al invertir el orden de los filamentos la tasa y el material son los mismos
    const swapped = mutated('input.plates[0].filaments', [{ materialId: 'petg', grams: 20 }, { materialId: 'pla-basic', grams: 100 }], raw)
    expect(ratesOf(swapped)[0]).toMatchObject({ rate: 0.15, sourceId: 'petg' })
  })

  it('un material sin override no rebaja la tasa de la placa (solo cuentan los overrides)', () => {
    let raw = mutated('params.materials', catalogWithPetg(0.15), validRequestRaw())
    raw = mutated('input.plates[0].filaments', [{ materialId: 'pla-basic', grams: 100 }, { materialId: 'petg', grams: 20 }], raw)
    expect(ratesOf(raw)[0]).toMatchObject({ rate: 0.15, sourceId: 'petg' })
  })

  it('empate entre materiales: gana el primero en el orden de filamentos', () => {
    let raw = mutated('params.materials', catalogWithPetg(0.1), validRequestRaw())
    raw = mutated('params.materials.pla-basic.failureRateOverride', 0.1, raw)
    raw = mutated('input.plates[0].filaments', [{ materialId: 'petg', grams: 20 }, { materialId: 'pla-basic', grams: 100 }], raw)
    expect(ratesOf(raw)[0]).toMatchObject({ rate: 0.1, sourceId: 'petg' })
  })

  it('un override de material en 0 se registra como tal (0 ≠ heredar)', () => {
    expect(ratesOf(mutated('params.materials.pla-basic.failureRateOverride', 0, validRequestRaw()))[0]).toMatchObject({
      rate: 0,
      source: 'MATERIAL_OVERRIDE',
      sourceId: 'pla-basic',
    })
  })

  it('cada placa registra la suya', () => {
    const second = { ...(validRequestRaw().input as { plates: Record<string, unknown>[] }).plates[0], id: 'plate-2', label: 'Tapa', filaments: [{ materialId: 'petg', grams: 20 }] }
    let raw = mutated('params.materials', catalogWithPetg(0.2), validRequestRaw())
    raw = mutated('input.plates', [(validRequestRaw().input as { plates: unknown[] }).plates[0], second], raw)
    const rates = ratesOf(raw)
    expect(rates.map((r) => [r.plateId ?? 'global', r.rate, r.source])).toEqual([
      ['plate-1', 0.08, 'PROFILE'],
      ['plate-2', 0.2, 'MATERIAL_OVERRIDE'],
      ['global', 0.08, 'PROFILE'],
    ])
  })

  it('modo TEST y override DISABLED quedan registrados como no aplicados', () => {
    const test = ratesOf(mutated('mode', 'TEST', validRequestRaw()))
    expect(test.every((r) => !r.applied && r.inactiveReason === 'TEST_MODE')).toBe(true)
    expect(test[0]?.rate).toBe(0.08) // se informa la tasa que correspondería
    const disabled = ratesOf(mutated('overrides', [{ kind: 'FAILURE_RATE', value: { mode: 'DISABLED' }, reason }], validRequestRaw()))
    expect(disabled.every((r) => !r.applied && r.inactiveReason === 'OVERRIDE_DISABLED' && r.rate === 0 && r.source === 'QUOTE_OVERRIDE')).toBe(true)
  })

  it('el factor usado en cada ítem de falla corresponde a la tasa registrada', () => {
    let raw = mutated('params.materials', catalogWithPetg(0.15), validRequestRaw())
    raw = mutated('input.plates[0].filaments', [{ materialId: 'pla-basic', grams: 100 }, { materialId: 'petg', grams: 20 }], raw)
    const calc = costOf(raw)
    const registered = calc.breakdown.failureRates.find((r) => r.plateId === 'plate-1')
    for (const failure of calc.breakdown.items.filter((i) => i.component === 'FAILURE')) {
      expect(failure.basis.unitCost).toBeCloseTo(((registered?.rate ?? 0) / (1 - (registered?.rate ?? 0))) * (registered?.costFraction ?? 0), 12)
    }
  })

  it('las tasas resueltas viajan en el desglose y sobreviven a la serialización (snapshot)', () => {
    const { breakdown } = costOf(validRequestRaw())
    const restored = JSON.parse(JSON.stringify(breakdown)) as typeof breakdown
    expect(restored.failureRates).toEqual(breakdown.failureRates)
  })
})

describe('cada falla se calcula desde rawAmount (no desde el monto ya redondeado)', () => {
  it('p = 95 %: 10,4 × 19 = 197,6 → 198 (desde el monto redondeado sería 10 × 19 = 190)', () => {
    const extra = costSpecRaw('x', 10.4, 'PER_UNIT')
    let raw = mutated('params.costProfile.failure.affectedComponents', ['OTHER'], validRequestRaw())
    raw = mutated('overrides', [{ kind: 'FAILURE_RATE', value: { mode: 'RATE', rate: 0.95 }, reason }], raw)
    raw = mutated('input.extraCosts', [extra], raw)
    const calc = costOf(raw)
    const parent = item(calc, 'extra:x')
    const failure = item(calc, 'failure:extra:x')
    expect(parent.rawAmount).toBeCloseTo(10.4, 9)
    expect(parent.amount).toBe(10)
    expect(failure.basis.quantity).toBeCloseTo(10.4, 9) // exacto, no 10
    expect(failure.rawAmount).toBeCloseTo(197.6, 9)
    expect(failure.amount).toBe(198)
  })
})

describe('herencia de la recuperación en fallas de costos únicos (sin doble amortización)', () => {
  // N = 10, K = 100, desarrollo de $40.000 que SÍ está afectado por fallas (componente DESIGN) con p = 8 %
  const dev = costSpecRaw('dev', 40000, 'ONE_OFF', { component: 'DESIGN', recoveryConfig: { recovery: 'IN_PRICE', amortization: { overUnits: 100 } } })
  const scenario = (n = 10, b = 1) => {
    let raw = mutated('params.costProfile.failure.affectedComponents', ['DESIGN'], validRequestRaw())
    raw = mutated('input.extraCosts', [dev], raw)
    raw = mutated('input.quantity', n, raw)
    return mutated('input.batches', b, raw)
  }

  it('la falla hereda la misma amortización y se amortiza UNA vez, desde su propio monto', () => {
    const calc = costOf(scenario())
    const parent = item(calc, 'extra:dev')
    const failure = item(calc, 'failure:extra:dev')
    expect(failure.recoveryConfig).toEqual(parent.recoveryConfig)
    expect(parent.pooledAmount).toBe(4000) // 40.000 × 10 / 100
    expect(failure.amount).toBe(3478) // 40.000 × 0,08 / 0,92 = 3.478,26
    expect(failure.pooledAmount).toBe(348) // 3.478,26 × 10 / 100 = 347,83 (no 4.000 × 0,10)
    expect(failure.pooledAmount).not.toBe(Math.round(parent.pooledAmount * 0.1))
  })

  it('el costo diferido suma padre + falla y la identidad contable cierra', () => {
    const calc = costOf(scenario())
    expect(calc.breakdown.deferredCost).toBe(36000 + (3478 - 348))
    expect(calc.breakdown.absorbedCost).toBe(0)
    const total = calc.breakdown.items.reduce((sum, i) => sum + i.amount, 0)
    expect(total).toBe(calc.breakdown.pricingPool + calc.breakdown.absorbedCost + calc.breakdown.deferredCost)
    expect(checkCostBreakdownInvariants(calc.breakdown, calc.quantities.units)).toEqual([])
  })

  it('la falla de un ONE_OFF no se multiplica por N, B ni placas', () => {
    const reference = item(costOf(scenario(10, 1)), 'failure:extra:dev')
    for (const [n, b] of [[1, 1], [100, 1], [10, 9], [1000, 50]] as const) {
      const failure = item(costOf(scenario(n, b)), 'failure:extra:dev')
      expect(failure.behavior).toBe('ONE_OFF')
      expect(failure.basis.multiplier).toBe(1)
      expect(failure.rawAmount).toBeCloseTo(reference.rawAmount, 9)
    }
  })

  it('con N ≥ overUnits entra todo y no queda nada diferido (sin amortizar de más)', () => {
    const calc = costOf(scenario(100))
    expect(item(calc, 'extra:dev').pooledAmount).toBe(40000)
    expect(item(calc, 'failure:extra:dev').pooledAmount).toBe(3478)
    expect(calc.breakdown.deferredCost).toBe(0)
  })

  it('un override de amortización sobre el padre se hereda sin duplicarse en la falla', () => {
    const plain = costSpecRaw('dev', 40000, 'ONE_OFF', { component: 'DESIGN' })
    let raw = mutated('params.costProfile.failure.affectedComponents', ['DESIGN'], validRequestRaw())
    raw = mutated('input.extraCosts', [plain], mutated('input.quantity', 10, raw))
    raw = mutated('overrides', [{ kind: 'ITEM_RECOVERY', itemCode: 'extra:dev', value: { recovery: 'IN_PRICE', amortization: { overUnits: 100 } }, reason }], raw)
    const calc = costOf(raw)
    expect(item(calc, 'extra:dev').pooledAmount).toBe(4000)
    expect(item(calc, 'failure:extra:dev').pooledAmount).toBe(348)
    expect(calc.breakdown.deferredCost).toBe(36000 + 3130)
  })

  it('un override propio sobre la falla reemplaza (no se acumula con) el heredado', () => {
    const overrides = [{ kind: 'ITEM_RECOVERY', itemCode: 'failure:extra:dev', value: { recovery: 'ABSORBED' }, reason }]
    const calc = costOf(mutated('overrides', overrides, scenario()))
    expect(item(calc, 'extra:dev').pooledAmount).toBe(4000)
    expect(item(calc, 'failure:extra:dev').pooledAmount).toBe(0)
    expect(calc.breakdown.absorbedCost).toBe(3478)
    expect(calc.breakdown.deferredCost).toBe(36000) // la falla ya no se amortiza
  })

  it('una falla de un ítem SEPARATE_LINE hereda SEPARATE_LINE y no se amortiza', () => {
    const design = costSpecRaw('design', 5000, 'ONE_OFF', { component: 'DESIGN', recoveryConfig: { recovery: 'SEPARATE_LINE' } })
    let raw = mutated('params.costProfile.failure.affectedComponents', ['DESIGN'], validRequestRaw())
    raw = mutated('input.extraCosts', [design], mutated('input.quantity', 10, raw))
    const failure = item(costOf(raw), 'failure:extra:design')
    expect(failure.recoveryConfig).toEqual({ recovery: 'SEPARATE_LINE' })
    expect(failure.amount).toBe(435) // 5.000 × 0,08 / 0,92
    expect(failure.pooledAmount).toBe(435)
  })
})

describe('GEOMETRIC_RETRY no admite una tasa de falla igual a 1 (p/(1−p) no está definida)', () => {
  it.each([
    [0, true],
    [0.08, true],
    [0.95, true],
    [0.999999, true],
    [1, false],
    [1.0000001, false],
    [2, false],
    [-0.01, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
  ] as [number, boolean][])('acceptsRate(%s) = %s', (rate, expected) => {
    expect(GEOMETRIC_RETRY.acceptsRate(rate)).toBe(expected)
  })

  it('extraCostFactor con una tasa fuera de dominio lanza InvariantViolation (nunca devuelve Infinity)', () => {
    for (const rate of [1, 1.5, Number.NaN, -0.1]) {
      let thrown: unknown
      try {
        GEOMETRIC_RETRY.extraCostFactor(rate, 1)
      } catch (error) {
        thrown = error
      }
      expect(thrown instanceof InvariantViolation).toBe(true)
    }
  })

  describe('el validador rechaza 1 en TODAS las fuentes de la tasa', () => {
    const rejects = (path: string, value: unknown, base = validRequestRaw()) => {
      const result = validateCalculationRequest(mutated(path, value, base))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.some((i) => i.path === path && i.code === 'RANGE')).toBe(true)
    }
    it('perfil de costos', () => rejects('params.costProfile.failure.rate', 1))
    it('override del material', () => rejects('params.materials.pla-basic.failureRateOverride', 1))
    it('override de la máquina', () => rejects('params.machines.printer-1.failureRateOverride', 1))
    it('override de la cotización', () => {
      const raw = mutated('overrides', [{ kind: 'FAILURE_RATE', value: { mode: 'RATE', rate: 1 }, reason: 'prueba' }], validRequestRaw())
      const result = validateCalculationRequest(raw)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.some((i) => i.path === 'overrides[0].value.rate')).toBe(true)
    })
  })

  describe('el motor lo rechaza aunque el dato eluda al validador (INCONSISTENT_SNAPSHOT)', () => {
    const request = () => requestOf(validRequestRaw())
    const expectInconsistent = (result: ReturnType<typeof calculateCost>) => {
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
        if (result.error.code === 'INCONSISTENT_SNAPSHOT') expect(result.error.detail).toContain('GEOMETRIC_RETRY')
      }
    }

    it('perfil con tasa 1', () => {
      const r = request()
      const profile = { ...r.params.costProfile, failure: { ...r.params.costProfile.failure, rate: 1 as never } }
      expectInconsistent(calculateCost({ ...r, params: { ...r.params, costProfile: profile } }))
    })

    it('override de material con tasa 1', () => {
      const r = request()
      const material = r.params.materials['pla-basic']
      if (material === undefined) throw new Error('material ausente')
      const materials = { 'pla-basic': { ...material, failureRateOverride: 1 as never } }
      expectInconsistent(calculateCost({ ...r, params: { ...r.params, materials } }))
    })

    it('override de máquina con tasa 1', () => {
      const r = request()
      const machine = r.params.machines['printer-1']
      if (machine === undefined) throw new Error('máquina ausente')
      const machines = { 'printer-1': { ...machine, failureRateOverride: 1 as never } }
      expectInconsistent(calculateCost({ ...r, params: { ...r.params, machines } }))
    })

    it('override de la cotización con tasa 1', () => {
      const r = request()
      const overrides = [{ kind: 'FAILURE_RATE' as const, value: { mode: 'RATE' as const, rate: 1 as never }, reason: 'prueba' }]
      expectInconsistent(calculateCost({ ...r, overrides }))
    })

    it('también en modo TEST: un snapshot con una tasa fuera de dominio está corrupto aunque no se apliquen fallas', () => {
      const r = request()
      const profile = { ...r.params.costProfile, failure: { ...r.params.costProfile.failure, rate: 1 as never } }
      expectInconsistent(calculateCost({ ...r, mode: 'TEST', params: { ...r.params, costProfile: profile } }))
    })

    it('con el override DISABLED la tasa registrada es 0 y un perfil válido no falla', () => {
      const r = request()
      const overrides = [{ kind: 'FAILURE_RATE' as const, value: { mode: 'DISABLED' as const }, reason: 'prueba' }]
      expect(calculateCost({ ...r, overrides }).ok).toBe(true)
    })
  })

  it('el límite superior válido del contrato (0,95) sigue funcionando: factor 19', () => {
    const raw = mutated('params.costProfile.failure.rate', 0.95, validRequestRaw())
    expect(costResult(raw).ok).toBe(true)
    expect(item(costOf(raw), 'failure:material:plate-1:pla-basic').basis.unitCost).toBeCloseTo(19, 9)
  })
})
