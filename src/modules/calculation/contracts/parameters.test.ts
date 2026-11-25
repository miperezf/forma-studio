import { describe, expect, it } from 'vitest'
import { validateCalculationRequest } from './index'
import { mutated, validRequestRaw, valueAt, without } from '../testing/fixtures'
import type { Issue } from '../../../core/validation'

function issuesOf(raw: unknown): readonly Issue[] {
  const result = validateCalculationRequest(raw)
  return result.ok ? [] : result.error
}

function hasIssue(raw: unknown, path: string, code: string): boolean {
  return issuesOf(raw).some((i) => i.path === path && i.code === code)
}

const P = 'params.'

describe('PricingProfile', () => {
  const cases: [string, string, unknown, string][] = [
    ['margen objetivo ingresado como 35 en vez de 0,35', `${P}pricingProfile.targetMargin`, 35, 'RANGE'],
    ['margen objetivo 1 (precio infinito)', `${P}pricingProfile.targetMargin`, 1, 'RANGE'],
    ['margen objetivo negativo', `${P}pricingProfile.targetMargin`, -0.1, 'RANGE'],
    ['margen mínimo fuera de rango', `${P}pricingProfile.minMargin`, 1.2, 'RANGE'],
    ['política desconocida', `${P}pricingProfile.onBelowMin`, 'IGNORE', 'ENUM'],
    ['paso de redondeo cero', `${P}pricingProfile.rounding.step`, 0, 'RANGE'],
    ['paso de redondeo decimal', `${P}pricingProfile.rounding.step`, 99.5, 'NOT_INTEGER'],
    ['paso de redondeo gigante', `${P}pricingProfile.rounding.step`, 10_000_000, 'RANGE'],
    ['dirección de redondeo inválida', `${P}pricingProfile.rounding.direction`, 'AROUND', 'ENUM'],
    ['objetivo de redondeo inválido', `${P}pricingProfile.rounding.target`, 'BOTH', 'ENUM'],
  ]
  it.each(cases)('%s', (_name, path, value, code) => {
    expect(hasIssue(mutated(path, value), path, code)).toBe(true)
  })

  it('el margen mínimo no puede superar al objetivo', () => {
    expect(hasIssue(mutated(`${P}pricingProfile.minMargin`, 0.4), `${P}pricingProfile.minMargin`, 'INCONSISTENT')).toBe(true)
    expect(validateCalculationRequest(mutated(`${P}pricingProfile.minMargin`, 0.35)).ok).toBe(true)
  })

  it('redondeo NONE no admite campos de STEP', () => {
    expect(validateCalculationRequest(mutated(`${P}pricingProfile.rounding`, { mode: 'NONE' })).ok).toBe(true)
    expect(
      hasIssue(
        mutated(`${P}pricingProfile.rounding`, { mode: 'NONE', step: 100 }),
        `${P}pricingProfile.rounding.step`,
        'UNKNOWN_KEY',
      ),
    ).toBe(true)
  })

  it('STEP exige step, direction y target', () => {
    const raw = mutated(`${P}pricingProfile.rounding`, { mode: 'STEP' })
    expect(hasIssue(raw, `${P}pricingProfile.rounding.step`, 'REQUIRED')).toBe(true)
    expect(hasIssue(raw, `${P}pricingProfile.rounding.direction`, 'REQUIRED')).toBe(true)
    expect(hasIssue(raw, `${P}pricingProfile.rounding.target`, 'REQUIRED')).toBe(true)
  })
})

