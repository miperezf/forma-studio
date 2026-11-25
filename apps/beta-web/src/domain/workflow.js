import { reservationFromQuote, releaseReservation } from './inventory.js';
/** FORMA Studio — commercial workflow. Independent from quote price calculation or UI. */
export const QUOTE_STATUS = Object.freeze(['Borrador','Enviada','Aceptada','Rechazada','Vencida']);
export const ORDER_STATUS = Object.freeze(['Pendiente','Preparación','En producción','Entregado']);
/** Estado terminal fuera del flujo de producción: el pedido se conserva (historial, abonos, consumos) pero no cuenta. */
export const ORDER_CANCELLED = 'Anulado';
export const isOrderCancelled = (order) => order?.status === ORDER_CANCELLED;
/** Siguiente / anterior estado de producción (null si no hay o si está anulado). */
export function nextOrderStatus(order){if(isOrderCancelled(order))return null;const i=ORDER_STATUS.indexOf(order?.status);return i>=0&&i<ORDER_STATUS.length-1?ORDER_STATUS[i+1]:null;}
export function previousOrderStatus(order){if(isOrderCancelled(order))return null;const i=ORDER_STATUS.indexOf(order?.status);return i>0?ORDER_STATUS[i-1]:null;}
const REASON_MAX=140;
function reasonOf(reason){const text=String(reason??'').trim().replace(/\s+/g,' ');if(text.length<3)throw Error('Indica el motivo (mínimo 3 caracteres).');return text.slice(0,REASON_MAX);}
const TRANSITIONS = Object.freeze({
  'Borrador':['Enviada'],
  'Enviada':['Aceptada','Rechazada','Vencida'],
  'Aceptada':[], 'Rechazada':[], 'Vencida':[],
});
export const nowIso = () => new Date().toISOString();
/** Versiones de cálculo del prototipo: sus precios no salen del motor v1 (D11). */
export const LEGACY_DEMO_VERSIONS = Object.freeze(['DEMO-UI-0.3','SEED-DEMO']);
/** El documento comercial vive en OTRA colección (separación física interna / cliente). */
export function customerQuoteOf(db,id){return (db.customerQuotes||[]).find(c=>c.id===id)||null;}
function replaceCustomerQuote(db,id,doc){
  db.customerQuotes ??=[];
  const index=db.customerQuotes.findIndex(c=>c.id===id);
  if(index<0)db.customerQuotes.push(doc);else db.customerQuotes[index]=doc;
}
/**
 * ¿Se puede emitir (marcar enviada)? BLOCK del motor o precio del prototipo demo ⇒ no. Un borrador bloqueado se
 * conserva y se puede recotizar; nunca se envía al cliente.
 */
