/** Identificadores de entidad: seguros para rutas de Firestore (sin `/`, no empiezan con `.`). */
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

/** Códigos de ítem de costo: igual que ID_PATTERN más `:` (p. ej. `service:assembly`). */
export const ITEM_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/
