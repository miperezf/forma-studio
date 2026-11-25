import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MockRepository, INTERNAL_KEY, CUSTOMER_KEY, LEGACY_KEY} from '../src/data/repository.js';
import {transitionQuote,acceptAndCreateOrder,createOrderFromQuote,recordPayment,paymentSummary,cloneQuoteRevision,deleteQuoteDraft,customerQuoteOf,issuanceProblem,nextQuoteId,updateDraftConditions} from '../src/domain/workflow.js';
import {quoteService,customerQuoteText,CUSTOMER_QUOTE_KEYS} from '../src/vendor/forma-engine.js';

const store=new Map();
let failOn=null;
globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{if(k===failOn)throw Error('cuota excedida');store.set(k,v);},removeItem:k=>store.delete(k)};
const AT='2026-10-20T15:00:00.000Z';
const FORM={clientId:'CLI-001',project:'Macetero geométrico',machineId:'MAC-001',materialId:'MAT-001',quantity:'8',partsPerPlate:'4',plateWeightGr:'340',plateHours:'5.5',channel:'direct'};
const ctx=db=>({shop:{shopSettings:db.shopSettings,printers:db.printers,materials:db.materials},clientName:db.clients.find(c=>c.id==='CLI-001').name,resolvedAt:AT,today:'2026-10-20'});
const FORBIDDEN=['economicCost','margin','realMargin','commercialMargin','commission','costBreakdown','breakdown','snapshot','inputSnapshot','formState','markup','failureRate','rawAmount','pooledAmount','vatRecoverable','purchasePrice','ratePerHour','costProfile','pricingProfile','commercialUtility','realUtility','pricingPool','costBasis','sourceItemCodes','floorNetTotal','calculation','params','profileRefs','issuance','flags'];
const keysOf=v=>Array.isArray(v)?v.flatMap(keysOf):v&&typeof v==='object'?Object.entries(v).flatMap(([k,x])=>[k,...keysOf(x)]):[];
function saveDraft(db,raw=FORM,extras=[],opts={}){
  const id=nextQuoteId(db);
  const r=quoteService.createDraft(raw,extras,ctx(db),{id,...opts});
  if(!r.ok)throw Error(JSON.stringify(r.error));
  db.quotes.push(r.value.internal);db.customerQuotes.push(r.value.customer);
  return r.value;
}

test('la UI ya no importa el estimador demo ni el CustomerQuote del prototipo',()=>{
  for(const file of ['src/ui/app.js','src/data/repository.js','src/domain/workflow.js']){
    const code=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.doesNotMatch(code,/quote-estimate\.js|estimateQuote|legacy\/customer-quote/,file);
  }
});

test('flujo completo con el motor v1: borrador → enviada → aceptar + pedido → pagos; precio congelado',()=>{
  store.clear();const db=MockRepository.reset();
  const {internal,customer}=saveDraft(db);
  assert.equal(internal.calculationVersion,'v2');
  assert.equal(internal.gross,48000);assert.equal(customer.total,48000);
  assert.deepEqual(customer.lines,[{description:'Macetero geométrico',quantity:8,unitPrice:6000,total:48000}]);
  transitionQuote(db,internal.id,'Enviada',{at:AT,channel:'WhatsApp'});
  const order=acceptAndCreateOrder(db,internal.id,{dueDate:'2026-11-02',channel:'WhatsApp',at:'2026-10-21T10:00:00Z'});
  assert.equal(order.amount,48000);assert.equal(order.agreedQuote.version,'v2');
  // no hay segundo pedido aunque se repita la acción (misma sesión)
  assert.throws(()=>acceptAndCreateOrder(db,internal.id,{dueDate:'2026-11-02',at:'2026-10-21T10:05:00Z'}),/Solo se puede aceptar/);
  assert.throws(()=>createOrderFromQuote(db,internal.id,{dueDate:'2026-11-02'}),/ya tiene un pedido/);
  assert.equal(db.orders.filter(o=>o.quoteId===internal.id).length,1);
  recordPayment(db,order.id,{amount:20000,at:AT});assert.equal(paymentSummary(order).status,'Abonado');
  assert.throws(()=>recordPayment(db,order.id,{amount:28001,at:AT}),/no superar el saldo/);
  recordPayment(db,order.id,{amount:28000,at:AT});assert.equal(paymentSummary(order).status,'Pagado');
  // cambiar después los perfiles no altera la cotización ni el pedido
  db.materials[0].priceKg=99000;db.shopSettings.targetMargin=60;
  const replay=quoteService.replay(internal);assert.ok(replay.ok&&replay.value.identical);
  assert.equal(order.amount,48000);
});

