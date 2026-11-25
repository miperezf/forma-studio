/**
 * Infraestructura Firebase de FORMA Studio (Auth + Firestore). La UI solo usa la interfaz `FormaBackend`.
 *  - Datos: workspaces/{ws}/{colección}/{id}; internalQuotes y customerQuotes en colecciones DISTINTAS.
 *  - Guardado: solo documentos cambiados (planWrites) en lotes atómicos.
 *  - Operaciones críticas en TRANSACCIONES con idempotencia:
 *      · aceptar + pedido: candado orderLocks/{quoteId} (create-only por reglas) ⇒ nunca dos pedidos por cotización,
 *        tampoco con doble clic, reintentos ni dos sesiones simultáneas;
 *      · folios de cotización y pedido: contador settings/counters (nunca se reutilizan);
 *      · pagos: id generado por la UI; repetirlo devuelve el pago existente.
 * La lógica de negocio (transiciones, validaciones) NO vive aquí: la UI pasa las funciones del dominio (`apply`).
 */
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  runTransaction,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import {
  chunk,
  COUNTERS_DOC,
  documentKey,
  ENTITY_COLLECTIONS,
  fromWorkspaceDocuments,
  MAX_BATCH_OPERATIONS,
  planWrites,
  SETTINGS_COLLECTION,
  toWorkspaceDocuments,
  WORKSPACE_ID,
  type WorkspaceDocument,
} from '../../modules/workspace-sync'

export interface FirebaseWebConfig {
  readonly apiKey: string
  readonly authDomain: string
  readonly projectId: string
  readonly appId: string
  readonly storageBucket?: string
  readonly messagingSenderId?: string
}

export interface BackendUser {
  readonly uid: string
  readonly email: string | null
  readonly displayName: string | null
}

type State = Record<string, unknown>
type Entity = Record<string, unknown> & { id: string }

/** Mini-estado que recibe una función del dominio dentro de una transacción (misma forma que el estado de la app). */
export interface MiniState {
  quotes: Entity[]
  orders: Entity[]
  clients: Entity[]
  customerQuotes: Entity[]
  meta: Record<string, unknown>
  /** Solo en `recordConsumptionOnce`: los materiales cuyo stock se actualiza en la MISMA transacción. */
  materials?: Entity[]
}

