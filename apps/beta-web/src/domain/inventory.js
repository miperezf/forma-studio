/**
 * Inventario de filamento (modelo físico / comprometido / disponible). Puro: sin DOM ni almacenamiento.
 *  - FÍSICO: stock del material (carretes + abierto). Solo lo mueven los CONSUMOS REALES registrados (producción,
 *    reimpresión, desperdicio, corrección), una vez por registro (id único).
 *  - COMPROMETIDO: suma de las RESERVAS activas de pedidos. Una reserva nace con el pedido (estimación de la
 *    cotización) y se libera al registrar el consumo real de producción o manualmente. No toca el físico.
 *  - DISPONIBLE = físico − comprometido. Es lo que usa el cotizador para avisar faltantes.
 */
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * ESTIMACIÓN de filamento [{materialId, grams}] a partir de {request, output} del motor (preview o cotización).
 * v2: placas completas × gramos de la placa completa + gramos REALES de la última placa (si se ingresaron); sin
 * ellos, la última placa se estima como completa (cota superior). v1: gramos por placa × placas requeridas.
 * Es una estimación de cotización: el consumo efectivo se registra en producción.
 */
export function filamentUsage(calculation) {
  const plates = calculation?.request?.input?.plates;
  const required = calculation?.output?.breakdown?.platesRequired;
  if (!Array.isArray(plates) || !Array.isArray(required)) return [];
  const total = new Map();
  const add = (materialId, grams) => total.set(materialId, (total.get(materialId) ?? 0) + Number(grams));
  for (const plate of plates) {
    const entry = required.find((candidate) => candidate.plateId === plate.id);
    const physical = Number(entry?.platesRequired ?? 0);
    const sliced = entry?.lastRun?.source === 'SLICED' && plate.lastRun;
    const fullRuns = sliced ? Number(entry.fullPlates ?? physical - 1) : physical;
    for (const filament of plate.filaments || []) add(filament.materialId, Number(filament.grams) * fullRuns);
    if (sliced) for (const filament of plate.lastRun.filaments || []) add(filament.materialId, filament.grams);
  }
  return [...total.entries()].map(([materialId, grams]) => ({ materialId, grams: round1(grams) }));
}

/** Gramos disponibles de un material (carretes cerrados + abierto si viene del catálogo; si no, stockKg). */
export function availableGrams(material) {
  if (material?.spoolNetG > 0 && Number.isInteger(Number(material.spools))) {
    return Number(material.spools) * Number(material.spoolNetG) + (Number(material.openRemainingG) || 0);
  }
  return Math.max(0, Number(material?.stockKg) || 0) * 1000;
}

/**
 * Descuenta `grams` de un material. Primero el carrete abierto; si no alcanza, se abren carretes cerrados.
 * Devuelve los campos a actualizar y el faltante (si el stock no alcanzaba, queda en 0 y se informa).
 */
export function consumeFromMaterial(material, grams) {
  const need = Math.max(0, Number(grams) || 0);
  if (material?.spoolNetG > 0 && Number.isInteger(Number(material.spools))) {
    const net = Number(material.spoolNetG);
    let spools = Number(material.spools);
    let open = (Number(material.openRemainingG) || 0) - need;
    while (open < 0 && spools > 0) { spools -= 1; open += net; }
    const shortfallG = open < 0 ? round1(-open) : 0;
    open = Math.max(0, round1(open));
    return { spools, openRemainingG: Math.round(open), stockKg: Math.round(spools * net + open) / 1000, shortfallG };
  }
  const available = Math.max(0, Number(material?.stockKg) || 0) * 1000;
  const left = available - need;
  return { stockKg: Math.round(Math.max(0, left)) / 1000, shortfallG: left < 0 ? round1(-left) : 0 };
}

/** Devuelve gramos a un material (corrección): primero al carrete abierto; lo que completa carretes los cierra. */
export function returnToMaterial(material, grams) {
  const back = Math.max(0, Number(grams) || 0);
  if (material?.spoolNetG > 0 && Number.isInteger(Number(material.spools))) {
    const net = Number(material.spoolNetG);
    let spools = Number(material.spools);
    let open = (Number(material.openRemainingG) || 0) + back;
    while (open >= net) { spools += 1; open -= net; }
    open = Math.round(open);
    return { spools, openRemainingG: open, stockKg: Math.round(spools * net + open) / 1000, shortfallG: 0 };
  }
  return { stockKg: Math.round((Math.max(0, Number(material?.stockKg) || 0) * 1000) + back) / 1000, shortfallG: 0 };
}