test('BLOCK: se guarda el borrador, no se puede marcar enviada y se puede eliminar',()=>{
  store.clear();const db=MockRepository.reset();
  db.shopSettings={...db.shopSettings,onBelowMin:'BLOCK'};
  const {internal}=saveDraft(db,{...FORM,targetMargin:'20',validDays:'7',terms:''},['sales']);
  assert.equal(internal.issuance.issuable,false);
  assert.match(issuanceProblem(db,internal),/Bloquear emisión/);
  assert.throws(()=>transitionQuote(db,internal.id,'Enviada',{at:AT}),/No se puede enviar/);
  assert.equal(internal.status,'Borrador');
  deleteQuoteDraft(db,internal.id);
  assert.equal(customerQuoteOf(db,internal.id),null);
});

test('WARN y CAP con el mismo margen bajo el mínimo: emitibles; CAP sube el precio',()=>{
  store.clear();const db=MockRepository.reset();
  const low={...FORM,targetMargin:'20',validDays:'7',terms:''};
  const warn=saveDraft(db,low,['sales']).internal;
  db.shopSettings={...db.shopSettings,onBelowMin:'CAP'};
  const cap=saveDraft(db,low,['sales']).internal;
  assert.ok(warn.issuance.issuable&&cap.issuance.issuable);
  assert.ok(cap.gross>warn.gross);
  assert.ok(warn.issuance.warnings.includes('BELOW_MIN'));
});

test('persistencia: dos claves físicas; la clave comercial no contiene nada interno',()=>{
  store.clear();const db=MockRepository.reset();
  saveDraft(db,{...FORM,oneOffDesignCost:'30000'},['design']);
  assert.ok(MockRepository.save(db));
  const customerJson=JSON.parse(store.get(CUSTOMER_KEY));
  const internalJson=JSON.parse(store.get(INTERNAL_KEY));
  assert.ok(!('customerQuotes' in internalJson));
  assert.ok(internalJson.quotes.every(q=>!('customerQuote' in q)));
  const keys=keysOf(customerJson);
  for(const k of FORBIDDEN)assert.ok(!keys.includes(k),`fuga: ${k}`);
  for(const doc of customerJson.customerQuotes)assert.deepEqual(Object.keys(doc).sort(),[...CUSTOMER_QUOTE_KEYS].sort());
  for(const doc of customerJson.customerQuotes)assert.doesNotMatch(customerQuoteText(doc),/costo|margen|comisi|utilidad|desgaste|fallas?/i);
  const loaded=MockRepository.load();
  assert.equal(loaded.customerQuotes.length,db.customerQuotes.length);
  assert.equal(loaded.quotes.at(-1).calculation.output.pricing.grossTotal,loaded.customerQuotes.at(-1).total);
});

test('si falla la escritura interna, la clave comercial se restaura (sin estado a medias)',()=>{
  store.clear();const db=MockRepository.reset();MockRepository.save(db);
  const before=store.get(CUSTOMER_KEY);
  saveDraft(db);
  failOn=INTERNAL_KEY;
  try{assert.equal(MockRepository.save(db),false);}finally{failOn=null;}
  assert.equal(store.get(CUSTOMER_KEY),before);
});

