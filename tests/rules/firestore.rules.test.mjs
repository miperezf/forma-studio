// Pruebas de las reglas de Firestore contra el EMULADOR (requiere Java 11+ y firebase-tools).
// Ejecutar: npm run test:rules   (firebase emulators:exec --only firestore "node --test tests/rules/")
import test, { after, before, beforeEach } from 'node:test'
import { readFileSync } from 'node:fs'
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

const OWNER = 'propietario@forma.test'
const rules = readFileSync(new URL('../../firebase/firestore.rules.template', import.meta.url), 'utf8').replaceAll('__OWNER_EMAILS__', `'${OWNER}'`)
let env
const W = 'workspaces/main'
const owner = () => env.authenticatedContext('owner-uid', { email: OWNER, email_verified: true }).firestore()
const stranger = () => env.authenticatedContext('other-uid', { email: 'otro@forma.test', email_verified: true }).firestore()
const unverified = () => env.authenticatedContext('owner-uid', { email: OWNER, email_verified: false }).firestore()
const anonymous = () => env.unauthenticatedContext().firestore()

const QUOTE = { id: 'COT-0001', clientId: 'CLI-001', status: 'Borrador', quantity: 8, net: 40336, vat: 7664, gross: 48000, unitPrice: 6000, validDays: 7, terms: 'T', calculationVersion: 'v1', calculation: { request: {}, output: {} }, events: [] }
const CUSTOMER = { kind: 'CustomerQuote', schemaVersion: 1, id: 'COT-0001', clientName: 'Camila', project: 'Macetero', createdAt: '2026-10-21', validDays: 7, terms: 'T', currency: 'CLP', taxTreatment: 'VAT_INCLUDED', lines: [{ description: 'Macetero', quantity: 8, unitPrice: 6000, total: 48000 }], quantity: 8, unitPrice: 6000, vatAmount: null, total: 48000 }

async function seed(data) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [path, value] of Object.entries(data)) await setDoc(doc(ctx.firestore(), path), value)
  })
}

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-forma-rules', firestore: { rules } })
})
after(async () => { await env.cleanup() })
beforeEach(async () => { await env.clearFirestore() })

test('sin sesión, otra cuenta o correo no verificado: sin acceso a nada', async () => {
  await seed({ [`${W}/clients/CLI-001`]: { id: 'CLI-001', name: 'Camila' }, [`${W}/internalQuotes/COT-0001`]: QUOTE })
  for (const db of [anonymous(), stranger(), unverified()]) {
    await assertFails(getDoc(doc(db, `${W}/clients/CLI-001`)))
    await assertFails(getDoc(doc(db, `${W}/internalQuotes/COT-0001`)))
    await assertFails(setDoc(doc(db, `${W}/clients/CLI-002`), { id: 'CLI-002' }))
  }
})

test('el propietario administra CRM y catálogo; id del documento = id de la entidad', async () => {
  const db = owner()
  await assertSucceeds(setDoc(doc(db, `${W}/clients/CLI-001`), { id: 'CLI-001', name: 'Camila' }))
  await assertFails(setDoc(doc(db, `${W}/clients/CLI-009`), { id: 'CLI-001', name: 'Suplantado' }))
  await assertSucceeds(getDoc(doc(db, `${W}/clients/CLI-001`)))
  await assertSucceeds(deleteDoc(doc(db, `${W}/clients/CLI-001`)))
})

test('colecciones no previstas: denegadas', async () => {
  await assertFails(setDoc(doc(owner(), `${W}/secretos/x`), { a: 1 }))
  await assertFails(setDoc(doc(owner(), `otraRaiz/x`), { a: 1 }))
})

test('cotización interna: importes y snapshot inmutables; estado sí', async () => {
  await seed({ [`${W}/internalQuotes/COT-0001`]: QUOTE })
  const db = owner()
  const ref = doc(db, `${W}/internalQuotes/COT-0001`)
  await assertFails(updateDoc(ref, { gross: 1 }))
  await assertFails(updateDoc(ref, { calculation: { request: {}, output: { forjado: true } } }))
  await assertSucceeds(updateDoc(ref, { validDays: 10 }))
  await assertSucceeds(updateDoc(ref, { status: 'Enviada', sentAt: '2026-10-21T10:00:00Z' }))
  await assertFails(updateDoc(ref, { validDays: 30 }))
  await assertFails(deleteDoc(ref))
})

