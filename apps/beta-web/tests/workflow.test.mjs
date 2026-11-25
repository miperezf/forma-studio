import test from 'node:test';
import assert from 'node:assert/strict';
import {MockRepository} from '../src/data/repository.js';
import {transitionQuote,expireOpenQuotes,createOrderFromQuote,linkedOrder,cloneQuoteRevision,changeOrderStatus,recordPayment,paymentSummary,validThrough,deleteQuoteDraft,nextQuoteId,customerQuoteOf} from '../src/domain/workflow.js';
import {migrateLegacyCustomerQuote} from '../src/vendor/forma-engine.js';
const bag=new Map();globalThis.localStorage={getItem:k=>bag.get(k)??null,setItem:(k,v)=>bag.set(k,v),removeItem:k=>bag.delete(k)};
const at='2026-10-20T13:20:00.000Z';
/** Borrador interno + documento comercial en SU colección (separación física, Beta 0.6). */
function draft(db,id='COT-7001',opts={}){const q={id,clientId:'CLI-002',status:'Borrador',createdAt:'2026-10-20',project:'Soporte',quantity:3,gross:18500,validDays:7,calculationVersion:'DEMO',events:[{type:'CREATED',at}],...opts};db.quotes.push(q);
 const doc=migrateLegacyCustomerQuote({id,clientName:'Matías Herrera',project:'Soporte',quantity:3,gross:18500,validDays:q.validDays,createdAt:q.createdAt,lines:[{description:'Soporte',quantity:1,total:18500}]},'');
 if(!doc.ok)throw Error('fixture');db.customerQuotes.push(doc.value);return q;}
