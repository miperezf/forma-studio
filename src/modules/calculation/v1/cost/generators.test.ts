import { describe, expect, it } from 'vitest'
import { codes, costOf, costResult, costSpecRaw, item, requestOf } from '../../testing/cost-helpers'
import { mutated, validRequestRaw, without } from '../../testing/fixtures'
import { calculateCost } from './index'

/** Solicitud base SIN fallas, para aislar cada generador. */
const noFailures = (raw = validRequestRaw()) => mutated('params.costProfile.failure.rate', 0, raw)

const kwhNet = (amount: number) => ({ amount, basis: 'NET', vatRecoverable: true })

describe('material (PER_PLATE)', () => {
  it('120 g de PLA a $15.000/kg = $1.800, con IVA recuperable prorrateado', () => {
    const calc = costOf(noFailures())
    const material = item(calc, 'material:plate-1:pla-basic')
    expect(material.behavior).toBe('PER_PLATE')
    expect(material.component).toBe('MATERIAL')
    expect(material.plateId).toBe('plate-1')
    expect(material.basis).toEqual({ quantity: 120, unit: 'g', unitCost: 15, multiplier: 1 })
    expect(material.rawAmount).toBeCloseTo(1800, 9)
    expect(material.amount).toBe(1800)
    expect(material.vatRecoverable).toBe(342) // 120 g × (15.000 × 19 % / 1.000 g)
  })

  it('se multiplica por las placas requeridas de ESA placa, no por N ni por B', () => {
    let raw = mutated('input.quantity', 10, noFailures())
    raw = mutated('input.plates[0].partsPerPlate', 6, raw)
    raw = mutated('input.batches', 4, raw)
    const material = item(costOf(raw), 'material:plate-1:pla-basic')
    expect(material.basis.multiplier).toBe(2) // ceil(10/6)
    expect(material.amount).toBe(3600)
  })

  it('merma: override del material > perfil; no se aplica si el peso ya la incluye', () => {
    const profile = mutated('params.costProfile.materialWaste.fraction', 0.05, noFailures())
    expect(item(costOf(profile), 'material:plate-1:pla-basic').basis.quantity).toBeCloseTo(126, 9) // 120 × 1,05
    expect(item(costOf(profile), 'material:plate-1:pla-basic').amount).toBe(1890)
    const overridden = mutated('params.materials.pla-basic.wasteFractionOverride', 0.1, profile)
    expect(item(costOf(overridden), 'material:plate-1:pla-basic').basis.quantity).toBeCloseTo(132, 9)
    const zeroOverride = mutated('params.materials.pla-basic.wasteFractionOverride', 0, profile)
    expect(item(costOf(zeroOverride), 'material:plate-1:pla-basic').basis.quantity).toBe(120) // override 0 ≠ heredar
    const included = mutated('input.plates[0].weightIncludesWaste', true, profile)
    expect(item(costOf(included), 'material:plate-1:pla-basic').basis.quantity).toBe(120)
    expect(item(costOf(included), 'material:plate-1:pla-basic').amount).toBe(1800)
  })

  it('un ítem por filamento, con el costo por gramo de CADA material', () => {
    const petg = {
      ref: { id: 'petg', revision: 1 },
      name: 'PETG',
      brand: 'Genérica',
      spool: { price: kwhNet(20000), netGrams: 1000 },
    }
    let raw = mutated('params.materials', { ...(validRequestRaw().params as { materials: object }).materials, petg }, noFailures())
    raw = mutated('input.plates[0].filaments', [
      { materialId: 'pla-basic', grams: 100 },
      { materialId: 'petg', grams: 50 },
    ], raw)
    const calc = costOf(raw)
    expect(item(calc, 'material:plate-1:pla-basic').amount).toBe(1500) // 100 g × $15
    expect(item(calc, 'material:plate-1:petg').amount).toBe(1000) // 50 g × $20
  })

  it('el costo por gramo usa los gramos netos del rollo (no un kilo fijo)', () => {
    const spool = (netGrams: number, amount: number, basis: 'NET' | 'GROSS' = 'NET') =>
      mutated('params.materials.pla-basic.spool', { price: { amount, basis, vatRecoverable: true }, netGrams }, noFailures())
    const small = item(costOf(spool(750, 15000)), 'material:plate-1:pla-basic')
    expect(small.basis.unitCost).toBeCloseTo(20, 9) // 15.000 / 750 g
    expect(small.amount).toBe(2400)
    expect(small.vatRecoverable).toBe(456) // 120 g × (15.000 × 19 % / 750)
    const large = item(costOf(spool(2000, 30000)), 'material:plate-1:pla-basic')
    expect(large.basis.unitCost).toBeCloseTo(15, 9)
    expect(large.amount).toBe(1800)
    const gross = item(costOf(spool(500, 11900, 'GROSS')), 'material:plate-1:pla-basic')
    expect(gross.basis.unitCost).toBeCloseTo(20, 9) // (11.900 / 1,19) / 500 g
    expect(gross.amount).toBe(2400)
  })

  it('precio del rollo 0 es válido y da costo 0 (cero ≠ ausente)', () => {
    const raw = mutated('params.materials.pla-basic.spool.price.amount', 0, noFailures())
    const material = item(costOf(raw), 'material:plate-1:pla-basic')
    expect(material.amount).toBe(0)
    expect(material.vatRecoverable).toBe(0)
  })

  describe('IVA del precio del rollo', () => {
    const price = (basis: 'NET' | 'GROSS', amount: number, vatRecoverable: boolean) =>
      mutated('params.materials.pla-basic.spool.price', { amount, basis, vatRecoverable }, noFailures())

    it('NET recuperable: costo 1.800 y crédito 342', () => {
      const m = item(costOf(price('NET', 15000, true)), 'material:plate-1:pla-basic')
      expect([m.amount, m.vatRecoverable]).toEqual([1800, 342])
    })
    it('NET NO recuperable: el IVA es costo (2.142) y no hay crédito', () => {
      const m = item(costOf(price('NET', 15000, false)), 'material:plate-1:pla-basic')
      expect([m.amount, m.vatRecoverable]).toEqual([2142, 0])
    })
    it('GROSS recuperable: costo = neto (1.800) y crédito 342', () => {
      const m = item(costOf(price('GROSS', 17850, true)), 'material:plate-1:pla-basic')
      expect([m.amount, m.vatRecoverable]).toEqual([1800, 342])
    })
    it('GROSS NO recuperable: todo el desembolso es costo (2.142)', () => {
      const m = item(costOf(price('GROSS', 17850, false)), 'material:plate-1:pla-basic')
      expect([m.amount, m.vatRecoverable]).toEqual([2142, 0])
    })
    it('régimen NO afecto: el IVA nunca se recupera aunque el monto lo declare', () => {
      let raw = mutated('params.taxProfile.regime', 'NOT_REGISTERED', price('NET', 15000, true))
      raw = mutated('params.taxProfile.vatRate', 0, raw)
      const m = item(costOf(raw), 'material:plate-1:pla-basic')
      expect([m.amount, m.vatRecoverable]).toEqual([2142, 0])
    })
  })
})