export function issuanceProblem(db,quote){
  if(!customerQuoteOf(db,quote.id))return 'Falta la versión comercial de la cotización.';
  if(quote.issuance && quote.issuance.issuable===false){
    return quote.issuance.blockingReasons?.includes('MARGIN_POLICY_BLOCK')
      ?'No se puede enviar: el margen queda bajo el mínimo y la política del taller es «Bloquear emisión». Recotiza con otro margen o cambia la política.'
      :'No se puede enviar esta cotización.';
  }
  if(!quote.issuance && LEGACY_DEMO_VERSIONS.includes(quote.calculationVersion))return 'Este borrador se calculó con el estimador demo. Crea una nueva cotización con el motor v1 antes de enviarla.';
  return null;
}
export const localDate = (when=new Date()) => `${when.getFullYear()}-${String(when.getMonth()+1).padStart(2,'0')}-${String(when.getDate()).padStart(2,'0')}`;
const isoDay = (day) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day))) throw Error('Fecha inválida.');
  const d=new Date(`${day}T12:00:00Z`);
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==day)throw Error('Fecha inválida.');
  return d;
};
export function validThrough(quote){
  const issue=quote?.issuedAt || quote?.createdAt;
  if(!issue || !/^\d{4}-\d{2}-\d{2}$/.test(issue)) return null;
  const days=Number(quote?.validDays ?? 7);
  if(!Number.isInteger(days)||days<1||days>365)return null;
  const end=isoDay(issue);
  end.setUTCDate(end.getUTCDate()+days);
  return end.toISOString().slice(0,10);
}
export function isQuoteExpired(quote,today=localDate()){
  const until=validThrough(quote);
  return quote.status==='Enviada' && until!==null && today>until;
}
/** Persist automatic expiration as an auditable transition; never expire draft or accepted quotes. */
export function expireOpenQuotes(db,today=localDate(),timestamp=nowIso()){
  let count=0;
  for(const quote of db.quotes){
    if(isQuoteExpired(quote,today)) { transitionQuote(db,quote.id,'Vencida',{at:timestamp,reason:'Vencimiento automático'});count++; }
  }
  return count;
}
export function transitionQuote(db,id,status,{at=nowIso(),reason='',channel=''}={}){
  const quote=db.quotes.find(q=>q.id===id);
  if(!quote)throw Error('Cotización no encontrada.');
  if(!QUOTE_STATUS.includes(status))throw Error('Estado de cotización inválido.');
  if(!TRANSITIONS[quote.status]?.includes(status))throw Error(`No se puede cambiar de ${quote.status} a ${status}.`);
  if(status==='Enviada'){const problem=issuanceProblem(db,quote);if(problem)throw Error(problem);}
  const prior=quote.status;
  quote.status=status;
  quote.events ??=[];
  quote.events.push({type:'STATUS_CHANGED',from:prior,to:status,at,reason:String(reason),channel:String(channel)});
  if(status==='Enviada'){quote.sentAt=at;quote.issuedAt=localDate(new Date(at));}
  if(status==='Aceptada')quote.acceptedAt=at;
  if(status==='Rechazada')quote.rejectedAt=at;
  if(status==='Vencida')quote.expiredAt=at;
  // Al emitir, el documento comercial toma la fecha de emisión (la vigencia corre desde ahí). Después no cambia.
  if(status==='Enviada'){const doc=customerQuoteOf(db,id);replaceCustomerQuote(db,id,Object.freeze({...doc,createdAt:quote.issuedAt}));}
  return quote;
}
export function linkedOrder(db,quoteId){return db.orders.find(o=>o.quoteId===quoteId)||null;}
/** Assign sequential quote folios without reusing deleted draft numbers. */
export function nextQuoteId(db){
  const maxExisting=Math.max(0,...db.quotes.map(q=>Number(/^(?:COT-)(\d+)$/.exec(q.id)?.[1])||0));
  const lastNumber=Number(db.meta?.lastQuoteNumber)||0;
  const next=Math.max(maxExisting,lastNumber)+1;
  db.meta??={}; db.meta.lastQuoteNumber=next;
  return `COT-${String(next).padStart(4,'0')}`;
}
/** Drafts have no commercial history yet: delete without affecting the client or other records. */
export function deleteQuoteDraft(db,id){
  const index=db.quotes.findIndex(q=>q.id===id);
  if(index<0)throw Error('Cotización no encontrada.');
  const quote=db.quotes[index];
  if(quote.status!=='Borrador')throw Error('Solo puedes eliminar cotizaciones en borrador.');
  if(linkedOrder(db,id)||quote.orderId)throw Error('No puedes eliminar una cotización vinculada a un pedido.');
  if(db.quotes.some(q=>q.id!==id&&(q.revisionOf===id||q.events?.some(ev=>ev.fromQuote===id))))throw Error('No puedes eliminar un borrador al que hagan referencia otras cotizaciones.');
  const serial=Number(/^COT-(\d+)$/.exec(id)?.[1])||0;
  db.meta??={};db.meta.lastQuoteNumber=Math.max(Number(db.meta.lastQuoteNumber)||0,serial);
  db.quotes.splice(index,1);
  db.customerQuotes=(db.customerQuotes||[]).filter(c=>c.id!==id);
  return quote;
}

/**
 * `orderId` opcional: el backend reserva el folio en una transacción (contador) para que dos sesiones nunca
 * generen el mismo folio. Sin él, se calcula localmente como antes.
 */
export function createOrderFromQuote(db,id,{dueDate,at=nowIso(),orderId}={}){
  const quote=db.quotes.find(q=>q.id===id);
  if(!quote)throw Error('Cotización no encontrada.');
  if(quote.status!=='Aceptada')throw Error('Solo se puede convertir una cotización aceptada.');
  if(linkedOrder(db,id))throw Error('Esta cotización ya tiene un pedido asociado.');
  if(!db.clients.some(c=>c.id===quote.clientId))throw Error('El cliente ya no existe en el CRM.');
  if(!dueDate)throw Error('Indica la fecha de entrega comprometida.');
  isoDay(dueDate);
  const serial=Math.max(0,...db.orders.map(o=>Number(/-(\d+)$/.exec(o.id)?.[1])||0))+1;
  const folio=orderId??`PED-${String(serial).padStart(4,'0')}`;
  if(!/^PED-\d{4,}$/.test(folio))throw Error('Folio de pedido inválido.');
  if(db.orders.some(o=>o.id===folio))throw Error('El folio de pedido ya existe.');
  const order={
    id:folio,quoteId:id,clientId:quote.clientId,
    project:quote.project,quantity:quote.quantity,amount:quote.gross,dueDate,
    status:'Pendiente',createdAt:at,payments:[],events:[{type:'ORDER_CREATED',at,fromQuote:id}],
    // Preserve amount snapshot; changes to pricing profiles must not change this order.
    agreedQuote:{quoteId:id,version:quote.calculationVersion||'LEGACY-DEMO',gross:quote.gross,quantity:quote.quantity},
  };
  // Filamento comprometido para este pedido (estimación de la cotización). No descuenta el stock físico.
  const reservation=reservationFromQuote(quote,at);
  if(reservation)order.reservation=reservation;
  db.orders.unshift(order);
  quote.events ??=[];
  quote.events.push({type:'ORDER_CREATED',at,orderId:order.id});
  quote.orderId=order.id;
  return order;
}
/** A single explicit customer-acceptance action can create the order in one transaction.
 * Validate all inputs before changing the quote; no partially accepted quote on invalid data.
 */