test('flujo transiciones autorizadas, con fecha, canal y documento seguro',()=>{const db=MockRepository.reset();const q=draft(db);
 assert.throws(()=>transitionQuote(db,q.id,'Aceptada'),/No se puede/);
 transitionQuote(db,q.id,'Enviada',{at,channel:'WhatsApp'});
 assert.equal(q.sentAt,at);assert.equal(customerQuoteOf(db,q.id).createdAt,'2026-10-20');assert.ok(!('status' in customerQuoteOf(db,q.id)));assert.equal(q.events.at(-1).channel,'WhatsApp');
 assert.throws(()=>transitionQuote(db,q.id,'Enviada',{at}),/No se puede/);
 transitionQuote(db,q.id,'Aceptada',{at});
 assert.equal(q.status,'Aceptada');assert.equal(q.events.length,3);
 assert.throws(()=>transitionQuote(db,q.id,'Rechazada'),/No se puede/);
});
test('Borrador y Aceptada no vencen; solo enviada tras fecha límite',()=>{const db=MockRepository.reset();const q=draft(db);
 assert.equal(validThrough(q),'2026-10-27');
 assert.equal(expireOpenQuotes(db,'2026-11-01',at),1); // seed COT-0204, Enviada
 assert.equal(q.status,'Borrador');
 transitionQuote(db,q.id,'Enviada',{at});
 assert.equal(expireOpenQuotes(db,'2026-10-27',at),0);
 assert.equal(expireOpenQuotes(db,'2026-10-28',at),1);
 assert.equal(q.status,'Vencida');assert.equal(expireOpenQuotes(db,'2026-10-29',at),0);
 assert.throws(()=>transitionQuote(db,q.id,'Aceptada',{at}),/No se puede/);
});
test('validez comienza al confirmar emisión, no al guardar el borrador',()=>{const db=MockRepository.reset();const q=draft(db,'COT-7002',{createdAt:'2026-01-01'});
 transitionQuote(db,q.id,'Enviada',{at});assert.equal(q.issuedAt,'2026-10-20');assert.equal(validThrough(q),'2026-10-27');assert.equal(customerQuoteOf(db,q.id).createdAt,'2026-10-20');
});
test('solo aceptadas producen pedidos y no se duplican; precio y referencias fijos',()=>{const db=MockRepository.reset();const q=draft(db);assert.throws(()=>createOrderFromQuote(db,q.id,{dueDate:'2026-11-02'}),/aceptada/i);
 transitionQuote(db,q.id,'Enviada',{at});transitionQuote(db,q.id,'Aceptada',{at});
 const order=createOrderFromQuote(db,q.id,{dueDate:'2026-11-03',at});
 assert.equal(order.amount,18500);assert.equal(order.quoteId,q.id);assert.equal(order.quantity,3);assert.equal(linkedOrder(db,q.id)?.id,order.id);
 assert.equal(order.status,'Pendiente');assert.equal(paymentSummary(order).status,'Pendiente de pago');
 assert.throws(()=>createOrderFromQuote(db,q.id,{dueDate:'2026-11-04'}),/pedido asociado/i);
 q.gross=999999;assert.equal(order.amount,18500);assert.equal(order.agreedQuote.gross,18500);
});
test('producción avanza de forma secuencial y no altera el cobro',()=>{const db=MockRepository.reset();const o=db.orders[1];
 assert.throws(()=>changeOrderStatus(db,o.id,'Entregado',{at}),/siguiente/i);
 changeOrderStatus(db,o.id,'Preparación',{at});changeOrderStatus(db,o.id,'En producción',{at});changeOrderStatus(db,o.id,'Entregado',{at});
 assert.equal(o.status,'Entregado');assert.equal(paymentSummary(o).paid,0);assert.equal(o.events.length,3);
 assert.throws(()=>changeOrderStatus(db,o.id,'Preparación',{at}),/siguiente/);
});
test('pagos parciales y completos auditables, con validación de sobrepago y negativos',()=>{const db=MockRepository.reset();const o=db.orders[0];
 assert.throws(()=>recordPayment(db,o.id,{amount:0}),/positivo/i);
 assert.throws(()=>recordPayment(db,o.id,{amount:o.amount+1}),/saldo/i);
 recordPayment(db,o.id,{amount:10000,method:'Transferencia',at});
 assert.equal(paymentSummary(o).status,'Abonado');assert.equal(paymentSummary(o).pending,o.amount-10000);
 recordPayment(db,o.id,{amount:o.amount-10000,method:'Efectivo',at});
 assert.equal(paymentSummary(o).status,'Pagado');assert.equal(paymentSummary(o).pending,0);
 assert.throws(()=>recordPayment(db,o.id,{amount:1}),/saldo/i);
 assert.ok(o.events.some(e=>e.type==='PAYMENT_RECORDED'));
});
test('revisiones con snapshots independientes; historial original intacto',()=>{const db=MockRepository.reset();const q=draft(db,'COT-7003',{inputSnapshot:{machineId:'MAC-001',quantity:3}});
 transitionQuote(db,q.id,'Enviada',{at});const r=cloneQuoteRevision(db,q.id,{at});
 assert.equal(r.status,'Borrador');assert.equal(r.revisionOf,q.id);assert.equal(r.revision,2);
 assert.equal(r.gross,q.gross);assert.equal(customerQuoteOf(db,r.id).id,r.id);assert.ok(!('customerQuote' in r));assert.equal(q.status,'Enviada');
 r.inputSnapshot.quantity=4;assert.equal(q.inputSnapshot.quantity,3);
 assert.equal(r.events[0].type,'REVISION_CREATED');assert.equal(r.orderId,undefined);
});
test('documento comercial de la revisión sin internal costBreakdown',()=>{const db=MockRepository.reset();const q=draft(db,'COT-7004',{costBreakdown:{internalCost:7000},economicCost:7000});
 transitionQuote(db,q.id,'Enviada',{at});const r=cloneQuoteRevision(db,q.id,{at});
 const exposed=JSON.stringify(customerQuoteOf(db,r.id));
 assert.ok(!exposed.includes('internalCost'));assert.ok(!exposed.includes('economicCost'));
});


test('eliminar borrador conserva al cliente y sus pedidos, pero lo retira del CRM',()=>{
 const db=MockRepository.reset();const originalClientCount=db.clients.length,originalOrderCount=db.orders.length;
 const q=draft(db,'COT-7020');
 const deleted=deleteQuoteDraft(db,q.id);
 assert.equal(deleted.id,q.id);
 assert.ok(!db.quotes.some(x=>x.id===q.id));
 assert.equal(db.clients.length,originalClientCount);
 assert.equal(db.orders.length,originalOrderCount);
 assert.throws(()=>deleteQuoteDraft(db,q.id),/no encontrada/i);
});

