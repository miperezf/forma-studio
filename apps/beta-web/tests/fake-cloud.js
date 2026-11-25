// Backend FALSO en memoria con la misma interfaz que FormaFirebase.createFirebaseBackend (solo para E2E de la UI).
// Reproduce las garantías que en Firebase dan las transacciones y las reglas: candado de pedido, folios crecientes,
// pago idempotente. Persiste en sessionStorage para sobrevivir recargas dentro de la prueba.
(() => {
  const KEY = 'fake-cloud-state'
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || { state: {}, locks: {}, counters: { q: 0, o: 0 }, user: null, saves: 0 } } catch { return { state: {}, locks: {}, counters: { q: 0, o: 0 }, user: null, saves: 0 } } }
  const write = (s) => sessionStorage.setItem(KEY, JSON.stringify(s))
  const clone = (v) => JSON.parse(JSON.stringify(v))
  const ALLOWED = 'propietario@forma.test'
  // Mismas validaciones de forma que las reglas de Firestore: id en cada entidad y lista blanca del documento comercial.
  const validate = (state) => {
    const whitelist = window.__customerWhitelist || null
    for (const [key, list] of Object.entries(state)) if (Array.isArray(list)) for (const entity of list) {
      if (!entity || typeof entity.id !== 'string' || entity.id === '') { const e = new Error(`${key}: entidad sin id`); e.code = 'PERMISSION_DENIED'; throw e }
    }
    if (whitelist) for (const doc of state.customerQuotes || []) {
      const extra = Object.keys(doc).filter((k) => !whitelist.includes(k))
      if (extra.length || doc.kind !== 'CustomerQuote') { const e = new Error(`customerQuotes/${doc.id}: campos fuera de la lista blanca ${extra.join(',')}`); e.code = 'PERMISSION_DENIED'; throw e }
    }
  }
  window.__fakeCloud = { read, write, ALLOWED }
  window.FORMA_ENV = { name: 'staging', version: 'test', label: 'STAGING · DATOS FICTICIOS', note: 'prueba' }
  window.FORMA_FIREBASE_CONFIG = { apiKey: 'fake', authDomain: 'fake', projectId: 'forma-fake', appId: 'fake' }
  window.FormaFirebase = {
    createFirebaseBackend(config) {
      let listener = null
      return {
        projectId: config.projectId,
        onAuthChange(cb) { listener = cb; setTimeout(() => cb(read().user), 0); return () => {} },
        async signIn() { const s = read(); s.user = { uid: 'u1', email: window.__fakeLoginEmail || ALLOWED, displayName: 'Prop' }; write(s); if (listener) listener(s.user) },
        async signOut() { const s = read(); s.user = null; write(s); if (listener) listener(null) },
        async load() {
          const s = read()
          if (!s.user || s.user.email !== ALLOWED) { const e = new Error('denied'); e.code = 'PERMISSION_DENIED'; throw e }
          return clone(s.state)
        },
        async save(state) { validate(state); const s = read(); s.state = clone(state); s.saves++; write(s); return 1 },
        async reserveQuoteNumber(localMax) { const s = read(); s.counters.q = Math.max(s.counters.q, localMax) + 1; write(s); return s.counters.q },
        async createOrderOnce({ quoteId, localMaxOrder = 0, apply }) {
          await new Promise((r) => setTimeout(r, 50)) // latencia: abre la ventana para doble envío
          const s = read()
          const quotes = s.state.quotes || [], orders = s.state.orders || []
          if (s.locks[quoteId]) return { quote: quotes.find((q) => q.id === quoteId), order: orders.find((o) => o.id === s.locks[quoteId]), alreadyExisted: true }
          const quote = clone(quotes.find((q) => q.id === quoteId))
          const mini = { quotes: [quote], orders: [], clients: clone((s.state.clients || []).filter((c) => c.id === quote.clientId)), customerQuotes: clone((s.state.customerQuotes || []).filter((c) => c.id === quoteId)), meta: {} }
          s.counters.o = Math.max(s.counters.o, localMaxOrder) + 1
          if (orders.some((o) => o.id === 'PED-' + String(s.counters.o).padStart(4, '0'))) throw new Error('CONFLICT folio')
          const order = apply(mini, 'PED-' + String(s.counters.o).padStart(4, '0'))
          s.locks[quoteId] = order.id
          s.state.quotes = quotes.map((q) => (q.id === quoteId ? mini.quotes[0] : q))
          s.state.orders = [order, ...orders]
          write(s)
          return { quote: mini.quotes[0], order, alreadyExisted: false }
        },
        async recordConsumptionOnce({ orderId, materialIds, apply }) {
          const s = read()
          const order = clone((s.state.orders || []).find((o) => o.id === orderId))
          const materials = clone((s.state.materials || []).filter((m) => materialIds.includes(m.id)))
          const mini = { quotes: [], orders: [order], clients: [], customerQuotes: [], meta: {}, materials }
          apply(mini)
          s.state.orders = s.state.orders.map((o) => (o.id === orderId ? mini.orders[0] : o))
          s.state.materials = s.state.materials.map((m) => mini.materials.find((x) => x.id === m.id) || m)
          write(s)
          return { order: mini.orders[0], materials: mini.materials }
        },
        async recordPaymentOnce({ orderId, apply }) {
          const s = read()
          const mini = { quotes: [], orders: [clone((s.state.orders || []).find((o) => o.id === orderId))], clients: [], customerQuotes: [], meta: {} }
          apply(mini)
          s.state.orders = s.state.orders.map((o) => (o.id === orderId ? mini.orders[0] : o))
          write(s)
          return { order: mini.orders[0] }
        },
      }
    },
  }
})()