export function acceptAndCreateOrder(db,id,{dueDate,channel='No especificado',at=nowIso(),orderId}={}){
  const quote=db.quotes.find(q=>q.id===id);
  if(!quote)throw Error('Cotización no encontrada.');
  if(quote.status!=='Enviada')throw Error('Solo se puede aceptar una cotización enviada.');
  if(linkedOrder(db,id)||quote.orderId)throw Error('La cotización ya tiene un pedido.');
  if(!db.clients.some(c=>c.id===quote.clientId))throw Error('El cliente ya no existe en el CRM.');
  if(!dueDate)throw Error('Indica la fecha de entrega comprometida.');
  isoDay(dueDate);
  if(dueDate<localDate(new Date(at)))throw Error('La entrega no puede ser anterior a la aceptación.');
  if(!customerQuoteOf(db,id))throw Error('Falta el documento comercial de la cotización.');
  transitionQuote(db,id,'Aceptada',{at,channel});
  return createOrderFromQuote(db,id,{dueDate,at,orderId});
}

export function changeOrderStatus(db,id,status,{at=nowIso()}={}){
  const order=db.orders.find(o=>o.id===id);
  if(!order)throw Error('Pedido no encontrado.');
  if(isOrderCancelled(order))throw Error('El pedido está anulado: no cambia de estado.');
  const oldIndex=ORDER_STATUS.indexOf(order.status),newIndex=ORDER_STATUS.indexOf(status);
  if(oldIndex<0||newIndex<0||newIndex!==oldIndex+1)throw Error('Avanza al siguiente estado de producción.');
  order.status=status;
  order.events??=[];order.events.push({type:'PRODUCTION_CHANGED',from:ORDER_STATUS[oldIndex],to:status,at});
  if(status==='Entregado')order.deliveredAt=at;
  return order;
}
/**
 * Corrige un avance hecho por error: vuelve UN estado atrás, con motivo obligatorio y registro en el historial.
 * No toca importes, abonos, reserva ni consumos (para ajustar filamento existe el registro «Corrección»).
 */
export function revertOrderStatus(db,id,{reason,at=nowIso()}={}){
  const order=db.orders.find(o=>o.id===id);
  if(!order)throw Error('Pedido no encontrado.');
  if(isOrderCancelled(order))throw Error('El pedido está anulado: no cambia de estado.');
  const to=previousOrderStatus(order);
  if(!to)throw Error('El pedido ya está en el primer estado.');
  const why=reasonOf(reason),from=order.status;
  order.status=to;
  if(from==='Entregado')delete order.deliveredAt;
  order.events??=[];order.events.push({type:'PRODUCTION_REVERTED',from,to,at,reason:why});
  return order;
}
/**
 * Anula un pedido (nunca se borra): motivo obligatorio, libera la reserva de filamento, deja de contar en pedidos
 * activos y ventas, y no admite nuevos abonos. Conserva historial, abonos ya recibidos y consumos reales.
 * Es definitivo: para rehacer el trabajo se crea una revisión de la cotización.
 */
