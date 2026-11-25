// Panel «Hoy», stock mínimo, movimientos por material, real vs cotizado y productos frecuentes (0.15).
import test from 'node:test';
import assert from 'node:assert/strict';
import { todayAgenda, daysBetween, dueLabel, urgency } from '../src/domain/today.js';
import { lowStockMaterials, logStockChange, materialMovements, realVsQuoted, recordConsumption, DEFAULT_MIN_STOCK_G, minStockOf } from '../src/domain/inventory.js';
import { productFromQuote, deleteProduct, nextProductId, missingMaterials, whatsappNumber, whatsappLink } from '../src/domain/products.js';
import { parseBackup, createBackup } from '../src/domain/backup.js';

const TODAY = '2026-10-22';
const order = (id, status, dueDate, extra = {}) => ({ id, status, dueDate, amount: 10000, payments: [], events: [], quantity: 1, project: id, clientId: 'C', ...extra });

test('fechas: días entre fechas y etiquetas', () => {
  assert.equal(daysBetween('2026-10-22', '2026-10-25'), 3);
  assert.equal(daysBetween('2026-10-22', '2026-10-20'), -2);
  assert.equal(daysBetween('2026-10-22', null), null);
  assert.deepEqual([-2, -1, 0, 1, 5].map(dueLabel), ['atrasado 2 días', 'atrasado 1 día', 'hoy', 'mañana', 'en 5 días']);
  assert.deepEqual([-1, 0, 1, 3, 4, null].map(urgency), ['late', 'today', 'today', 'soon', 'later', 'none']);
});

test('agenda: producción por fecha, sin anulados ni entregados; por cobrar primero entregados; cotizaciones por vencer', () => {
  const db = {
    clients: [{ id: 'C' }], materials: [], meta: {},
    orders: [
      order('PED-1', 'En producción', '2026-10-25'),
      order('PED-2', 'Pendiente', '2026-10-20'),
      order('PED-3', 'Entregado', '2026-10-10', { payments: [{ amount: 4000 }] }),
      order('PED-4', 'Anulado', '2026-10-21', { cancelled: { reason: 'x' } }),
    ],
    quotes: [
      { id: 'COT-1', status: 'Enviada', issuedAt: '2026-10-20', validDays: 7 },
      { id: 'COT-2', status: 'Enviada', issuedAt: '2026-10-16', validDays: 7 },
      { id: 'COT-3', status: 'Borrador' },
    ],
  };
  const a = todayAgenda(db, TODAY);
  assert.deepEqual(a.production.map((r) => [r.order.id, r.days]), [['PED-2', -2], ['PED-1', 3]]);
  assert.equal(a.late, 1); assert.equal(a.dueSoon, 1);
  assert.deepEqual(a.quotes.map((r) => [r.quote.id, r.days, r.sentDaysAgo]), [['COT-2', 1, 6], ['COT-1', 5, 2]]);
  assert.equal(a.expiringQuotes, 1);
  assert.deepEqual(a.receivables.map((r) => [r.order.id, r.pending]), [['PED-3', 6000], ['PED-1', 10000], ['PED-2', 10000]]);
  assert.equal(a.receivableTotal, 26000);
  assert.deepEqual(a.backup, { lastAt: null, days: null, due: true });
  assert.equal(todayAgenda({ ...db, meta: { lastBackupAt: '2026-10-20T10:00:00Z' } }, TODAY).backup.due, false);
  assert.equal(todayAgenda({ ...db, meta: { lastBackupAt: '2026-10-15T10:00:00Z' } }, TODAY).backup.due, true);
  assert.equal(todayAgenda({ clients: [], quotes: [], orders: [], materials: [], meta: {} }, TODAY).backup.due, false, 'taller vacío: sin aviso');
});

test('stock bajo: disponible (físico − comprometido) bajo el mínimo propio o el por defecto', () => {
  const db = {
    materials: [{ id: 'A', stockKg: 0.2 }, { id: 'B', stockKg: 1, minStockG: 900 }, { id: 'C', stockKg: 0.1, minStockG: 0 }, { id: 'D', stockKg: 2 }],
    orders: [{ id: 'P', reservation: { status: 'ACTIVE', items: [{ materialId: 'B', grams: 200 }] } }],
  };
  assert.equal(minStockOf({}), DEFAULT_MIN_STOCK_G);
  assert.equal(minStockOf({ minStockG: 0 }), 0);
  assert.deepEqual(lowStockMaterials(db).map((r) => [r.material.id, r.available, r.min]), [['A', 200, 250], ['B', 800, 900]]);
});