describe('tramos de descuento por volumen', () => {
  const tiersPath = `${P}pricingProfile.discountTiers`
  const tier = (minQty: number, maxQty: number | null, discount: number) => ({ minQty, maxQty, discount })

  it('sin tramos es válido (nunca hay descuento)', () => {
    expect(validateCalculationRequest(mutated(tiersPath, [])).ok).toBe(true)
  })

  it('un solo tramo abierto desde 1 es válido', () => {
    expect(validateCalculationRequest(mutated(tiersPath, [tier(1, null, 0.1)])).ok).toBe(true)
  })

  it('el primer tramo debe comenzar en 1', () => {
    expect(hasIssue(mutated(tiersPath, [tier(2, null, 0.1)]), `${tiersPath}[0].minQty`, 'INCONSISTENT')).toBe(true)
  })

  it('los tramos no pueden tener huecos', () => {
    const raw = mutated(tiersPath, [tier(1, 4, 0), tier(6, null, 0.1)])
    expect(hasIssue(raw, `${tiersPath}[1].minQty`, 'INCONSISTENT')).toBe(true)
  })

  it('los tramos no pueden solaparse', () => {
    const raw = mutated(tiersPath, [tier(1, 5, 0), tier(5, null, 0.1)])
    expect(hasIssue(raw, `${tiersPath}[1].minQty`, 'INCONSISTENT')).toBe(true)
  })

  it('solo el último tramo puede ser abierto y debe serlo', () => {
    expect(hasIssue(mutated(tiersPath, [tier(1, null, 0), tier(5, null, 0.1)]), `${tiersPath}[1].minQty`, 'INCONSISTENT')).toBe(true)
    expect(hasIssue(mutated(tiersPath, [tier(1, 4, 0), tier(5, 9, 0.1)]), `${tiersPath}[1].maxQty`, 'INCONSISTENT')).toBe(true)
  })

  it('maxQty no puede ser menor que minQty', () => {
    expect(hasIssue(mutated(tiersPath, [tier(1, 4, 0), tier(5, 3, 0.1), tier(4, null, 0.2)]), `${tiersPath}[1].maxQty`, 'RANGE')).toBe(true)
  })

  it('el descuento es una fracción [0, 1)', () => {
    expect(hasIssue(mutated(tiersPath, [tier(1, null, 1)]), `${tiersPath}[0].discount`, 'RANGE')).toBe(true)
    expect(hasIssue(mutated(tiersPath, [tier(1, null, 15)]), `${tiersPath}[0].discount`, 'RANGE')).toBe(true)
  })
})

describe('TaxProfile', () => {
  it('la tasa es una fracción [0, 1)', () => {
    expect(hasIssue(mutated(`${P}taxProfile.vatRate`, 19), `${P}taxProfile.vatRate`, 'RANGE')).toBe(true)
    expect(hasIssue(mutated(`${P}taxProfile.regime`, 'EXEMPT'), `${P}taxProfile.regime`, 'ENUM')).toBe(true)
  })

  it('NOT_REGISTERED exige tasa 0; VAT_REGISTERED acepta cualquier tasa configurable', () => {
    const notRegistered = mutated(`${P}taxProfile.regime`, 'NOT_REGISTERED')
    expect(hasIssue(notRegistered, `${P}taxProfile.vatRate`, 'INCONSISTENT')).toBe(true)
    expect(validateCalculationRequest(mutated(`${P}taxProfile.vatRate`, 0, notRegistered)).ok).toBe(true)
    expect(validateCalculationRequest(mutated(`${P}taxProfile.vatRate`, 0.21)).ok).toBe(true)
  })

  it('el precio al cliente puede ser NET o GROSS', () => {
    expect(validateCalculationRequest(mutated(`${P}taxProfile.customerPriceMode`, 'NET')).ok).toBe(true)
    expect(hasIssue(mutated(`${P}taxProfile.customerPriceMode`, 'IVA'), `${P}taxProfile.customerPriceMode`, 'ENUM')).toBe(true)
  })
})

describe('TaxedAmount en parámetros', () => {
  it('un monto con base inválida o recuperabilidad ausente se rechaza', () => {
    expect(hasIssue(mutated(`${P}costProfile.energy.kwhPrice.basis`, 'BRUTO'), `${P}costProfile.energy.kwhPrice.basis`, 'ENUM')).toBe(true)
    expect(hasIssue(without(`${P}costProfile.energy.kwhPrice.vatRecoverable`), `${P}costProfile.energy.kwhPrice.vatRecoverable`, 'REQUIRED')).toBe(true)
  })

  it('acepta compra con IVA no recuperable (boleta)', () => {
    const raw = mutated(`${P}costProfile.energy.kwhPrice`, { amount: 238, basis: 'GROSS', vatRecoverable: false })
    expect(validateCalculationRequest(raw).ok).toBe(true)
  })

  it('el precio del rollo puede ser 0 (muestra gratuita) pero no negativo', () => {
    const path = `${P}materials.pla-basic.spool.price.amount`
    expect(validateCalculationRequest(mutated(path, 0)).ok).toBe(true)
    expect(hasIssue(mutated(path, -1), path, 'RANGE')).toBe(true)
  })
})

