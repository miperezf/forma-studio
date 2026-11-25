import { describe, expect, it } from 'vitest'
import {
  CALCULATION_V1,
  BelowMinPolicyId,
  CalculationMode,
  CostBehavior,
  CostComponent,
  FlagCode,
  OverrideKind,
  Recovery,
  parseCalculationVersion,
} from './index'
import { mutated, validRequestRaw, valueAt, without } from '../testing/fixtures'
import { validateCalculationRequest, validateParameterSnapshot, validateQuoteInput } from './index'
import type { Issue } from '../../../core/validation'

function issuesOf(raw: unknown): readonly Issue[] {
  const result = validateCalculationRequest(raw)
  return result.ok ? [] : result.error
}

/** `ruta:código` ordenado, para comparar listas completas de problemas. */
function summary(raw: unknown): string[] {
  return issuesOf(raw)
    .map((i) => `${i.path}:${i.code}`)
    .sort()
}

function hasIssue(raw: unknown, path: string, code: string): boolean {
  return issuesOf(raw).some((i) => i.path === path && i.code === code)
}

describe('enumeraciones', () => {
  it('CostBehavior contiene exactamente los 5 comportamientos acordados', () => {
    expect(Object.values(CostBehavior).sort()).toEqual(
      ['ONE_OFF', 'PER_BATCH', 'PER_EXTRA_PART', 'PER_PLATE', 'PER_UNIT'],
    )
  })

  it('Recovery y BelowMinPolicyId contienen lo decidido', () => {
    expect(Object.values(Recovery).sort()).toEqual(['ABSORBED', 'IN_PRICE', 'SEPARATE_LINE'])
    expect(Object.values(BelowMinPolicyId).sort()).toEqual(['BLOCK', 'CAP', 'WARN'])
    expect(Object.values(CalculationMode).sort()).toEqual(['QUOTE', 'TEST'])
  })

  it('cada clave coincide con su valor (evita typos silenciosos)', () => {
    for (const enumeration of [CostBehavior, CostComponent, Recovery, OverrideKind, FlagCode]) {
      for (const [key, value] of Object.entries(enumeration)) expect(key).toBe(value)
    }
  })

  it('los 8 tipos de override cerrados', () => {
    expect(Object.values(OverrideKind).sort()).toEqual([
      'DISCOUNT',
      'FAILURE_RATE',
      'FIXED_LINE_PRICE',
      'FIXED_UNIT_PRICE',
      'ITEM_RECOVERY',
      'MIN_MARGIN',
      'ROUNDING',
      'TARGET_MARGIN',
    ])
  })
})

describe('calculationVersion', () => {
  const cases: [unknown, boolean][] = [
    ['v1', true],
    ['v12', true],
    ['v0', false],
    ['1', false],
    ['v1.1', false],
    ['V1', false],
    [1, false],
    [undefined, false],
  ]
  it.each(cases)('parseCalculationVersion(%s) válido = %s', (value, valid) => {
    expect(parseCalculationVersion(value, 'v').ok).toBe(valid)
  })

  it('CALCULATION_V1 es "v1"', () => {
    expect(CALCULATION_V1).toBe('v1')
  })
})