test('movimientos por material: ajustes, reserva/liberación y consumos reales, más reciente primero', () => {
  const material = { id: 'M', name: 'PLA', stockKg: 1 };
  logStockChange(material, { beforeG: 0, afterG: 1000, at: '2026-10-01T10:00:00Z', reason: 'CREATED' });
  assert.equal(logStockChange(material, { beforeG: 1000, afterG: 1000, at: '2026-10-02T10:00:00Z' }), null, 'sin cambio no se registra');
  const db = { materials: [material], orders: [{ id: 'PED-1', reservation: { at: '2026-10-03T10:00:00Z', status: 'ACTIVE', items: [{ materialId: 'M', grams: 55 }] }, events: [] }] };
  recordConsumption(db, 'PED-1', { id: 'cons-00000001', at: '2026-10-04T10:00:00Z', kind: 'PRODUCTION', items: [{ materialId: 'M', grams: 60 }] });
  logStockChange(material, { beforeG: 940, afterG: 1940, at: '2026-10-05T10:00:00Z' });
  const rows = materialMovements(db, 'M');
  assert.deepEqual(rows.map((r) => [r.kind, r.physicalG, r.committedG]), [['ADJUST', 1000, 0], ['RELEASED', 0, -55], ['PRODUCTION', -60, 0], ['RESERVED', 0, 55], ['CREATED', 1000, 0]]);
  assert.equal(rows[0].kind, 'ADJUST');
  assert.ok(rows.some((r) => r.kind === 'PRODUCTION' && r.physicalG === -60 && r.label.includes('PED-1')));
  assert.ok(rows.some((r) => r.kind === 'RESERVED' && r.committedG === 55));
  assert.ok(rows.some((r) => r.kind === 'RELEASED' && r.committedG === -55));
  assert.equal(rows.at(-1).kind, 'CREATED');
  material.stockLog = Array.from({ length: 120 }, (_, i) => ({ at: `t${i}`, reason: 'EDIT', deltaG: 1, afterG: i }));
  logStockChange(material, { beforeG: 0, afterG: 5, at: 'z' });
  assert.equal(material.stockLog.length, 100);
});

test('real vs cotizado: material + provisión de fallas cotizados vs gramos registrados a costo por gramo', () => {
  const quote = { id: 'COT-1', calculation: { output: { pricing: { commercialUtility: 5000 }, breakdown: { items: [
    { component: 'MATERIAL', code: 'material:plate-1:M', amount: 1000, basis: { quantity: 50, unitCost: 20, multiplier: 1 } },
    { component: 'FAILURE', code: 'failure:material:plate-1:M', derivedFrom: 'material:plate-1:M', amount: 50 },
    { component: 'ELECTRICITY', code: 'electricity:plate-1', amount: 100, basis: { quantity: 1, unitCost: 100, multiplier: 1 } },
  ] } } } };
  const o = { id: 'PED-1', quoteId: 'COT-1', consumptions: [] };
  const db = { quotes: [quote], materials: [{ id: 'X', priceKg: 30000 }], orders: [o] };
  assert.deepEqual(realVsQuoted(db, o), { complete: false, quotedGrams: 50, quotedCost: 1050, realGrams: 0, realCost: 0, diff: -1050, quotedUtility: 5000, realUtility: 6050 });
  o.consumptions = [{ kind: 'PRODUCTION', items: [{ materialId: 'M', grams: 55 }] }, { kind: 'REPRINT', items: [{ materialId: 'M', grams: 10 }, { materialId: 'X', grams: 5 }] }];
  const r = realVsQuoted(db, o);
  assert.equal(r.complete, true);
  assert.equal(r.realGrams, 70);
  assert.equal(r.realCost, 65 * 20 + 5 * 30);
  assert.equal(r.diff, 1450 - 1050);
  assert.equal(r.realUtility, 5000 - 400);
  assert.equal(realVsQuoted(db, { id: 'PED-2' }), null, 'pedido manual: sin comparación');
});

test('productos frecuentes: sin cliente ni precios, nombre único, folio que no se reutiliza', () => {
  const db = { meta: {}, materials: [{ id: 'MAT-001' }], products: [], quotes: [
    { id: 'COT-1', project: 'Llavero AMS', formState: { clientId: 'CLI-1', project: 'Llavero AMS', materialId: 'MAT-001', extraFilaments: [{ materialId: 'MAT-009', grams: 3 }], quantity: 4 }, gross: 9999 },
    { id: 'COT-2', project: 'Antigua' },
  ] };
  const p = productFromQuote(db, 'COT-1', { at: '2026-10-22T10:00:00Z' });
  assert.equal(p.id, 'PRD-0001');
  assert.equal(p.name, 'Llavero AMS');
  assert.ok(!('clientId' in p.formState) && !('gross' in p));
  assert.throws(() => productFromQuote(db, 'COT-1', { at: 'x' }), /Ya existe/);
  assert.throws(() => productFromQuote(db, 'COT-2', { at: 'x' }), /anterior/);
  assert.throws(() => productFromQuote(db, 'COT-1', { name: ' ', at: 'x' }), /nombre/);
  assert.deepEqual(missingMaterials(db, p), ['MAT-009']);
  deleteProduct(db, 'PRD-0001');
  assert.equal(nextProductId(db), 'PRD-0002');
});

test('WhatsApp: números chilenos y enlace con texto', () => {
  assert.equal(whatsappNumber('+56 9 1234 5678'), '56912345678');
  assert.equal(whatsappNumber('9 1234 5678'), '56912345678');
  assert.equal(whatsappNumber('abc'), '');
  assert.equal(whatsappLink('', 'Hola & chao'), 'https://wa.me/?text=Hola%20%26%20chao');
});

test('respaldo: los productos viajan en el respaldo y un respaldo anterior (sin productos) se acepta', () => {
  const db = { clients: [], materials: [], printers: [], projects: [], quotes: [], customerQuotes: [], orders: [], products: [{ id: 'PRD-0001', name: 'X' }] };
  const backup = createBackup(db, { at: '2026-10-22T10:00:00Z', source: 'test' });
  assert.equal(backup.counts.products, 1);
  const old = JSON.parse(JSON.stringify(backup)); Reflect.deleteProperty(old.data, 'products');
  assert.deepEqual(parseBackup(JSON.stringify(old)).data.products, []);
});
