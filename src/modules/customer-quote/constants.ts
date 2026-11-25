/** Versión del esquema del documento comercial (sube si cambian sus campos). */
export const CUSTOMER_QUOTE_SCHEMA_VERSION = 1

/** Agrupación de miles en CLP: 1.234.567 */
export const THOUSANDS_GROUP = 3
export const THOUSANDS_SEPARATOR = '.'

/** Límites de texto de un documento comercial. */
export const MAX_TEXT_LENGTH = 500
export const MAX_LINES = 50
export const MAX_VALID_DAYS = 365

/** Formato de fecha AAAA-MM-DD. */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Vigencia por defecto de un documento heredado de la Beta sin `validDays`. */
export const LEGACY_DEFAULT_VALID_DAYS = 7
