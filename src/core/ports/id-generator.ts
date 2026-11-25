/** Genera identificadores de entidad (cumplen `ID_PATTERN`). */
export interface IdGenerator {
  newId(): string
}