describe('solicitud válida', () => {
  it('la solicitud de referencia se valida y conserva los valores tipados', () => {
    const result = validateCalculationRequest(validRequestRaw())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { input, params } = result.value
    expect(input.quantity).toBe(1)
    expect(input.plates).toHaveLength(1)
    expect(params.pricingProfile.targetMargin).toBe(0.35)
    expect(params.pricingProfile.minMargin).toBe(0.25)
    expect(params.pricingProfile.onBelowMin).toBe('WARN')
    expect(params.pricingProfile.discountTiers).toHaveLength(5)
    expect(params.taxProfile.vatRate).toBe(0.19)
    expect(params.costProfile.failure.affectedComponents).toEqual([
      'MATERIAL',
      'ELECTRICITY',
      'WEAR',
      'SUPERVISION',
    ])
    expect(params.resolvedAt).toBe('2026-10-08T12:00:00.000Z')
  })

  it('es determinista: validar dos veces da el mismo resultado', () => {
    expect(validateCalculationRequest(validRequestRaw())).toEqual(validateCalculationRequest(validRequestRaw()))
  })

  it('no muta la entrada', () => {
    const raw = validRequestRaw()
    const before = JSON.stringify(raw)
    validateCalculationRequest(raw)
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('acepta modo TEST sin overrides', () => {
    expect(validateCalculationRequest(mutated('mode', 'TEST')).ok).toBe(true)
  })

  it('validateQuoteInput y validateParameterSnapshot validan por separado', () => {
    expect(validateQuoteInput(valueAt('input')).ok).toBe(true)
    expect(validateParameterSnapshot(valueAt('params')).ok).toBe(true)
    expect(validateQuoteInput({ quantity: 0 }).ok).toBe(false)
  })

  it('acepta un ONE_OFF IN_PRICE con amortización explícita', () => {
    const raw = mutated('input.extraCosts', [
      {
        code: 'dev-cost',
        label: 'Desarrollo inicial',
        component: 'DESIGN',
        behavior: 'ONE_OFF',
        amount: { amount: 40000, basis: 'NET', vatRecoverable: true },
        recoveryConfig: { recovery: 'IN_PRICE', amortization: { overUnits: 100 } },
      },
    ])
    const result = validateCalculationRequest(raw)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.input.extraCosts[0]?.recoveryConfig.amortization?.overUnits).toBe(100)
  })
})

describe('estructura de la solicitud', () => {
  it('rechaza algo que no es objeto', () => {
    expect(summary(null)).toEqual([':TYPE'])
    expect(summary(undefined)).toEqual([':REQUIRED'])
  })

  it('rechaza claves desconocidas en cualquier nivel (un typo nunca pasa en silencio)', () => {
    expect(hasIssue(mutated('margen', 60), 'margen', 'UNKNOWN_KEY')).toBe(true)
    expect(hasIssue(mutated('params.pricingProfile.margen', 0.6), 'params.pricingProfile.margen', 'UNKNOWN_KEY')).toBe(true)
    expect(hasIssue(mutated('input.plates[0].grams', 5), 'input.plates[0].grams', 'UNKNOWN_KEY')).toBe(true)
  })

  const missing: [string, string][] = [
    ['calculationVersion', 'calculationVersion'],
    ['mode', 'mode'],
    ['input', 'input'],
    ['params', 'params'],
    ['overrides', 'overrides'],
    ['input.quantity', 'input.quantity'],
    ['params.pricingProfile.targetMargin', 'params.pricingProfile.targetMargin'],
    ['params.taxProfile.vatRate', 'params.taxProfile.vatRate'],
    ['params.channel.commissionBase', 'params.channel.commissionBase'],
  ]
  it.each(missing)('falta %s → REQUIRED en %s', (removed, path) => {
    expect(hasIssue(without(removed), path, 'REQUIRED')).toBe(true)
  })

  it('acumula varios problemas independientes en una sola pasada', () => {
    let raw = mutated('input.quantity', 0)
    raw = mutated('params.pricingProfile.targetMargin', 35, raw)
    raw = mutated('mode', 'DEMO', raw)
    expect(summary(raw)).toEqual([
      'input.quantity:RANGE',
      'mode:ENUM',
      'params.pricingProfile.targetMargin:RANGE',
    ])
  })
})

describe('QuoteInput', () => {
  const cases: [string, string, unknown, string][] = [
    ['cantidad cero', 'input.quantity', 0, 'RANGE'],
    ['cantidad decimal', 'input.quantity', 2.5, 'NOT_INTEGER'],
    ['cantidad como texto', 'input.quantity', '10', 'TYPE'],
    ['lotes cero', 'input.batches', 0, 'RANGE'],
    ['gramos cero', 'input.plates[0].filaments[0].grams', 0, 'RANGE'],
    ['gramos negativos', 'input.plates[0].filaments[0].grams', -5, 'RANGE'],
    ['horas cero', 'input.plates[0].printHours', 0, 'RANGE'],
    ['horas negativas', 'input.plates[0].printHours', -1, 'RANGE'],
    ['piezas por placa cero', 'input.plates[0].partsPerPlate', 0, 'RANGE'],
    ['piezas por unidad decimal', 'input.plates[0].partsPerUnit', 1.5, 'NOT_INTEGER'],
    ['origen inválido', 'input.plates[0].source', 'WEB', 'ENUM'],
    ['id con espacio', 'input.plates[0].id', 'placa 1', 'FORMAT'],
    ['canal con barra', 'input.channelId', 'a/b', 'FORMAT'],
    ['etiqueta vacía', 'input.plates[0].label', '   ', 'EMPTY'],
    ['sin placas', 'input.plates', [], 'EMPTY'],
    ['sin filamentos', 'input.plates[0].filaments', [], 'EMPTY'],
  ]
  it.each(cases)('%s → %s %s', (_name, path, value, code) => {
    expect(hasIssue(mutated(path, value), path, code)).toBe(true)
  })

  it('NaN e Infinity no son números válidos', () => {
    expect(hasIssue(mutated('input.plates[0].printHours', Number.NaN), 'input.plates[0].printHours', 'NOT_FINITE')).toBe(true)
    expect(
      hasIssue(mutated('input.plates[0].filaments[0].grams', Number.POSITIVE_INFINITY), 'input.plates[0].filaments[0].grams', 'NOT_FINITE'),
    ).toBe(true)
  })

  it('unidades, lotes y placas son magnitudes distintas: no hay relación universal entre ellas', () => {
    // Más lotes que unidades, y más lotes que placas, son entradas válidas hasta confirmar el modelo.
    const moreBatchesThanUnits = mutated('input.batches', 5, mutated('input.quantity', 2))
    expect(validateCalculationRequest(moreBatchesThanUnits).ok).toBe(true)
    const fewUnitsManyPlates = mutated('input.plates[0].partsPerPlate', 1, mutated('input.quantity', 30))
    expect(validateCalculationRequest(fewUnitsManyPlates).ok).toBe(true)
    // Cada magnitud se valida por separado.
    expect(hasIssue(mutated('input.batches', 0), 'input.batches', 'RANGE')).toBe(true)
    expect(hasIssue(mutated('input.batches', 1.5), 'input.batches', 'NOT_INTEGER')).toBe(true)
  })

  it('origen TEST exige sourceTestId', () => {
    expect(hasIssue(mutated('input.plates[0].source', 'TEST'), 'input.plates[0].sourceTestId', 'REQUIRED')).toBe(true)
    const raw = mutated('input.plates[0].sourceTestId', 'test-05', mutated('input.plates[0].source', 'TEST'))
    expect(validateCalculationRequest(raw).ok).toBe(true)
  })

  it('placas, servicios y extras con identificador repetido', () => {
    const plate = valueAt('input.plates[0]')
    expect(hasIssue(mutated('input.plates', [plate, plate]), 'input.plates[1].id', 'DUPLICATE')).toBe(true)
    const service = { serviceId: 'assembly', active: true }
    expect(hasIssue(mutated('input.services', [service, service]), 'input.services[1].serviceId', 'DUPLICATE')).toBe(true)
    const extra = {
      code: 'packaging',
      label: 'Embalaje',
      component: 'PACKAGING',
      behavior: 'PER_UNIT',
      amount: { amount: 500, basis: 'NET', vatRecoverable: true },
      recoveryConfig: { recovery: 'IN_PRICE' },
    }
    expect(hasIssue(mutated('input.extraCosts', [extra, extra]), 'input.extraCosts[1].code', 'DUPLICATE')).toBe(true)
  })

  it('el mismo material dos veces en una placa se rechaza (deben sumarse los gramos)', () => {
    const filament = { materialId: 'pla-basic', grams: 10 }
    expect(
      hasIssue(mutated('input.plates[0].filaments', [filament, filament]), 'input.plates[0].filaments[1].materialId', 'DUPLICATE'),
    ).toBe(true)
  })

  it('un costo extra no puede declarar el componente FAILURE', () => {
    const extra = {
      code: 'x',
      label: 'x',
      component: 'FAILURE',
      behavior: 'PER_UNIT',
      amount: { amount: 1, basis: 'NET', vatRecoverable: true },
      recoveryConfig: { recovery: 'IN_PRICE' },
    }
    expect(hasIssue(mutated('input.extraCosts', [extra]), 'input.extraCosts[0].component', 'INCONSISTENT')).toBe(true)
  })

  it('la amortización solo aplica a ONE_OFF con IN_PRICE (nunca multiplicación implícita)', () => {
    const base = {
      code: 'dev',
      label: 'Desarrollo',
      component: 'DESIGN',
      amount: { amount: 1000, basis: 'NET', vatRecoverable: true },
    }
    const perUnit = { ...base, behavior: 'PER_UNIT', recoveryConfig: { recovery: 'IN_PRICE', amortization: { overUnits: 10 } } }
    expect(hasIssue(mutated('input.extraCosts', [perUnit]), 'input.extraCosts[0].recoveryConfig.amortization', 'INCONSISTENT')).toBe(true)
    const absorbed = { ...base, behavior: 'ONE_OFF', recoveryConfig: { recovery: 'ABSORBED', amortization: { overUnits: 10 } } }
    expect(hasIssue(mutated('input.extraCosts', [absorbed]), 'input.extraCosts[0].recoveryConfig.amortization', 'INCONSISTENT')).toBe(true)
    const zero = { ...base, behavior: 'ONE_OFF', recoveryConfig: { recovery: 'IN_PRICE', amortization: { overUnits: 0 } } }
    expect(hasIssue(mutated('input.extraCosts', [zero]), 'input.extraCosts[0].recoveryConfig.amortization.overUnits', 'RANGE')).toBe(true)
  })
})

describe('referencias entre entrada y snapshot', () => {
  it('material, máquina, servicio y canal deben existir en el snapshot', () => {
    expect(hasIssue(mutated('input.plates[0].filaments[0].materialId', 'otro'), 'input.plates[0].filaments[0].materialId', 'UNKNOWN_REFERENCE')).toBe(true)
    expect(hasIssue(mutated('input.plates[0].machineId', 'otra'), 'input.plates[0].machineId', 'UNKNOWN_REFERENCE')).toBe(true)
    expect(hasIssue(mutated('input.services[0].serviceId', 'fantasma'), 'input.services[0].serviceId', 'UNKNOWN_REFERENCE')).toBe(true)
    expect(hasIssue(mutated('input.channelId', 'web'), 'input.channelId', 'INCONSISTENT')).toBe(true)
  })

  it('la clave del catálogo debe coincidir con ref.id', () => {
    const material = valueAt('params.materials.pla-basic')
    const raw = mutated('params.materials', { 'pla-otro': material })
    expect(hasIssue(raw, 'params.materials.pla-otro', 'INCONSISTENT')).toBe(true)
  })

  it('un costo extra no puede colisionar con un auxiliar del perfil', () => {
    const aux = {
      code: 'consumables',
      label: 'Consumibles',
      component: 'AUXILIARY',
      behavior: 'PER_PLATE',
      amount: { amount: 100, basis: 'NET', vatRecoverable: true },
      recoveryConfig: { recovery: 'IN_PRICE' },
    }
    let raw = mutated('params.costProfile.auxiliaryCosts', [aux])
    raw = mutated('input.extraCosts', [aux], raw)
    expect(hasIssue(raw, 'input.extraCosts[0].code', 'DUPLICATE')).toBe(true)
  })
})
