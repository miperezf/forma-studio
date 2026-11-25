/** Espacio de trabajo único del taller (multi-taller queda fuera de 1.0). */
export const WORKSPACE_ID = 'main'

/** Colecciones con un documento por entidad: clave del estado de la app → colección Firestore. */
export const ENTITY_COLLECTIONS = {
  clients: 'clients',
  materials: 'materials',
  printers: 'printers',
  projects: 'projects',
  orders: 'orders',
  quotes: 'internalQuotes',
  customerQuotes: 'customerQuotes',
  /** Productos frecuentes (0.15): plantilla de cotización reutilizable. */
  products: 'products',
} as const

/** Documentos únicos (configuración y metadatos) dentro de la colección `settings`. */
export const SINGLETON_DOCS = { shopSettings: 'shop', meta: 'meta' } as const
export const SETTINGS_COLLECTION = 'settings'
export const COUNTERS_DOC = 'counters'

/** Operaciones de entidad por lote de escritura de Firestore. */
// 240 + hasta 240 candados de pedido por lote < 500 (límite de Firestore).
export const MAX_BATCH_OPERATIONS = 240

/** Tamaño máximo de un documento Firestore (1 MiB) con margen. */
export const MAX_DOCUMENT_BYTES = 900_000

/** Identificador de documento válido: sin «/», no «.» ni «..», sin prefijo/sufijo «__». */
export const DOC_ID_PATTERN = /^(?!\.\.?$)(?!__.*__$)[^/]{1,700}$/
