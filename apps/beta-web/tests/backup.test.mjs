// Respaldo manual: ida y vuelta completa, validación del archivo y restauración NO destructiva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MockRepository } from '../src/data/repository.js';
import { BACKUP_COLLECTIONS, backupFileName, createBackup, mergeMissing, parseBackup } from '../src/domain/backup.js';

const AT = '2026-10-21T04:00:00.000Z';
const demo = () => MockRepository.normalize(MockRepository.initialWorkspace('demo'));

test('ida y vuelta: el respaldo contiene todo y se vuelve a leer igual', () => {
  const db = demo();
  const backup = createBackup(db, { at: AT, source: 'prueba' });
  assert.equal(backupFileName(AT), 'forma-respaldo-2026-10-21.json');
  for (const key of BACKUP_COLLECTIONS) assert.equal(backup.counts[key], db[key].length, key);
  const { data, exportedAt } = parseBackup(JSON.stringify(backup));
  assert.equal(exportedAt, AT);
  for (const key of BACKUP_COLLECTIONS) assert.deepEqual(data[key], JSON.parse(JSON.stringify(db[key])), key);
  assert.deepEqual(data.shopSettings, JSON.parse(JSON.stringify(db.shopSettings)));
});

test('restaurar en un taller vacío recupera todo; en uno lleno no toca nada', () => {
  const source = demo();
  const { data } = parseBackup(JSON.stringify(createBackup(source, { at: AT })));
  const empty = MockRepository.normalize(MockRepository.initialWorkspace('empty'));
  const firstMaterials = empty.materials.length;
  const r1 = mergeMissing(empty, data, { restoredFrom: 'r.json' });
  assert.equal(empty.quotes.length, source.quotes.length);
  assert.equal(empty.orders.length, source.orders.length);
  const incoming = BACKUP_COLLECTIONS.reduce((total, key) => total + data[key].length, 0);
  assert.ok(r1.added > 0 && r1.added + r1.skipped === incoming, JSON.stringify(r1));
  assert.ok(empty.materials.length >= firstMaterials);
  assert.ok(empty.quotes.every((q) => q.restoredFrom === 'r.json'));
  assert.ok(empty.customerQuotes.every((c) => !('restoredFrom' in c)), 'documento comercial sin marcas (lista blanca)');

  const full = demo();
  const before = JSON.stringify(full);
  const order = full.orders[0];
  const changed = { ...data, orders: data.orders.map((o) => (o.id === order.id ? { ...o, amount: 1 } : o)) };
  const r2 = mergeMissing(full, changed, { restoredFrom: 'r.json' });
  assert.equal(r2.added, 0);
  assert.equal(JSON.stringify(full), before, 'nunca sobrescribe');
});

test('archivos inválidos: mensajes claros, sin tocar datos', () => {
  assert.throws(() => parseBackup(''), /vacío/);
  assert.throws(() => parseBackup('{'), /JSON ilegible/);
  assert.throws(() => parseBackup('{"format":"otro"}'), /no es un respaldo de FORMA/);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'forma-studio-backup', version: 99, data: {} })), /no soportada/);
  const broken = createBackup(demo(), { at: AT });
  broken.data.orders[0].id = '';
  assert.throws(() => parseBackup(JSON.stringify(broken)), /sin id en «orders»/);
});
