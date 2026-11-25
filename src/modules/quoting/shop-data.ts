import { z } from 'zod'
import { FIRST_REVISION, LIMITS, ROUNDING_STEPS } from './constants'
export { DEFAULT_CHANNELS } from './constants'

/**
 * Datos persistidos por la Beta (localStorage) que alimentan los perfiles. Se validan SIEMPRE al leerlos: un
 * almacenamiento corrupto produce un error explicable, nunca un precio. Unidades de la Beta: porcentajes y $/kg.
 */
/** Número guardado como número o como texto de un input. Vacío / null NO es 0: es un dato faltante. */
const numeric = () =>
  z.preprocess(
    (value) => (value === null ? undefined : typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value),
    z.number({ required_error: 'Valor requerido', invalid_type_error: 'Debe ser un número' }).finite('Debe ser un número finito'),
  )
const num = (build: (base: z.ZodNumber) => z.ZodNumber = (base) => base) =>
  z.preprocess(
    (value) => (value === null ? undefined : typeof value === 'string' ? (value.trim() === '' ? undefined : Number(value)) : value),
    build(z.number({ required_error: 'Valor requerido', invalid_type_error: 'Debe ser un número' }).finite('Debe ser un número finito')),
  )
const nonNegative = num((n) => n.min(0))
const revision = z.preprocess((value) => value ?? FIRST_REVISION, num((n) => n.int().min(FIRST_REVISION)))

export const BelowMinPolicySchema = z.enum(['WARN', 'CAP', 'BLOCK'])

export const ShopSettingsSchema = z.object({
  revision,
  targetMargin: num((n) => n.min(0).max(LIMITS.marginPct)),
  minMargin: num((n) => n.min(0).max(LIMITS.marginPct)),
  /** D2: régimen EXPLÍCITO (no se deduce de la tasa). La tasa es la del IVA de venta en % (0 si no afecto). */
  taxRegime: z.enum(['VAT_REGISTERED', 'NOT_REGISTERED'], { required_error: 'Indica el régimen tributario', invalid_type_error: 'Régimen tributario inválido' }),
  taxRate: num((n) => n.min(0).max(LIMITS.marginPct)),
  /** El propietario confirmó el régimen (p. ej. «aún no facturo» ⇒ no afecto). Sin confirmar se muestra el aviso. */
  taxRegimeConfirmed: z.boolean().default(false),
  energyPerKwh: nonNegative,
  laborPerHour: nonNegative,
  supervisionFactor: num((n) => n.min(0).max(LIMITS.supervision)),
  preparationMinutes: num((n) => n.min(0).max(LIMITS.minutes)),
  packingPerUnit: num((n) => n.min(0).max(LIMITS.money)),
  failureRate: num((n) => n.min(0).max(LIMITS.failurePct)),
  priceRounding: numeric().refine((value) => (ROUNDING_STEPS as readonly number[]).includes(value), 'Redondeo no soportado'),
  onBelowMin: BelowMinPolicySchema.default('WARN'),
  validDays: num((n) => n.int().min(1).max(LIMITS.validDays)),
  terms: z.string().max(LIMITS.terms),
})
  .refine((settings) => settings.minMargin <= settings.targetMargin, { message: 'El margen mínimo no puede superar al objetivo', path: ['minMargin'] })
  .refine((settings) => (settings.taxRegime === 'VAT_REGISTERED' ? settings.taxRate > 0 : settings.taxRate === 0), {
    message: 'Régimen y tasa incoherentes: afecto requiere tasa > 0 y no afecto, tasa 0',
    path: ['taxRate'],
  })
export type ShopSettings = z.infer<typeof ShopSettingsSchema>

export const PrinterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  technology: z.literal('FDM'),
  purchasePrice: nonNegative,
  residualValue: nonNegative,
  lifeHours: num((n) => n.positive()),
  averageWatts: nonNegative,
  maintenanceBudget: nonNegative,
  maintenanceHours: num((n) => n.positive()),
  revision,
}).refine((printer) => printer.residualValue <= printer.purchasePrice, { message: 'El valor residual no puede exceder el precio', path: ['residualValue'] })
export type Printer = z.infer<typeof PrinterSchema>

export const MaterialSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  brand: z.string().default(''),
  color: z.string().default(''),
  priceKg: nonNegative,
  revision,
})
export type Material = z.infer<typeof MaterialSchema>

/** Canal de venta (catálogo del taller). `rate` en fracción, `fixed` en CLP por transacción. */
export const ChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['DIRECT', 'INSTAGRAM', 'WEB', 'MARKETPLACE', 'OTHER']),
  rate: z.number().min(0).lt(1),
  fixed: nonNegative,
  revision,
})
export type Channel = z.infer<typeof ChannelSchema>

export interface ShopData {
  readonly shopSettings: unknown
  readonly printers: readonly unknown[]
  readonly materials: readonly unknown[]
  readonly channels?: readonly unknown[]
}
