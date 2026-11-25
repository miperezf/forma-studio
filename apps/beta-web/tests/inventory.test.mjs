// Inventario: la cotización solo ESTIMA (v1 y v2, con última placa real); el stock se mueve únicamente con
// consumos REALES registrados (producción, reimpresión, desperdicio, corrección), una vez por registro.
import test from 'node:test';
import assert from 'node:assert/strict';
import { availableGrams, committedGrams, consumeFromMaterial, estimatedConsumption, filamentUsage, recordConsumption, registeredConsumption, releaseReservation, reservationFromQuote, returnToMaterial, stockStatus } from '../src/domain/inventory.js';
import { acceptAndCreateOrder, changeOrderStatus } from '../src/domain/workflow.js';

const calcV1 = (filaments, plates = 2) => ({
  request: { input: { plates: [{ id: 'plate-1', filaments }] }, params: { materials: { 'MAT-X': { name: 'Borrado' } } } },
  output: { breakdown: { platesRequired: [{ plateId: 'plate-1', platesRequired: plates }] } },
});
const calcV2 = (filaments, lastRun, fullPlates, source) => ({
  request: { input: { plates: [{ id: 'plate-1', filaments, ...(lastRun ? { lastRun } : {}) }] }, params: { materials: {} } },
  output: { breakdown: { platesRequired: [{ plateId: 'plate-1', platesRequired: fullPlates + 1, fullPlates, remainderParts: 1, lastRun: { source, parts: 1 } }] } },
});

test('estimación v1: gramos por placa × placas (multicolor)', () => {
  assert.deepEqual(filamentUsage(calcV1([{ materialId: 'A', grams: 300 }, { materialId: 'B', grams: 40.25 }], 3)), [{ materialId: 'A', grams: 900 }, { materialId: 'B', grams: 120.8 }]);
  assert.deepEqual(filamentUsage(null), []);
});

test('estimación v2: completas × placa completa + última placa REAL; sin datos, la última se estima como completa', () => {
  const sliced = calcV2([{ materialId: 'A', grams: 300 }, { materialId: 'B', grams: 40 }], { parts: 1, filaments: [{ materialId: 'A', grams: 105 }], printHours: 2 }, 1, 'SLICED');
  assert.deepEqual(filamentUsage(sliced), [{ materialId: 'A', grams: 405 }, { materialId: 'B', grams: 40 }]);
  const estimated = calcV2([{ materialId: 'A', grams: 300 }], null, 1, 'ESTIMATED_FULL_PLATE');
  assert.deepEqual(filamentUsage(estimated), [{ materialId: 'A', grams: 600 }]);
});

test('carretes: consumir abre carretes; devolver los vuelve a cerrar', () => {
  const m = { spoolNetG: 1000, spools: 2, openRemainingG: 400, stockKg: 2.4 };
  assert.equal(availableGrams(m), 2400);
  assert.deepEqual(consumeFromMaterial(m, 1500), { spools: 0, openRemainingG: 900, stockKg: 0.9, shortfallG: 0 });
  assert.deepEqual(consumeFromMaterial(m, 2600), { spools: 0, openRemainingG: 0, stockKg: 0, shortfallG: 200 });
  assert.deepEqual(returnToMaterial({ spoolNetG: 1000, spools: 0, openRemainingG: 900 }, 300), { spools: 1, openRemainingG: 200, stockKg: 1.2, shortfallG: 0 });
  assert.deepEqual(returnToMaterial({ stockKg: 1 }, 250), { stockKg: 1.25, shortfallG: 0 });
});

const dbOf = () => ({
  materials: [{ id: 'A', name: 'PLA Negro', spoolNetG: 1000, spools: 1, openRemainingG: 500, stockKg: 1.5 }, { id: 'B', name: 'PETG', stockKg: 1 }],
  quotes: [{ id: 'COT-1', calculation: calcV1([{ materialId: 'A', grams: 300 }, { materialId: 'B', grams: 50 }], 2) }],
  orders: [{ id: 'PED-1', quoteId: 'COT-1', status: 'Preparación', events: [] }],
});