test('solo se elimina un borrador sin pedido', async () => {
  await seed({ [`${W}/internalQuotes/COT-0001`]: QUOTE, [`${W}/internalQuotes/COT-0002`]: { ...QUOTE, id: 'COT-0002' }, [`${W}/orderLocks/COT-0002`]: { quoteId: 'COT-0002', orderId: 'PED-0001' } })
  await assertSucceeds(deleteDoc(doc(owner(), `${W}/internalQuotes/COT-0001`)))
  await assertFails(deleteDoc(doc(owner(), `${W}/internalQuotes/COT-0002`)))
})

test('documento comercial: whitelist en el servidor; condiciones solo en borrador', async () => {
  await seed({ [`${W}/internalQuotes/COT-0001`]: QUOTE })
  const db = owner()
  await assertFails(setDoc(doc(db, `${W}/customerQuotes/COT-0001`), { ...CUSTOMER, economicCost: 25975 }))
  await assertFails(setDoc(doc(db, `${W}/customerQuotes/COT-0001`), { ...CUSTOMER, margin: 0.35 }))
  await assertSucceeds(setDoc(doc(db, `${W}/customerQuotes/COT-0001`), CUSTOMER))
  await assertFails(updateDoc(doc(db, `${W}/customerQuotes/COT-0001`), { total: 1 }))
  await assertSucceeds(updateDoc(doc(db, `${W}/customerQuotes/COT-0001`), { terms: 'Pago 50 %' }))
  await seed({ [`${W}/internalQuotes/COT-0001`]: { ...QUOTE, status: 'Enviada' } })
  await assertFails(updateDoc(doc(db, `${W}/customerQuotes/COT-0001`), { terms: 'Otro' }))
})

test('un solo pedido por cotización: el segundo candado se rechaza (doble clic, reintento o dos sesiones)', async () => {
  const db = owner()
  const first = writeBatch(db)
  first.set(doc(db, `${W}/orders/PED-0001`), { id: 'PED-0001', quoteId: 'COT-0001', amount: 48000, payments: [] })
  first.set(doc(db, `${W}/orderLocks/COT-0001`), { quoteId: 'COT-0001', orderId: 'PED-0001' })
  await assertSucceeds(first.commit())
  const second = writeBatch(db)
  second.set(doc(db, `${W}/orders/PED-0002`), { id: 'PED-0002', quoteId: 'COT-0001', amount: 48000, payments: [] })
  second.set(doc(db, `${W}/orderLocks/COT-0001`), { quoteId: 'COT-0001', orderId: 'PED-0002' })
  await assertFails(second.commit())
  // un pedido con cotización SIN candado tampoco se acepta
  await assertFails(setDoc(doc(db, `${W}/orders/PED-0003`), { id: 'PED-0003', quoteId: 'COT-0009', amount: 1, payments: [] }))
  // pedido manual (sin cotización): permitido
  await assertSucceeds(setDoc(doc(db, `${W}/orders/PED-0004`), { id: 'PED-0004', amount: 15000, payments: [] }))
})

test('pedido: importe inmutable; pagos solo se agregan; nunca se elimina', async () => {
  const pago = { id: 'pago-0001-abcdef', amount: 20000, method: 'Transferencia', at: '2026-10-21T10:00:00Z' }
  await seed({ [`${W}/orders/PED-0001`]: { id: 'PED-0001', amount: 48000, payments: [pago], status: 'Pendiente' } })
  const ref = doc(owner(), `${W}/orders/PED-0001`)
  await assertFails(updateDoc(ref, { amount: 1 }))
  await assertSucceeds(updateDoc(ref, { payments: [pago, { ...pago, id: 'pago-0002-abcdef', amount: 28000 }] }))
  await assertFails(updateDoc(ref, { payments: [{ ...pago, amount: 1 }, { ...pago, id: 'pago-0002-abcdef', amount: 28000 }] }))
  await assertFails(updateDoc(ref, { payments: [] }))
  await assertSucceeds(updateDoc(ref, { status: 'Preparación' }))
  await assertFails(deleteDoc(ref))
})