export const CONSUMPTION_KINDS = Object.freeze({ PRODUCTION: 'Producción', REPRINT: 'Reimpresión', WASTE: 'Desperdicio', ADJUSTMENT: 'Corrección' });
const CONSUMPTION_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Estimación de la cotización para un pedido (para precargar el registro). Vacía si el pedido no viene de una cotización con snapshot. */
export function estimatedConsumption(db, order) {
  const quote = order?.quoteId ? (db.quotes || []).find((q) => q.id === order.quoteId) : null;
  const names = quote?.calculation?.request?.params?.materials || {};
  return filamentUsage(quote?.calculation).map((usage) => ({ ...usage, name: (db.materials || []).find((m) => m.id === usage.materialId)?.name ?? names[usage.materialId]?.name ?? usage.materialId }));
}

/** Total registrado (real) por material, sumando todos los registros (las correcciones pueden restar). */
export function registeredConsumption(order) {
  const total = new Map();
  for (const entry of order?.consumptions || []) {
    for (const item of entry.items || []) total.set(item.materialId, (total.get(item.materialId) ?? 0) + Number(item.grams));
  }
  return [...total.entries()].map(([materialId, grams]) => ({ materialId, grams: round1(grams) }));
}

/**
 * Registra un consumo REAL en el pedido y actualiza el stock. `state` = { orders, materials } (estado completo o
 * el mini-estado de la transacción en la nube). Idempotente por `id`: repetirlo devuelve el registro existente.
 * kind ∈ CONSUMPTION_KINDS. Gramos ≥ 0 (en «Corrección» también negativos: devuelven material al stock).
 */
export function recordConsumption(state, orderId, { id, at, kind = 'PRODUCTION', items = [], note = '' } = {}) {
  const order = (state.orders || []).find((o) => o.id === orderId);
  if (!order) throw Error('Pedido no encontrado.');
  if (!CONSUMPTION_ID.test(String(id || ''))) throw Error('Identificador de registro inválido.');
  const existing = (order.consumptions || []).find((entry) => entry.id === id);
  if (existing) return existing;
  if (!CONSUMPTION_KINDS[kind]) throw Error('Tipo de consumo inválido.');
  const clean = items
    .map((item) => ({ materialId: String(item.materialId || ''), grams: round1(Number(item.grams)) }))
    .filter((item) => item.materialId !== '' && Number.isFinite(item.grams) && item.grams !== 0);
  if (clean.some((item) => item.grams < 0 && kind !== 'ADJUSTMENT')) throw Error('Los gramos no pueden ser negativos (usa «Corrección» para devolver material al stock).');
  if (clean.some((item) => Math.abs(item.grams) > 1_000_000)) throw Error('Revisa los gramos ingresados.');
  if (clean.length === 0) throw Error('Ingresa los gramos de al menos un material.');
  const recorded = clean.map(({ materialId, grams }) => {
    const material = (state.materials || []).find((m) => m.id === materialId);
    if (!material) return { materialId, name: materialId, grams, shortfallG: grams > 0 ? grams : 0, missing: true };
    const { shortfallG, ...fields } = grams >= 0 ? consumeFromMaterial(material, grams) : returnToMaterial(material, -grams);
    Object.assign(material, fields);
    return { materialId, name: material.name, grams, shortfallG };
  });
  const entry = { id, at, kind, items: recorded, ...(String(note).trim() ? { note: String(note).trim().slice(0, 140) } : {}) };
  order.consumptions = [...(order.consumptions || []), entry];
  // El consumo REAL de producción reemplaza a la reserva (aunque difiera en gramos): se libera completa.
  if (kind === 'PRODUCTION') releaseReservation(order, { at, reason: 'CONSUMED' });
  order.events ??= [];
  order.events.push({ type: 'CONSUMPTION_RECORDED', at, kind, grams: round1(recorded.reduce((sum, item) => sum + item.grams, 0)) });
  return entry;
}