describe('electricidad (PER_PLATE)', () => {
  it('override de la máquina: 8 h × $180 = $1.440, IVA recuperable 273,6 → 274', () => {
    const e = item(costOf(noFailures()), 'electricity:plate-1')
    expect(e.basis).toEqual({ quantity: 8, unit: 'h', unitCost: 180, multiplier: 1 })
    expect(e.amount).toBe(1440)
    expect(e.vatRecoverable).toBe(274)
  })

  it('por potencia: (120 W / 1.000) × $200/kWh × 8 h = $192', () => {
    let raw = without('params.machines.printer-1.electricityPerHourOverride', noFailures())
    raw = mutated('params.machines.printer-1.avgPowerW', 120, raw)
    const e = item(costOf(raw), 'electricity:plate-1')
    expect(e.basis.unitCost).toBeCloseTo(24, 9)
    expect(e.rawAmount).toBeCloseTo(192, 9)
    expect(e.amount).toBe(192)
    expect(e.vatRecoverable).toBe(36) // 8 h × 0,12 kW × 38 = 36,48
  })

  it('el override de la máquina prevalece sobre la potencia', () => {
    const raw = mutated('params.machines.printer-1.avgPowerW', 120, noFailures())
    expect(item(costOf(raw), 'electricity:plate-1').amount).toBe(1440)
  })

  it('potencia 0 (energía incluida) da costo 0 y override 0 también', () => {
    let raw = without('params.machines.printer-1.electricityPerHourOverride', noFailures())
    raw = mutated('params.machines.printer-1.avgPowerW', 0, raw)
    expect(item(costOf(raw), 'electricity:plate-1').amount).toBe(0)
    const overrideZero = mutated('params.machines.printer-1.electricityPerHourOverride', kwhNet(0), noFailures())
    expect(item(costOf(overrideZero), 'electricity:plate-1').amount).toBe(0)
  })

  it('el kWh en base bruta se descompone (200 bruto recuperable → 168,07 neto)', () => {
    let raw = without('params.machines.printer-1.electricityPerHourOverride', noFailures())
    raw = mutated('params.machines.printer-1.avgPowerW', 1000, raw)
    raw = mutated('params.costProfile.energy.kwhPrice', { amount: 238, basis: 'GROSS', vatRecoverable: true }, raw)
    expect(item(costOf(raw), 'electricity:plate-1').basis.unitCost).toBeCloseTo(200, 9)
  })
})