test('pedido sin pagos (campo ausente o lista vacía): cambia estado y recibe su primer pago', async () => {
  const pago = { id: 'pago-0001-abcdef', amount: 10000, method: 'Transferencia', at: '2026-10-21T10:00:00Z' }
  await seed({
    [`${W}/orders/PED-0002`]: { id: 'PED-0002', amount: 48000, status: 'Pendiente' },
    [`${W}/orders/PED-0003`]: { id: 'PED-0003', amount: 48000, status: 'Pendiente', payments: [] },
  })
  for (const id of ['PED-0002', 'PED-0003']) {
    const ref = doc(owner(), `${W}/orders/${id}`)
    await assertSucceeds(updateDoc(ref, { status: 'Preparación' }))
    await assertSucceeds(setDoc(ref, { id, amount: 48000, status: 'Preparación', payments: [] }))
    await assertSucceeds(updateDoc(ref, { payments: [pago] }))
    await assertFails(updateDoc(ref, { payments: [] }))
    await assertFails(updateDoc(ref, { amount: 1 }))
  }
})

test('consumos reales de filamento: solo se agregan (sin borrar ni reescribir registros)', async () => {
  const consumo = { id: 'cons-0001-abcdef', at: '2026-10-21T10:00:00Z', kind: 'PRODUCTION', items: [{ materialId: 'MAT-001', name: 'PLA', grams: 620, shortfallG: 0 }] }
  await seed({ [`${W}/orders/PED-0004`]: { id: 'PED-0004', amount: 48000, status: 'En producción', payments: [] } })
  const ref = doc(owner(), `${W}/orders/PED-0004`)
  await assertSucceeds(updateDoc(ref, { consumptions: [consumo] }))
  await assertSucceeds(updateDoc(ref, { consumptions: [consumo, { ...consumo, id: 'cons-0002-abcdef', kind: 'REPRINT' }] }))
  await assertFails(updateDoc(ref, { consumptions: [consumo] }))
  await assertFails(updateDoc(ref, { consumptions: [{ ...consumo, items: [] }, { ...consumo, id: 'cons-0002-abcdef', kind: 'REPRINT' }] }))
  await assertSucceeds(updateDoc(ref, { status: 'Entregado' }))
})

test('reserva de filamento: gramos inmutables; solo ACTIVE → RELEASED; no se puede quitar ni reactivar', async () => {
  const reserva = { at: '2026-10-21T10:00:00Z', source: 'QUOTE_ESTIMATE', status: 'ACTIVE', items: [{ materialId: 'MAT-001', name: 'PLA', grams: 680 }] }
  await seed({ [`${W}/orders/PED-0005`]: { id: 'PED-0005', amount: 48000, status: 'Pendiente', payments: [], reservation: reserva } })
  const ref = doc(owner(), `${W}/orders/PED-0005`)
  await assertFails(updateDoc(ref, { reservation: { ...reserva, items: [{ materialId: 'MAT-001', name: 'PLA', grams: 1 }] } }))
  await assertFails(updateDoc(ref, { status: 'Preparación', reservation: null }))
  await assertSucceeds(updateDoc(ref, { status: 'Preparación' }))
  const liberada = { ...reserva, status: 'RELEASED', releasedAt: '2026-10-22T10:00:00Z', releaseReason: 'CONSUMED' }
  await assertSucceeds(updateDoc(ref, { reservation: liberada }))
  await assertFails(updateDoc(ref, { reservation: { ...liberada, status: 'ACTIVE' } }))
})