test('no es posible borrar cotizaciones enviadas, aceptadas ni vinculadas',()=>{
 const db=MockRepository.reset(); const q=draft(db,'COT-7021');
 transitionQuote(db,q.id,'Enviada',{at});
 assert.throws(()=>deleteQuoteDraft(db,q.id),/solo puedes eliminar/i);
 assert.ok(db.quotes.some(x=>x.id===q.id));
 transitionQuote(db,q.id,'Aceptada',{at});
 createOrderFromQuote(db,q.id,{dueDate:'2026-11-02',at});
 assert.throws(()=>deleteQuoteDraft(db,q.id),/solo puedes eliminar/i);
 assert.ok(db.orders.some(x=>x.quoteId===q.id));
 const corrupted=draft(db,'COT-7022',{orderId:'PED-9999'});
 assert.throws(()=>deleteQuoteDraft(db,corrupted.id),/vinculada/i);
 assert.ok(db.quotes.some(x=>x.id===corrupted.id));
});

test('un borrador de revisión se elimina sin alterar la cotización original',()=>{
 const db=MockRepository.reset();const q=draft(db,'COT-7023');
 transitionQuote(db,q.id,'Enviada',{at});const r=cloneQuoteRevision(db,q.id,{at});
 deleteQuoteDraft(db,r.id);
 assert.ok(db.quotes.some(x=>x.id===q.id&&x.status==='Enviada'));
 assert.ok(!db.quotes.some(x=>x.id===r.id));
});

test('el folio de un borrador eliminado jamás se reutiliza',()=>{
 const db=MockRepository.reset();
 const id1=nextQuoteId(db),q=draft(db,id1);
 deleteQuoteDraft(db,q.id);
 const id2=nextQuoteId(db);
 assert.ok(Number(id2.slice(4))>Number(id1.slice(4)));
 const replacement=draft(db,id2);
 transitionQuote(db,replacement.id,'Enviada',{at});
 const revision=cloneQuoteRevision(db,replacement.id,{at});
 assert.ok(Number(revision.id.slice(4))>Number(id2.slice(4)));
});

test('protege contra eliminación de un borrador referenciado por otro registro',()=>{
 const db=MockRepository.reset();const q=draft(db,'COT-7030');
 const other=draft(db,'COT-7031',{events:[{type:'REVISION_CREATED',fromQuote:q.id,at}]});
 assert.throws(()=>deleteQuoteDraft(db,q.id),/referencia/i);
 assert.ok(db.quotes.includes(q));assert.ok(db.quotes.includes(other));
});

test('idempotencia: folio de pedido externo y pago con id único no se duplican',()=>{
 const db=MockRepository.reset();const q=draft(db,'COT-7101');
 transitionQuote(db,q.id,'Enviada',{at});transitionQuote(db,q.id,'Aceptada',{at});
 const o=createOrderFromQuote(db,q.id,{dueDate:'2026-11-02',at,orderId:'PED-0042'});
 assert.equal(o.id,'PED-0042');
 assert.throws(()=>createOrderFromQuote(db,q.id,{dueDate:'2026-11-02',orderId:'PED-0043'}),/ya tiene un pedido/);
 const p1=recordPayment(db,o.id,{amount:5000,at,paymentId:'pago-abc-001'});
 const p2=recordPayment(db,o.id,{amount:5000,at,paymentId:'pago-abc-001'});
 assert.equal(p1,p2);assert.equal(o.payments.length,1);
 assert.throws(()=>recordPayment(db,o.id,{amount:7000,at,paymentId:'pago-abc-001'}),/otro importe/);
 assert.throws(()=>recordPayment(db,o.id,{amount:1,at,paymentId:'x'}),/inválido/);
 assert.throws(()=>createOrderFromQuote(db,'COT-0203',{dueDate:'2026-11-02',orderId:'PED-0042'}),/Solo se puede convertir|ya existe|ya tiene/);
});