// ── Reservas (comprometido) ────────────────────────────────────────────────────────────────────────────────────
export const RELEASE_REASONS = Object.freeze({ CONSUMED: 'Consumo real registrado', MANUAL: 'Liberada manualmente', CANCELLED: 'Pedido anulado' });

/** Reserva que nace con el pedido: la estimación de filamento de la cotización aceptada (snapshot del motor). */
export function reservationFromQuote(quote, at) {
  const names = quote?.calculation?.request?.params?.materials || {};
  const items = filamentUsage(quote?.calculation).filter((u) => u.grams > 0).map((u) => ({ materialId: u.materialId, name: names[u.materialId]?.name ?? u.materialId, grams: u.grams }));
  return items.length ? { at, source: 'QUOTE_ESTIMATE', status: 'ACTIVE', items } : null;
}

const activeReservation = (order) => (order?.reservation?.status === 'ACTIVE' ? order.reservation : null);

/** Gramos comprometidos por material (reservas ACTIVAS de todos los pedidos), opcionalmente excluyendo un pedido. */
export function committedGrams(db, { excludeOrderId } = {}) {
  const total = new Map();
  for (const order of db.orders || []) {
    if (order.id === excludeOrderId) continue;
    for (const item of activeReservation(order)?.items || []) total.set(item.materialId, (total.get(item.materialId) ?? 0) + Number(item.grams));
  }
  return total;
}

/** Físico, comprometido y disponible de un material (gramos). */
export function stockStatus(db, material, committed = committedGrams(db)) {
  const physical = availableGrams(material);
  const reserved = round1(committed.get(material?.id) ?? 0);
  return { physical, committed: reserved, available: round1(physical - reserved) };
}

/** Libera la reserva activa del pedido (idempotente). Devuelve true si estaba activa. */
export function releaseReservation(order, { at, reason = 'MANUAL' } = {}) {
  const reservation = activeReservation(order);
  if (!reservation) return false;
  if (!RELEASE_REASONS[reason]) throw Error('Motivo de liberación inválido.');
  order.reservation = { ...reservation, status: 'RELEASED', releasedAt: at, releaseReason: reason };
  order.events ??= [];
  order.events.push({ type: 'RESERVATION_RELEASED', at, reason });
  return true;
}

// ── Stock mínimo, historial de movimientos por material y costo real vs cotizado (0.15) ─────────────────────────
/** Umbral por defecto para avisar «stock bajo» si el material no tiene uno propio. */
export const DEFAULT_MIN_STOCK_G = 250;
export const minStockOf = (material) => (Number.isFinite(Number(material?.minStockG)) && Number(material.minStockG) >= 0 && material.minStockG !== '' ? Number(material.minStockG) : DEFAULT_MIN_STOCK_G);

/** Materiales cuyo DISPONIBLE (físico − comprometido) está bajo su mínimo; el más urgente primero. */
export function lowStockMaterials(db, committed = committedGrams(db)) {
  return (db.materials || []).map((material) => ({ material, ...stockStatus(db, material, committed), min: minStockOf(material) }))
    .filter((row) => row.min > 0 && row.available < row.min)
    .sort((a, b) => a.available / a.min - b.available / b.min);
}

const STOCK_LOG_MAX = 100;
export const STOCK_LOG_REASONS = Object.freeze({ CREATED: 'Alta del material', EDIT: 'Ajuste manual (edición)' });
/** Registra en el material un cambio de stock hecho al editarlo (compra, conteo, corrección). Guarda los últimos 100. */
export function logStockChange(material, { beforeG, afterG, at, reason = 'EDIT' }) {
  const delta = Math.round((Number(afterG) - Number(beforeG)) * 10) / 10;
  if (!Number.isFinite(delta) || (delta === 0 && reason !== 'CREATED')) return null;
  const entry = { at, reason, deltaG: delta, afterG: Math.round(Number(afterG)) };
  material.stockLog = [...(material.stockLog || []), entry].slice(-STOCK_LOG_MAX);
  return entry;
}