test('contadores de folio: solo crecen', async () => {
  await seed({ [`${W}/settings/counters`]: { lastQuoteNumber: 10, lastOrderNumber: 5 } })
  const ref = doc(owner(), `${W}/settings/counters`)
  await assertSucceeds(setDoc(ref, { lastQuoteNumber: 11, lastOrderNumber: 5 }))
  await assertFails(setDoc(ref, { lastQuoteNumber: 3, lastOrderNumber: 5 }))
  await assertFails(deleteDoc(ref))
})

test('historial del pedido: solo se agregan movimientos', async () => {
  const ev = { type: 'ORDER_CREATED', at: '2026-10-21T10:00:00Z' }
  await seed({ [`${W}/orders/PED-0006`]: { id: 'PED-0006', amount: 48000, status: 'Preparación', payments: [], events: [ev] } })
  const ref = doc(owner(), `${W}/orders/PED-0006`)
  const back = { type: 'PRODUCTION_REVERTED', from: 'Preparación', to: 'Pendiente', at: '2026-10-21T11:00:00Z', reason: 'Avancé por error' }
  await assertSucceeds(updateDoc(ref, { status: 'Pendiente', events: [ev, back] }))
  await assertFails(updateDoc(ref, { events: [back] }))
  await assertFails(updateDoc(ref, { events: [] }))
  await assertFails(updateDoc(ref, { events: [{ ...ev, at: 'otro' }, back] }))
})

test('anulación: exige motivo; definitiva; sin abonos posteriores; nunca se elimina', async () => {
  const pago = { id: 'pago-0001-abcdef', amount: 10000, method: 'Transferencia', at: '2026-10-21T10:00:00Z' }
  const reserva = { at: '2026-10-21T10:00:00Z', source: 'QUOTE_ESTIMATE', status: 'ACTIVE', items: [{ materialId: 'MAT-001', name: 'PLA', grams: 55 }] }
  await seed({ [`${W}/orders/PED-0007`]: { id: 'PED-0007', amount: 48000, status: 'Preparación', payments: [pago], reservation: reserva, events: [] } })
  const ref = doc(owner(), `${W}/orders/PED-0007`)
  await assertFails(updateDoc(ref, { status: 'Anulado' }))
  await assertFails(updateDoc(ref, { status: 'Anulado', cancelled: { at: '2026-10-22T10:00:00Z', reason: '', fromStatus: 'Preparación' } }))
  const cancelled = { at: '2026-10-22T10:00:00Z', reason: 'Cliente desistió', fromStatus: 'Preparación' }
  const liberada = { ...reserva, status: 'RELEASED', releasedAt: '2026-10-22T10:00:00Z', releaseReason: 'CANCELLED' }
  await assertSucceeds(updateDoc(ref, { status: 'Anulado', cancelled, reservation: liberada, events: [{ type: 'ORDER_CANCELLED', at: '2026-10-22T10:00:00Z', reason: 'Cliente desistió' }] }))
  await assertFails(updateDoc(ref, { status: 'Preparación' }))
  await assertFails(updateDoc(ref, { cancelled: { ...cancelled, reason: 'Otro motivo' } }))
  await assertFails(updateDoc(ref, { payments: [pago, { ...pago, id: 'pago-0002-abcdef' }] }))
  await assertSucceeds(updateDoc(ref, { consumptions: [{ id: 'cons-0001-abcdef', at: '2026-10-22T11:00:00Z', kind: 'WASTE', items: [] }] }))
  await assertFails(deleteDoc(ref))
})

test('productos frecuentes: solo el propietario; id del documento = id del producto', async () => {
  const product = { id: 'PRD-0001', name: 'Llavero AMS', createdAt: '2026-10-22', formState: { quantity: 4 } }
  await assertSucceeds(setDoc(doc(owner(), `${W}/products/PRD-0001`), product))
  await assertFails(setDoc(doc(owner(), `${W}/products/PRD-0009`), product))
  await assertFails(getDoc(doc(stranger(), `${W}/products/PRD-0001`)))
  await assertFails(setDoc(doc(anonymous(), `${W}/products/PRD-0002`), { ...product, id: 'PRD-0002' }))
  await assertSucceeds(deleteDoc(doc(owner(), `${W}/products/PRD-0001`)))
})