describe('desgaste (PER_PLATE)', () => {
  it('override: 8 h × $250 = $2.000, sin IVA', () => {
    const w = item(costOf(noFailures()), 'wear:plate-1')
    expect(w.basis).toEqual({ quantity: 8, unit: 'h', unitCost: 250, multiplier: 1 })
    expect(w.amount).toBe(2000)
    expect(w.vatRecoverable).toBe(0)
  })

  const derived = (extra: Record<string, unknown> = {}) => {
    let raw = without('params.machines.printer-1.wearPerHourOverride', noFailures())
    raw = mutated('params.machines.printer-1.purchasePrice', { amount: 450000, basis: 'GROSS', vatRecoverable: true }, raw)
    raw = mutated('params.machines.printer-1.lifetimeHours', 8000, raw)
    for (const [key, value] of Object.entries(extra)) raw = mutated(`params.machines.printer-1.${key}`, value, raw)
    return raw
  }

  it('derivado: (compra neta − residual) / vida útil por hora, × horas', () => {
    const w = item(costOf(derived()), 'wear:plate-1')
    // 450.000 / 1,19 = 378.151,26 ; / 8.000 = 47,2689 por hora ; × 8 h = 378,15
    expect(w.basis.unitCost).toBeCloseTo(47.268907563, 6)
    expect(w.rawAmount).toBeCloseTo(378.151260504, 6)
    expect(w.amount).toBe(378)
    // El IVA de la máquina se recuperó en la COMPRA: el desgaste no reconoce crédito fiscal por impresión.
    expect(w.vatRecoverable).toBe(0)
  })

  it('suma la reserva de mantención por hora', () => {
    const w = item(costOf(derived({ maintenanceReservePerHour: 40 })), 'wear:plate-1')
    expect(w.basis.unitCost).toBeCloseTo(87.268907563, 6)
    expect(w.rawAmount).toBeCloseTo(698.151260504, 6)
  })

  it('resta el valor residual (también descompuesto de IVA)', () => {
    const residual = { amount: 119000, basis: 'GROSS', vatRecoverable: true } // neto 100.000
    const w = item(costOf(derived({ residualValue: residual })), 'wear:plate-1')
    expect(w.basis.unitCost).toBeCloseTo((378151.260504 - 100000) / 8000, 6)
  })

  it('máquina ya depreciada: compra 0 da desgaste 0', () => {
    const w = item(costOf(derived({ purchasePrice: { amount: 0, basis: 'NET', vatRecoverable: true } })), 'wear:plate-1')
    expect(w.amount).toBe(0)
  })

  it('el override prevalece sobre la derivación', () => {
    const w = item(costOf(derived({ wearPerHourOverride: 250 })), 'wear:plate-1')
    expect(w.amount).toBe(2000)
  })

  it('valor residual mayor que el precio de compra es inconsistente', () => {
    const raw = derived({ residualValue: { amount: 500000, basis: 'GROSS', vatRecoverable: true } })
    const result = costResult(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INCONSISTENT_SNAPSHOT')
  })
})

describe('supervisión (PER_PLATE)', () => {
  it('8 h × 0,15 = 1,2 h de mano de obra × $5.000 = $6.000', () => {
    const s = item(costOf(noFailures()), 'supervision:plate-1')
    expect(s.basis.quantity).toBeCloseTo(1.2, 9)
    expect(s.basis.unit).toBe('h MO')
    expect(s.basis.unitCost).toBe(5000)
    expect(s.amount).toBe(6000)
    expect(s.component).toBe('SUPERVISION')
  })

  it('el ratio de la máquina prevalece sobre el del perfil; 0 es un override válido', () => {
    const machine = mutated('params.machines.printer-1.supervisionRatioOverride', 0.5, noFailures())
    expect(item(costOf(machine), 'supervision:plate-1').amount).toBe(20000)
    const zero = mutated('params.machines.printer-1.supervisionRatioOverride', 0, noFailures())
    expect(item(costOf(zero), 'supervision:plate-1').amount).toBe(0)
  })

  it('usa la tarifa del tipo SUPERVISION si existe', () => {
    const raw = mutated('params.costProfile.labor.rateByKind', { SUPERVISION: 3000 }, noFailures())
    expect(item(costOf(raw), 'supervision:plate-1').amount).toBe(3600)
  })

  it('se multiplica por las placas de esa placa', () => {
    const raw = mutated('input.plates[0].partsPerPlate', 5, mutated('input.quantity', 12, noFailures()))
    const s = item(costOf(raw), 'supervision:plate-1')
    expect(s.basis.multiplier).toBe(3) // ceil(12/5)
    expect(s.amount).toBe(18000)
  })
})

describe('preparación (setup)', () => {
  it('trabajo: 20 min = 1/3 h × $5.000 = $1.666,67 → 1.667, PER_BATCH', () => {
    const s = item(costOf(noFailures()), 'setup:job')
    expect(s.behavior).toBe('PER_BATCH')
    expect(s.component).toBe('SETUP')
    expect(s.basis.multiplier).toBe(1)
    expect(s.rawAmount).toBeCloseTo(1666.6666667, 6)
    expect(s.amount).toBe(1667)
  })

  it('se multiplica por los lotes B, no por las unidades ni por las placas', () => {
    expect(item(costOf(mutated('input.batches', 3, noFailures())), 'setup:job').amount).toBe(5000)
    const manyUnits = mutated('input.quantity', 50, noFailures())
    expect(item(costOf(manyUnits), 'setup:job').amount).toBe(1667)
    const manyPlates = mutated('input.plates[0].partsPerPlate', 1, manyUnits)
    expect(item(costOf(manyPlates), 'setup:job').amount).toBe(1667)
  })

  it('cambio de placa: PER_PLATE, 0 por defecto, y × Σ placas cuando hay minutos', () => {
    expect(item(costOf(noFailures()), 'setup:changeover').amount).toBe(0)
    let raw = mutated('params.costProfile.preparation.plateChangeoverMinutes', 6, noFailures())
    raw = mutated('input.quantity', 5, raw)
    const c = item(costOf(raw), 'setup:changeover')
    expect(c.behavior).toBe('PER_PLATE')
    expect(c.basis.multiplier).toBe(5)
    expect(c.amount).toBe(2500) // 0,1 h × $5.000 × 5 placas
  })

  it('usa la tarifa del tipo PREPARATION si existe', () => {
    const raw = mutated('params.costProfile.labor.rateByKind', { PREPARATION: 4000 }, noFailures())
    expect(item(costOf(raw), 'setup:job').amount).toBe(1333)
  })

  it('0 minutos de preparación es válido', () => {
    const raw = mutated('params.costProfile.preparation.jobSetupMinutes', 0, noFailures())
    expect(item(costOf(raw), 'setup:job').amount).toBe(0)
  })
})

describe('servicios', () => {
  const withService = (serviceId: string, active = true, base = noFailures()) =>
    mutated('input.services', [{ serviceId, active }], base)

  it('un servicio inactivo no genera ítem', () => {
    expect(codes(costOf(withService('assembly', false)))).not.toContain('service:assembly')
  })

  it('NRE (modelado 3D): ONE_OFF, SEPARATE_LINE, $27.000, sin multiplicarse nunca', () => {
    for (const [n, b, perPlate] of [[1, 1, 1], [50, 1, 1], [50, 7, 6], [1000, 40, 1]] as const) {
      let raw = mutated('input.quantity', n, withService('modeling-3d'))
      raw = mutated('input.batches', b, raw)
      raw = mutated('input.plates[0].partsPerPlate', perPlate, raw)
      const nre = item(costOf(raw), 'service:modeling-3d')
      expect(nre.behavior).toBe('ONE_OFF')
      expect(nre.recoveryConfig).toEqual({ recovery: 'SEPARATE_LINE' })
      expect(nre.basis.multiplier).toBe(1)
      expect(nre.amount).toBe(27000)
      expect(nre.pooledAmount).toBe(27000)
    }
  })

  describe('ensamblaje (PER_EXTRA_PART): una vez y solo por las piezas adicionales', () => {
    const assembled = (n: number, perUnit: number, perPlate = 1) => {
      let raw = mutated('input.quantity', n, withService('assembly'))
      raw = mutated('input.plates[0].partsPerUnit', perUnit, raw)
      raw = mutated('input.plates[0].partsPerPlate', perPlate, raw)
      return costOf(raw)
    }

    it('3 piezas por unidad, N = 2: 4 piezas extra × ($2.000 + 18 min × $5.000/h = $3.500) = $14.000', () => {
      const a = item(assembled(2, 3), 'service:assembly')
      expect(a.behavior).toBe('PER_EXTRA_PART')
      expect(a.basis).toEqual({ quantity: 1, unit: 'u', unitCost: 3500, multiplier: 4 })
      expect(a.amount).toBe(14000)
      expect(a.vatRecoverable).toBe(1520) // 4 × 2.000 × 19 %
    })

    it('con una sola pieza por unidad no se cobra ensamblaje (multiplicador 0) y se advierte', () => {
      const calc = assembled(10, 1)
      const a = item(calc, 'service:assembly')
      expect(a.basis.multiplier).toBe(0)
      expect(a.amount).toBe(0)
      expect(calc.flags.map((f) => f.code)).toEqual(['ASSEMBLY_WITHOUT_EXTRA_PARTS'])
    })

    it('no depende de las placas: mismas piezas extra con placas distintas', () => {
      expect(item(assembled(4, 3, 1), 'service:assembly').amount).toBe(item(assembled(4, 3, 12), 'service:assembly').amount)
    })

    it('no depende de B', () => {
      const withBatches = mutated('input.batches', 9, mutated('input.plates[0].partsPerUnit', 3, withService('assembly')))
      expect(item(costOf(withBatches), 'service:assembly').amount).toBe(7000) // 2 piezas extra × 3.500, N = 1
    })

    it('se cobra una sola vez: un solo ítem de ensamblaje', () => {
      const calc = assembled(5, 4)
      expect(codes(calc).filter((c) => c.startsWith('service:')).length).toBe(1)
    })

    it('con varias placas, las piezas por unidad se suman (2 placas de 1 pieza = 1 pieza extra por unidad)', () => {
      const second = { ...(validRequestRaw().input as { plates: Record<string, unknown>[] }).plates[0], id: 'plate-2', label: 'Tapa' }
      let raw = mutated('input.plates', [(validRequestRaw().input as { plates: unknown[] }).plates[0], second], withService('assembly'))
      raw = mutated('input.quantity', 3, raw)
      const a = item(costOf(raw), 'service:assembly')
      expect(a.basis.multiplier).toBe(3) // 3 unidades × (2 − 1)
      expect(a.amount).toBe(10500)
    })

    it('tarifa del servicio: override del servicio (0 válido) > tarifa del tipo > base', () => {
      const zero = mutated('params.services.assembly.laborRateOverride', 0, mutated('input.services', [{ serviceId: 'assembly', active: true }], noFailures()))
      let raw = mutated('input.plates[0].partsPerUnit', 2, zero)
      expect(item(costOf(raw), 'service:assembly').basis.unitCost).toBe(2000) // solo el insumo
      const kind = mutated('params.costProfile.labor.rateByKind', { ASSEMBLY: 4000 }, mutated('input.plates[0].partsPerUnit', 2, withService('assembly')))
      expect(item(costOf(kind), 'service:assembly').basis.unitCost).toBe(3200) // 2.000 + 0,3 h × 4.000
      raw = mutated('input.plates[0].partsPerUnit', 2, withService('assembly'))
      expect(item(costOf(raw), 'service:assembly').basis.unitCost).toBe(3500)
    })
  })
})

describe('costos auxiliares y adicionales: cada uno con SU magnitud', () => {
  // N = 10, B = 3, placa de 6 piezas, 3 piezas por unidad → 5 placas, 20 piezas extra
  const scenario = () => {
    let raw = mutated('input.quantity', 10, noFailures())
    raw = mutated('input.batches', 3, raw)
    raw = mutated('input.plates[0].partsPerPlate', 6, raw)
    raw = mutated('input.plates[0].partsPerUnit', 3, raw)
    return raw
  }
  const specs = [
    costSpecRaw('per-unit', 100, 'PER_UNIT'),
    costSpecRaw('per-plate', 200, 'PER_PLATE'),
    costSpecRaw('per-batch', 300, 'PER_BATCH'),
    costSpecRaw('one-off', 400, 'ONE_OFF'),
    costSpecRaw('per-extra', 500, 'PER_EXTRA_PART'),
  ]

  const expected: [string, number, number][] = [
    ['per-unit', 10, 1000],
    ['per-plate', 5, 1000],
    ['per-batch', 3, 900],
    ['one-off', 1, 400],
    ['per-extra', 20, 10000],
  ]

  it.each(expected)('extra %s: multiplicador %s → $%s', (code, multiplier, amount) => {
    const calc = costOf(mutated('input.extraCosts', specs, scenario()))
    const found = item(calc, `extra:${code}`)
    expect(found.basis.multiplier).toBe(multiplier)
    expect(found.amount).toBe(amount)
  })

  it.each(expected)('auxiliar %s (del perfil): mismos multiplicadores', (code, multiplier, amount) => {
    const calc = costOf(mutated('params.costProfile.auxiliaryCosts', specs, scenario()))
    const found = item(calc, `aux:${code}`)
    expect(found.basis.multiplier).toBe(multiplier)
    expect(found.amount).toBe(amount)
  })

  it('el monto de un extra con IVA se descompone con la misma regla (bruto no recuperable = costo completo)', () => {
    const spec = costSpecRaw('box', 119, 'PER_UNIT', { basis: 'GROSS', vatRecoverable: false })
    const found = item(costOf(mutated('input.extraCosts', [spec], noFailures())), 'extra:box')
    expect(found.amount).toBe(119)
    expect(found.vatRecoverable).toBe(0)
    const recoverable = costSpecRaw('box', 119, 'PER_UNIT', { basis: 'GROSS', vatRecoverable: true })
    const second = item(costOf(mutated('input.extraCosts', [recoverable], noFailures())), 'extra:box')
    expect([second.amount, second.vatRecoverable]).toEqual([100, 19])
  })

  it('conserva la recuperación declarada (SEPARATE_LINE, ABSORBED, amortización)', () => {
    const extras = [
      costSpecRaw('design', 5000, 'ONE_OFF', { recoveryConfig: { recovery: 'SEPARATE_LINE' } }),
      costSpecRaw('small', 300, 'PER_UNIT', { recoveryConfig: { recovery: 'ABSORBED' } }),
      costSpecRaw('dev', 40000, 'ONE_OFF', { recoveryConfig: { recovery: 'IN_PRICE', amortization: { overUnits: 100 } } }),
    ]
    const calc = costOf(mutated('input.extraCosts', extras, scenario()))
    expect(item(calc, 'extra:design').recoveryConfig.recovery).toBe('SEPARATE_LINE')
    expect(item(calc, 'extra:small').pooledAmount).toBe(0)
    expect(item(calc, 'extra:dev').pooledAmount).toBe(4000) // 40.000 × 10 / 100
  })
})

describe('estructura del desglose', () => {
  it('el orden de los ítems es fijo y determinista', () => {
    const raw = mutated('input.services', [{ serviceId: 'modeling-3d', active: true }], validRequestRaw())
    const order = codes(costOf(raw))
    expect(order).toEqual([
      'material:plate-1:pla-basic',
      'electricity:plate-1',
      'wear:plate-1',
      'supervision:plate-1',
      'setup:job',
      'setup:changeover',
      'service:modeling-3d',
      'failure:material:plate-1:pla-basic',
      'failure:electricity:plate-1',
      'failure:wear:plate-1',
      'failure:supervision:plate-1',
    ])
    expect(codes(costOf(raw))).toEqual(order)
  })

  it('los códigos de ítem son únicos', () => {
    const calc = costOf(mutated('input.services', [{ serviceId: 'assembly', active: true }, { serviceId: 'modeling-3d', active: true }], validRequestRaw()))
    expect(new Set(codes(calc)).size).toBe(codes(calc).length)
  })

  it('calculateCost no muta la solicitud y es determinista', () => {
    const request = requestOf(validRequestRaw())
    const before = JSON.stringify(request)
    const first = calculateCost(request)
    const second = calculateCost(request)
    expect(JSON.stringify(request)).toBe(before)
    expect(first).toEqual(second)
  })
})