/**
 * Historial de un material (más reciente primero): ajustes manuales del material, reservas y liberaciones de pedidos
 * (no tocan el físico) y consumos reales registrados (sí lo tocan). `physicalG` = efecto en el stock físico.
 */
export function materialMovements(db, materialId) {
  const rows = [];
  const material = (db.materials || []).find((m) => m.id === materialId);
  for (const entry of material?.stockLog || []) rows.push({ at: entry.at, kind: entry.reason === 'CREATED' ? 'CREATED' : 'ADJUST', label: STOCK_LOG_REASONS[entry.reason] || entry.reason, physicalG: entry.deltaG, committedG: 0 });
  for (const order of db.orders || []) {
    const reserved = (order.reservation?.items || []).filter((item) => item.materialId === materialId).reduce((sum, item) => sum + Number(item.grams), 0);
    if (reserved > 0) {
      rows.push({ at: order.reservation.at, kind: 'RESERVED', label: `Reservado para ${order.id}`, orderId: order.id, physicalG: 0, committedG: round1(reserved) });
      if (order.reservation.status === 'RELEASED') rows.push({ at: order.reservation.releasedAt, kind: 'RELEASED', label: `Reserva liberada · ${order.id} (${(RELEASE_REASONS[order.reservation.releaseReason] || '').toLowerCase()})`, orderId: order.id, physicalG: 0, committedG: -round1(reserved) });
    }
    for (const consumption of order.consumptions || []) {
      for (const item of consumption.items || []) {
        if (item.materialId !== materialId) continue;
        rows.push({ at: consumption.at, kind: consumption.kind, label: `${CONSUMPTION_KINDS[consumption.kind] || consumption.kind} · ${order.id}${consumption.note ? ` — ${consumption.note}` : ''}`, orderId: order.id, physicalG: -round1(Number(item.grams)), committedG: 0 });
      }
    }
  }
  return rows.filter((row) => row.at).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

/**
 * Costo REAL vs COTIZADO del filamento de un pedido (solo pedidos de cotizaciones con snapshot del motor).
 * Cotizado = material + su provisión de fallas (los consumos reales incluyen reimpresiones y desperdicio).
 * Real = gramos registrados × costo por gramo de la cotización (o el precio actual si el material no estaba).
 * La utilidad real = utilidad cotizada − (material real − material cotizado). `complete` = hay consumo de Producción.
 */
export function realVsQuoted(db, order) {
  const quote = order?.quoteId ? (db.quotes || []).find((q) => q.id === order.quoteId) : null;
  const output = quote?.calculation?.output;
  const items = output?.breakdown?.items;
  if (!Array.isArray(items) || !output.pricing) return null;
  const perGram = new Map();
  let quotedGrams = 0, quotedCost = 0;
  for (const item of items) {
    if (item.component === 'MATERIAL' && String(item.code).startsWith('material:')) {
      const materialId = String(item.code).split(':').slice(2).join(':');
      perGram.set(materialId, Number(item.basis?.unitCost) || 0);
      quotedGrams += Number(item.basis?.quantity || 0) * Number(item.basis?.multiplier || 0);
      quotedCost += Number(item.amount) || 0;
    }
    if (item.component === 'FAILURE' && String(item.derivedFrom || '').startsWith('material:')) quotedCost += Number(item.amount) || 0;
  }
  const registered = registeredConsumption(order);
  const realGrams = registered.reduce((sum, row) => sum + row.grams, 0);
  const realCost = registered.reduce((sum, row) => {
    const price = perGram.get(row.materialId) ?? (Number((db.materials || []).find((m) => m.id === row.materialId)?.priceKg) || 0) / 1000;
    return sum + row.grams * price;
  }, 0);
  const quotedUtility = Number(output.pricing.commercialUtility) || 0;
  const diff = Math.round(realCost) - Math.round(quotedCost);
  return {
    complete: (order.consumptions || []).some((c) => c.kind === 'PRODUCTION'),
    quotedGrams: round1(quotedGrams), quotedCost: Math.round(quotedCost),
    realGrams: round1(realGrams), realCost: Math.round(realCost),
    diff, quotedUtility: Math.round(quotedUtility), realUtility: Math.round(quotedUtility - diff),
  };
}