test('migración desde Beta 0.5.2: documentos embebidos → colección; borrador demo no emitible; respaldo intacto',()=>{
  store.clear();
  const legacy={clients:[{id:'CLI-001',name:'CAMILA RODRÍGUEZ',createdAt:'2026-10-02'}],materials:[{id:'MAT-001',name:'PLA',brand:'B',priceKg:22000}],projects:[],orders:[],printers:[{id:'MAC-001',name:'Bambu Lab A1',technology:'FDM',purchasePrice:420000,residualValue:40000,lifeHours:5000,averageWatts:95,maintenanceBudget:60000,maintenanceHours:5000,revision:1}],shopSettings:{targetMargin:40},
    quotes:[
      {id:'COT-0010',clientId:'CLI-001',project:'Llavero',quantity:4,gross:12000,status:'Enviada',createdAt:'2026-10-18',calculationVersion:'DEMO-UI-0.3',customerQuote:{id:'COT-0010',clientName:'Camila Rodríguez',project:'Llavero',quantity:4,unitGross:3000,gross:12000,createdAt:'2026-10-18',status:'Enviada',validDays:10,lines:[{description:'Llavero',quantity:4,total:12000}]}},
      {id:'COT-0011',clientId:'CLI-001',project:'Soporte',quantity:2,gross:9100,status:'Borrador',createdAt:'2026-10-19',calculationVersion:'DEMO-UI-0.3',inputSnapshot:{machineId:'MAC-001',materialId:'MAT-001'},customerQuote:{id:'COT-0011',clientName:'Camila Rodríguez',project:'Soporte',quantity:2,unitGross:4550,gross:9100,createdAt:'2026-10-19',status:'Borrador'}},
    ]};
  store.set(LEGACY_KEY,JSON.stringify(legacy));
  const db=MockRepository.load();
  assert.equal(db.clients[0].name,'Camila Rodríguez');
  assert.equal(db.shopSettings.targetMargin,40);assert.equal(db.shopSettings.revision,1);assert.equal(db.materials[0].revision,1);
  assert.ok(db.quotes.every(q=>!('customerQuote' in q)));
  assert.equal(customerQuoteOf(db,'COT-0010').total,12000);
  assert.equal(customerQuoteOf(db,'COT-0010').lines[0].unitPrice,3000);
  assert.equal(db.quotes[0].validDays,10);
  assert.equal(db.quotes[0].gross,12000); // no se recalcula
  assert.match(issuanceProblem(db,db.quotes[1]),/estimador demo/);
  assert.throws(()=>transitionQuote(db,'COT-0011','Enviada',{at:AT}),/estimador demo/);
  assert.ok(store.has(LEGACY_KEY),'el respaldo 0.5.2 no se borra');
  assert.ok(store.has(INTERNAL_KEY)&&store.has(CUSTOMER_KEY));
  // revisión con el MISMO precio de un documento ya emitido: se puede volver a emitir
  const rev=cloneQuoteRevision(db,'COT-0010',{at:AT});
  assert.equal(issuanceProblem(db,rev),null);
  assert.equal(customerQuoteOf(db,rev.id).total,12000);
  assert.equal(customerQuoteOf(db,rev.id).id,rev.id);
});

test('editar condiciones del borrador actualiza interno y documento comercial; nunca el precio',()=>{
  store.clear();const db=MockRepository.reset();
  const {internal}=saveDraft(db);
  updateDraftConditions(db,internal.id,{validDays:15,terms:'Pago 50 % anticipado',at:AT});
  assert.equal(internal.validDays,15);
  assert.equal(customerQuoteOf(db,internal.id).validDays,15);
  assert.equal(customerQuoteOf(db,internal.id).terms,'Pago 50 % anticipado');
  assert.equal(customerQuoteOf(db,internal.id).total,48000);
  assert.throws(()=>updateDraftConditions(db,internal.id,{validDays:0}),/Vigencia/);
});