describe('CostProfile', () => {
  const cases: [string, string, unknown, string][] = [
    ['valor hora negativo', `${P}costProfile.labor.ratePerHour`, -1, 'RANGE'],
    ['supervisión negativa', `${P}costProfile.supervision.hoursPerPrintHour`, -0.15, 'RANGE'],
    ['preparación negativa', `${P}costProfile.preparation.jobSetupMinutes`, -20, 'RANGE'],
    ['merma 100 %', `${P}costProfile.materialWaste.fraction`, 1, 'RANGE'],
    ['tasa de falla 100 %', `${P}costProfile.failure.rate`, 1, 'RANGE'],
    ['tasa de falla sobre el tope', `${P}costProfile.failure.rate`, 0.96, 'RANGE'],
    ['tasa de falla como porcentaje', `${P}costProfile.failure.rate`, 8, 'RANGE'],
    ['costFraction fuera de rango', `${P}costProfile.failure.costFraction`, 1.5, 'RANGE'],
    ['modelo de fallas desconocido', `${P}costProfile.failure.modelId`, 'WEIBULL', 'ENUM'],
  ]
  it.each(cases)('%s', (_name, path, value, code) => {
    expect(hasIssue(mutated(path, value), path, code)).toBe(true)
  })

  it('tasa de falla 0 y tope exacto son válidos', () => {
    expect(validateCalculationRequest(mutated(`${P}costProfile.failure.rate`, 0)).ok).toBe(true)
    expect(validateCalculationRequest(mutated(`${P}costProfile.failure.rate`, 0.95)).ok).toBe(true)
  })

  it('los componentes afectados por fallas no pueden incluir FAILURE ni repetirse', () => {
    const path = `${P}costProfile.failure.affectedComponents`
    expect(hasIssue(mutated(path, ['MATERIAL', 'FAILURE']), `${path}[1]`, 'INCONSISTENT')).toBe(true)
    expect(hasIssue(mutated(path, ['MATERIAL', 'MATERIAL']), `${path}[1]`, 'DUPLICATE')).toBe(true)
    expect(hasIssue(mutated(path, ['MATERIAL', 'POSTRE']), `${path}[1]`, 'ENUM')).toBe(true)
    expect(validateCalculationRequest(mutated(path, [])).ok).toBe(true)
  })

  it('tarifas por tipo de mano de obra: solo los tipos conocidos', () => {
    const path = `${P}costProfile.labor.rateByKind`
    expect(validateCalculationRequest(mutated(path, { ASSEMBLY: 4000, SUPERVISION: 3000 })).ok).toBe(true)
    expect(hasIssue(mutated(path, { PINTURA: 1 }), `${path}.PINTURA`, 'UNKNOWN_KEY')).toBe(true)
    expect(hasIssue(mutated(path, { ASSEMBLY: -1 }), `${path}.ASSEMBLY`, 'RANGE')).toBe(true)
  })

  it('costos auxiliares con códigos únicos', () => {
    const aux = {
      code: 'consumables',
      label: 'Consumibles',
      component: 'AUXILIARY',
      behavior: 'PER_PLATE',
      amount: { amount: 100, basis: 'NET', vatRecoverable: true },
      recoveryConfig: { recovery: 'IN_PRICE' },
    }
    const path = `${P}costProfile.auxiliaryCosts`
    expect(validateCalculationRequest(mutated(path, [aux])).ok).toBe(true)
    expect(hasIssue(mutated(path, [aux, aux]), `${path}[1].code`, 'DUPLICATE')).toBe(true)
  })
})

describe('SalesChannel', () => {
  it('la comisión es una fracción [0, 1)', () => {
    expect(hasIssue(mutated(`${P}channel.commission`, 13), `${P}channel.commission`, 'RANGE')).toBe(true)
    expect(validateCalculationRequest(mutated(`${P}channel.commission`, 0.13)).ok).toBe(true)
  })

  it('base NET/GROSS, cargo fijo y tratamiento de IVA de la comisión', () => {
    expect(validateCalculationRequest(mutated(`${P}channel.commissionBase`, 'GROSS')).ok).toBe(true)
    expect(hasIssue(mutated(`${P}channel.commissionBase`, 'TOTAL'), `${P}channel.commissionBase`, 'ENUM')).toBe(true)
    const fee = { amount: 150, basis: 'NET', vatRecoverable: true }
    expect(validateCalculationRequest(mutated(`${P}channel.fixedFee`, fee)).ok).toBe(true)
    const withVat = mutated(`${P}channel.commissionTax`, { vatCharged: true, vatRecoverable: false })
    expect(validateCalculationRequest(withVat).ok).toBe(true)
    expect(hasIssue(without(`${P}channel.commissionTax.vatCharged`), `${P}channel.commissionTax.vatCharged`, 'REQUIRED')).toBe(true)
  })

  it('el tipo de canal es una lista cerrada', () => {
    expect(validateCalculationRequest(mutated(`${P}channel.kind`, 'MARKETPLACE')).ok).toBe(true)
    expect(hasIssue(mutated(`${P}channel.kind`, 'TIENDA'), `${P}channel.kind`, 'ENUM')).toBe(true)
  })
})

