import { err, ok, type Result } from '../../core/result'
import { DOC_ID_PATTERN, ENTITY_COLLECTIONS, MAX_DOCUMENT_BYTES, SETTINGS_COLLECTION, SINGLETON_DOCS } from './constants'

/** Documento listo para Firestore: ruta relativa al espacio de trabajo y datos JSON planos. */
export interface WorkspaceDocument {
  readonly collection: string
  readonly id: string
  readonly data: Readonly<Record<string, unknown>>
}

export interface DocumentIssue {
  readonly path: string
  readonly message: string
}

export type EntityKey = keyof typeof ENTITY_COLLECTIONS

/**
 * Normaliza un valor para Firestore: JSON plano (sin `undefined`, funciones ni fechas como objeto) y sin listas
 * dentro de listas, que Firestore no admite. No transforma montos ni textos.
 */
export function toFirestoreData(value: unknown, path: string, issues: DocumentIssue[]): unknown {
  const plain: unknown = JSON.parse(JSON.stringify(value ?? null))
  const walk = (node: unknown, at: string, insideArray: boolean): void => {
    if (Array.isArray(node)) {
      if (insideArray) issues.push({ path: at, message: 'Firestore no admite listas dentro de listas' })
      node.forEach((child, index) => walk(child, `${at}[${String(index)}]`, true))
    } else if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith('__') && key.endsWith('__')) issues.push({ path: `${at}.${key}`, message: 'Nombre de campo reservado' })
        walk(child, `${at}.${key}`, false)
      }
    }
  }
  walk(plain, path, false)
  return plain
}

/** Estado de la app (forma del MockRepository) → documentos del espacio de trabajo. */
export function toWorkspaceDocuments(state: Readonly<Record<string, unknown>>): Result<readonly WorkspaceDocument[], readonly DocumentIssue[]> {
  const issues: DocumentIssue[] = []
  const entries: WorkspaceDocument[] = []
  for (const [key, collection] of Object.entries(ENTITY_COLLECTIONS)) {
    const list = state[key]
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      issues.push({ path: key, message: 'Debe ser una lista' })
      continue
    }
    const seen = new Set<string>()
    list.forEach((entity: unknown, index) => {
      const path = `${key}[${String(index)}]`
      const id = typeof entity === 'object' && entity !== null ? (entity as { id?: unknown }).id : undefined
      if (typeof id !== 'string' || !DOC_ID_PATTERN.test(id)) {
        issues.push({ path, message: 'Identificador ausente o inválido para un documento' })
        return
      }
      if (seen.has(id)) issues.push({ path, message: `Identificador duplicado: ${id}` })
      seen.add(id)
      const data = toFirestoreData(entity, path, issues) as Record<string, unknown>
      if (JSON.stringify(data).length > MAX_DOCUMENT_BYTES) issues.push({ path, message: 'Documento demasiado grande' })
      entries.push({ collection, id, data })
    })
  }
  for (const [key, id] of Object.entries(SINGLETON_DOCS)) {
    const value = state[key]
    if (value === undefined || value === null) continue
    if (typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ path: key, message: 'Debe ser un objeto' })
      continue
    }
    entries.push({ collection: SETTINGS_COLLECTION, id, data: toFirestoreData(value, key, issues) as Record<string, unknown> })
  }
  return issues.length > 0 ? err(issues) : ok(entries)
}

/** Documentos del espacio de trabajo → estado de la app (inverso de `toWorkspaceDocuments`). */
export function fromWorkspaceDocuments(entries: readonly WorkspaceDocument[]): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (const key of Object.keys(ENTITY_COLLECTIONS)) state[key] = []
  for (const entry of entries) {
    const entity = Object.entries(ENTITY_COLLECTIONS).find(([, collection]) => collection === entry.collection)
    if (entity !== undefined) {
      ;(state[entity[0]] as unknown[]).push({ ...entry.data })
      continue
    }
    if (entry.collection === SETTINGS_COLLECTION) {
      const single = Object.entries(SINGLETON_DOCS).find(([, id]) => id === entry.id)
      if (single !== undefined) state[single[0]] = { ...entry.data }
    }
  }
  return state
}

export const documentKey = (entry: Pick<WorkspaceDocument, 'collection' | 'id'>): string => `${entry.collection}/${entry.id}`
