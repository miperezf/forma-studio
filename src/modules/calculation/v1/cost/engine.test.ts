import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../../core/result'
import { checkCostBreakdownInvariants } from '../../contracts/invariants'
import type { CalculationRequest } from '../../contracts/request'
import { validateCalculationRequest } from '../../contracts/validate'
import { codes, costOf, costResult, costSpecRaw, item, requestOf } from '../../testing/cost-helpers'
import { mutated, validRequestRaw, without } from '../../testing/fixtures'
import { calculateCost, makeDraftForTests, type CostItemGenerator } from './index'

const reason = 'Decisión comercial de prueba'
const services = (...ids: string[]) => ids.map((serviceId) => ({ serviceId, active: true }))

describe('GOLDEN 1 — caso base (N=1, 1 placa de 120 g y 8 h, PLA $15.000/kg, fallas 8 %)', () => {
  const calc = costOf(validRequestRaw())
  const b = calc.breakdown

  it('ítems y montos', () => {
    const amounts = Object.fromEntries(b.items.map((i) => [i.code, i.amount]))
    expect(amounts).toEqual({
      'material:plate-1:pla-basic': 1800,
      'electricity:plate-1': 1440,
      'wear:plate-1': 2000,
      'supervision:plate-1': 6000,
      'setup:job': 1667,
      'setup:changeover': 0,
      'failure:material:plate-1:pla-basic': 157,
      'failure:electricity:plate-1': 125,
      'failure:wear:plate-1': 174,
      'failure:supervision:plate-1': 522,
    })
  })

  it('totales: pool, absorbido, diferido, crédito fiscal y costo unitario', () => {
    expect(b.pricingPool).toBe(13885)
    expect(b.absorbedCost).toBe(0)
    expect(b.deferredCost).toBe(0)
    expect(b.recoverableVat).toBe(670) // 342 + 274 + 30 + 24
    expect(b.unitCost).toBe(13885)
  })

  it('totales por comportamiento, componente y recuperación', () => {
    expect(b.totals.byBehavior).toEqual({ PER_UNIT: 0, PER_PLATE: 12218, PER_BATCH: 1667, ONE_OFF: 0, PER_EXTRA_PART: 0 })
    expect(b.totals.byComponent).toEqual({
      MATERIAL: 1800,
      ELECTRICITY: 1440,
      WEAR: 2000,
      SUPERVISION: 6000,
      SETUP: 1667,
      FAILURE: 978,
    })
    expect(b.totals.byRecovery).toEqual({ IN_PRICE: 13885, SEPARATE_LINE: 0, ABSORBED: 0 })
  })

  it('tasa de falla resuelta y procedencia (van al snapshot)', () => {
    expect(b.failureRates).toEqual([
      { scope: 'PLATE', plateId: 'plate-1', modelId: 'GEOMETRIC_RETRY', rate: 0.08, costFraction: 1, source: 'PROFILE', sourceId: 'cost-default', applied: true },
      { scope: 'GLOBAL', modelId: 'GEOMETRIC_RETRY', rate: 0.08, costFraction: 1, source: 'PROFILE', sourceId: 'cost-default', applied: true },
    ])
  })

  it('placas requeridas, sin advertencias', () => {
    expect(b.platesRequired).toEqual([{ plateId: 'plate-1', platesRequired: 1 }])
    expect(calc.flags).toEqual([])
    expect(calc.quantities.totalPlates).toBe(1)
  })

  it('sin fallas el mismo caso cuesta $12.907 (la diferencia es exactamente el costo de las fallas)', () => {
    const none = costOf(mutated('params.costProfile.failure.rate', 0, validRequestRaw()))
    expect(none.breakdown.pricingPool).toBe(12907)
    expect(b.pricingPool - none.breakdown.pricingPool).toBe(978)
  })

  it('cumple todas las identidades del contrato', () => {
    expect(checkCostBreakdownInvariants(b, calc.quantities.units)).toEqual([])
  })
})