describe('Material y Machine', () => {
  it('overrides de merma y de falla del material respetan sus rangos', () => {
    const base = `${P}materials.pla-basic`
    expect(validateCalculationRequest(mutated(`${base}.wasteFractionOverride`, 0.05)).ok).toBe(true)
    expect(hasIssue(mutated(`${base}.wasteFractionOverride`, 5), `${base}.wasteFractionOverride`, 'RANGE')).toBe(true)
    expect(validateCalculationRequest(mutated(`${base}.failureRateOverride`, 0.2)).ok).toBe(true)
    expect(hasIssue(mutated(`${base}.failureRateOverride`, 0.99), `${base}.failureRateOverride`, 'RANGE')).toBe(true)
  })

  it('el rollo debe tener gramos netos positivos', () => {
    const path = `${P}materials.pla-basic.spool.netGrams`
    expect(hasIssue(mutated(path, 0), path, 'RANGE')).toBe(true)
  })

  it('la máquina requiere un origen de energía y uno de desgaste', () => {
    const machine = `${P}machines.printer-1`
    const noEnergy = without(`${machine}.electricityPerHourOverride`)
    expect(hasIssue(noEnergy, `${machine}.avgPowerW`, 'REQUIRED')).toBe(true)
    const noWear = without(`${machine}.wearPerHourOverride`)
    expect(hasIssue(noWear, `${machine}.wearPerHourOverride`, 'REQUIRED')).toBe(true)
  })

  it('máquina por potencia y precio/vida útil en vez de overrides', () => {
    const machine = `${P}machines.printer-1`
    let raw = without(`${machine}.electricityPerHourOverride`)
    raw = without(`${machine}.wearPerHourOverride`, raw)
    raw = mutated(`${machine}.avgPowerW`, 120, raw)
    raw = mutated(`${machine}.purchasePrice`, { amount: 450000, basis: 'GROSS', vatRecoverable: true }, raw)
    raw = mutated(`${machine}.lifetimeHours`, 8000, raw)
    raw = mutated(`${machine}.maintenanceReservePerHour`, 40, raw)
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.params.machines['printer-1']?.lifetimeHours).toBe(8000)
  })

  it('la vida útil debe ser > 0 (es divisor); la potencia negativa se rechaza', () => {
    const machine = `${P}machines.printer-1`
    expect(hasIssue(mutated(`${machine}.lifetimeHours`, 0), `${machine}.lifetimeHours`, 'RANGE')).toBe(true)
    expect(hasIssue(mutated(`${machine}.avgPowerW`, -1), `${machine}.avgPowerW`, 'RANGE')).toBe(true)
  })
})

describe('PostProcessService', () => {
  const service = `${P}services.assembly`

  it('el ensamblaje debe ser PER_EXTRA_PART (única fuente de verdad)', () => {
    expect(hasIssue(mutated(`${service}.behavior`, 'PER_UNIT'), `${service}.behavior`, 'INCONSISTENT')).toBe(true)
  })

  it('NRE como servicio ONE_OFF con SEPARATE_LINE por defecto', () => {
    const modeling = valueAt(`${P}services.modeling-3d`) as { behavior: string; defaultRecovery: { recovery: string } }
    expect(modeling.behavior).toBe('ONE_OFF')
    expect(modeling.defaultRecovery.recovery).toBe('SEPARATE_LINE')
    expect(validateCalculationRequest(mutated('input.services', [{ serviceId: 'modeling-3d', active: true }])).ok).toBe(true)
  })

  it('un servicio no puede declarar FAILURE ni minutos negativos', () => {
    expect(hasIssue(mutated(`${service}.component`, 'FAILURE'), `${service}.component`, 'INCONSISTENT')).toBe(true)
    expect(hasIssue(mutated(`${service}.laborMinutes`, -5), `${service}.laborMinutes`, 'RANGE')).toBe(true)
  })

  it('la recuperación por defecto con amortización exige ONE_OFF', () => {
    const raw = mutated(`${service}.defaultRecovery`, { recovery: 'IN_PRICE', amortization: { overUnits: 10 } })
    expect(hasIssue(raw, `${service}.defaultRecovery.amortization`, 'INCONSISTENT')).toBe(true)
  })
})

