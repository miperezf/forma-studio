import { canonicalize } from '../../core/canonical'
import { documentKey, type WorkspaceDocument } from './documents'

export type WriteOperation =
  | { readonly kind: 'set'; readonly collection: string; readonly id: string; readonly data: Readonly<Record<string, unknown>> }
  | { readonly kind: 'delete'; readonly collection: string; readonly id: string }

const fingerprint = (data: unknown): string => {
  const result = canonicalize(data)
  return result.ok ? result.value : JSON.stringify(data)
}

/**
 * Escrituras mínimas para pasar de `baseline` (lo que el servidor tiene, según esta sesión) a `next`:
 * solo documentos nuevos o cambiados (comparación canónica) y eliminaciones. Nunca reescribe lo que no cambió.
 */
export function planWrites(baseline: readonly WorkspaceDocument[], next: readonly WorkspaceDocument[]): readonly WriteOperation[] {
  const before = new Map(baseline.map((entry) => [documentKey(entry), fingerprint(entry.data)]))
  const after = new Set<string>()
  const operations: WriteOperation[] = []
  for (const entry of next) {
    const key = documentKey(entry)
    after.add(key)
    if (before.get(key) !== fingerprint(entry.data)) {
      operations.push({ kind: 'set', collection: entry.collection, id: entry.id, data: entry.data })
    }
  }
  for (const entry of baseline) {
    if (!after.has(documentKey(entry))) operations.push({ kind: 'delete', collection: entry.collection, id: entry.id })
  }
  return operations
}

/** Parte una lista de operaciones en lotes de tamaño máximo `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
  return out
}