export function cancelOrder(db,id,{reason,at=nowIso()}={}){
  const order=db.orders.find(o=>o.id===id);
  if(!order)throw Error('Pedido no encontrado.');
  if(isOrderCancelled(order))throw Error('El pedido ya está anulado.');
  const why=reasonOf(reason),from=order.status;
  order.status=ORDER_CANCELLED;
  order.cancelled={at,reason:why,fromStatus:from};
  order.events??=[];order.events.push({type:'ORDER_CANCELLED',from,at,reason:why});
  releaseReservation(order,{at,reason:'CANCELLED'});
  return order;
}
export function paymentSummary(order){
  const amount=Number(order.amount);
  const paid=(order.payments||[]).reduce((total,p)=>total+Number(p.amount||0),0);
  if(!Number.isFinite(amount)||amount<0||!Number.isFinite(paid)||paid<0)throw Error('Importes de pago inválidos.');
  if(isOrderCancelled(order))return {paid,pending:0,status:paid>0?'Anulado con abonos':'Anulado'};
  const pending=Math.max(0,amount-paid);
  return {paid,pending,status:amount===0||pending===0?'Pagado':paid>0?'Abonado':'Pendiente de pago'};
}
/** Edita vigencia y condiciones de un BORRADOR (interno y documento comercial). Nunca toca precios. */
export function updateDraftConditions(db,id,{validDays,terms,at=nowIso()}={}){
  const quote=db.quotes.find(q=>q.id===id);
  if(!quote||quote.status!=='Borrador')throw Error('Solo puedes editar borradores.');
  const days=Number(validDays);
  if(!Number.isSafeInteger(days)||days<1||days>365)throw Error('Vigencia inválida.');
  const doc=customerQuoteOf(db,id);
  if(!doc)throw Error('Falta el documento comercial de la cotización.');
  const cleanTerms=String(terms||'').trim().slice(0,250);
  quote.validDays=days;quote.terms=cleanTerms;
  replaceCustomerQuote(db,id,Object.freeze({...doc,validDays:days,terms:cleanTerms}));
  quote.events??=[];quote.events.push({type:'DRAFT_CONDITIONS_UPDATED',at});
  return quote;
}
/**
 * `paymentId` opcional (lo genera la UI una vez por intento de registro): si ya existe un pago con ese id, se
 * devuelve el existente sin registrar otro (idempotencia ante doble clic, reintentos o dos sesiones).
 */
export function recordPayment(db,id,{amount,method='Transferencia',at=nowIso(),paymentId}={}){
  const order=db.orders.find(o=>o.id===id);
  if(!order)throw Error('Pedido no encontrado.');
  if(isOrderCancelled(order))throw Error('No se registran abonos en un pedido anulado.');
  if(paymentId!==undefined){
    if(!/^[A-Za-z0-9_-]{8,64}$/.test(String(paymentId)))throw Error('Identificador de pago inválido.');
    const existing=(order.payments||[]).find(p=>p.id===paymentId);
    if(existing){if(existing.amount!==Number(amount))throw Error('El identificador de pago ya se usó con otro importe.');return existing;}
  }
  const value=Number(amount),summary=paymentSummary(order);
  if(!Number.isSafeInteger(value)||value<=0||value>summary.pending)throw Error('El abono debe ser positivo y no superar el saldo pendiente.');
  const payment={id:paymentId??`PAG-${order.id}-${(order.payments?.length||0)+1}`,amount:value,method:String(method).slice(0,40),at};
  order.payments??=[];order.payments.push(payment);
  order.events??=[];order.events.push({type:'PAYMENT_RECORDED',at,amount:value,method:payment.method});
  return payment;
}
/** Revisions are new immutable quote records. Legacy quotes lacking inputs copy original totals (no silent repricing). */
export function cloneQuoteRevision(db,id,{at=nowIso()}={}){
  const original=db.quotes.find(q=>q.id===id);
  if(!original)throw Error('Cotización no encontrada.');
  if(original.status==='Borrador')throw Error('Edita o envía el borrador actual antes de crear una revisión.');
  const revisionId=nextQuoteId(db);
  const revisionRoot=original.revisionOf||original.id;
  const n=Math.max(1,...db.quotes.filter(q=>(q.revisionOf||q.id)===revisionRoot).map(q=>Number(q.revision)||1))+1;
  const day=localDate(new Date(at));
  const originalDoc=customerQuoteOf(db,id);
  if(!originalDoc)throw Error('Falta el documento comercial de la cotización original.');
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const quote={...copy(original),id:revisionId,createdAt:day,revisionOf:revisionRoot,revision:n,
    status:'Borrador',events:[{type:'REVISION_CREATED',at,fromQuote:id}],orderId:undefined,
    acceptedAt:undefined,rejectedAt:undefined,sentAt:undefined,expiredAt:undefined,issuedAt:undefined,
    customerQuoteId:revisionId,
    // Mismo precio que un documento YA emitido al cliente: se puede volver a emitir aunque provenga del prototipo.
    issuance:original.issuance??{issuable:true,blockingReasons:[],warnings:[],inheritedFrom:id},
  };
  delete quote.customerQuote;
  db.quotes.push(quote);
  replaceCustomerQuote(db,revisionId,Object.freeze({...originalDoc,id:revisionId,createdAt:day}));
  return quote;
}