export interface FormaBackend {
  readonly projectId: string
  onAuthChange(listener: (user: BackendUser | null) => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>
  /** Lee todo el espacio de trabajo (taller pequeño: sin paginación en 1.0) y fija la línea base. */
  load(): Promise<State>
  /** Escribe solo lo que cambió respecto de la línea base. Devuelve cuántas escrituras hizo. */
  save(state: State): Promise<number>
  /** Reserva el siguiente número de folio de cotización (transacción; nunca se reutiliza). */
  reserveQuoteNumber(localMax: number): Promise<number>
  /** Crea el pedido de una cotización una sola vez. `apply` es la función del dominio. */
  createOrderOnce(args: {
    readonly quoteId: string
    /** Mayor número de pedido conocido localmente (p. ej. datos importados): el folio nuevo siempre lo supera. */
    readonly localMaxOrder?: number
    readonly apply: (state: MiniState, orderId: string) => Entity
  }): Promise<{ readonly quote: Entity; readonly order: Entity; readonly alreadyExisted: boolean }>
  /** Registra un pago con id único (idempotente). `apply` es la función del dominio. */
  recordPaymentOnce(args: {
    readonly orderId: string
    readonly apply: (state: MiniState) => unknown
  }): Promise<{ readonly order: Entity }>
  /**
   * Registra un consumo REAL de filamento (id único, idempotente): pedido y materiales en UNA transacción, para que
   * dos dispositivos no pisen el stock del otro. `apply` es la función del dominio.
   */
  recordConsumptionOnce(args: {
    readonly orderId: string
    readonly materialIds: readonly string[]
    readonly apply: (state: MiniState) => unknown
  }): Promise<{ readonly order: Entity; readonly materials: readonly Entity[] }>
}

export type BackendErrorCode = 'PERMISSION_DENIED' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID_DATA' | 'NETWORK' | 'UNKNOWN'

export class BackendError extends Error {
  readonly code: BackendErrorCode
  constructor(code: BackendErrorCode, message: string) {
    super(message)
    this.name = 'BackendError'
    this.code = code
  }
}

const ORDER_PREFIX = 'PED-'
const FOLIO_DIGITS = 4
const folio = (prefix: string, n: number): string => `${prefix}${String(n).padStart(FOLIO_DIGITS, '0')}`

function toBackendError(error: unknown): BackendError {
  if (error instanceof BackendError) return error
  const code = typeof error === 'object' && error !== null ? String((error as { code?: unknown }).code ?? '') : ''
  const message = error instanceof Error ? error.message : String(error)
  if (code.includes('permission-denied')) return new BackendError('PERMISSION_DENIED', 'Tu cuenta no tiene permiso para estos datos.')
  if (code.includes('unavailable') || code.includes('network')) return new BackendError('NETWORK', 'Sin conexión con la nube. Revisa internet e intenta de nuevo.')
  if (code.includes('aborted') || code.includes('failed-precondition')) return new BackendError('CONFLICT', 'Otro cambio llegó al mismo tiempo. Intenta de nuevo.')
  return new BackendError('UNKNOWN', message)
}

export function createFirebaseBackend(config: FirebaseWebConfig, workspaceId: string = WORKSPACE_ID): FormaBackend {
  const app = initializeApp(config)
  const auth = getAuth(app)
  const db: Firestore = getFirestore(app)
  const ws = (path: string, id: string): DocumentReference => doc(db, 'workspaces', workspaceId, path, id)
  let baseline = new Map<string, WorkspaceDocument>()

  const remember = (documents: readonly WorkspaceDocument[]): void => {
    for (const document of documents) baseline.set(documentKey(document), document)
  }
  const entityDocument = (key: keyof typeof ENTITY_COLLECTIONS, entity: Entity): WorkspaceDocument => {
    const result = toWorkspaceDocuments({ [key]: [entity] })
    if (!result.ok) throw new BackendError('INVALID_DATA', result.error.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    const first = result.value[0]
    if (first === undefined) throw new BackendError('INVALID_DATA', 'Documento vacío')
    return first
  }
  const readEntity = async (tx: Transaction, path: string, id: string): Promise<Entity | null> => {
    const snapshot = await tx.get(ws(path, id))
    return snapshot.exists() ? ({ ...(snapshot.data() as Record<string, unknown>), id } as Entity) : null
  }
  const counters = async (tx: Transaction): Promise<{ lastQuoteNumber: number; lastOrderNumber: number }> => {
    const snapshot = await tx.get(ws(SETTINGS_COLLECTION, COUNTERS_DOC))
    const data = (snapshot.exists() ? snapshot.data() : {}) as Record<string, unknown>
    return { lastQuoteNumber: Number(data.lastQuoteNumber ?? 0) || 0, lastOrderNumber: Number(data.lastOrderNumber ?? 0) || 0 }
  }

  return {
    projectId: config.projectId,
    onAuthChange(listener) {
      return onAuthStateChanged(auth, (user) => {
        listener(user === null ? null : { uid: user.uid, email: user.email, displayName: user.displayName })
      })
    },
    async signIn() {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      try {
        await signInWithPopup(auth, provider)
      } catch (error) {
        const code = String((error as { code?: unknown }).code ?? '')
        // Navegadores que bloquean ventanas emergentes: misma autenticación por redirección.
        if (code.includes('popup-blocked') || code.includes('operation-not-supported')) await signInWithRedirect(auth, provider)
        else if (!code.includes('popup-closed-by-user') && !code.includes('cancelled-popup-request')) throw toBackendError(error)
      }
    },
    async signOut() {
      baseline = new Map()
      await signOut(auth)
    },
    async load() {
      try {
        const documents: WorkspaceDocument[] = []
        const paths = [...Object.values(ENTITY_COLLECTIONS), SETTINGS_COLLECTION]
        const snapshots = await Promise.all(paths.map((path) => getDocs(collection(db, 'workspaces', workspaceId, path))))
        snapshots.forEach((snapshot, index) => {
          const path = paths[index] ?? ''
          snapshot.forEach((entry) => {
            if (path === SETTINGS_COLLECTION && entry.id === COUNTERS_DOC) return
            documents.push({ collection: path, id: entry.id, data: entry.data() as Record<string, unknown> })
          })
        })
        baseline = new Map(documents.map((document) => [documentKey(document), document]))
        return fromWorkspaceDocuments(documents)
      } catch (error) {
        throw toBackendError(error)
      }
    },
    async save(state) {
      const next = toWorkspaceDocuments(state)
      if (!next.ok) throw new BackendError('INVALID_DATA', next.error.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
      const operations = planWrites([...baseline.values()], next.value)
      try {
        for (const group of chunk(operations, MAX_BATCH_OPERATIONS)) {
          const batch = writeBatch(db)
          for (const operation of group) {
            if (operation.kind === 'set') {
              batch.set(ws(operation.collection, operation.id), operation.data)
              // Pedido NUEVO con cotización: su candado va en el mismo lote (las reglas exigen ambos o ninguno).
              const isNew = !baseline.has(documentKey(operation))
              const quoteId = operation.data.quoteId
              if (isNew && operation.collection === ENTITY_COLLECTIONS.orders && typeof quoteId === 'string' && quoteId !== '') {
                batch.set(ws('orderLocks', quoteId), { quoteId, orderId: operation.id })
              }
            } else batch.delete(ws(operation.collection, operation.id))
          }
          await batch.commit()
        }
      } catch (error) {
        throw toBackendError(error)
      }
      baseline = new Map(next.value.map((document) => [documentKey(document), document]))
      return operations.length
    },
    async reserveQuoteNumber(localMax) {
      try {
        return await runTransaction(db, async (tx) => {
          const current = await counters(tx)
          const next = Math.max(current.lastQuoteNumber, localMax) + 1
          tx.set(ws(SETTINGS_COLLECTION, COUNTERS_DOC), { ...current, lastQuoteNumber: next })
          return next
        })
      } catch (error) {
        throw toBackendError(error)
      }
    },
    async createOrderOnce({ quoteId, localMaxOrder = 0, apply }) {
      try {
        const result = await runTransaction(db, async (tx) => {
          const lockRef = ws('orderLocks', quoteId)
          const lock = await tx.get(lockRef)
          const quote = await readEntity(tx, ENTITY_COLLECTIONS.quotes, quoteId)
          if (quote === null) throw new BackendError('NOT_FOUND', 'Cotización no encontrada en la nube.')
          if (lock.exists()) {
            const existingId = String((lock.data() as { orderId?: unknown }).orderId ?? '')
            const existing = await readEntity(tx, ENTITY_COLLECTIONS.orders, existingId)
            if (existing === null) throw new BackendError('CONFLICT', 'El pedido de esta cotización está registrado pero no se encontró.')
            return { quote, order: existing, alreadyExisted: true }
          }
          const clientId = String(quote.clientId ?? '')
          const client = clientId === '' ? null : await readEntity(tx, ENTITY_COLLECTIONS.clients, clientId)
          const customer = await readEntity(tx, ENTITY_COLLECTIONS.customerQuotes, quoteId)
          const current = await counters(tx)
          const orderNumber = Math.max(current.lastOrderNumber, localMaxOrder) + 1
          // Nunca sobrescribir un pedido existente con el mismo folio (p. ej. creado en otro dispositivo).
          if ((await tx.get(ws(ENTITY_COLLECTIONS.orders, folio(ORDER_PREFIX, orderNumber)))).exists()) {
            throw new BackendError('CONFLICT', 'El folio de pedido ya está en uso. Recarga e intenta de nuevo.')
          }
          const state: MiniState = {
            quotes: [quote],
            orders: [],
            clients: client === null ? [] : [client],
            customerQuotes: customer === null ? [] : [customer],
            meta: {},
          }
          const order = apply(state, folio(ORDER_PREFIX, orderNumber))
          const updatedQuote = state.quotes[0] ?? quote
          const quoteDoc = entityDocument('quotes', updatedQuote)
          const orderDoc = entityDocument('orders', order)
          tx.set(ws(quoteDoc.collection, quoteDoc.id), quoteDoc.data)
          tx.set(ws(orderDoc.collection, orderDoc.id), orderDoc.data)
          tx.set(lockRef, { quoteId, orderId: order.id })
          tx.set(ws(SETTINGS_COLLECTION, COUNTERS_DOC), { ...current, lastOrderNumber: orderNumber })
          return { quote: updatedQuote, order, alreadyExisted: false }
        })
        remember([entityDocument('quotes', result.quote), entityDocument('orders', result.order)])
        return result
      } catch (error) {
        throw toBackendError(error)
      }
    },
    async recordPaymentOnce({ orderId, apply }) {
      try {
        const order = await runTransaction(db, async (tx) => {
          const current = await readEntity(tx, ENTITY_COLLECTIONS.orders, orderId)
          if (current === null) throw new BackendError('NOT_FOUND', 'Pedido no encontrado en la nube.')
          const state: MiniState = { quotes: [], orders: [current], clients: [], customerQuotes: [], meta: {} }
          apply(state)
          const updated = state.orders[0] ?? current
          const orderDoc = entityDocument('orders', updated)
          tx.set(ws(orderDoc.collection, orderDoc.id), orderDoc.data)
          return updated
        })
        remember([entityDocument('orders', order)])
        return { order }
      } catch (error) {
        throw toBackendError(error)
      }
    },
    async recordConsumptionOnce({ orderId, materialIds, apply }) {
      try {
        const result = await runTransaction(db, async (tx) => {
          const current = await readEntity(tx, ENTITY_COLLECTIONS.orders, orderId)
          if (current === null) throw new BackendError('NOT_FOUND', 'Pedido no encontrado en la nube.')
          const materials: Entity[] = []
          for (const id of [...new Set(materialIds)]) {
            const material = await readEntity(tx, ENTITY_COLLECTIONS.materials, id)
            if (material !== null) materials.push(material)
          }
          const state: MiniState = { quotes: [], orders: [current], clients: [], customerQuotes: [], meta: {}, materials }
          apply(state)
          const order = state.orders[0] ?? current
          const orderDoc = entityDocument('orders', order)
          tx.set(ws(orderDoc.collection, orderDoc.id), orderDoc.data)
          for (const material of state.materials ?? []) {
            const materialDoc = entityDocument('materials', material)
            tx.set(ws(materialDoc.collection, materialDoc.id), materialDoc.data)
          }
          return { order, materials: state.materials ?? [] }
        })
        remember([entityDocument('orders', result.order), ...result.materials.map((m) => entityDocument('materials', m))])
        return result
      } catch (error) {
        throw toBackendError(error)
      }
    },
  }
}
