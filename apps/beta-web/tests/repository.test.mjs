import test from 'node:test';
import assert from 'node:assert/strict';
import {MockRepository} from '../src/data/repository.js';
const map=new Map();
globalThis.localStorage={getItem:key=>map.has(key)?map.get(key):null,setItem:(key,val)=>map.set(key,val),removeItem:key=>map.delete(key)};
test('se persisten clientes e impresoras editadas',()=>{
 const data=MockRepository.reset();
 data.clients.push({id:'CLI-999',name:'Cliente local'});
 data.printers[0].lifeHours=6700;
 assert.ok(MockRepository.save(data));
 const saved=MockRepository.load();
 assert.equal(saved.clients.at(-1).name,'Cliente Local');
 assert.equal(saved.printers[0].lifeHours,6700);
});
test('migración de almacenamiento 0.1 agrega impresoras sin borrar CRM',()=>{
 const data=MockRepository.reset();delete data.printers;
 MockRepository.save(data);
 const loaded=MockRepository.load();
 assert.ok(loaded.printers.length>0);
 assert.equal(loaded.clients.length,data.clients.length);
});
test('reset vuelve al perfil de impresora de ejemplo',()=>{
 const state=MockRepository.reset();
 assert.equal(state.printers[0].name,'Bambu Lab A1');
});
test('perfiles económicos del taller se guardan y migran sin borrar presupuestos',()=>{
 const state=MockRepository.reset();
 state.shopSettings.targetMargin=42;
 state.shopSettings.packingPerUnit=700;
 state.quotes.push({id:'COT-TEST',gross:12345});
 MockRepository.save(state);
 const loaded=MockRepository.load();
 assert.equal(loaded.shopSettings.targetMargin,42);
 assert.equal(loaded.shopSettings.packingPerUnit,700);
 assert.ok(loaded.quotes.some(q=>q.id==='COT-TEST' && q.gross===12345));
 delete loaded.shopSettings;
 MockRepository.save(loaded);
 const migrated=MockRepository.load();
 assert.equal(migrated.shopSettings.targetMargin,35);
 assert.ok(migrated.quotes.some(q=>q.id==='COT-TEST'));
});