test('pasar a «En producción» NO descuenta inventario (la estimación no es consumo)', () => {
  const db = dbOf();
  changeOrderStatus(db, 'PED-1', 'En producción', { at: 't' });
  assert.equal(db.materials[0].stockKg, 1.5);
  assert.equal(db.materials[1].stockKg, 1);
  assert.equal(db.orders[0].consumptions, undefined);
  assert.deepEqual(estimatedConsumption(db, db.orders[0]).map((e) => [e.materialId, e.grams, e.name]), [['A', 600, 'PLA Negro'], ['B', 100, 'PETG']]);
});

test('consumo real: descuenta lo registrado (no lo estimado), una vez por id; reimpresión y desperdicio suman', () => {
  const db = dbOf();
  const first = recordConsumption(db, 'PED-1', { id: 'cons-00000001', at: 't1', kind: 'PRODUCTION', items: [{ materialId: 'A', grams: 620 }, { materialId: 'B', grams: 95 }] });
  assert.deepEqual(first.items.map((i) => [i.materialId, i.grams]), [['A', 620], ['B', 95]]);
  assert.deepEqual([db.materials[0].spools, db.materials[0].openRemainingG, db.materials[0].stockKg], [0, 880, 0.88]);
  assert.equal(db.materials[1].stockKg, 0.905);
  // idempotente: el mismo id (doble clic, otro dispositivo) no vuelve a descontar
  assert.equal(recordConsumption(db, 'PED-1', { id: 'cons-00000001', at: 't2', kind: 'PRODUCTION', items: [{ materialId: 'A', grams: 620 }] }), first);
  assert.equal(db.materials[0].stockKg, 0.88);
  recordConsumption(db, 'PED-1', { id: 'cons-00000002', at: 't3', kind: 'REPRINT', items: [{ materialId: 'A', grams: 300 }], note: 'falló la placa 2' });
  recordConsumption(db, 'PED-1', { id: 'cons-00000003', at: 't4', kind: 'WASTE', items: [{ materialId: 'A', grams: 15 }] });
  assert.deepEqual(registeredConsumption(db.orders[0]), [{ materialId: 'A', grams: 935 }, { materialId: 'B', grams: 95 }]);
  assert.equal(db.orders[0].consumptions.length, 3);
  assert.equal(db.orders[0].events.at(-1).type, 'CONSUMPTION_RECORDED');
});

test('corrección: puede devolver material (negativo); otros tipos no aceptan negativos ni registros vacíos', () => {
  const db = dbOf();
  recordConsumption(db, 'PED-1', { id: 'cons-00000001', at: 't', items: [{ materialId: 'A', grams: 600 }] });
  recordConsumption(db, 'PED-1', { id: 'cons-00000002', at: 't', kind: 'ADJUSTMENT', items: [{ materialId: 'A', grams: -100 }] });
  assert.equal(db.materials[0].stockKg, 1);
  assert.deepEqual(registeredConsumption(db.orders[0]), [{ materialId: 'A', grams: 500 }]);
  assert.throws(() => recordConsumption(db, 'PED-1', { id: 'cons-00000003', at: 't', kind: 'REPRINT', items: [{ materialId: 'A', grams: -5 }] }), /no pueden ser negativos/);
  assert.throws(() => recordConsumption(db, 'PED-1', { id: 'cons-00000004', at: 't', items: [] }), /al menos un material/);
  assert.throws(() => recordConsumption(db, 'PED-1', { id: 'x', at: 't', items: [{ materialId: 'A', grams: 1 }] }), /Identificador/);
});

test('stock insuficiente y material eliminado: se registra el faltante, no rompe', () => {
  const db = dbOf();
  const entry = recordConsumption(db, 'PED-1', { id: 'cons-00000001', at: 't', items: [{ materialId: 'B', grams: 1200 }, { materialId: 'X', grams: 10 }] });
  assert.deepEqual(entry.items.map((i) => [i.materialId, i.shortfallG, Boolean(i.missing)]), [['B', 200, false], ['X', 10, true]]);
  assert.equal(db.materials[1].stockKg, 0);
});

