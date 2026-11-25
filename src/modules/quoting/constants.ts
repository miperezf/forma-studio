/** Conversiones de unidades de la UI (porcentajes, kilos) a las del motor (fracciones, gramos). */
export const PERCENT = 100
export const GRAMS_PER_KG = 1000

/** IVA que cobran los proveedores en Chile (independiente del régimen del taller). */
export const CHILE_PURCHASE_VAT_RATE = 0.19

/** Límites del formulario (mismos que la Beta 0.5.2). */
export const LIMITS = {
  quantity: 100_000,
  partsPerPlate: 1_000,
  partsPerUnit: 1_000,
  batches: 10_000,
  grams: 1_000_000,
  hours: 10_000,
  minutes: 10_000,
  money: 1_000_000_000,
  marginPct: 90,
  validDays: 365,
  project: 90,
  componentName: 60,
  terms: 250,
  failurePct: 99,
  supervision: 10,
  /** AMS / AMS lite: hasta 4 filamentos por placa (1 principal + 3 adicionales). */
  amsSlots: 4,
  /** Placas distintas de un mismo producto (perfiles de MakerWorld con varias placas). */
  plates: 8,
  /** Texto de trazabilidad de un archivo importado (nombre, versión del laminador, impresora). */
  importText: 120,
} as const

/** Número del primer color ADICIONAL de una placa multicolor (el color 1 es el filamento principal). */
export const FIRST_EXTRA_SLOT = 2

/** Número de la primera placa ADICIONAL de un producto con varias placas (la placa 1 es la del formulario base). */
export const FIRST_EXTRA_PLATE = 2

/** Pasos de redondeo comercial que ofrece la Beta (0 = sin redondeo). */
export const ROUNDING_STEPS = [0, 10, 100, 500, 1000] as const

/** Revisión inicial de un perfil sin historial. */
export const FIRST_REVISION = 1

/** Identificadores fijos de los perfiles del taller y de los servicios del sistema. */
export const PROFILE_IDS = {
  cost: 'cost-shop',
  pricing: 'pricing-shop',
  tax: 'tax-shop',
  finishing: 'finishing',
  assembly: 'assembly',
} as const

/** Códigos de costos adicionales de la cotización (el motor les antepone `extra:`). */
export const EXTRA_CODES = { design: 'design', packaging: 'packaging' } as const

/** Motivo auditable del ajuste de margen hecho desde el cotizador (D12). */
export const TARGET_MARGIN_REASON = 'Ajuste en el cotizador'

/** Canales de la Beta 0.5.2 (mismos valores), ahora con revisión. Comisión sin IVA (D6, provisional). */
export const DEFAULT_CHANNELS = Object.freeze([
  { id: 'direct', name: 'Venta directa', kind: 'DIRECT', rate: 0, fixed: 0, revision: FIRST_REVISION },
  { id: 'instagram', name: 'Instagram', kind: 'INSTAGRAM', rate: 0.03, fixed: 0, revision: FIRST_REVISION },
  { id: 'web', name: 'Tienda web', kind: 'WEB', rate: 0.045, fixed: 100, revision: FIRST_REVISION },
  { id: 'marketplace', name: 'Marketplace', kind: 'MARKETPLACE', rate: 0.12, fixed: 250, revision: FIRST_REVISION },
] as const)


/** Cuántos problemas se muestran en un mensaje de error (el resto queda en el detalle). */
export const MAX_ISSUES_IN_MESSAGE = 3
export const MAX_PATHS_IN_MESSAGE = 2