describe('GOLDEN 2 — 10 unidades en placas de 6 piezas (2 placas, sobran 2 piezas)', () => {
  const raw = mutated('input.plates[0].partsPerPlate', 6, mutated('input.quantity', 10, validRequestRaw()))
  const calc = costOf(raw)

  it('las partidas por placa se duplican; la preparación no', () => {
    expect(item(calc, 'material:plate-1:pla-basic').amount).toBe(3600)
    expect(item(calc, 'electricity:plate-1').amount).toBe(2880)
    expect(item(calc, 'wear:plate-1').amount).toBe(4000)
    expect(item(calc, 'supervision:plate-1').amount).toBe(12000)
    expect(item(calc, 'setup:job').amount).toBe(1667)
  })

  it('total y costo unitario', () => {
    expect(calc.breakdown.pricingPool).toBe(26101) // fallas: 313 + 250 + 348 + 1.043
    expect(calc.breakdown.unitCost).toBeCloseTo(2610.1, 9)
    expect(calc.quantities.plates[0]?.surplusParts).toBe(2)
  })
})

describe('GOLDEN 3 — 3 lotes de trabajo', () => {
  it('solo la preparación se triplica; las placas no cambian', () => {
    const calc = costOf(mutated('input.batches', 3, validRequestRaw()))
    expect(item(calc, 'setup:job').amount).toBe(5000)
    expect(calc.quantities.totalPlates).toBe(1)
    expect(calc.breakdown.pricingPool).toBe(17218) // 13.885 − 1.667 + 5.000
  })
})

describe('GOLDEN 4 — modelado 3D como línea separada', () => {
  it('se suma una sola vez al pool y queda en SEPARATE_LINE', () => {
    const calc = costOf(mutated('input.services', services('modeling-3d'), validRequestRaw()))
    expect(calc.breakdown.pricingPool).toBe(40885)
    expect(calc.breakdown.totals.byRecovery).toEqual({ IN_PRICE: 13885, SEPARATE_LINE: 27000, ABSORBED: 0 })
    expect(calc.breakdown.totals.byBehavior.ONE_OFF).toBe(27000)
    expect(calc.breakdown.recoverableVat).toBe(670 + 5130) // el insumo del NRE también trae crédito
  })

  it('50 unidades no multiplican el NRE', () => {
    const raw = mutated('input.quantity', 50, mutated('input.services', services('modeling-3d'), validRequestRaw()))
    expect(item(costOf(raw), 'service:modeling-3d').amount).toBe(27000)
  })
})

describe('GOLDEN 5 — integrado: N=2, 3 piezas por unidad (6 placas), ensamblaje y modelado', () => {
  const raw = mutated(
    'input.plates[0].partsPerUnit',
    3,
    mutated('input.quantity', 2, mutated('input.services', services('assembly', 'modeling-3d'), validRequestRaw())),
  )
  const calc = costOf(raw)

  it('cantidades derivadas', () => {
    expect(calc.quantities.totalPlates).toBe(6)
    expect(calc.quantities.extraParts).toBe(4)
  })

  it('cada partida con su multiplicador', () => {
    expect(item(calc, 'material:plate-1:pla-basic').amount).toBe(10800) // 6 placas
    expect(item(calc, 'electricity:plate-1').amount).toBe(8640)
    expect(item(calc, 'wear:plate-1').amount).toBe(12000)
    expect(item(calc, 'supervision:plate-1').amount).toBe(36000)
    expect(item(calc, 'setup:job').amount).toBe(1667) // 1 lote
    expect(item(calc, 'service:assembly').amount).toBe(14000) // 4 piezas extra
    expect(item(calc, 'service:modeling-3d').amount).toBe(27000) // una vez
  })

  it('fallas (939 + 751 + 1.043 + 3.130), pool y crédito fiscal', () => {
    expect(calc.breakdown.totals.byComponent.FAILURE).toBe(5863)
    expect(calc.breakdown.pricingPool).toBe(115970)
    expect(calc.breakdown.recoverableVat).toBe(10665)
    expect(checkCostBreakdownInvariants(calc.breakdown, calc.quantities.units)).toEqual([])
  })

  it('el ensamblaje no se ve afectado por las fallas', () => {
    expect(codes(calc)).not.toContain('failure:service:assembly')
  })
})