test('reserva: nace con el pedido (estimación), no toca el físico y reduce el disponible', () => {
  const quote = { id: 'COT-1', calculation: calcV1([{ materialId: 'A', grams: 300 }, { materialId: 'B', grams: 50 }], 2) };
  const r = reservationFromQuote(quote, 't0');
  assert.deepEqual(r, { at: 't0', source: 'QUOTE_ESTIMATE', status: 'ACTIVE', items: [{ materialId: 'A', name: 'A', grams: 600 }, { materialId: 'B', name: 'B', grams: 100 }] });
  assert.equal(reservationFromQuote({ id: 'X' }, 't'), null, 'cotización sin snapshot: sin reserva');
  const db = dbOf();
  db.orders[0].reservation = r;
  db.orders.push({ id: 'PED-2', reservation: { ...r, items: [{ materialId: 'A', name: 'A', grams: 1000 }] } });
  assert.deepEqual([...committedGrams(db)], [['A', 1600], ['B', 100]]);
  assert.deepEqual(stockStatus(db, db.materials[0]), { physical: 1500, committed: 1600, available: -100 });
  assert.deepEqual([...committedGrams(db, { excludeOrderId: 'PED-2' })], [['A', 600], ['B', 100]]);
  assert.equal(db.materials[0].stockKg, 1.5, 'reservar no descuenta el físico');
});

test('aceptar + pedido crea la reserva desde el snapshot de la cotización', () => {
  const db = { clients: [{ id: 'CLI-1' }], materials: [], orders: [], customerQuotes: [{ kind: 'CustomerQuote', id: 'COT-9', lines: [], total: 48000 }], quotes: [{ id: 'COT-9', clientId: 'CLI-1', status: 'Enviada', project: 'P', quantity: 8, gross: 48000, calculationVersion: 'v2', issuedAt: '2026-10-20', validDays: 7, calculation: calcV1([{ materialId: 'A', grams: 340 }], 2), events: [] }] };
  const order = acceptAndCreateOrder(db, 'COT-9', { dueDate: '2026-11-04', at: '2026-10-21T10:00:00Z' });
  assert.deepEqual(order.reservation, { at: '2026-10-21T10:00:00Z', source: 'QUOTE_ESTIMATE', status: 'ACTIVE', items: [{ materialId: 'A', name: 'A', grams: 680 }] });
});

test('el consumo real de PRODUCCIÓN libera la reserva completa; reimpresión no; liberar a mano es idempotente', () => {
  const db = dbOf();
  db.orders[0].reservation = reservationFromQuote(db.quotes[0], 't0');
  recordConsumption(db, 'PED-1', { id: 'cons-00000001', at: 't1', kind: 'REPRINT', items: [{ materialId: 'A', grams: 20 }] });
  assert.equal(db.orders[0].reservation.status, 'ACTIVE');
  recordConsumption(db, 'PED-1', { id: 'cons-00000002', at: 't2', kind: 'PRODUCTION', items: [{ materialId: 'A', grams: 620 }, { materialId: 'B', grams: 90 }] });
  assert.deepEqual([db.orders[0].reservation.status, db.orders[0].reservation.releaseReason, db.orders[0].reservation.releasedAt], ['RELEASED', 'CONSUMED', 't2']);
  assert.deepEqual([...committedGrams(db)], []);
  assert.equal(releaseReservation(db.orders[0], { at: 't3' }), false);
  const other = { id: 'PED-3', reservation: { status: 'ACTIVE', items: [{ materialId: 'A', grams: 5 }] } };
  assert.equal(releaseReservation(other, { at: 't4', reason: 'MANUAL' }), true);
  assert.equal(other.reservation.releaseReason, 'MANUAL');
  assert.equal(other.reservation.items[0].grams, 5, 'los gramos reservados quedan como historial');
});
