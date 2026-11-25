import type { IsoDateTime } from '../versioning'

/** Única fuente de "ahora". El dominio nunca lee el reloj del sistema. */
export interface Clock {
  now(): IsoDateTime
}
