import type { EntityRef } from './entity-ref'
import { compareIsoDateTime, type IsoDateTime } from './iso-date-time'
import type { Revision } from './revision'

/** Metadatos de una revisión inmutable: editar = crear una revisión nueva. */
export interface VersionMeta {
  readonly id: string
  readonly revision: Revision
  readonly effectiveFrom: IsoDateTime
  readonly supersedes?: Revision
}

export type Versioned<T> = T & VersionMeta

export function toEntityRef(meta: VersionMeta): EntityRef {
  return { id: meta.id, revision: meta.revision }
}

/**
 * Revisión vigente en `at`: entre las que ya rigen (`effectiveFrom <= at`),
 * la de mayor `effectiveFrom`; el empate lo decide la mayor revisión.
 * Función pura, usada por los repositorios (Mock y Firebase) para resolver "activa".
 */
export function resolveActiveRevision<T extends VersionMeta>(
  revisions: readonly T[],
  at: IsoDateTime,
): T | undefined {
  let best: T | undefined
  for (const candidate of revisions) {
    if (compareIsoDateTime(candidate.effectiveFrom, at) > 0) continue
    if (best === undefined) {
      best = candidate
      continue
    }
    const byDate = compareIsoDateTime(candidate.effectiveFrom, best.effectiveFrom)
    if (byDate > 0 || (byDate === 0 && candidate.revision > best.revision)) best = candidate
  }
  return best
}
