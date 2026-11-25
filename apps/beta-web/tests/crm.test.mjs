import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeClientName, clientRelations, allocateClientId, removeOrArchiveClient} from '../src/domain/crm.js';
import {MockRepository} from '../src/data/repository.js';
const map=new Map();
globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
test('capitaliza nombres ingresados en mayúsculas, minúsculas, tildes y apellidos compuestos',()=>{
 assert.equal(normalizeClientName('  LUCAS    MARTINO '),'Lucas Martino');
 assert.equal(normalizeClientName('MARÍA-JOSÉ DE LA CRUZ'),'María-José de la Cruz');
 assert.equal(normalizeClientName("JUAN O'CONNOR"),"Juan O'Connor");
 assert.equal(normalizeClientName('ÁNGEL MUÑOZ'),'Ángel Muñoz');
});
test('nombres existentes se migran, conservando historial de cotizaciones',()=>{
 const db=MockRepository.reset();
 db.clients[0].name='CAMILA RODRÍGUEZ';
 MockRepository.save(db);
 const loaded=MockRepository.load();
 assert.equal(loaded.clients[0].name,'Camila Rodríguez');
 // el documento comercial histórico vive en su colección y conserva el nombre con el que se emitió
 assert.equal(loaded.customerQuotes.find(c=>c.id===loaded.quotes[0].id).clientName,'Camila Rodríguez');
 assert.equal(MockRepository.load().clients[0].name,'Camila Rodríguez');
});
test('historial distingue pedidos entregados de cotizaciones aún no cobradas',()=>{
 const db=MockRepository.reset();
 const h=clientRelations(db,'CLI-001');
 assert.equal(h.orders.length,1);
 assert.equal(h.quotes.length,1);
 assert.equal(h.projects.length,1);
 assert.equal(h.deliveredAmount,0);
 assert.equal(h.deliveredCount,0);
 db.orders[0].status='Entregado';
 assert.equal(clientRelations(db,'CLI-001').deliveredAmount,68500);
});
test('archiva clientes vinculados sin borrar pedidos, cotizaciones o proyectos',()=>{
 const db=MockRepository.reset();
 const n=db.orders.length, q=db.quotes.length, p=db.projects.length;
 assert.equal(removeOrArchiveClient(db,'CLI-001','2026-10-20'),'archived');
 assert.equal(db.clients.find(c=>c.id==='CLI-001').archivedAt,'2026-10-20');
 assert.equal(db.orders.length,n);assert.equal(db.quotes.length,q);assert.equal(db.projects.length,p);
});
test('elimina definitivamente clientes sin historial y no reutiliza su ID',()=>{
 const db=MockRepository.reset();
 const id=allocateClientId(db);
 db.clients.push({id,name:'Lucas Martino',createdAt:'2026-10-20'});
 assert.equal(removeOrArchiveClient(db,id,'2026-10-20'),'deleted');
 assert.ok(!db.clients.some(c=>c.id===id));
 assert.notEqual(allocateClientId(db),id);
});
test('no elimina entidades si el cliente no existe',()=>{
 const db=MockRepository.reset();
 assert.throws(()=>removeOrArchiveClient(db,'CLI-NOPE','2026-10-20'),/no encontrado/i);
});
