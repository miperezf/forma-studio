import { err, ok, type Result } from '../result'
import {
  childPath,
  ID_PATTERN,
  readPattern,
  readRecord,
  take,
  type Issue,
} from '../validation'
import { parseRevision, type Revision } from './revision'

/** Referencia exacta a una revisión de una entidad de configuración. */
export interface EntityRef {
  readonly id: string
  readonly revision: Revision
}

export function parseEntityRef(value: unknown, path: string): Result<EntityRef, readonly Issue[]> {
  const issues: Issue[] = []
  const record = readRecord(issues, path, value, ['id', 'revision'])
  if (record === undefined) return err(issues)
  const id = readPattern(issues, childPath(path, 'id'), record.id, ID_PATTERN, 'letras, números, _ . -')
  const revision = take(issues, parseRevision(record.revision, childPath(path, 'revision')))
  if (id === undefined || revision === undefined) return err(issues)
  return ok({ id, revision })
}

export function entityRefKey(ref: EntityRef): string {
  return `${ref.id}@${String(ref.revision)}`
}

export function sameEntityRef(a: EntityRef, b: EntityRef): boolean {
  return a.id === b.id && a.revision === b.revision
}
