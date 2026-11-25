import type { QuoteContext } from '../service'

/** Datos tal como los guarda la Beta 0.5.2 (seed): valores de EJEMPLO, no parámetros de negocio validados. */
export const BETA_SETTINGS = {
  targetMargin: 35,
  minMargin: 25,
  taxRegime: 'VAT_REGISTERED',
  taxRate: 19,
  energyPerKwh: 210,
  laborPerHour: 4500,
  supervisionFactor: 0.15,
  preparationMinutes: 20,
  packingPerUnit: 350,
  failureRate: 5,
  priceRounding: 100,
  validDays: 7,
  terms: 'Plazos y forma de pago sujetos a confirmación.',
}
export const BETA_PRINTERS = [
  { id: 'MAC-001', name: 'Bambu Lab A1', technology: 'FDM', purchasePrice: 420000, residualValue: 40000, lifeHours: 5000, averageWatts: 95, maintenanceBudget: 60000, maintenanceHours: 5000, revision: 1, isExample: true },
]
export const BETA_MATERIALS = [
  { id: 'MAT-001', name: 'PLA Basic', brand: 'Bambu Lab', color: 'Negro carbón', hex: '#374151', priceKg: 22000, stockKg: 2.4, type: 'PLA' },
  { id: 'MAT-002', name: 'PETG', brand: 'Elegoo', color: 'Blanco', hex: '#f0f0ec', priceKg: 19500, stockKg: 1.7, type: 'PETG' },
]

/** Formulario por defecto del cotizador de la Beta (valores de los inputs). */
export const DEFAULT_FORM: Readonly<Record<string, string>> = {
  clientId: 'CLI-001',
  project: 'Macetero geométrico',
  machineId: 'MAC-001',
  materialId: 'MAT-001',
  quantity: '8',
  partsPerPlate: '4',
  plateWeightGr: '340',
  plateHours: '5.5',
  channel: 'direct',
}

export function context(settings: Record<string, unknown> = {}, extra: Partial<QuoteContext> = {}): QuoteContext {
  return {
    shop: { shopSettings: { ...BETA_SETTINGS, ...settings }, printers: BETA_PRINTERS, materials: BETA_MATERIALS },
    clientName: 'Camila Rodríguez',
    resolvedAt: '2026-10-20T15:00:00.000Z',
    today: '2026-10-20',
    ...extra,
  }
}

export const form = (over: Record<string, string> = {}): Record<string, string> => ({ ...DEFAULT_FORM, ...over })

/** Claves internas que JAMÁS pueden aparecer en un CustomerQuote ni en su texto/impresión (doc 14). */
export const FORBIDDEN_KEYS = [
  'economicCost', 'margin', 'realMargin', 'commercialMargin', 'commission', 'costBreakdown', 'breakdown', 'snapshot',
  'inputSnapshot', 'formState', 'markup', 'realMarkup', 'commercialMarkup', 'failureRate', 'rawAmount', 'pooledAmount',
  'taxRecoverable', 'vatRecoverable', 'machinePurchasePrice', 'purchasePrice', 'laborRate', 'ratePerHour', 'costProfile',
  'pricingProfile', 'utility', 'commercialUtility', 'realUtility', 'pricingPool', 'costBasis', 'sourceItemCodes',
  'floorNetTotal', 'breakEvenNetTotal', 'targetNetTotal', 'absorbedCost', 'deferredCost', 'calculation', 'request',
  'output', 'params', 'profileRefs', 'issuance', 'flags',
]

/** Palabras que delatan información interna en un texto para el cliente. */
export const FORBIDDEN_WORDS = /costo|margen|comisi[oó]n|utilidad|markup|desgaste|depreciaci|electricidad|supervisi|fallas?|pool|snapshot|perfil/i
