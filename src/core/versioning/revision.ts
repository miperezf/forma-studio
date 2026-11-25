import type { Brand } from '../types'
import { ok, type Result } from '../result'
import type { Issue } from '../validation'
import { parseSafeInteger } from '../money'

/** Número de revisión de una entidad de configuración (≥ 1, monótono). */
export type Revision = Brand<number, 'Revision'>

export const FIRST_REVISION = 1 as Revision

export function parseRevision(value: unknown, path: string): Result<Revision, Issue> {
  const parsed = parseSafeInteger(value, path, 'POSITIVE')
  return parsed.ok ? ok(parsed.value as Revision) : parsed
}

export function nextRevision(revision: Revision): Revision {
  return (revision + 1) as Revision
}