describe('snapshot', () => {
  it('exige moneda CLP, fecha de resolución válida y catálogos no vacíos', () => {
    expect(hasIssue(mutated(`${P}currency`, 'USD'), `${P}currency`, 'ENUM')).toBe(true)
    expect(hasIssue(mutated(`${P}resolvedAt`, '2026-10-08'), `${P}resolvedAt`, 'FORMAT')).toBe(true)
    expect(hasIssue(mutated(`${P}materials`, {}), `${P}materials`, 'EMPTY')).toBe(true)
    expect(hasIssue(mutated(`${P}machines`, {}), `${P}machines`, 'EMPTY')).toBe(true)
    expect(validateCalculationRequest(mutated(`${P}services`, {}, mutated('input.services', []))).ok).toBe(true)
  })

  it('cada perfil exige su referencia (id + revisión) para el replay', () => {
    expect(hasIssue(without(`${P}costProfile.ref`), `${P}costProfile.ref`, 'REQUIRED')).toBe(true)
    expect(hasIssue(mutated(`${P}pricingProfile.ref.revision`, 0), `${P}pricingProfile.ref.revision`, 'RANGE')).toBe(true)
  })
})

describe('ausente vs. cero en Machine y overrides opcionales', () => {
  const machine = `${P}machines.printer-1`
  const zero = { amount: 0, basis: 'NET', vatRecoverable: true }

  it('cero es un valor válido y se conserva en el resultado tipado (no se confunde con ausente)', () => {
    let raw = without(`${machine}.electricityPerHourOverride`)
    raw = without(`${machine}.wearPerHourOverride`, raw)
    raw = mutated(`${machine}.avgPowerW`, 0, raw)
    raw = mutated(`${machine}.purchasePrice`, zero, raw)
    raw = mutated(`${machine}.lifetimeHours`, 8000, raw)
    raw = mutated(`${machine}.residualValue`, zero, raw)
    raw = mutated(`${machine}.maintenanceReservePerHour`, 0, raw)
    raw = mutated(`${machine}.supervisionRatioOverride`, 0, raw)
    raw = mutated(`${machine}.failureRateOverride`, 0, raw)
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const value = result.value.params.machines['printer-1']
    expect(value?.avgPowerW).toBe(0)
    expect(value?.purchasePrice?.amount).toBe(0)
    expect(value?.residualValue?.amount).toBe(0)
    expect(value?.maintenanceReservePerHour).toBe(0)
    expect(value?.supervisionRatioOverride).toBe(0)
    expect(value?.failureRateOverride).toBe(0)
    for (const key of ['avgPowerW', 'maintenanceReservePerHour', 'supervisionRatioOverride', 'failureRateOverride']) {
      expect(Object.keys(value ?? {}).includes(key)).toBe(true)
    }
  })

  it('overrides de energía y desgaste en 0 cuentan como origen válido', () => {
    let raw = mutated(`${machine}.electricityPerHourOverride`, zero)
    raw = mutated(`${machine}.wearPerHourOverride`, 0, raw)
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.params.machines['printer-1']?.wearPerHourOverride).toBe(0)
  })

  it('ausente no es cero: sin ningún origen de energía o de desgaste es REQUIRED', () => {
    const noEnergy = without(`${machine}.electricityPerHourOverride`)
    expect(hasIssue(noEnergy, `${machine}.avgPowerW`, 'REQUIRED')).toBe(true)
    const noWear = without(`${machine}.wearPerHourOverride`)
    expect(hasIssue(noWear, `${machine}.wearPerHourOverride`, 'REQUIRED')).toBe(true)
  })

  it('para desgastar por derivación se requieren precio de compra Y vida útil', () => {
    let raw = without(`${machine}.wearPerHourOverride`)
    raw = mutated(`${machine}.purchasePrice`, zero, raw)
    expect(hasIssue(raw, `${machine}.wearPerHourOverride`, 'REQUIRED')).toBe(true)
    raw = mutated(`${machine}.lifetimeHours`, 8000, raw)
    expect(validateCalculationRequest(raw).ok).toBe(true)
  })

  it('null no es "ausente": es un error de tipo, tanto en Machine como en Material y Service', () => {
    expect(hasIssue(mutated(`${machine}.avgPowerW`, null), `${machine}.avgPowerW`, 'TYPE')).toBe(true)
    expect(hasIssue(mutated(`${machine}.wearPerHourOverride`, null), `${machine}.wearPerHourOverride`, 'TYPE')).toBe(true)
    const material = `${P}materials.pla-basic`
    expect(hasIssue(mutated(`${material}.wasteFractionOverride`, null), `${material}.wasteFractionOverride`, 'TYPE')).toBe(true)
    const service = `${P}services.assembly`
    expect(hasIssue(mutated(`${service}.laborRateOverride`, null), `${service}.laborRateOverride`, 'TYPE')).toBe(true)
  })

  it('un override en 0 de Material o Service se conserva (override a cero ≠ heredar)', () => {
    let raw = mutated(`${P}materials.pla-basic.wasteFractionOverride`, 0)
    raw = mutated(`${P}materials.pla-basic.failureRateOverride`, 0, raw)
    raw = mutated(`${P}services.assembly.laborRateOverride`, 0, raw)
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const material = result.value.params.materials['pla-basic']
    expect(material?.wasteFractionOverride).toBe(0)
    expect(material?.failureRateOverride).toBe(0)
    expect(result.value.params.services.assembly?.laborRateOverride).toBe(0)
    const plain = validateCalculationRequest(validRequestRaw())
    if (plain.ok) {
      expect(Object.keys(plain.value.params.materials['pla-basic'] ?? {}).includes('wasteFractionOverride')).toBe(false)
    }
  })
})

