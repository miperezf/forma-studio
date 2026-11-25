import test from 'node:test';
import assert from 'node:assert/strict';
import {MockRepository} from '../src/data/repository.js';
import {transitionQuote,acceptAndCreateOrder,linkedOrder,paymentSummary} from '../src/domain/workflow.js';
import {migrateLegacyCustomerQuote} from '../src/vendor/forma-engine.js';
/** Guarda la cotización interna y su documento comercial en colecciones separadas. */
function add(db,q){const {customerQuote,...internal}=q;db.quotes.push(internal);const doc=migrateLegacyCustomerQuote({clientName:'Cliente',project:q.project,quantity:q.quantity,gross:q.gross,createdAt:q.createdAt,...customerQuote},'');if(!doc.ok)throw Error('fixture');db.customerQuotes.push(doc.value);return internal;}

test('aceptar y crear pedido mantiene precio y genera solo una relación',()=>{
 const db=MockRepository.reset();let q={id:'COT-7898',clientId:db.clients[0].id,project:'Impresión urgente',createdAt:'2026-10-20',status:'Borrador',quantity:5,gross:27500,customerQuote:{id:'COT-7898'},events:[]};
 q=add(db,q);
 transitionQuote(db,q.id,'Enviada',{channel:'No especificado',at:'2026-10-20T18:00:00Z'});
 const order=acceptAndCreateOrder(db,q.id,{dueDate:'2026-11-01',channel:'WhatsApp',at:'2026-10-20T18:02:00Z'});
 assert.equal(q.status,'Aceptada');
 assert.equal(q.events.at(-2).channel,'WhatsApp');
 assert.equal(order.quoteId,q.id);
 assert.equal(order.amount,27500);
 assert.equal(order.quantity,5);
 assert.equal(order.status,'Pendiente');
 assert.equal(paymentSummary(order).status,'Pendiente de pago');
 assert.equal(linkedOrder(db,q.id)?.id,order.id);
 assert.equal(q.events.filter(x=>x.type==='ORDER_CREATED').length,1);
 assert.throws(()=>acceptAndCreateOrder(db,q.id,{dueDate:'2026-11-02'}),/Solo se puede aceptar/i);
});

test('fecha inválida nunca acepta parcialmente ni crea pedidos',()=>{
 const db=MockRepository.reset();let q={id:'COT-7899',clientId:db.clients[0].id,project:'Prueba',createdAt:'2026-10-20',status:'Enviada',quantity:1,gross:25000,customerQuote:{id:'COT-7899'},events:[]};
 q=add(db,q);
 const count=db.orders.length;
 assert.throws(()=>acceptAndCreateOrder(db,q.id,{dueDate:'2026-02-31',at:'2026-10-20T17:00:00Z'}),/Fecha inválida/i);
 assert.equal(q.status,'Enviada');assert.equal(db.orders.length,count);
 assert.throws(()=>acceptAndCreateOrder(db,q.id,{dueDate:'2026-10-01',at:'2026-10-20T17:00:00Z'}),/entrega no puede ser anterior/i);
 assert.equal(q.status,'Enviada');assert.equal(db.orders.length,count);
});

test('cliente eliminado bloquea la acción sin pasar a aceptada',()=>{
 const db=MockRepository.reset();let q={id:'COT-7897',clientId:'CLI-BOGUS',project:'Prueba',createdAt:'2026-10-20',status:'Enviada',quantity:1,gross:10,customerQuote:{id:'COT-7897'},events:[]};
 q=add(db,q);
 assert.throws(()=>acceptAndCreateOrder(db,q.id,{dueDate:'2026-11-01',at:'2026-10-20T18:00:00Z'}),/cliente ya no existe/i);
 assert.equal(q.status,'Enviada');
});
