// Corrección de estado y anulación de pedidos (0.13). Puro: sin DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { changeOrderStatus, revertOrderStatus, cancelOrder, recordPayment, paymentSummary, nextOrderStatus, previousOrderStatus, isOrderCancelled, ORDER_CANCELLED } from '../src/domain/workflow.js';
import { recordConsumption, committedGrams } from '../src/domain/inventory.js';

const at = '2026-10-21T12:00:00.000Z';
const later = '2026-10-21T13:00:00.000Z';
function workspace(status = 'Pendiente', extra = {}) {
  const order = { id: 'PED-0001', quoteId: 'COT-0001', clientId: 'CLI-0001', amount: 24200, quantity: 2, status, payments: [], events: [{ type: 'ORDER_CREATED', at }],
    reservation: { at, source: 'QUOTE_ESTIMATE', status: 'ACTIVE', items: [{ materialId: 'MAT-1', name: 'PLA Basic Black', grams: 55.2 }] }, ...extra };
  return { orders: [order], materials: [{ id: 'MAT-1', name: 'PLA Basic Black', stockKg: 1, spools: 1, spoolNetG: 1000, openRemainingG: 0 }] };
}

test('siguiente / anterior estado', () => {
  assert.equal(nextOrderStatus({ status: 'Pendiente' }), 'Preparación');
  assert.equal(nextOrderStatus({ status: 'Entregado' }), null);
  assert.equal(previousOrderStatus({ status: 'Pendiente' }), null);
  assert.equal(previousOrderStatus({ status: 'Entregado' }), 'En producción');
  assert.equal(nextOrderStatus({ status: ORDER_CANCELLED }), null);
  assert.equal(previousOrderStatus({ status: ORDER_CANCELLED }), null);
});

test('volver atrás: un paso, motivo obligatorio, queda en el historial y borra la fecha de entrega', () => {
  const db = workspace('En producción');
  changeOrderStatus(db, 'PED-0001', 'Entregado', { at });
  const order = db.orders[0];
  assert.equal(order.deliveredAt, at);
  assert.throws(() => revertOrderStatus(db, 'PED-0001', { reason: '' }), /motivo/);
  assert.throws(() => revertOrderStatus(db, 'PED-0001', { reason: 'ok' }), /motivo/);
  revertOrderStatus(db, 'PED-0001', { reason: '  Marqué  entregado por error ', at: later });
  assert.equal(order.status, 'En producción');
  assert.ok(!('deliveredAt' in order));
  assert.deepEqual(order.events.at(-1), { type: 'PRODUCTION_REVERTED', from: 'Entregado', to: 'En producción', at: later, reason: 'Marqué entregado por error' });
  // No toca la reserva, el importe ni los abonos.
  assert.equal(order.reservation.status, 'ACTIVE');
  assert.equal(order.amount, 24200);
  // Puede volver a avanzar normalmente.
  changeOrderStatus(db, 'PED-0001', 'Entregado', { at: later });
  assert.equal(order.status, 'Entregado');
});

test('volver atrás desde Pendiente no es posible', () => {
  const db = workspace('Pendiente');
  assert.throws(() => revertOrderStatus(db, 'PED-0001', { reason: 'error de prueba' }), /primer estado/);
});

test('el motivo se limita a 140 caracteres', () => {
  const db = workspace('Preparación');
  revertOrderStatus(db, 'PED-0001', { reason: 'x'.repeat(400), at });
  assert.equal(db.orders[0].events.at(-1).reason.length, 140);
});

test('anular: libera la reserva, conserva abonos e historial, saldo 0 y sin nuevos abonos', () => {
  const db = workspace('Preparación');
  recordPayment(db, 'PED-0001', { amount: 10000, paymentId: 'pago-abcdef01', at });
  assert.equal(committedGrams(db).get('MAT-1'), 55.2);
  cancelOrder(db, 'PED-0001', { reason: 'Cliente desistió', at: later });
  const order = db.orders[0];
  assert.ok(isOrderCancelled(order));
  assert.deepEqual(order.cancelled, { at: later, reason: 'Cliente desistió', fromStatus: 'Preparación' });
  assert.equal(order.reservation.status, 'RELEASED');
  assert.equal(order.reservation.releaseReason, 'CANCELLED');
  assert.equal(committedGrams(db).get('MAT-1') ?? 0, 0);
  assert.equal(order.payments.length, 1);
  assert.deepEqual(paymentSummary(order), { paid: 10000, pending: 0, status: 'Anulado con abonos' });
  assert.throws(() => recordPayment(db, 'PED-0001', { amount: 1000, paymentId: 'pago-abcdef02', at }), /anulado/);
  assert.throws(() => changeOrderStatus(db, 'PED-0001', 'En producción', { at }), /anulado/);
  assert.throws(() => revertOrderStatus(db, 'PED-0001', { reason: 'deshacer', at }), /anulado/);
  assert.throws(() => cancelOrder(db, 'PED-0001', { reason: 'otra vez', at }), /ya está anulado/);
  const types = order.events.map((e) => e.type);
  assert.deepEqual(types.slice(-2), ['ORDER_CANCELLED', 'RESERVATION_RELEASED']);
});

test('anular exige motivo y no modifica nada si falta', () => {
  const db = workspace('Pendiente');
  const before = JSON.stringify(db);
  assert.throws(() => cancelOrder(db, 'PED-0001', { reason: ' ' }), /motivo/);
  assert.equal(JSON.stringify(db), before);
});

test('pedido anulado sin abonos: estado «Anulado»; el filamento ya usado se puede registrar igual', () => {
  const db = workspace('En producción');
  cancelOrder(db, 'PED-0001', { reason: 'Falla de diseño', at });
  assert.equal(paymentSummary(db.orders[0]).status, 'Anulado');
  recordConsumption(db, 'PED-0001', { id: 'cons-abcdef01', at: later, kind: 'WASTE', items: [{ materialId: 'MAT-1', grams: 30 }] });
  assert.equal(db.materials[0].stockKg, 0.97);
});

test('pedido manual sin reserva: se anula igual', () => {
  const db = workspace('Pendiente', { quoteId: undefined, reservation: undefined });
  cancelOrder(db, 'PED-0001', { reason: 'Duplicado', at });
  assert.equal(db.orders[0].status, 'Anulado');
  assert.equal(db.orders[0].events.at(-1).type, 'ORDER_CANCELLED');
});