describe('ensamblaje: se cobra una sola vez', () => {
  const secondAssembly = (): unknown => {
    const copy = JSON.parse(JSON.stringify(valueAt(`${P}services.assembly`))) as { ref: { id: string } }
    copy.ref.id = 'assembly-2'
    return copy
  }
  const withTwoAssemblies = (flags: [boolean, boolean]) => {
    let raw = mutated(`${P}services.assembly-2`, secondAssembly())
    raw = mutated(
      'input.services',
      [
        { serviceId: 'assembly', active: flags[0] },
        { serviceId: 'assembly-2', active: flags[1] },
      ],
      raw,
    )
    return raw
  }

  it('dos servicios de ensamblaje activos a la vez son inconsistentes', () => {
    expect(hasIssue(withTwoAssemblies([true, true]), 'input.services', 'INCONSISTENT')).toBe(true)
  })

  it('uno activo y otro inactivo es válido; también ninguno activo', () => {
    expect(validateCalculationRequest(withTwoAssemblies([true, false])).ok).toBe(true)
    expect(validateCalculationRequest(withTwoAssemblies([false, true])).ok).toBe(true)
    expect(validateCalculationRequest(withTwoAssemblies([false, false])).ok).toBe(true)
  })

  it('un servicio no-ensamblaje no cuenta como ensamblaje', () => {
    const raw = mutated('input.services', [
      { serviceId: 'assembly', active: true },
      { serviceId: 'modeling-3d', active: true },
    ])
    expect(validateCalculationRequest(raw).ok).toBe(true)
  })
})

describe('purchaseVatRate (tasa del IVA de las compras)', () => {
  it('es obligatoria y es una fracción [0, 1)', () => {
    expect(hasIssue(without(`${P}taxProfile.purchaseVatRate`), `${P}taxProfile.purchaseVatRate`, 'REQUIRED')).toBe(true)
    expect(hasIssue(mutated(`${P}taxProfile.purchaseVatRate`, 19), `${P}taxProfile.purchaseVatRate`, 'RANGE')).toBe(true)
  })

  it('es independiente del régimen: NOT_REGISTERED cobra 0 en ventas pero paga IVA en compras', () => {
    let raw = mutated(`${P}taxProfile.regime`, 'NOT_REGISTERED')
    raw = mutated(`${P}taxProfile.vatRate`, 0, raw)
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.params.taxProfile.vatRate).toBe(0)
      expect(result.value.params.taxProfile.purchaseVatRate).toBe(0.19)
    }
  })
})
