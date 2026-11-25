import { describe, expect, it } from 'vitest'
import { validateCalculationRequest } from './index'
import { mutated } from '../testing/fixtures'
import type { Issue } from '../../../core/validation'

function issuesOf(raw: unknown): readonly Issue[] {
  const result = validateCalculationRequest(raw)
  return result.ok ? [] : result.error
}

function hasIssue(raw: unknown, path: string, code: string): boolean {
  return issuesOf(raw).some((i) => i.path === path && i.code === code)
}

const withOverrides = (overrides: unknown[]) => mutated('overrides', overrides)
const reason = 'Cliente recurrente, acuerdo comercial'

describe('overrides por cotización', () => {
  const valid: [string, unknown][] = [
    ['margen objetivo', { kind: 'TARGET_MARGIN', value: 0.3, reason }],
    ['margen mínimo', { kind: 'MIN_MARGIN', value: 0.2, reason }],
    ['sin descuento', { kind: 'DISCOUNT', value: { mode: 'NONE' }, reason }],
    ['descuento manual', { kind: 'DISCOUNT', value: { mode: 'MANUAL', pct: 0.1 }, reason }],
    ['tasa de falla manual', { kind: 'FAILURE_RATE', value: { mode: 'RATE', rate: 0.15 }, reason }],
    ['fallas desactivadas', { kind: 'FAILURE_RATE', value: { mode: 'DISABLED' }, reason }],
    ['redondeo', { kind: 'ROUNDING', value: { mode: 'STEP', step: 500, direction: 'UP', target: 'GROSS' }, reason }],
    ['redondeo desactivado', { kind: 'ROUNDING', value: { mode: 'NONE' }, reason }],
    ['recuperación de ítem', { kind: 'ITEM_RECOVERY', itemCode: 'service:modeling-3d', value: { recovery: 'ABSORBED' }, reason }],
    ['precio unitario fijo', { kind: 'FIXED_UNIT_PRICE', value: { customerUnitPrice: 25000 }, reason }],
    ['precio fijo de línea', { kind: 'FIXED_LINE_PRICE', itemCode: 'service:modeling-3d', value: { customerPrice: 20000 }, reason }],
  ]
  it.each(valid)('acepta %s', (_name, override) => {
    const result = validateCalculationRequest(withOverrides([override]))
    expect(result.ok).toBe(true)
  })

  it('el motivo es obligatorio y no puede estar vacío', () => {
    expect(hasIssue(withOverrides([{ kind: 'TARGET_MARGIN', value: 0.3 }]), 'overrides[0].reason', 'REQUIRED')).toBe(true)
    expect(hasIssue(withOverrides([{ kind: 'TARGET_MARGIN', value: 0.3, reason: '   ' }]), 'overrides[0].reason', 'EMPTY')).toBe(true)
    expect(hasIssue(withOverrides([{ kind: 'TARGET_MARGIN', value: 0.3, reason: 'x'.repeat(501) }]), 'overrides[0].reason', 'TOO_LONG')).toBe(true)
  })

  it('lista cerrada: tipos desconocidos y claves extra se rechazan', () => {
    expect(hasIssue(withOverrides([{ kind: 'LABOR_RATE', value: 1, reason }]), 'overrides[0].kind', 'ENUM')).toBe(true)
    expect(hasIssue(withOverrides([{ kind: 'TARGET_MARGIN', value: 0.3, reason, extra: 1 }]), 'overrides[0].extra', 'UNKNOWN_KEY')).toBe(true)
    expect(hasIssue(withOverrides([{ kind: 'TARGET_MARGIN', value: 0.3, reason, itemCode: 'x' }]), 'overrides[0].itemCode', 'UNKNOWN_KEY')).toBe(true)
  })

  const invalid: [string, unknown, string, string][] = [
    ['margen como porcentaje', { kind: 'TARGET_MARGIN', value: 30, reason }, 'overrides[0].value', 'RANGE'],
    ['descuento manual sin pct', { kind: 'DISCOUNT', value: { mode: 'MANUAL' }, reason }, 'overrides[0].value.pct', 'REQUIRED'],
    ['descuento NONE con pct', { kind: 'DISCOUNT', value: { mode: 'NONE', pct: 0.1 }, reason }, 'overrides[0].value.pct', 'INCONSISTENT'],
    ['descuento del 100 %', { kind: 'DISCOUNT', value: { mode: 'MANUAL', pct: 1 }, reason }, 'overrides[0].value.pct', 'RANGE'],
    ['falla sobre el tope', { kind: 'FAILURE_RATE', value: { mode: 'RATE', rate: 0.99 }, reason }, 'overrides[0].value.rate', 'RANGE'],
    ['falla DISABLED con tasa', { kind: 'FAILURE_RATE', value: { mode: 'DISABLED', rate: 0.1 }, reason }, 'overrides[0].value.rate', 'INCONSISTENT'],
    ['precio fijo cero', { kind: 'FIXED_UNIT_PRICE', value: { customerUnitPrice: 0 }, reason }, 'overrides[0].value.customerUnitPrice', 'RANGE'],
    ['precio fijo decimal', { kind: 'FIXED_UNIT_PRICE', value: { customerUnitPrice: 100.5 }, reason }, 'overrides[0].value.customerUnitPrice', 'NOT_INTEGER'],
    ['línea fija sin itemCode', { kind: 'FIXED_LINE_PRICE', value: { customerPrice: 100 }, reason }, 'overrides[0].itemCode', 'REQUIRED'],
    ['itemCode inválido', { kind: 'ITEM_RECOVERY', itemCode: 'con espacio', value: { recovery: 'ABSORBED' }, reason }, 'overrides[0].itemCode', 'FORMAT'],
    ['amortizar sin IN_PRICE', { kind: 'ITEM_RECOVERY', itemCode: 'x', value: { recovery: 'ABSORBED', amortization: { overUnits: 5 } }, reason }, 'overrides[0].value.amortization', 'INCONSISTENT'],
  ]
  it.each(invalid)('rechaza %s', (_name, override, path, code) => {
    expect(hasIssue(withOverrides([override]), path, code)).toBe(true)
  })

  it('no se repite el mismo tipo; los de ítem se distinguen por itemCode', () => {
    const margin = { kind: 'TARGET_MARGIN', value: 0.3, reason }
    expect(hasIssue(withOverrides([margin, margin]), 'overrides[1]', 'DUPLICATE')).toBe(true)
    const a = { kind: 'FIXED_LINE_PRICE', itemCode: 'a', value: { customerPrice: 100 }, reason }
    const b = { kind: 'FIXED_LINE_PRICE', itemCode: 'b', value: { customerPrice: 200 }, reason }
    expect(validateCalculationRequest(withOverrides([a, b])).ok).toBe(true)
    expect(hasIssue(withOverrides([a, a]), 'overrides[1]', 'DUPLICATE')).toBe(true)
  })

  it('D13: un override puede dejar el objetivo de UNA cotización bajo el mínimo; decide la política (no es dato inválido)', () => {
    expect(validateCalculationRequest(withOverrides([{ kind: 'MIN_MARGIN', value: 0.5, reason }])).ok).toBe(true)
    expect(validateCalculationRequest(withOverrides([{ kind: 'TARGET_MARGIN', value: 0.2, reason }])).ok).toBe(true)
    const both = [
      { kind: 'TARGET_MARGIN', value: 0.2, reason },
      { kind: 'MIN_MARGIN', value: 0.15, reason },
    ]
    expect(validateCalculationRequest(withOverrides(both)).ok).toBe(true)
  })

  it('el modo TEST no admite overrides', () => {
    const raw = mutated('mode', 'TEST', withOverrides([{ kind: 'TARGET_MARGIN', value: 0.3, reason }]))
    expect(hasIssue(raw, 'overrides', 'INCONSISTENT')).toBe(true)
  })

  it('la validación devuelve los overrides tipados y en el mismo orden', () => {
    const result = validateCalculationRequest(
      withOverrides([
        { kind: 'DISCOUNT', value: { mode: 'MANUAL', pct: 0.1 }, reason },
        { kind: 'TARGET_MARGIN', value: 0.3, reason },
      ]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.overrides.map((o) => o.kind)).toEqual(['DISCOUNT', 'TARGET_MARGIN'])
  })
})