describe('GOLDEN 6 — desgaste derivado de la compra de la máquina (sin crédito fiscal por impresión)', () => {
  // máquina de $450.000 con IVA recuperable, 8.000 h de vida útil, en vez del override de $250/h
  const raw = mutated('params.machines.printer-1.lifetimeHours', 8000, mutated('params.machines.printer-1.purchasePrice', { amount: 450000, basis: 'GROSS', vatRecoverable: true }, without('params.machines.printer-1.wearPerHourOverride', validRequestRaw())))
  const calc = costOf(raw)

  it('el desgaste usa el costo neto de la máquina y su falla se calcula desde el monto exacto', () => {
    expect(item(calc, 'wear:plate-1').amount).toBe(378) // 450.000 / 1,19 / 8.000 × 8 h = 378,15
    expect(item(calc, 'failure:wear:plate-1').amount).toBe(33) // 378,15 × 0,0870 = 32,88
    expect(calc.breakdown.pricingPool).toBe(13885 - (2000 - 378) - (174 - 33)) // 12.122
  })

  it('el crédito fiscal no cambia respecto del caso base: el IVA de la máquina no se reconoce por impresión', () => {
    expect(item(calc, 'wear:plate-1').vatRecoverable).toBe(0)
    expect(item(calc, 'failure:wear:plate-1').vatRecoverable).toBe(0)
    expect(calc.breakdown.recoverableVat).toBe(670)
  })
})

describe('advertencias informativas', () => {
  it('ensamblaje sin piezas extra: ítem en 0 e INFO; la cotización sigue siendo válida', () => {
    const calc = costOf(mutated('input.services', services('assembly'), validRequestRaw()))
    expect(item(calc, 'service:assembly').amount).toBe(0)
    expect(calc.flags).toEqual([{ code: 'ASSEMBLY_WITHOUT_EXTRA_PARTS', severity: 'INFO', path: 'input.services[0]' }])
    expect(calc.flags.some((f) => f.severity === 'BLOCKING')).toBe(false)
    expect(calc.breakdown.pricingPool).toBe(13885) // no cambia el costo
  })

  it('con piezas extra no hay advertencia', () => {
    const raw = mutated('input.plates[0].partsPerUnit', 2, mutated('input.services', services('assembly'), validRequestRaw()))
    expect(costOf(raw).flags).toEqual([])
  })
})

describe('overrides de recuperación (ITEM_RECOVERY)', () => {
  const nre = mutated('input.services', services('modeling-3d'), validRequestRaw())
  const override = (itemCode: string, value: unknown) => mutated('overrides', [{ kind: 'ITEM_RECOVERY', itemCode, value, reason }], nre)

  it('absorber un costo único lo saca del precio y lo suma a lo absorbido', () => {
    const calc = costOf(override('service:modeling-3d', { recovery: 'ABSORBED' }))
    const nreItem = item(calc, 'service:modeling-3d')
    expect(nreItem.pooledAmount).toBe(0)
    expect(calc.breakdown.pricingPool).toBe(13885)
    expect(calc.breakdown.absorbedCost).toBe(27000)
    expect(calc.breakdown.totals.byRecovery.SEPARATE_LINE).toBe(0)
    expect(checkCostBreakdownInvariants(calc.breakdown, calc.quantities.units)).toEqual([])
  })

  it('amortizar un ONE_OFF sobre 100 unidades con N = 10: entra el 10 %, el resto queda diferido', () => {
    const dev = costSpecRaw('dev', 40000, 'ONE_OFF', { component: 'DESIGN' })
    let raw = mutated('input.quantity', 10, mutated('input.extraCosts', [dev], validRequestRaw()))
    raw = mutated('overrides', [{ kind: 'ITEM_RECOVERY', itemCode: 'extra:dev', value: { recovery: 'IN_PRICE', amortization: { overUnits: 100 } }, reason }], raw)
    const calc = costOf(raw)
    expect(item(calc, 'extra:dev').pooledAmount).toBe(4000)
    expect(calc.breakdown.deferredCost).toBe(36000)
    expect(calc.breakdown.absorbedCost).toBe(0)
    expect(checkCostBreakdownInvariants(calc.breakdown, calc.quantities.units)).toEqual([])
  })

  it('el cambio se propaga a las fallas del ítem (heredan la recuperación)', () => {
    const calc = costOf(mutated('overrides', [{ kind: 'ITEM_RECOVERY', itemCode: 'material:plate-1:pla-basic', value: { recovery: 'ABSORBED' }, reason }], validRequestRaw()))
    expect(item(calc, 'failure:material:plate-1:pla-basic').recoveryConfig.recovery).toBe('ABSORBED')
    expect(calc.breakdown.absorbedCost).toBe(1800 + 157)
    expect(calc.breakdown.pricingPool).toBe(13885 - 1957)
  })

  it('un override sobre el ítem de falla afecta solo a esa falla', () => {
    const calc = costOf(mutated('overrides', [{ kind: 'ITEM_RECOVERY', itemCode: 'failure:material:plate-1:pla-basic', value: { recovery: 'ABSORBED' }, reason }], validRequestRaw()))
    expect(item(calc, 'material:plate-1:pla-basic').pooledAmount).toBe(1800)
    expect(item(calc, 'failure:material:plate-1:pla-basic').pooledAmount).toBe(0)
    expect(calc.breakdown.absorbedCost).toBe(157)
  })

  it('un código inexistente no falla: se advierte (UNKNOWN_OVERRIDE_TARGET)', () => {
    const calc = costOf(override('service:no-existe', { recovery: 'ABSORBED' }))
    expect(calc.flags).toEqual([{ code: 'UNKNOWN_OVERRIDE_TARGET', severity: 'WARNING', path: 'overrides[0]' }])
    expect(calc.breakdown.pricingPool).toBe(40885)
  })

  it('amortizar un ítem que no es ONE_OFF es una entrada inválida', () => {
    const result = costResult(override('setup:job', { recovery: 'IN_PRICE', amortization: { overUnits: 10 } }))
    expect(result.ok).toBe(false)
    if (!result.ok && result.error.code === 'INVALID_INPUT') {
      expect(result.error.issues[0]?.path).toBe('overrides[0].value.amortization')
      expect(result.error.issues[0]?.code).toBe('INCONSISTENT')
    } else {
      throw new Error('se esperaba INVALID_INPUT')
    }
  })

  it('la solicitud original no se modifica', () => {
    const request = requestOf(override('service:modeling-3d', { recovery: 'ABSORBED' }))
    const before = JSON.stringify(request)
    calculateCost(request)
    expect(JSON.stringify(request)).toBe(before)
  })
})

