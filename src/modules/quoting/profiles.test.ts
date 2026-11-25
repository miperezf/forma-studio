import { describe, expect, it } from 'vitest'
import { resolveShopProfiles, toParameterSnapshotRaw } from './profiles'
import { BETA_MATERIALS, BETA_PRINTERS, BETA_SETTINGS } from './testing/shop-fixtures'

const resolve = (settings: Record<string, unknown> = {}, printers: unknown[] = BETA_PRINTERS, materials: unknown[] = BETA_MATERIALS) =>
  resolveShopProfiles({ shopSettings: { ...BETA_SETTINGS, ...settings }, printers, materials })

describe('perfiles tipados y revisionados desde los datos de la Beta', () => {
  it('convierte porcentajes a fracciones una sola vez', () => {
    const result = resolve()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.pricing).toMatchObject({ targetMargin: 0.35, minMargin: 0.25, onBelowMin: 'WARN', roundingStep: 100, discountTiers: [] })
    expect(result.value.cost.failureRate).toBe(0.05)
    expect(result.value.tax).toMatchObject({ regime: 'VAT_REGISTERED', vatRate: 0.19, purchaseVatRate: 0.19, customerPriceMode: 'GROSS', regimeConfirmed: false })
  })

  it('D2: la confirmación del régimen viene de la configuración (por defecto, sin confirmar)', () => {
    const confirmed = resolve({ taxRegime: 'NOT_REGISTERED', taxRate: 0, taxRegimeConfirmed: true })
    expect(confirmed.ok && confirmed.value.tax).toMatchObject({ regime: 'NOT_REGISTERED', vatRate: 0, regimeConfirmed: true })
    const invalid = resolve({ taxRegimeConfirmed: 'sí' })
    expect(invalid.ok).toBe(false)
  })

  it('mantenimiento = presupuesto / horas (reserva por hora)', () => {
    const result = resolve()
    expect(result.ok && result.value.machines['MAC-001']?.maintenanceReservePerHour === 12).toBe(true)
  })

  it('revisiones: las de la Beta se respetan; sin revisión = 1', () => {
    const result = resolve({ revision: 4 }, [{ ...BETA_PRINTERS[0], revision: 3 }])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.cost.ref).toEqual({ id: 'cost-shop', revision: 4 })
    expect(result.value.pricing.ref.revision).toBe(4)
    expect(result.value.machines['MAC-001']?.ref).toEqual({ id: 'MAC-001', revision: 3 })
    expect(result.value.materials['MAT-001']?.ref).toEqual({ id: 'MAT-001', revision: 1 })
  })

  it('D2: el régimen es explícito; no afecto ⇒ tasa 0', () => {
    const result = resolve({ taxRegime: 'NOT_REGISTERED', taxRate: 0 })
    expect(result.ok && result.value.tax.regime === 'NOT_REGISTERED' && result.value.tax.vatRate === 0).toBe(true)
  })

  it('D2: el régimen NO se deduce de la tasa: sin régimen o con régimen y tasa incoherentes ⇒ error', () => {
    expect(resolve({ taxRegime: undefined }).ok).toBe(false)
    expect(resolve({ taxRegime: 'NOT_REGISTERED', taxRate: 19 }).ok).toBe(false)
    expect(resolve({ taxRegime: 'VAT_REGISTERED', taxRate: 0 }).ok).toBe(false)
  })

  const corrupt: [string, Record<string, unknown>][] = [
    ['margen mínimo > objetivo', { minMargin: 40 }],
    ['fallas negativas', { failureRate: -1 }],
    ['redondeo no soportado', { priceRounding: 7 }],
    ['política desconocida', { onBelowMin: 'IGNORE' }],
    ['tarifa vacía (vacío ≠ 0)', { laborPerHour: '' }],
    ['electricidad null', { energyPerKwh: null }],
    ['IVA ausente', { taxRate: undefined }],
  ]
  it.each(corrupt)('rechaza configuración corrupta: %s', (_name, settings) => {
    const result = resolve(settings)
    expect(result.ok).toBe(false)
  })

  it('rechaza una impresora con residual > precio o vida 0, con la ruta del problema', () => {
    const result = resolve({}, [{ ...BETA_PRINTERS[0], residualValue: 999999 }])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error[0]?.path).toContain('printers[0]')
    expect(resolve({}, [{ ...BETA_PRINTERS[0], lifeHours: 0 }]).ok).toBe(false)
  })

  it('snapshot: solo el material, la máquina y el canal usados; montos de compra BRUTOS (D1)', () => {
    const profiles = resolve()
    if (!profiles.ok) throw new Error('perfiles')
    const snapshot = toParameterSnapshotRaw(profiles.value, { materialId: 'MAT-001', machineId: 'MAC-001', channelId: 'web' }, '2026-10-20T15:00:00.000Z')
    expect(snapshot.ok).toBe(true)
    if (!snapshot.ok) return
    const s = snapshot.value as { materials: Record<string, unknown>; machines: Record<string, { purchasePrice: unknown }>; channel: Record<string, unknown> }
    expect(Object.keys(s.materials)).toEqual(['MAT-001'])
    expect(s.machines['MAC-001']?.purchasePrice).toEqual({ amount: 420000, basis: 'GROSS', vatRecoverable: true })
    expect(s.channel).toMatchObject({ commission: 0.045, fixedFee: { amount: 100, basis: 'GROSS', vatRecoverable: false } })
  })

  it('material, máquina o canal inexistente: error explícito, nunca un valor inventado', () => {
    const profiles = resolve()
    if (!profiles.ok) throw new Error('perfiles')
    const result = toParameterSnapshotRaw(profiles.value, { materialId: 'MAT-999', machineId: 'MAC-001', channelId: 'tiktok' }, '2026-10-20T15:00:00.000Z')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.map((i) => i.path)).toEqual(['materialId', 'channelId'])
  })
})
