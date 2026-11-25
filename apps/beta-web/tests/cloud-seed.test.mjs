// La siembra inicial de la nube debe cumplir las reglas de Firestore: el documento comercial solo lleva los campos de
// la lista blanca del servidor (se lee de la plantilla de reglas, la misma fuente que se despliega).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MockRepository } from '../src/data/repository.js';

const rules = readFileSync(new URL('../../../firebase/firestore.rules.template', import.meta.url), 'utf8');
const block = rules.slice(rules.indexOf('match /customerQuotes/'));
const whitelist = [...(/hasOnly\(\[(.*?)\]\)/s.exec(block)?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);

test('lista blanca del servidor leída de la plantilla de reglas', () => {
  for (const key of ['kind', 'id', 'lines', 'total']) assert.ok(whitelist.includes(key), key);
});

for (const kind of ['demo', 'empty']) {
  test(`siembra ${kind}: documentos comerciales dentro de la lista blanca e ids presentes`, () => {
    const state = MockRepository.normalize(MockRepository.initialWorkspace(kind));
    for (const doc of state.customerQuotes) {
      assert.equal(doc.kind, 'CustomerQuote');
      assert.deepEqual(Object.keys(doc).filter((k) => !whitelist.includes(k)), [], doc.id);
    }
    for (const key of ['clients', 'materials', 'printers', 'projects', 'orders', 'quotes', 'customerQuotes']) {
      for (const entity of state[key]) assert.ok(typeof entity.id === 'string' && entity.id !== '', key);
    }
    if (kind === 'demo') assert.ok(state.quotes.every((q) => q.origin === 'DEMO'), 'cotizaciones internas marcadas DEMO');
  });
}

test('producción (taller vacío): régimen decidido por el propietario — no afecto, 0 %, confirmado', () => {
  const state = MockRepository.normalize(MockRepository.initialWorkspace('empty'));
  assert.equal(state.shopSettings.taxRegime, 'NOT_REGISTERED');
  assert.equal(state.shopSettings.taxRate, 0);
  assert.equal(state.shopSettings.taxRegimeConfirmed, true);
  assert.equal(state.quotes.length + state.orders.length + state.clients.length, 0);
});