describe('errores: entrada vs. interno', () => {
  const withoutEnergy = (): CalculationRequest => {
    const request = requestOf(validRequestRaw())
    const machine = request.params.machines['printer-1']
    if (machine === undefined) throw new Error('máquina de prueba ausente')
    const { electricityPerHourOverride, ...rest } = machine
    void electricityPerHourOverride
    return { ...request, params: { ...request.params, machines: { 'printer-1': rest } } }
  }

  it('sin origen de energía (dato que eludió el validador): MISSING_PARAMETER', () => {
    const result = calculateCost(withoutEnergy())
    expect(result).toEqual({ ok: false, error: { code: 'MISSING_PARAMETER', path: 'params.machines.printer-1.avgPowerW' } })
  })

  it('material ausente del snapshot: MISSING_PARAMETER', () => {
    const request = requestOf(validRequestRaw())
    const result = calculateCost({ ...request, params: { ...request.params, materials: {} } })
    expect(result).toEqual({ ok: false, error: { code: 'MISSING_PARAMETER', path: 'params.materials.pla-basic' } })
  })

  it('un monto corrupto (NaN) es INCONSISTENT_SNAPSHOT, no un error interno', () => {
    const request = requestOf(validRequestRaw())
    const corrupted = { ...request.params.costProfile, labor: { ratePerHour: Number.NaN as never } }
    const result = calculateCost({ ...request, params: { ...request.params, costProfile: corrupted } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
  })

  it('perfil tributario incoherente que eludió el validador: INCONSISTENT_SNAPSHOT', () => {
    const request = requestOf(validRequestRaw())
    const tax = { ...request.params.taxProfile, purchaseVatRate: 5 as never }
    const result = calculateCost({ ...request, params: { ...request.params, taxProfile: tax } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
  })

  it('un modelo de fallas desconocido es INCONSISTENT_SNAPSHOT', () => {
    const request = requestOf(validRequestRaw())
    const profile = { ...request.params.costProfile, failure: { ...request.params.costProfile.failure, modelId: 'WEIBULL' as never } }
    const result = calculateCost({ ...request, params: { ...request.params, costProfile: profile } })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
  })

  it('un generador defectuoso se detecta con la autoverificación: INTERNAL_INVARIANT', () => {
    const buggy: CostItemGenerator = () =>
      ok([
        {
          ...makeDraftForTests({ code: 'bug', rawAmount: 100 }),
          // basis dice 100 × 1 × 1 pero rawAmount es otro: el ítem rompe su propia trazabilidad
          rawAmount: 250,
        },
      ])
    const result = calculateCost(requestOf(validRequestRaw()), { generators: [buggy] })
    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL_INVARIANT', invariant: 'cost.breakdown' } })
  })

  it('un generador que falla propaga su error de entrada', () => {
    const failing: CostItemGenerator = () => err({ code: 'MISSING_PARAMETER', path: 'x' })
    expect(calculateCost(requestOf(validRequestRaw()), { generators: [failing] })).toEqual({
      ok: false,
      error: { code: 'MISSING_PARAMETER', path: 'x' },
    })
  })

  it('extensibilidad: un generador nuevo se suma al desglose sin tocar el motor', () => {
    const custom: CostItemGenerator = () => ok([makeDraftForTests({ code: 'custom:fee', rawAmount: 321 })])
    const calc = calculateCost(requestOf(validRequestRaw()), { generators: [custom] })
    expect(calc.ok && calc.value.breakdown.pricingPool).toBe(321)
  })
})

describe('modo TEST', () => {
  it('solo costo: sin fallas, con el mismo desglose de ítems base', () => {
    const calc = costOf(mutated('mode', 'TEST', validRequestRaw()))
    expect(calc.breakdown.pricingPool).toBe(12907)
    expect(codes(calc).some((c) => c.startsWith('failure:'))).toBe(false)
  })
})

describe('trazabilidad: rawAmount = quantity × unitCost × multiplier en TODOS los ítems', () => {
  const scenarios = [
    validRequestRaw(),
    mutated('input.plates[0].partsPerUnit', 3, mutated('input.quantity', 2, mutated('input.services', services('assembly', 'modeling-3d'), validRequestRaw()))),
    mutated('input.batches', 4, mutated('input.quantity', 25, validRequestRaw())),
  ]
  it.each(scenarios.map((raw, index): [number, unknown] => [index + 1, raw]))('escenario %s', (_index, raw) => {
    for (const i of costOf(raw).breakdown.items) {
      expect(Math.abs(i.rawAmount - i.basis.quantity * i.basis.unitCost * i.basis.multiplier)).toBeLessThan(1e-9 * Math.max(1, i.rawAmount))
      expect(i.amount).toBe(Math.round(i.rawAmount))
    }
  })

  it('el IVA recuperable por ítem es no negativo y la suma coincide con el total', () => {
    const b = costOf(scenarios[1]).breakdown
    expect(b.items.every((i) => i.vatRecoverable >= 0)).toBe(true)
    expect(b.items.reduce((sum, i) => sum + i.vatRecoverable, 0)).toBe(b.recoverableVat)
  })
})

describe('ServiceSelection.laborMinutes: minutos de trabajo de la cotización', () => {
  const withFinishing = (minutes: number | undefined) => {
    const raw = mutated(
      'params.services.finishing',
      {
        ref: { id: 'finishing', revision: 1 },
        name: 'Acabados',
        kind: 'STANDARD',
        behavior: 'PER_UNIT',
        component: 'POSTPROCESS',
        supplyCost: { amount: 0, basis: 'NET', vatRecoverable: true },
        laborMinutes: 30,
        laborKind: 'POSTPROCESS',
        defaultRecovery: { recovery: 'IN_PRICE' },
      },
      mutated('input.quantity', 4, mutated('input.plates[0].partsPerPlate', 4, validRequestRaw())),
    )
    const selection = minutes === undefined ? { serviceId: 'finishing', active: true } : { serviceId: 'finishing', active: true, laborMinutes: minutes }
    return costOf(mutated('input.services', [selection], raw))
  }
  it('sin minutos en la selección usa los del servicio: 4 u × 30/60 h × $5.000 = $10.000', () => {
    expect(item(withFinishing(undefined), 'service:finishing').amount).toBe(10000)
  })
  it('con 12 minutos por unidad: 4 × 12/60 × 5.000 = $4.000 (la tarifa sigue siendo la del perfil)', () => {
    expect(item(withFinishing(12), 'service:finishing').amount).toBe(4000)
  })
  it('0 minutos explícitos ≠ ausente: el ítem vale 0', () => {
    expect(item(withFinishing(0), 'service:finishing').amount).toBe(0)
  })
  it('minutos negativos se rechazan en la validación', () => {
    expect(validateCalculationRequest(mutated('input.services', [{ serviceId: 'assembly', active: true, laborMinutes: -1 }], validRequestRaw())).ok).toBe(false)
  })
})
