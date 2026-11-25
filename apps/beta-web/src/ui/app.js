import { MockRepository } from '../data/repository.js';
import { quoteService, failureMessage, customerQuoteText, taxLabel, toRawForm, DEFAULT_CHANNELS } from '../vendor/forma-engine.js';
import { machineHourlyCosts, validatePrinterProfile, MACHINE_CATALOG } from '../domain/printer-profiles.js';
import { normalizedShopSettings } from '../domain/quote-inputs.js';
import { createBackup, backupFileName, parseBackup, mergeMissing } from '../domain/backup.js';
import { filamentUsage, estimatedConsumption, registeredConsumption, recordConsumption, CONSUMPTION_KINDS, committedGrams, stockStatus, releaseReservation, RELEASE_REASONS, minStockOf, lowStockMaterials, logStockChange, materialMovements, realVsQuoted, availableGrams } from '../domain/inventory.js';
import { todayAgenda, dueLabel, urgency, SOON_DAYS } from '../domain/today.js';
import { productFromQuote, deleteProduct, missingMaterials, whatsappLink } from '../domain/products.js';
import { readSlicedProject, matchMaterial, colorName } from '../domain/bambu-3mf.js';
import { catalogBrands, catalogMaterialTypes, catalogLines, catalogColors, catalogSizes, catalogEntry, catalogMeta, materialFromCatalog, selectionOf, traitLabel } from '../domain/materials-catalog.js';
import { normalizeClientName, clientRelations, allocateClientId, removeOrArchiveClient } from '../domain/crm.js';
import { transitionQuote, expireOpenQuotes, linkedOrder, createOrderFromQuote, acceptAndCreateOrder, cloneQuoteRevision, changeOrderStatus, revertOrderStatus, cancelOrder, nextOrderStatus, previousOrderStatus, isOrderCancelled, ORDER_STATUS, paymentSummary, recordPayment, validThrough, localDate, deleteQuoteDraft, nextQuoteId, customerQuoteOf, issuanceProblem, updateDraftConditions } from '../domain/workflow.js';

/** Entorno inyectado por el build (staging/demo). Solo texto informativo: no es control de acceso. */
const ENV=Object.freeze({label:'ENTORNO DEMO',note:'Datos ficticios guardados solo en este navegador.',...(globalThis.FORMA_ENV||{})});
/** Producción: sin avisos de demo/beta ni datos técnicos del entorno en la interfaz. */
const PROD=ENV.name==='production';
const app = document.getElementById('app');
/**
 * Nube (staging/producción): el build inyecta FormaFirebase + FORMA_FIREBASE_CONFIG. Sin ellos, modo local (demo).
 * La seguridad real la dan Firebase Auth + reglas de Firestore; la UI solo refleja lo que el servidor permite.
 */
const CLOUD=(globalThis.FormaFirebase&&globalThis.FORMA_FIREBASE_CONFIG)?globalThis.FormaFirebase.createFirebaseBackend(globalThis.FORMA_FIREBASE_CONFIG):null;
let cloudUser=null;
let cloudSaving=Promise.resolve();
let db = CLOUD ? MockRepository.normalize({}) : MockRepository.load();
if (!CLOUD && expireOpenQuotes(db)) MockRepository.save(db);
let route = 'dashboard';
let selectedMachineId = db.printers[0]?.id ?? '';
let quoteDraft = {};
let quoteExtras = new Set();
/** Colores adicionales de la placa (AMS lite: 0–3 además del filamento principal). Campos amsMaterialN/amsGramsN. */
let amsRows = 0;
const AMS_MAX_EXTRA = 3;
function syncMulticolor(){if(amsRows>0)quoteExtras.add('multicolor');else quoteExtras.delete('multicolor');}
const materialHex=id=>{const m=db.materials.find(x=>x.id===id);return /^#[0-9a-fA-F]{6}$/.test(m?.hex||'')?m.hex:'#cfd6dc';};
/** Color claro (blanco, amarillo…): número oscuro y borde visible para que la muestra no desaparezca. */
const isLightHex=hex=>{const n=parseInt(String(hex).slice(1),16);if(!Number.isFinite(n))return false;const r=n>>16&255,g=n>>8&255,b=n&255;return (0.299*r+0.587*g+0.114*b)/255>0.72;};
const dotStyle=id=>{const hex=materialHex(id);return isLightHex(hex)?`background:${hex};color:#2b3440;text-shadow:none;border-color:#0004`:`background:${hex}`;};
/** «PLA Basic Blue · Bambu Lab» (sin repetir el color si ya está en el nombre). Con `committed`, agrega lo disponible. */
function materialLabel(m,{committed=null}={}){
 if(!m)return '';
 const name=String(m.name||''),color=String(m.color||'');
 const withColor=color&&!name.toLocaleLowerCase('es-CL').includes(color.toLocaleLowerCase('es-CL'))?`${name} ${color}`:name;
 const stock=committed?` · ${kg(stockStatus(db,m,committed).available/1000)} kg disp.`:'';
 return `${withColor}${m.brand?` · ${m.brand}`:''}${stock}`;
}
function filamentTotal(){const grams=[quoteDraft.plateWeightGr??340,...Array.from({length:amsRows},(_,i)=>quoteDraft[`amsGrams${i+2}`])].map(Number).filter(Number.isFinite);return Math.round(grams.reduce((a,b)=>a+b,0)*10)/10;}
/** Tiempo como lo muestra Bambu Studio («2h 4m»): campos h + min; el motor recibe horas decimales en un campo oculto. */
const DURATIONS={plateHours:['plateH','plateMin'],lastRunHours:['lastRunH','lastRunMin']};
/** Campos h/min de un tiempo (placa base, última placa o placa adicional `plate{n}Hours`). */
const durationParts=name=>DURATIONS[name]??(/^plate\d+Hours$/.test(name)?[name.replace('Hours','H'),name.replace('Hours','Min')]:null);
/** Campo oculto de horas al que pertenece un campo h o min. */
const durationOfPart=part=>{const m=/^(plate\d*|lastRun)(H|Min)$/.exec(String(part||''));if(!m)return null;const name=m[1]==='plate'?'plateHours':`${m[1]}Hours`;return durationParts(name)?name:null;};
function hoursFrom(h,m){const hs=String(h??'').trim(),ms=String(m??'').trim();if(hs===''&&ms==='')return '';const v=Number(hs.replace(',','.')||0)+Number(ms.replace(',','.')||0)/60;return Number.isFinite(v)?String(Math.round(v*10000)/10000):'x';}
function splitHours(value){const v=Number(value);if(String(value??'').trim()===''||!Number.isFinite(v)||v<0)return ['',''];let h=Math.floor(v),m=Math.round((v-h)*60);if(m===60){h+=1;m=0;}return [String(h),String(m)];}
function durationField(name,label,{span=false}={}){
 const [hName,mName]=durationParts(name);
 const [h0,m0]=quoteDraft[hName]!==undefined||quoteDraft[mName]!==undefined?[quoteDraft[hName]??'',quoteDraft[mName]??'']:splitHours(quoteDraft[name]??(name==='plateHours'?'5.5':''));
 const hidden=quoteDraft[name]??(name==='plateHours'?'5.5':'');
 return `<div class="field duration-field${span?' span2':''}"><span>${label}</span><div class="duration"><label><input name="${hName}" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${esc(h0)}" aria-label="${label}: horas"><span>h</span></label><label><input name="${mName}" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${esc(m0)}" aria-label="${label}: minutos"><span>min</span></label></div><input type="hidden" name="${name}" value="${esc(hidden)}"></div>`;
}
/** Sincroniza el campo oculto de horas cuando cambian h o min. */
function syncDuration(el){
 const name=durationOfPart(el.name);if(!name||!el.form)return false;
 const [hName,mName]=durationParts(name),form=el.form;
 const value=hoursFrom(form.elements.namedItem(hName)?.value,form.elements.namedItem(mName)?.value);
 const hidden=form.elements.namedItem(name);if(hidden)hidden.value=value;quoteDraft[name]=value;return true;
}
function updateFilamentUi(el){
 if(/^lastRun/.test(el.name||'')){const b=document.getElementById('lp-badge');if(b)b.innerHTML=lastPlateBadge();}
 if(/^(quantity|partsPerPlate|partsPerUnit|materialId|amsMaterial\d)$/.test(el.name||'')){const box=document.getElementById('last-plate');if(box)box.innerHTML=lastPlateBlock();}
 if(/^(materialId|amsMaterial\d|plate\d+Mat\d)$/.test(el.name||'')){const dot=document.querySelector(`[data-dot-for="${el.name}"]`);if(dot)dot.style.cssText=dotStyle(el.value);}
 if(/^(plateWeightGr|amsGrams\d)$/.test(el.name||'')){const total=document.getElementById('filament-total');if(total)total.textContent=`${filamentTotal().toLocaleString('es-CL')} g`;}
  if(/^(quantity|partsPerPlate|partsPerUnit|plate\d+Units)$/.test(el.name||'')){const plan=document.getElementById('print-plan-preview');if(plan)plan.innerHTML=productionPlanHtml();}
}
// UX2: vista explicativa; solo interpreta cantidades ya existentes. NO interviene en el precio.
function productionPlanHtml(){
 const quantity=Number(quoteDraft.quantity??8);
 const piecesPerProduct=quoteExtras.has('planning')?Number(quoteDraft.partsPerUnit??1):1;
 const bad='<p class="quote-plan-muted">Completa las cantidades para ver cuántas veces necesitas imprimir.</p>';
 if(!Number.isSafeInteger(quantity)||quantity<1||!Number.isSafeInteger(piecesPerProduct)||piecesPerProduct<1)return bad;
 if(plateCount>1&&piecesPerProduct!==1)return '<p class="quote-plan-muted">Revisa la planificación especial: con varias placas, el motor requiere 1 pieza por producto.</p>';
 let totalRuns=0;
 const rows=[];
 for(let n=1;n<=plateCount;n++){
  const capacity=Number(n===1?(quoteDraft.partsPerPlate??4):quoteDraft[`plate${n}Units`]);
  if(!Number.isSafeInteger(capacity)||capacity<1)return bad;
  const required=plateCount===1?quantity*piecesPerProduct:quantity;
  if(!Number.isSafeInteger(required))return bad;
  const runs=Math.ceil(required/capacity);
  totalRuns+=runs;
  const remainder=required%capacity;
  const unitLabel=plateCount===1?(capacity===1?'pieza':'piezas'):(capacity===1?'producto':'productos');
  rows.push(`<li><span>Placa ${n}: ${capacity} ${unitLabel} por impresión</span><strong>${runs} ${runs===1?'impresión':'impresiones'}${remainder?` · última con ${remainder}`:''}</strong></li>`);
 }
 return `<div class="quote-plan" role="status" aria-live="polite"><div class="quote-plan-head"><strong>Plan de fabricación</strong><span>${quantity} producto${quantity===1?'':'s'} · ${totalRuns} ${totalRuns===1?'impresión':'impresiones'}</span></div><ul>${rows.join('')}</ul><p>${plateCount===1?'La impresora puede fabricar varias piezas en la misma placa.':'Cada placa adicional se cuenta como una etapa necesaria para fabricar los productos, no como productos distintos.'} La última placa puede necesitar otra cantidad de filamento y tiempo.</p></div>`;
}
/** Placas completas y piezas restantes según cantidad, piezas por unidad y piezas por placa completa. */
function lastPlateInfo(){
 const q=Number(quoteDraft.quantity??8),ppp=Number(quoteDraft.partsPerPlate??4),ppu=quoteExtras.has('planning')?Number(quoteDraft.partsPerUnit||1):1;
 if(!(Number.isInteger(q)&&q>0&&Number.isInteger(ppp)&&ppp>0&&Number.isInteger(ppu)&&ppu>0))return null;
 const parts=q*ppu,full=Math.floor(parts/ppp);return {full,remainder:parts-full*ppp,ppp};
}
const lastRunKeys=()=>['lastRunH','lastRunMin',...Array.from({length:1+amsRows},(_,i)=>`lastRunGrams${i+1}`)];
const lastRunFilled=()=>lastRunKeys().some(k=>String(quoteDraft[k]??'').trim()!=='');
function lastPlateBadge(){return lastRunFilled()?'<span class="lp-badge ok">Datos de Bambu Studio</span>':'<span class="lp-badge est">Estimación provisional · se cobra como placa completa</span>';}
function lastPlateBlock(){
 const info=lastPlateInfo();if(!info)return '';
 const fullTxt=`${info.full} placa${info.full===1?'':'s'} completa${info.full===1?'':'s'} de ${info.ppp} pieza${info.ppp===1?'':'s'}`;
 if(info.remainder===0)return `<div class="plates-plan">${ic('printer',15)} ${fullTxt}.</div>`;
 // Si cambió el número de piezas de la última placa, sus datos anteriores ya no sirven.
 if(quoteDraft._lastRunParts!==info.remainder){if(quoteDraft._lastRunParts!==undefined)for(const k of Object.keys(quoteDraft))if(k.startsWith('lastRun'))Reflect.deleteProperty(quoteDraft,k);quoteDraft._lastRunParts=info.remainder;}
 const colors=[quoteDraft.materialId??db.materials[0]?.id,...Array.from({length:amsRows},(_,i)=>quoteDraft[`amsMaterial${i+2}`])];
 const val=k=>quoteDraft[k]!==undefined?`value="${esc(quoteDraft[k])}"`:'';
 return `<div class="last-plate"><div class="plates-plan">${ic('printer',15)} ${info.full?fullTxt+' + ':''}<b>1 última placa con ${info.remainder} pieza${info.remainder===1?'':'s'}</b></div>
 <div class="lp-head"><strong>Última placa (${info.remainder} pieza${info.remainder===1?'':'s'})</strong><span id="lp-badge">${lastPlateBadge()}</span></div>
 <p class="lp-help">Opcional: rebana en Bambu Studio solo ${info.remainder} pieza${info.remainder===1?'':'s'} y copia su tiempo y gramos. Sin estos datos se usa la placa completa como estimación conservadora.</p>
 <div class="lp-grid">${durationField('lastRunHours','Tiempo')}
 ${colors.map((id,i)=>{const m=db.materials.find(x=>x.id===id);return `<label class="field"><span class="lp-color"><span class="filament-dot sm" style="${dotStyle(id)}">${i+1}</span>${esc(m?.name||'Color '+(i+1))} (g)</span><input name="lastRunGrams${i+1}" type="number" min="0" step="any" inputmode="decimal" placeholder="${amsRows?'0':'—'}" ${val(`lastRunGrams${i+1}`)}></label>`;}).join('')}</div></div>`;
}
function filamentRows(){
 const committed=committedGrams(db);const options=db.materials.map(m=>`<option value="${esc(m.id)}">${esc(materialLabel(m,{committed}))}</option>`).join('');
 const first=quoteDraft.materialId&&db.materials.some(m=>m.id===quoteDraft.materialId)?quoteDraft.materialId:db.materials[0]?.id;
 const row=(n,selName,gramsName,id,removable)=>`<div class="filament-row"><span class="filament-dot" data-dot-for="${selName}" style="${dotStyle(id)}">${n}</span><select name="${selName}" aria-label="Filamento ${n}" required>${options}</select><input name="${gramsName}" type="number" min="0" step="any" inputmode="decimal" required aria-label="Gramos por placa del filamento ${n}" ${n===1?'value="340"':''} placeholder="g/placa">${removable?`<button type="button" class="filament-remove" data-ams-remove="${n}" aria-label="Quitar filamento ${n}">×</button>`:'<span></span>'}</div>`;
 const extra=Array.from({length:amsRows},(_,i)=>row(i+2,`amsMaterial${i+2}`,`amsGrams${i+2}`,quoteDraft[`amsMaterial${i+2}`],true)).join('');
 return `<div class="field filament-list"><div class="filament-head"><span>${isMultiPlate()?'Placa 1 · filamentos':'Filamentos de la placa completa'}</span><small>g por placa</small></div>${row(1,'materialId','plateWeightGr',first,false)}${extra}
 ${amsRows<AMS_MAX_EXTRA?`<button type="button" class="filament-add" data-ams-add>＋ Agregar color <small>(AMS lite · hasta 4)</small></button>`:''}
 <div class="filament-total"><span>${isMultiPlate()?'Total placa 1':'Total por placa completa'}</span><b id="filament-total">${filamentTotal().toLocaleString('es-CL')} g</b></div></div>`;
}
// ── Producto con varias placas + importación desde Bambu Studio (0.14) ───────────────────────────────────────────
const MAX_PLATES=8,MAX_PLATE_COLORS=4;
/** Placas adicionales en pantalla (2..plateCount) y cuántos colores tiene cada una. */
let plateCount=1;
let plateColors={};
/** Último archivo importado (solo en memoria): filamentos del archivo y su asociación con el inventario. */
let importInfo=null;
let componentMode=false;
const isMultiPlate=()=>plateCount>1;
// UX2B: el asistente calcula capacidad, el motor económico permanece intacto.
function plateCapacity(n){return Number(n===1?(quoteDraft.partsPerPlate??4):(quoteDraft[`plate${n}Units`]??1));}
function componentCapacity(n){
 const req=String(quoteDraft[`component${n}Required`]??'1').trim();
 const made=String(quoteDraft[`component${n}Produced`]??String(plateCapacity(n))).trim();
 if(!/^\d+$/.test(req)||!/^\d+$/.test(made))return null;
 const r=Number(req),m=Number(made);
 if(!Number.isSafeInteger(r)||!Number.isSafeInteger(m)||r<1||r>1000||m<1||m>1000000)return null;
 const c=Math.floor(m/r);return c>=1&&c<=1000?c:null;
}
function componentCapacityText(n){
 const c=componentCapacity(n);
 if(c===null)return 'Revisa las cantidades. No se puede calcular la capacidad.';
 const r=Number(quoteDraft[`component${n}Required`]??1),m=Number(quoteDraft[`component${n}Produced`]??plateCapacity(n));
 const spare=m%r;
 return `${c} producto${c===1?'':'s'} completo${c===1?'':'s'} por impresión${spare?` · ${spare} pieza${spare===1?'':'s'} sobrante${spare===1?'':'s'}`:''}`;
}
function componentPlannerHtml(){
 if(!isMultiPlate())return '';
 if(!componentMode)return `<div class="component-planner-off"><button type="button" class="btn btn-light" data-component-enable>Calcular capacidad desde componentes</button><small>Opcional: útil cuando un producto necesita bases, laterales u otras piezas en placas diferentes. También puedes indicar la capacidad manualmente.</small></div>`;
 const cards=Array.from({length:plateCount},(_,i)=>{
  const n=i+1,key=`component${n}`;
  const nm=quoteDraft[`${key}Name`]??`Componente placa ${n}`;
  const req=quoteDraft[`${key}Required`]??'1';
  const made=quoteDraft[`${key}Produced`]??String(plateCapacity(n));
  return `<div class="component-planner-row"><strong>Placa ${n}</strong><div class="fields-grid"><label class="field">Nombre del componente <input maxlength="60" name="${key}Name" value="${esc(nm)}" placeholder="Ej.: lateral"></label><label class="field">Piezas necesarias por producto <input type="number" inputmode="numeric" min="1" max="1000" step="1" name="${key}Required" value="${esc(req)}"></label><label class="field">Piezas de ese componente por placa <input type="number" inputmode="numeric" min="1" max="1000000" step="1" name="${key}Produced" value="${esc(made)}"></label></div><output id="component-result-${n}" class="component-result">${esc(componentCapacityText(n))}</output></div>`;
 }).join('');
 return `<section class="component-planner"><div class="component-planner-head"><div><strong>Composición del producto</strong><small>La capacidad de cada placa se calcula sin cambiar los costos de impresión.</small></div><button type="button" class="text-button" data-component-disable>Usar capacidad manual</button></div>${cards}<p class="component-planner-warning">Cada placa debe contener un tipo de componente contado de forma homogénea. Si mezclas componentes diferentes en una misma placa, usa la capacidad manual. El tiempo y los gramos corresponden siempre a una impresión de la placa completa.</p></section>`;
}
function updateComponentCapacity(el){
 if(!componentMode)return;
 const match=/^component([1-8])(Required|Produced)$/.exec(el.name||'');if(!match)return;
 const n=Number(match[1]),capacity=componentCapacity(n);
 if(capacity!==null){const dest=n===1?'partsPerPlate':`plate${n}Units`;quoteDraft[dest]=String(capacity);const input=document.querySelector(`#quote-form [name="${dest}"]`);if(input)input.value=String(capacity);const plan=document.getElementById('print-plan-preview');if(plan)plan.innerHTML=productionPlanHtml();if(n===1){const last=document.getElementById('last-plate');if(last)last.innerHTML=lastPlateBlock();}}
 const out=document.getElementById(`component-result-${n}`);if(out)out.textContent=componentCapacityText(n);
}
function enableComponents(){
 componentMode=true;
 for(let n=1;n<=plateCount;n++){
  const key=`component${n}`;
  quoteDraft[`${key}Name`]??=`Componente placa ${n}`;
  quoteDraft[`${key}Required`]??='1';
  quoteDraft[`${key}Produced`]??=String(plateCapacity(n));
 }
}
function disableComponents(){componentMode=false;for(const k of Object.keys(quoteDraft))if(/^component\d+(Name|Required|Produced)$/.test(k))Reflect.deleteProperty(quoteDraft,k);}
const fmtDuration=hours=>{const v=Number(hours);if(!Number.isFinite(v)||v<=0)return '—';let h=Math.floor(v),m=Math.round((v-h)*60);if(m===60){h+=1;m=0;}return h?`${h} h${m?` ${m} min`:''}`:`${m} min`;};
const gramsFmt=g=>`${(Math.round(Number(g)*100)/100).toLocaleString('es-CL')} g`;
function materialOptions(selected){const committed=committedGrams(db);return db.materials.map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''}>${esc(materialLabel(m,{committed}))}</option>`).join('');}
function plateCard(n){
 const key=`plate${n}`,colors=plateColors[n]||1;
 const rows=Array.from({length:colors},(_,i)=>{const k=i+1,sel=quoteDraft[`${key}Mat${k}`]??db.materials[0]?.id;
  return `<div class="filament-row"><span class="filament-dot" data-dot-for="${key}Mat${k}" style="${dotStyle(sel)}">${k}</span><select name="${key}Mat${k}" aria-label="Placa ${n}, filamento ${k}">${materialOptions(sel)}</select><input name="${key}Grams${k}" type="number" min="0" step="any" inputmode="decimal" placeholder="g/placa" aria-label="Placa ${n}, gramos del filamento ${k}" value="${esc(quoteDraft[`${key}Grams${k}`]??'')}">${k>1?`<button type="button" class="filament-remove" data-plate-color-remove="${n}:${k}" aria-label="Quitar filamento ${k} de la placa ${n}">×</button>`:'<span></span>'}</div>`;}).join('');
 return `<div class="plate-card" data-plate="${n}"><div class="plate-card-head"><strong>Placa ${n}</strong><button type="button" class="filament-remove" data-plate-remove="${n}" aria-label="Quitar placa ${n}">×</button></div>
 <div class="field filament-list"><div class="filament-head"><span>Filamentos</span><small>g por placa</small></div>${rows}${colors<MAX_PLATE_COLORS?`<button type="button" class="filament-add" data-plate-color-add="${n}">＋ Agregar color</button>`:''}</div>
 <div class="fields-grid">${durationField(`${key}Hours`,'Tiempo de la placa')}<label class="field">Capacidad de esta placa (productos) <input name="${key}Units" type="number" min="1" step="1" inputmode="numeric" value="${esc(quoteDraft[`${key}Units`]??'1')}" ${componentMode?'readonly':''}><small>${componentMode?'Calculado a partir de los componentes.':'¿Para cuántos productos alcanza una impresión de esta placa?'}</small></label></div></div>`;
}
function extraPlatesHtml(){
 return `${Array.from({length:plateCount-1},(_,i)=>plateCard(i+2)).join('')}${plateCount<MAX_PLATES?`<button type="button" class="filament-add plate-add" data-plate-add>＋ Agregar otra placa <small>(componentes del mismo producto)</small></button>`:''}`;
}
/** Desplaza los campos `plate{m}…` de las placas siguientes una posición hacia atrás (al quitar la placa n). */
function shiftPlatesDown(n){
 const moved={};
 for(const [k,v] of Object.entries(quoteDraft)){const mm=/^plate(\d+)([A-Z].*)$/.exec(k);if(!mm)continue;const p=Number(mm[1]);Reflect.deleteProperty(quoteDraft,k);if(p!==n)moved[`plate${p>n?p-1:p}${mm[2]}`]=v;}
 Object.assign(quoteDraft,moved);
 const components={};for(const [k,v] of Object.entries(quoteDraft)){const m=/^component(\d+)(Name|Required|Produced)$/.exec(k);if(!m)continue;const p=Number(m[1]);Reflect.deleteProperty(quoteDraft,k);if(p!==n)components[`component${p>n?p-1:p}${m[2]}`]=v;}
 Object.assign(quoteDraft,components);
 const colors={};for(const [p,c] of Object.entries(plateColors)){const q=Number(p);if(q!==n)colors[q>n?q-1:q]=c;}
 plateColors=colors;plateCount--;
 if(plateCount===1)disableComponents();
}
/** Placas y colores en pantalla a partir de los campos guardados (recotizar). */
function platesFromDraft(){
 plateCount=1;plateColors={};
 for(let n=2;n<=MAX_PLATES;n++){if(quoteDraft[`plate${n}Units`]===undefined)break;plateCount=n;let c=1;for(let k=2;k<=MAX_PLATE_COLORS;k++)if(quoteDraft[`plate${n}Mat${k}`]!==undefined)c=k;plateColors[n]=c;}
 componentMode=plateCount>1&&quoteDraft.component1Required!==undefined;
}
function resetPlates(){plateCount=1;plateColors={};componentMode=false;importInfo=null;}
// Importación
const normText=v=>String(v??'').toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
async function inflateRawBrowser(bytes){
 if(typeof DecompressionStream!=='function')throw Error('Este navegador no puede leer archivos .3mf. Usa Chrome, Edge, Firefox o Safari actualizados.');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** Impresora del taller que corresponde a la del archivo («Bambu Lab A1» no debe elegir «A1 mini»). */
function printerForImport(printer){
 const p=normText(printer);if(!p)return null;
 return db.printers.find(m=>normText(m.name)===p)||db.printers.find(m=>normText(m.name).includes(p)&&(p.includes('mini')||!normText(m.name).includes('mini')))||null;
}
function applyImport(info,{materialsOnly=false}={}){
 const mat=slot=>info.mapping[slot]||db.materials[0]?.id||'';
 const [first,...rest]=info.plates;
 if(!materialsOnly){
  disableComponents();
  for(const k of Object.keys(quoteDraft))if(/^(plate\d+[A-Z]|ams(Material|Grams)\d|lastRun|plateH$|plateMin$|_lastRunParts$)/.test(k))Reflect.deleteProperty(quoteDraft,k);
  const projectField=String(quoteDraft.project??'').trim();
  if(!projectField||projectField==='Macetero geométrico')quoteDraft.project=(info.title||info.fileName.replace(/\.gcode\.3mf$|\.3mf$/i,'')).slice(0,90);
  const printer=printerForImport(info.printer);if(printer){selectedMachineId=printer.id;quoteDraft.machineId=printer.id;}
  quoteDraft.plateWeightGr=String(first.filaments[0].grams);
  quoteDraft.plateHours=String(first.hours);
  quoteDraft.partsPerPlate=String(rest.length?1:Math.max(1,first.objects.length));
  amsRows=Math.min(AMS_MAX_EXTRA,first.filaments.length-1);
  first.filaments.slice(1,1+AMS_MAX_EXTRA).forEach((f,i)=>{quoteDraft[`amsGrams${i+2}`]=String(f.grams);});
  if(quoteExtras.has('planning')&&rest.length)quoteDraft.partsPerUnit='1';
  plateCount=1+Math.min(rest.length,MAX_PLATES-1);plateColors={};
  rest.slice(0,MAX_PLATES-1).forEach((plate,i)=>{const n=i+2;plateColors[n]=Math.min(MAX_PLATE_COLORS,plate.filaments.length);quoteDraft[`plate${n}Units`]='1';quoteDraft[`plate${n}Hours`]=String(plate.hours);plate.filaments.slice(0,MAX_PLATE_COLORS).forEach((f,k)=>{quoteDraft[`plate${n}Grams${k+1}`]=String(f.grams);});});
  quoteDraft.importFile=info.fileName;quoteDraft.importSlicer=info.slicer;quoteDraft.importPrinter=info.printer;
  syncMulticolor();
 }
 quoteDraft.materialId=mat(first.filaments[0].slot);
 first.filaments.slice(1,1+AMS_MAX_EXTRA).forEach((f,i)=>{quoteDraft[`amsMaterial${i+2}`]=mat(f.slot);});
 rest.slice(0,MAX_PLATES-1).forEach((plate,i)=>plate.filaments.slice(0,MAX_PLATE_COLORS).forEach((f,k)=>{quoteDraft[`plate${i+2}Mat${k+1}`]=mat(f.slot);}));
}
async function importBambuFile(file){
 if(!file)return;
 if(file.size>200*1024*1024)throw Error('El archivo es demasiado grande (máximo 200 MB).');
 const info=await readSlicedProject(new Uint8Array(await file.arrayBuffer()),{inflateRaw:inflateRawBrowser,fileName:file.name});
 info.mapping={};info.match={};
 for(const f of info.filaments){const r=matchMaterial(f,db.materials);info.mapping[f.slot]=r.materialId;info.match[f.slot]=r.match;}
 importInfo=info;applyImport(info);render();
 const skipped=info.plates.length>MAX_PLATES?` Solo se importaron ${MAX_PLATES} placas.`:'';
 const review=info.filaments.some(f=>info.match[f.slot]!=='exact');
 toast(`Importado: ${info.plates.length} placa${info.plates.length===1?'':'s'}, ${info.filaments.length} color${info.filaments.length===1?'':'es'}, ${fmtDuration(info.totals.hours)}, ${gramsFmt(info.totals.grams)}.${review?' Revisa la asociación de colores.':''}${skipped}`,review||skipped?'warning':'success');
}
function importBlock(){
 const hidden=['importFile','importSlicer','importPrinter'].map(k=>quoteDraft[k]?`<input type="hidden" name="${k}" value="${esc(quoteDraft[k])}">`:'').join('');
 const bar=`<div class="import-bar"><label class="btn btn-light import-btn" for="bambu-file" tabindex="0">${ic('download',16)} Importar desde Bambu Studio</label><input id="bambu-file" type="file" accept=".3mf" hidden><small>Archivo <b>.gcode.3mf</b>: en Bambu Studio, «Laminar todas las placas» → Archivo → Exportar → «Exportar todas las placas laminadas». Se lee en tu navegador; no se sube a ningún lado.</small></div>`;
 if(!importInfo)return bar+(quoteDraft.importFile?`<div class="import-note">${ic('check',15)} Datos importados de <b>${esc(quoteDraft.importFile)}</b>${quoteDraft.importPrinter?` · ${esc(quoteDraft.importPrinter)}`:''}</div>`:'')+hidden;
 const i=importInfo;
 const badge=slot=>({exact:'<span class="match ok">✓ coincide</span>',type:'<span class="match warn">revisa el color</span>',none:'<span class="match bad">sin ese tipo en inventario</span>'})[i.match[slot]]||'';
 return bar+`<div class="import-summary"><div class="import-head"><div><b>${esc(i.title||i.fileName)}</b><small>${esc(i.fileName)} · ${esc(i.printer||'impresora no indicada')} · ${esc(i.slicer)}</small></div><button type="button" class="text-button" data-import-clear>Quitar</button></div>
 <div class="import-stats"><span><b>${i.plates.length}</b> placa${i.plates.length===1?'':'s'}</span><span><b>${fmtDuration(i.totals.hours)}</b> en total</span><span><b>${gramsFmt(i.totals.grams)}</b> de filamento</span></div>
 <div class="import-map"><div class="import-map-head">Colores del archivo → tu inventario</div>${i.filaments.map(f=>`<div class="import-map-row"><span class="filament-dot sm" style="background:${esc(f.hex||'#ccc')};${isLightHex(f.hex||'#ccc')?'border-color:#0004':''}"></span><span class="import-file-color">${esc(colorName(f.hex))} <small>${esc(f.type)}${f.profile?` · ${esc(f.profile)}`:''}</small></span><select data-import-slot="${f.slot}" aria-label="Material del inventario para el color ${f.slot} del archivo">${materialOptions(i.mapping[f.slot])}</select>${badge(f.slot)}</div>`).join('')}</div></div>`+hidden;
}
function plateBreakdownHtml(s){
 if(!s.plateBreakdown||s.plateBreakdown.length<2)return '';
 return `<div class="plate-breakdown"><div class="stock-title">Desglose por placa</div><div class="pb-grid"><small>Placa</small><small>Impresiones</small><small>Tiempo c/u</small><small>g c/u</small><small class="right">Costo directo</small>${s.plateBreakdown.map(l=>`<span>${esc(l.label)}</span><span>${l.physical}×</span><span>${fmtDuration(l.hoursEach)}</span><span>${gramsFmt(l.gramsEach)}</span><b class="right">${money(l.directCost)}</b>`).join('')}</div></div>`;
}
let showArchivedClients = false;
let clientSearchTerm = '';
let quoteMenuOpen = null;
let revisionSourceId = null;
let toastTimeout;
const money = n => new Intl.NumberFormat('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 }).format(Number(n) || 0);
const fmtDate = d => { if (!d) return '—'; const [y,m,dd] = String(d).split('-'); return dd && m && y ? `${dd}/${m}/${y}` : d; };
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clientName = id => db.clients.find(c=>c.id===id)?.name ?? 'Sin asignar';
const today = () => localDate();
const now = () => new Date().toISOString();
const nextId = (prefix, data) => prefix + '-' + String(Math.max(0,...data.map(x=>Number(x.id.split('-').at(-1))||0)) + 1).padStart(4,'0');
const iconPaths = {
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  clients:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M5.5 16c.6-2 6.4-2 7 0M15 9h3M15 13h3"/>',
  calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="5" width="8" height="3" rx=".5"/><path d="M8 12h2m4 0h2m-8 4h2m4 0h2"/>',
  projects:'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  orders:'<rect x="5" y="3" width="14" height="19" rx="2"/><path d="M9 3.5V2h6v1.5M9 10h6M9 14h6M9 18h4"/>',
  machines:'<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M8 4h8m-8 7h8m-4 0v4M7 19v2m10-2v2"/>',
  materials:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v.1"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  printer:'<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M8 5V3h8v2M8 12h8M8 16h8"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
};
const ic=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]||iconPaths.dashboard}</svg>`;
const NAV = [ ['dashboard','Panel general'], ['clients','Clientes / CRM'], ['calculator','Cotizador'], ['projects','Proyectos'], ['orders','Pedidos'], ['materials','Materiales'], ['machines','Impresoras'] ];
/** Etiquetas cortas para la barra inferior del celular (íconos solos no se entienden). */
const NAV_SHORT = {dashboard:'Panel',clients:'Clientes',calculator:'Cotizar',projects:'Proyectos',orders:'Pedidos',materials:'Material',machines:'Impresoras',settings:'Ajustes'};
const heads = {
  dashboard:['Resumen general','Un vistazo a lo que está pasando en tu taller.'],
  clients:['Clientes y contactos','Tu relación con cada cliente, en un solo lugar.'],
  calculator:['Nueva cotización','Los datos esenciales de cada trabajo; el resto viene de tus perfiles.'],
  projects:['Proyectos','De la idea y el prototipo hasta la pieza final.'],
  orders:['Gestión de pedidos','Sigue el estado de cada trabajo en producción.'],
  materials:['Inventario de materiales','Filamentos y costos de referencia.'],
  machines:['Mis impresoras','Perfiles de máquina y costos por hora.'],
  settings:['Configuración','Parámetros del taller, cuenta y respaldo.'],
};
const statusBadge=s=>{const key=({'En producción':'blue','Preparación':'orange','En pruebas':'orange','Pendiente':'neutral','Entregado':'green','Aceptada':'green','Enviada':'blue','Borrador':'neutral','Rechazada':'red','Vencida':'orange','Pagado':'green','Abonado':'orange','Pendiente de pago':'neutral','Listo':'green','Diseño':'neutral','Anulado':'red','Anulado con abonos':'red'})[s]||'neutral';return `<span class="status ${key}"><i></i>${esc(s)}</span>`;};
const persist=()=>{
 if(CLOUD){
  // Guardados en serie: cada uno escribe solo lo que cambió respecto de lo que el servidor ya tiene.
  cloudSaving=cloudSaving.then(()=>CLOUD.save(db)).then(()=>true,err=>{toast(`No se pudo guardar en la nube: ${err.message}`,'warning');return false;});
  return cloudSaving;
 }
 const ok=MockRepository.save(db);
 if(!ok) toast('El navegador no pudo guardar los cambios en almacenamiento local.','warning');
 return Promise.resolve(Boolean(ok));
};
/** Reemplaza (o agrega) una entidad con la versión que confirmó el servidor. */
function mergeEntity(key,entity,{prepend=false}={}){db[key]??=[];const i=db[key].findIndex(x=>x.id===entity.id);if(i>=0)db[key][i]=entity;else if(prepend)db[key].unshift(entity);else db[key].push(entity);}
/** Folio de cotización: en la nube se reserva en una transacción (nunca se repite entre sesiones). */
async function reserveQuoteNumber(){
 const localMax=Math.max(0,Number(db.meta?.lastQuoteNumber)||0,...db.quotes.map(q=>Number(/^COT-(\d+)$/.exec(q.id)?.[1])||0));
 const n=await CLOUD.reserveQuoteNumber(localMax);db.meta??={};db.meta.lastQuoteNumber=n-1;return n;
}
const newPaymentId=()=>'pago-'+(globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2,12)}`).replace(/[^A-Za-z0-9_-]/g,'');
function toast(msg, kind='success') { const el=document.getElementById('toast'); if(!el)return; el.innerHTML=`${ic(kind==='success'?'check':'info',17)} <span>${esc(msg)}</span>`;el.className='toast show '+kind; clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.className='toast',3500); }
/**
 * Confirmación dentro de la página (reemplaza window.confirm, que algunos visores bloquean y que no sigue el diseño).
 * Solo para acciones destructivas. Devuelve una promesa: true = confirmar, false = cancelar / Escape / fondo.
 */
function askConfirm({title='¿Confirmas esta acción?',message='',confirmLabel='Confirmar',danger=true}={}){
 return new Promise(resolve=>{
  document.getElementById('confirm-root')?.remove();
  const root=document.createElement('div');root.id='confirm-root';
  root.innerHTML=`<div class="modal-backdrop confirm-backdrop" data-confirm="no"><div class="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"><div class="dialog-head"><div><h2 id="confirm-title">${esc(title)}</h2></div></div><p id="confirm-message" class="confirm-message">${esc(message)}</p><div class="dialog-actions"><button type="button" class="btn btn-light" data-confirm="no">Cancelar</button><button type="button" class="btn ${danger?'btn-danger':'btn-primary'}" data-confirm="yes">${esc(confirmLabel)}</button></div></div></div>`;
  const done=answer=>{root.remove();document.removeEventListener('keydown',onKey,true);resolve(answer);};
  const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();done(false);}};
  root.addEventListener('click',e=>{const t=e.target.closest('[data-confirm]');if(!t)return;if(t.dataset.confirm==='no'&&t.classList.contains('confirm-backdrop')&&e.target!==t)return;done(t.dataset.confirm==='yes');});
  document.addEventListener('keydown',onKey,true);
  document.body.appendChild(root);root.querySelector('[data-confirm="no"].btn')?.focus();
 });
}
function tableEmpty(colspan,text='Todavía no hay registros') {return `<tr><td colspan="${colspan}" class="empty-table">${esc(text)}</td></tr>`;}
function layout(){
const [pageTitle,subtitle]=heads[route]??heads.dashboard;
return `<div class="shell">
<aside class="sidebar"><div class="brand"><div class="brand-mark"><span class="brand-cube">◈</span></div><div><strong>FORMA<span class="brand-dot">.</span></strong><small>STUDIO / 3D</small></div></div>
<div class="side-label">ESPACIO DE TRABAJO</div><nav class="side-nav" aria-label="Menú principal">${NAV.map(([id,label])=>`<button aria-label="${esc(label)}" class="nav-item ${route===id?'active':''}" data-nav="${id}" ${route===id?'aria-current="page"':''}>${ic(id)}<span>${label}</span><span class="nav-short" aria-hidden="true">${NAV_SHORT[id]}</span>${id==='orders'?`<span class="nav-count">${activeOrders().length}</span>`:''}</button>`).join('')}<button class="nav-item nav-mobile-only ${route==='settings'?'active':''}" data-nav="settings" aria-label="Configuración">${ic('settings')}<span class="nav-short" aria-hidden="true">${NAV_SHORT.settings}</span></button></nav>
<div class="side-footer">${PROD?'':`<div class="sidebar-help"><span class="help-symbol">✦</span><strong>Tu taller, organizado.</strong><p>Esta es una versión de exploración. Prueba, cambia y danos feedback.</p><button data-nav="settings">Ver alcance de la beta ${ic('arrow',15)}</button></div>`}<button class="nav-item settings-link ${route==='settings'?'active':''}" data-nav="settings">${ic('settings')} <span>Configuración</span></button><div class="side-profile"><div class="avatar">3D</div><div><strong>Mi taller 3D</strong><small>${CLOUD?esc(cloudUser?.email||''):'Modo demostración'}</small></div><span class="profile-more">${ic('more',17)}</span></div></div></aside>
<div class="workspace"><header class="topbar"><div class="crumb">Mi espacio <span>/</span> <strong>${pageTitle}</strong></div><div class="top-right">${PROD?'':`<span class="demo-indicator" title="${esc(ENV.note)}"><span></span> ${esc(ENV.label)}</span>`}${cloudUser?`<button type="button" class="text-button" id="cloud-signout" title="${esc(cloudUser.email||'')}">Cerrar sesión</button>`:''}<div class="top-avatar">3D</div></div></header>
<main class="main"><div class="page-heading"><div><div class="eyebrow">WORKSPACE / 2026</div><h1>${pageTitle}</h1><p>${subtitle}</p></div><div class="heading-actions">${route==='dashboard'?`<button class="btn btn-light" data-nav="clients">${ic('clients',17)} Ver clientes</button><button class="btn btn-primary" data-nav="calculator">${ic('plus',18)} Nueva cotización</button>`:route==='clients'?`<button class="btn btn-primary" data-modal="client">${ic('plus',18)} Nuevo cliente</button>`:route==='projects'?`<button class="btn btn-primary" data-modal="project">${ic('plus',18)} Nuevo proyecto</button>`:route==='orders'?`<button class="btn btn-primary" data-modal="order">${ic('plus',18)} Nuevo pedido</button>`:route==='materials'?`<button class="btn btn-primary" data-modal="material">${ic('plus',18)} Agregar material</button>`:route==='machines'?`<button class="btn btn-primary" data-modal="machine">${ic('plus',18)} Agregar impresora</button>`:''}</div></div>
${page()}
<footer class="page-footer"><span>© 2026 Forma Studio${PROD?'':' — Beta exploratoria'}</span><span>${PROD?'':CLOUD?`Datos en la nube (${esc(CLOUD.projectId)})${cloudUser?` · ${esc(cloudUser.email||'')}`:''}`:'Datos almacenados en este navegador'}</span></footer></main></div></div><div id="modal-root"></div><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}
/** Título de la pestaña: «Pedidos (3) · FORMA Studio»; fuera de producción se marca el entorno. */
const TAB_TITLES={dashboard:'Panel',clients:'Clientes',calculator:'Cotizador',projects:'Proyectos',orders:'Pedidos',materials:'Materiales',machines:'Impresoras',settings:'Configuración'};
function tabTitle(name){const envTag=PROD?'':CLOUD?' · Staging':' · Demo';return `${name} · FORMA Studio${envTag}`;}
function updateTabTitle(){const open=activeOrders().length;document.title=tabTitle(route==='orders'&&open?`Pedidos (${open})`:TAB_TITLES[route]||'Panel');}
function page(){switch(route){case 'dashboard':return dashboard();case 'clients':return clients();case 'calculator':return calculator();case 'projects':return projects();case 'orders':return orders();case 'materials':return materials();case 'machines':return machines();case 'settings':return settings();default:return dashboard();}}
const activeOrders=()=>db.orders.filter(o=>o.status!=='Entregado'&&!isOrderCancelled(o));
const monthlySales=()=>db.orders.filter(o=>o.status==='Entregado').reduce((s,o)=>s+o.amount,0);
const moneyReceived=()=>db.orders.reduce((s,o)=>s+paymentSummary(o).paid,0);
// ── Panel «Hoy» (0.15) ──────────────────────────────────────────────────────────────────────────────────────────
const TODAY_ROWS=5;
const dueChip=days=>`<span class="due-chip ${urgency(days)}">${esc(dueLabel(days))}</span>`;
function todayCard({title,icon,count,countLabel,rows,empty,more,nav}){
 return `<section class="panel today-card"><div class="today-head"><span class="today-icon">${ic(icon,17)}</span><div><h3>${title}</h3><small>${count?`${count} ${countLabel}`:''}</small></div>${nav?`<button class="text-button" data-nav="${nav}">Ver ${ic('arrow',14)}</button>`:''}</div>${rows.length?`<ul class="today-list">${rows.join('')}</ul>${more>0?`<p class="today-more">y ${more} más</p>`:''}`:`<p class="today-empty">${ic('check',15)} ${empty}</p>`}</section>`;
}
function todaySection(){
 const a=todayAgenda(db,today());
 const prodRows=a.production.slice(0,TODAY_ROWS).map(({order:o,days})=>`<li><button type="button" class="today-row" data-order-detail="${esc(o.id)}"><span><b>${esc(o.project)}</b><small>${esc(o.id)} · ${esc(clientName(o.clientId))} · ${esc(o.status)}</small></span>${dueChip(days)}</button></li>`);
 const quoteRows=a.quotes.slice(0,TODAY_ROWS).map(({quote:q,days,sentDaysAgo})=>`<li><button type="button" class="today-row" data-quote-action="detail" data-id="${esc(q.id)}"><span><b>${esc(q.project)}</b><small>${esc(q.id)} · ${esc(clientName(q.clientId))} · ${money(q.gross)}${sentDaysAgo!==null?` · enviada hace ${sentDaysAgo} día${sentDaysAgo===1?'':'s'}`:''}</small></span><span class="due-chip ${urgency(days)}">${days===null?'sin vigencia':days<0?'vencida':`vence ${dueLabel(days)}`}</span></button></li>`);
 const payRows=a.receivables.slice(0,TODAY_ROWS).map(({order:o,pending})=>`<li><button type="button" class="today-row" data-order-detail="${esc(o.id)}"><span><b>${esc(o.project)}</b><small>${esc(o.id)} · ${esc(clientName(o.clientId))} · ${esc(o.status)}</small></span><b class="today-amount">${money(pending)}</b></button></li>`);
 const stockRows=a.lowStock.slice(0,TODAY_ROWS).map(r=>`<li><button type="button" class="today-row" data-material-movements="${esc(r.material.id)}"><span class="today-mat"><span class="swatch-dot sm" style="background:${/^#[0-9a-fA-F]{6}$/.test(r.material.hex||'')?r.material.hex:'#ccc'}"></span><span><b>${esc(materialLabel(r.material))}</b><small>disponible ${gramsTxt(Math.max(0,r.available))} · mínimo ${gramsTxt(r.min)}${r.committed>0?` · ${gramsTxt(r.committed)} comprometidos`:''}</small></span></span><span class="due-chip ${r.available<=0?'late':'soon'}">${r.available<=0?'sin stock':'bajo'}</span></button></li>`);
 const backup=a.backup.due?`<div class="today-banner">${ic('info',17)} <span>${a.backup.days===null?'Aún no descargas un respaldo de tus datos.':`Tu último respaldo fue hace ${a.backup.days} días.`} Recomendado: una vez por semana.</span><button type="button" class="btn btn-light compact-button" id="backup-download">Descargar respaldo</button></div>`:'';
 const summary=[a.late?`<b class="late">${a.late} atrasado${a.late===1?'':'s'}</b>`:'',a.dueSoon?`${a.dueSoon} por entregar en ${SOON_DAYS} días`:'',a.expiringQuotes?`${a.expiringQuotes} cotización${a.expiringQuotes===1?'':'es'} por vencer`:'',a.receivableTotal?`${money(a.receivableTotal)} por cobrar`:'',a.lowStock.length?`${a.lowStock.length} filamento${a.lowStock.length===1?'':'s'} bajo${a.lowStock.length===1?'':'s'}`:''].filter(Boolean);
 return `${backup}<div class="today-title"><h2>Hoy</h2><p>${summary.length?summary.join(' · '):'Todo al día.'}</p></div><div class="today-grid">
 ${todayCard({title:'Producción y entregas',icon:'printer',count:a.production.length,countLabel:`pedido${a.production.length===1?'':'s'} en curso`,rows:prodRows,more:a.production.length-TODAY_ROWS,empty:'No hay pedidos en curso.',nav:'orders'})}
 ${todayCard({title:'Cotizaciones esperando respuesta',icon:'calculator',count:a.quotes.length,countLabel:`enviada${a.quotes.length===1?'':'s'}`,rows:quoteRows,more:a.quotes.length-TODAY_ROWS,empty:'No hay cotizaciones esperando respuesta.',nav:'calculator'})}
 ${todayCard({title:'Por cobrar',icon:'check',count:a.receivables.length,countLabel:`pedido${a.receivables.length===1?'':'s'} · ${money(a.receivableTotal)}`,rows:payRows,more:a.receivables.length-TODAY_ROWS,empty:'No hay saldos por cobrar.',nav:'orders'})}
 ${todayCard({title:'Filamento bajo',icon:'materials',count:a.lowStock.length,countLabel:'bajo el mínimo',rows:stockRows,more:a.lowStock.length-TODAY_ROWS,empty:'Todo el filamento sobre su mínimo.',nav:'materials'})}
 </div>`;
}
function dashboard(){
 const live=db.orders.filter(o=>!isOrderCancelled(o));
 const pipeline=[{label:'Pendientes',count:live.filter(x=>x.status==='Pendiente').length},{label:'Preparación',count:live.filter(x=>x.status==='Preparación').length},{label:'Producción',count:live.filter(x=>x.status==='En producción').length},{label:'Entregados',count:live.filter(x=>x.status==='Entregado').length}];
 return `${PROD?'':`<section class="hero"><div class="hero-copy"><div class="hero-kicker"><span class="light-dot"></span> PANEL DE CONTROL</div><h2>Da forma a tus ideas.<br/><em>Nosotros ordenamos el resto.</em></h2><p>Clientes, proyectos, cotizaciones y pedidos. Todo tu flujo de impresión 3D, en un mismo lugar.</p><button class="hero-btn" data-nav="calculator">Crear nueva cotización ${ic('arrow',18)}</button></div><div class="hero-art" aria-hidden="true"><div class="art-shadow"></div><div class="art-stack art-stack-3"></div><div class="art-stack art-stack-2"></div><div class="art-stack art-stack-1"></div><div class="art-hole"></div><div class="art-outline"></div><div class="art-spark a">✦</div><div class="art-spark b">✦</div></div></section>`}
 ${todaySection()}
 <section class="stats-grid"><div class="metric"><div class="metric-top"><span>Pedidos activos</span><span class="metric-icon lilac">${ic('orders',20)}</span></div><strong>${activeOrders().length}</strong><small>En la cola de trabajo</small></div><div class="metric"><div class="metric-top"><span>Cotizaciones</span><span class="metric-icon mint">${ic('calculator',20)}</span></div><strong>${db.quotes.length}</strong><small>Registradas</small></div><div class="metric"><div class="metric-top"><span>Clientes</span><span class="metric-icon peach">${ic('clients',20)}</span></div><strong>${db.clients.length}</strong><small>Contactos en tu cartera</small></div><div class="metric"><div class="metric-top"><span>Ventas entregadas</span><span class="metric-icon sky">${ic('check',20)}</span></div><strong class="money-metric">${money(monthlySales())}</strong><small>Entregas (no equivale a cobrado)</small></div></section>
 <div class="dashboard-grid"><section class="panel recent-panel"><div class="panel-head"><div><h3>Pedidos recientes</h3><p>Control de tus trabajos en curso</p></div><button class="text-button" data-nav="orders">Ver todos ${ic('arrow',16)}</button></div><div class="table-wrap"><table><thead><tr><th>TRABAJO</th><th>CLIENTE</th><th>ESTADO</th><th class="right">IMPORTE</th></tr></thead><tbody>${db.orders.slice(0,5).map(o=>`<tr><td><span class="table-title">${esc(o.project)}</span><span class="table-sub">${esc(o.id)}</span></td><td>${esc(clientName(o.clientId))}</td><td>${statusBadge(o.status)} <span class="order-payment-inline">${statusBadge(paymentSummary(o).status)}</span></td><td class="right strong-td">${money(o.amount)}</td></tr>`).join('')||tableEmpty(4)}</tbody></table></div></section>
 <section class="panel pipeline-panel"><div class="panel-head"><div><h3>Estado de producción</h3><p>Distribución actual de pedidos</p></div><span class="small-ghost">${ic('printer',20)}</span></div><div class="pipeline-items">${pipeline.map((p,i)=>`<div class="pipeline-item"><div class="pipeline-label"><span><i class="pipeline-dot p${i}"></i>${p.label}</span><b>${p.count}</b></div><div class="progress-track"><div class="progress-fill p${i}" style="width:${live.length?Math.round(p.count/live.length*100):0}%"></div></div></div>`).join('')}</div>${PROD?'':`<div class="pipeline-footer">${ic('info',17)} Actualizado con los datos de esta demo.</div>`}</section></div>
 <section class="panel project-overview"><div class="panel-head"><div><h3>Proyectos en desarrollo</h3><p>Diseños, pruebas y próximas entregas</p></div><button class="text-button" data-nav="projects">Ver proyectos ${ic('arrow',16)}</button></div><div class="project-cards">${db.projects.slice(0,3).map((p,i)=>`<div class="project-tile"><div class="tile-thumb shape${i}"><div class="shape-object"></div></div><div class="tile-content"><div class="tile-mini">${esc(p.category)}</div><strong>${esc(p.name)}</strong><small>${esc(clientName(p.clientId))}</small><div class="tile-bottom"><span>${statusBadge(p.status)}</span><b>${p.progress}%</b></div><div class="progress-track thin"><div class="progress-fill mint-bar" style="width:${p.progress}%"></div></div></div></div>`).join('')}</div></section>`;
}
const activeClients = () => db.clients.filter(c => !c.archivedAt);
const filteredClients = () => db.clients.filter(c => (showArchivedClients || !c.archivedAt) &&
 [c.name,c.company,c.email,c.phone].some(value => String(value||'').toLocaleLowerCase('es-CL').includes(clientSearchTerm)));
function clients(){return `<section class="panel full-panel"><div class="list-tools client-tools"><div class="search-control">${ic('search',17)}<input id="client-search" value="${esc(clientSearchTerm)}" placeholder="Buscar nombre, empresa, correo o teléfono" aria-label="Buscar clientes"></div><div class="client-tools-right"><label class="archive-toggle"><input type="checkbox" id="show-archived-clients" ${showArchivedClients?'checked':''}> Ver archivados</label><span class="count-chip">${activeClients().length} activos</span></div></div><div class="table-wrap"><table><thead><tr><th>CLIENTE</th><th>EMPRESA</th><th>CONTACTO</th><th>REGISTRADO</th><th>ACTIVIDAD</th><th class="client-action-heading">ACCIONES</th></tr></thead><tbody id="client-tbody">${clientRows(filteredClients())}</tbody></table></div></section>`;}
function clientRows(list){return list.map((c,i)=>{const history=clientRelations(db,c.id);return `<tr class="${c.archivedAt?'archived-client':''}"><td><div class="user-cell"><span class="mini-avatar c${i%5}">${esc(c.name.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><div><button type="button" class="client-name-button" data-client-detail="${esc(c.id)}">${esc(c.name)}</button>${c.archivedAt?'<span class="archived-mark">Archivado</span>':''}</div></div></td><td>${esc(c.company||'Particular')}</td><td><span>${esc(c.email||'—')}</span><span class="table-sub">${esc(c.phone||'')}</span></td><td>${fmtDate(c.createdAt)}</td><td><span class="client-activity">${history.orders.length} ${history.orders.length===1?'pedido':'pedidos'} · ${history.quotes.length} ${history.quotes.length===1?'cotización':'cotizaciones'}</span></td><td class="client-actions-cell"><button type="button" class="small-action client-more-button" data-client-menu="${esc(c.id)}" aria-label="Opciones de ${esc(c.name)}" aria-haspopup="menu" aria-expanded="false">${ic('more',19)}</button></td></tr>`;}).join('')||tableEmpty(6,'No se encontraron clientes');}
function clientDetail(id) {
 const client=db.clients.find(c=>c.id===id);if(!client)throw Error('Cliente no encontrado.');
 const h=clientRelations(db,id);
 const orderRows=h.orders.slice().reverse().map(o=>`<tr><td><b>${esc(o.project)}</b><small>${esc(o.id)}</small></td><td>${fmtDate(o.dueDate)}</td><td>${statusBadge(o.status)} <span class="order-payment-inline">${statusBadge(paymentSummary(o).status)}</span></td><td class="right strong-td">${money(o.amount)}</td></tr>`).join('')||tableEmpty(4,'Este cliente todavía no tiene pedidos.');
 const quoteRows=h.quotes.slice().reverse().map(q=>`<tr><td><b>${esc(q.project)}</b><small>${esc(q.id)} · ${fmtDate(q.createdAt)}</small></td><td>${statusBadge(q.status)}</td><td class="right strong-td">${money(q.gross)}</td><td class="right"><div class="row-actions"><button class="small-action" data-copy-quote="${esc(q.id)}" aria-label="Copiar cotización ${esc(q.id)}">${ic('copy',15)}</button><button class="small-action" data-print-quote="${esc(q.id)}" aria-label="Imprimir cotización ${esc(q.id)}">${ic('download',15)}</button>${quoteMore(q)}</div></td></tr>`).join('')||tableEmpty(4,'Aún no hay cotizaciones guardadas.');
 const projectRows=h.projects.map(p=>`<div class="history-project"><span>${esc(p.name)}</span>${statusBadge(p.status)}</div>`).join('')||'<p class="history-empty">Aún no hay proyectos vinculados.</p>';
 document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog client-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">FICHA DEL CLIENTE · ${esc(client.id)}</div><h2 id="modal-title">${esc(client.name)}</h2><p class="client-detail-company">${esc(client.company||'Particular')}${client.archivedAt?' · Archivado':''}</p></div><button class="close-modal" data-close aria-label="Cerrar">×</button></div><div class="client-detail-content"><div class="client-contact-strip"><span>${ic('clients',16)} ${esc(client.email||'Sin correo')}</span><span>${ic('info',16)} ${esc(client.phone||'Sin teléfono')}</span><span>Cliente desde ${fmtDate(client.createdAt)}</span></div><div class="client-history-metrics"><div><small>Pedidos</small><strong>${h.orders.length}</strong></div><div><small>Cotizaciones</small><strong>${h.quotes.length}</strong></div><div><small>Pedidos entregados</small><strong>${h.deliveredCount}</strong></div><div><small>Importe de entregados*</small><strong>${money(h.deliveredAmount)}</strong></div></div><div class="history-title"><h3>Historial de pedidos</h3><small>Fecha pactada de entrega, no fecha de pago</small></div><div class="history-table-wrap"><table><thead><tr><th>TRABAJO</th><th>ENTREGA PACTADA</th><th>ESTADO</th><th class="right">IMPORTE</th></tr></thead><tbody>${orderRows}</tbody></table></div><div class="history-title"><h3>Historial de cotizaciones</h3></div><div class="history-table-wrap"><table><thead><tr><th>COTIZACIÓN</th><th>ESTADO</th><th class="right">IMPORTE</th><th class="right">DOCUMENTO</th></tr></thead><tbody>${quoteRows}</tbody></table></div><div class="history-title"><h3>Proyectos (${h.projects.length})</h3></div><div class="history-projects">${projectRows}</div><p class="history-footnote">*Suma de pedidos marcados «Entregado»; no acredita cobro o pago. Las cotizaciones no se suman a las ventas.</p></div><div class="dialog-actions"><button type="button" class="btn btn-light" data-close>Cerrar</button><button type="button" class="btn btn-primary" data-edit-client="${esc(client.id)}">Editar cliente</button></div></div></div>`;
 document.querySelector('.client-detail-dialog .close-modal')?.focus();
}
function closeClientMenu(){const menu=document.getElementById('client-action-menu');if(menu){document.querySelector(`[data-client-menu="${menu.dataset.id}"]`)?.setAttribute('aria-expanded','false');menu.remove();}}
function openClientMenu(button,id){
 const existing=document.getElementById('client-action-menu');if(existing?.dataset.id===id){closeClientMenu();return;}
 closeClientMenu();const client=db.clients.find(c=>c.id===id);if(!client)return;
 const h=clientRelations(db,id);
 const removeLabel=h.hasHistory?'Archivar del CRM':'Eliminar cliente';
 const popup=document.createElement('div');popup.id='client-action-menu';popup.className='client-popup-menu';popup.dataset.id=id;popup.setAttribute('role','menu');popup.innerHTML=`<button role="menuitem" data-client-action="detail" data-id="${esc(id)}">Ver ficha e historial</button><button role="menuitem" data-client-action="edit" data-id="${esc(id)}">Editar datos</button>${client.archivedAt?`<button role="menuitem" data-client-action="restore" data-id="${esc(id)}">Restaurar cliente</button>`:`<button role="menuitem" class="danger-menu-item" data-client-action="remove" data-id="${esc(id)}">${removeLabel}</button>`}`;
 document.body.appendChild(popup);button.setAttribute('aria-expanded','true');const rect=button.getBoundingClientRect();const hgt=popup.getBoundingClientRect().height;popup.style.left=Math.max(8,Math.min(window.innerWidth-210,rect.right-195))+'px';popup.style.top=Math.max(8,(window.innerHeight-rect.bottom<hgt+12?rect.top-hgt-6:rect.bottom+6))+'px';popup.querySelector('button')?.focus();
}

function quoteQuick(q){
  if(q.status==='Borrador'){const problem=issuanceProblem(db,q);if(problem)return `<span class="quote-quick blocked" title="${esc(problem)}">No emitible</span>`;return `<button type="button" class="quote-quick" data-quote-action="send-quick" data-id="${esc(q.id)}" title="Solo si ya enviaste el presupuesto">Ya la envié</button>`;}
  if(q.status==='Enviada')return `<button type="button" class="quote-quick green" data-quote-action="accept-order" data-id="${esc(q.id)}">Aceptar + pedido</button>`;
  if(q.status==='Aceptada'&&!linkedOrder(db,q.id))return `<button type="button" class="quote-quick green" data-quote-action="convert" data-id="${esc(q.id)}">Crear pedido</button>`;
  return '';
}
function quoteMore(q){return `<button type="button" class="small-action" data-quote-menu="${esc(q.id)}" aria-label="Opciones de ${esc(q.id)}" aria-haspopup="menu">${ic('more',17)}</button>`;}
function closeQuoteMenu(){document.getElementById('quote-action-menu')?.remove();quoteMenuOpen=null;}
function openQuoteMenu(btn,id){
  if(quoteMenuOpen===id){closeQuoteMenu();return;}
  closeQuoteMenu();closeClientMenu();const q=db.quotes.find(x=>x.id===id);if(!q)return;
  const opts=[['detail','Ver ficha y trazabilidad']];
  if(q.status==='Borrador')opts.push(['send-quick','Ya la envié · marcar enviada'],['send','Indicar canal de envío…'],['edit','Editar condiciones del borrador'],['delete','Eliminar borrador']);
  if(q.status==='Enviada')opts.push(['accept-order','Aceptar y crear pedido'],['accept-quick','Solo marcar aceptada'],['reject','Registrar rechazo']);
  if(q.status==='Aceptada'&&!linkedOrder(db,id))opts.push(['convert','Convertir a pedido']);
  if(q.status!=='Borrador'){opts.push(['revision','Crear revisión con mismo precio']);if(q.inputSnapshot)opts.push(['reprice','Nueva revisión y recotizar']);}
  if(q.formState)opts.push(['duplicate','Duplicar como nueva cotización'],['product','Guardar como producto frecuente…']);
  if(customerQuoteOf(db,id)&&['Borrador','Enviada'].includes(q.status))opts.push(['whatsapp','Enviar por WhatsApp']);
  const menu=document.createElement('div');menu.id='quote-action-menu';menu.className='client-popup-menu workflow-popup';menu.setAttribute('role','menu');menu.innerHTML=opts.map(([act,label])=>`<button type="button" role="menuitem" class="${act==='delete'?'danger-menu-item':''}" data-quote-action="${act}" data-id="${esc(id)}">${label}</button>`).join('');document.body.appendChild(menu);
  const r=btn.getBoundingClientRect(),h=menu.getBoundingClientRect().height;
  menu.style.left=Math.max(8,Math.min(window.innerWidth-232,r.right-220))+'px';menu.style.top=Math.max(8,(window.innerHeight-r.bottom<h+12?r.top-h-6:r.bottom+6))+'px';quoteMenuOpen=id;menu.querySelector('button')?.focus();
}
const eventDesc=(e)=>({DRAFT_CONDITIONS_UPDATED:'Condiciones de borrador modificadas',CREATED:'Borrador creado',STATUS_CHANGED:`${e.from} → ${e.to}`,ORDER_CREATED:'Convertido a pedido',REVISION_CREATED:'Nueva revisión desde '+e.fromQuote,PRODUCTION_CHANGED:`Producción: ${e.from} → ${e.to}`,PRODUCTION_REVERTED:`Corrección de estado: ${e.from} → ${e.to}`,ORDER_CANCELLED:`Pedido anulado (estaba en ${e.from})`,PAYMENT_RECORDED:'Abono registrado',MATERIAL_CONSUMED:`Filamento descontado del inventario: ${Math.round(Number(e.grams)||0).toLocaleString('es-CL')} g`,RESERVATION_RELEASED:`Reserva de filamento liberada (${(RELEASE_REASONS[e.reason]||e.reason||'').toLowerCase()})`,CONSUMPTION_RECORDED:`Consumo real registrado (${CONSUMPTION_KINDS[e.kind]||e.kind}): ${(Math.round(Number(e.grams)*10)/10).toLocaleString('es-CL')} g`}[e.type]||e.type);
const fmtTime=t=>{if(!t)return '—';const date=new Date(t);return Number.isFinite(date.getTime())?date.toLocaleString('es-CL'):String(t);};
function quoteDetail(id){const q=db.quotes.find(x=>x.id===id);if(!q)return;
  const o=linkedOrder(db,id),events=Array.isArray(q.events)?q.events:[];
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">TRAZABILIDAD · ${esc(q.id)}</div><h2 id="modal-title">${esc(q.project)}</h2><p class="client-detail-company">${esc(clientName(q.clientId))} · ${money(q.gross)} · ${esc(q.quantity)} unidad(es)</p></div><button class="close-modal" data-close aria-label="Cerrar">×</button></div><div class="workflow-detail"><div class="workflow-status-line">${statusBadge(q.status)}<span>${q.status==='Borrador'?'Vigencia al enviar: '+(Number(q.validDays)||7)+' días':'Válida hasta: '+fmtDate(validThrough(q))}</span>${q.revisionOf?`<span>Revisión ${q.revision} de ${esc(q.revisionOf)}</span>`:''}</div><div class="workflow-engine">${q.calculation?`Calculada con motor ${esc(q.calculationVersion)} · perfiles costo r${esc(q.profileRefs?.cost?.revision)} / precio r${esc(q.profileRefs?.pricing?.revision)} / material ${esc(q.profileRefs?.material?.id)} r${esc(q.profileRefs?.material?.revision)}`:`Registro del prototipo (${esc(q.calculationVersion||'sin versión')}): importe congelado, no recalculado.`}${q.status==='Borrador'&&issuanceProblem(db,q)?` · <strong>${esc(issuanceProblem(db,q))}</strong>`:''}</div>${o?`<div class="workflow-linked">${ic('orders',18)} <strong>Pedido vinculado: ${esc(o.id)}</strong> · ${statusBadge(o.status)} · ${statusBadge(paymentSummary(o).status)}</div>`:''}<h3>Historial de la cotización</h3><div class="workflow-events">${events.length?events.map(ev=>`<div><span class="workflow-event-dot"></span><div><b>${esc(eventDesc(ev))}</b><small>${esc(fmtTime(ev.at))}${ev.channel?' · '+esc(ev.channel):''}${ev.reason?' · '+esc(ev.reason):''}${ev.orderId?' · '+esc(ev.orderId):''}</small></div></div>`).join(''):'<p>Registro anterior a esta versión: no se dispone de un historial completo.</p>'}</div><p class="history-footnote">Los cambios de estado no alteran el precio acordado. Copiar texto o abrir WhatsApp no confirma el envío por sí solo.</p></div><div class="dialog-actions workflow-actions"><button class="btn btn-light" data-close>Cerrar</button>${q.status==='Borrador'?`<button class="btn btn-light" data-quote-action="delete" data-id="${esc(q.id)}">Eliminar borrador</button><button class="btn btn-primary" data-quote-action="send-quick" data-id="${esc(q.id)}">Ya la envié</button>`:q.status==='Enviada'?`<button class="btn btn-light" data-quote-action="reject" data-id="${esc(q.id)}">Rechazar</button><button class="btn btn-primary" data-quote-action="accept-order" data-id="${esc(q.id)}">Aceptar y crear pedido</button>`:q.status==='Aceptada'&&!o?`<button class="btn btn-primary" data-quote-action="convert" data-id="${esc(q.id)}">Crear pedido</button>`:''}</div></div></div>`;
}
function workflowForm(action,id){const quote=db.quotes.find(q=>q.id===id);if(!quote)return;
  const isSend=action==='send',isAccept=action==='accept',isReject=action==='reject',isConvert=action==='convert',isAcceptOrder=action==='accept-order';
  const title=isSend?'Confirmar envío':isAccept?'Registrar aceptación':isReject?'Registrar rechazo':isConvert?'Convertir en pedido':isAcceptOrder?'Aceptar y crear pedido':'Acción comercial';
  const body=isSend?`<p class="workflow-help">¿Ya enviaste la cotización al cliente? Abrir WhatsApp o imprimir no es suficiente para confirmarlo.</p><label class="field">Canal utilizado<select name="channel"><option>WhatsApp</option><option>Correo</option><option>Presencial</option><option>Teléfono</option><option>Otro</option></select></label>`:isAccept?`<p class="workflow-help">Confirma que el cliente aceptó el precio y las condiciones de ${esc(id)}. No se genera un pedido todavía.</p><label class="field">Medio de confirmación<select name="channel"><option>WhatsApp</option><option>Correo</option><option>Teléfono</option><option>Presencial</option><option>Otro</option></select></label>`:isReject?`<p class="workflow-help">El presupuesto se cerrará como rechazado. Puedes crear una nueva revisión más adelante.</p><label class="field">Motivo (opcional)<input name="reason" maxlength="140" placeholder="Ej. Presupuesto fuera de alcance"></label>`:isConvert?`<div class="workflow-frozen"><span>${esc(clientName(quote.clientId))} · ${esc(quote.project)}</span><strong>${money(quote.gross)}</strong><small>${quote.quantity} unidad(es) · Importe acordado, no se recalculará</small></div><label class="field">Entrega comprometida<input name="dueDate" type="date" min="${today()}" required value="${localDate(new Date(Date.now()+7*86400000))}"></label><p class="workflow-help">El pedido empezará en Pendiente y con saldo de pago pendiente. Su producción y su cobro se gestionan por separado.</p>`:'';
  const combinedBody=`<div class="workflow-frozen"><span>${esc(clientName(quote.clientId))} · ${esc(quote.project)}</span><strong>${money(quote.gross)}</strong><small>${quote.quantity} unidad(es) · Importe acordado, sin recálculo</small></div><label class="field">Entrega comprometida<input name="dueDate" type="date" min="${today()}" required value="${localDate(new Date(Date.now()+7*86400000))}"></label><label class="field">Aceptación recibida por<select name="channel"><option>WhatsApp</option><option>Correo</option><option>Teléfono</option><option>Presencial</option><option>Otro</option></select></label><p class="workflow-help">Registra la aceptación del cliente y crea un único pedido pendiente en la misma acción.</p>`;
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">${esc(id)} · ${esc(quote.status)}</div><h2 id="modal-title">${title}</h2></div><button class="close-modal" data-close aria-label="Cerrar">×</button></div><form id="workflow-form" data-action="${action}" data-id="${esc(id)}"><div class="dialog-form">${isAcceptOrder?combinedBody:body}</div><div class="dialog-actions"><button class="btn btn-light" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">${title}</button></div></form></div></div>`;
}
function editQuoteModal(id){const q=db.quotes.find(x=>x.id===id);if(!q||q.status!=='Borrador')return;
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">${esc(q.id)} · BORRADOR</div><h2 id="modal-title">Editar condiciones</h2></div><button class="close-modal" data-close aria-label="Cerrar">×</button></div><form id="quote-conditions-form" data-id="${esc(id)}"><div class="dialog-form"><div class="workflow-frozen"><small>Importe actual (congelado)</small><strong>${money(q.gross)}</strong></div><label class="field">Validez (días)<input type="number" min="1" max="365" step="1" required name="validDays" value="${Number(q.validDays)||7}"></label><label class="field">Condiciones comerciales<input name="terms" maxlength="250" value="${esc(q.terms||'')}"></label><p class="workflow-help">Para cambiar cantidades, materiales o precios, utiliza «Nueva revisión y recotizar» desde una cotización ya enviada. No se modifican presupuestos enviados ni pedidos aceptados.</p></div><div class="dialog-actions"><button class="btn btn-light" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Guardar condiciones</button></div></form></div></div>`;
}
/** Carga un formState en el cotizador como cotización NUEVA (duplicar o producto frecuente). */
function loadIntoCalculator(formState,{clientId}={}){
 quoteDraft=toRawForm(formState);
 if(clientId&&activeClients().some(c=>c.id===clientId))quoteDraft.clientId=clientId;else Reflect.deleteProperty(quoteDraft,'clientId');
 for(const [k,v] of Object.entries(quoteDraft))if(v===undefined||v==='undefined')Reflect.deleteProperty(quoteDraft,k);
 selectedMachineId=db.printers.some(m=>m.id===quoteDraft.machineId)?quoteDraft.machineId:(db.printers[0]?.id??'');quoteDraft.machineId=selectedMachineId;
 quoteExtras=new Set(formState.extras||[]);amsRows=(formState.extraFilaments||[]).length;syncMulticolor();
 importInfo=null;platesFromDraft();revisionSourceId=null;quoteSubmitted=false;route='calculator';render();window.scrollTo(0,0);
}
function productModal(quoteId){const q=db.quotes.find(x=>x.id===quoteId);if(!q)return;
 modalShell({eyebrow:`${esc(q.id)} · PRODUCTO FRECUENTE`,title:'Guardar como producto frecuente',formId:'product-form',dataId:q.id,
  body:`<div class="dialog-form"><label class="field">Nombre del producto <input name="name" required maxlength="80" value="${esc(q.project)}"></label><p class="workflow-help">Guarda cómo se fabrica (placas, filamentos, tiempos y extras), sin precio ni cliente. Al usarlo, el precio se recalcula con tus costos actuales.</p></div>`,
  actions:`<button class="btn btn-light" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Guardar producto</button>`});
 document.querySelector('#product-form [name="name"]')?.select();
}
let selectedProductId='';
function productsBar(){
 if(!(db.products||[]).length)return '';
 const list=db.products.slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
 if(!list.some(p=>p.id===selectedProductId))selectedProductId=list[0].id;
 return `<div class="products-bar"><span class="products-label">${ic('copy',15)} Productos frecuentes</span><select data-product-select aria-label="Producto frecuente">${list.map(p=>`<option value="${esc(p.id)}" ${p.id===selectedProductId?'selected':''}>${esc(p.name)}</option>`).join('')}</select><button type="button" class="btn btn-light compact-button" data-product-load>Cotizar este</button><button type="button" class="small-action" data-product-delete aria-label="Eliminar producto frecuente" title="Eliminar producto frecuente">×</button></div>`;
}
function startReprice(id){const q=db.quotes.find(x=>x.id===id);if(!q||!q.inputSnapshot)throw Error('La cotización antigua no tiene parámetros para recotizar. Usa una nueva cotización.');if(q.status==='Borrador')throw Error('Primero envía o finaliza el borrador anterior.');
  if(!db.printers.some(x=>x.id===q.inputSnapshot.machineId)||!db.materials.some(x=>x.id===q.inputSnapshot.materialId))throw Error('Los perfiles de material o máquina anteriores ya no existen. Registra un nuevo presupuesto.');
  if(q.formState){quoteDraft=toRawForm(q.formState);selectedMachineId=quoteDraft.machineId;quoteExtras=new Set(q.formState.extras);amsRows=(q.formState.extraFilaments||[]).length;syncMulticolor();importInfo=null;platesFromDraft();revisionSourceId=id;route='calculator';render();window.scrollTo(0,0);toast(`Revisión de ${id}: se recalcula con los perfiles actuales. La versión anterior sigue intacta.`);return;}
  quoteDraft={...q.inputSnapshot};selectedMachineId=quoteDraft.machineId;amsRows=0;resetPlates();
  const profile=normalizedShopSettings(db.shopSettings);
  quoteExtras=new Set();
  if(Number(quoteDraft.oneOffDesignCost)>0)quoteExtras.add('design');
  if(Number(quoteDraft.finishingMinutesPerUnit)>0)quoteExtras.add('finishing');
  if(Number(quoteDraft.assemblyMinutesPerExtraPart)>0)quoteExtras.add('assembly');
  if(Number(quoteDraft.partsPerUnit)>1||Number(quoteDraft.batches)>1||Number(quoteDraft.extraGrPerPlate)>0)quoteExtras.add('planning');
  if(Number(quoteDraft.packagingPerUnit)!==Number(profile.packingPerUnit))quoteExtras.add('packing');
  if(Number(quoteDraft.targetMargin)!==Number(profile.targetMargin)||Number(quoteDraft.validDays)!==Number(profile.validDays)||quoteDraft.terms!==profile.terms)quoteExtras.add('sales');
  revisionSourceId=id;route='calculator';render();window.scrollTo(0,0);toast(`Revisión de ${id}: ajusta los valores y guarda un nuevo borrador. La versión anterior sigue intacta.`);
}
function paymentModal(id){const o=db.orders.find(x=>x.id===id);if(!o)return;if(isOrderCancelled(o)){toast('No se registran abonos en un pedido anulado.','warning');return;}const summary=paymentSummary(o);
  document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog workflow-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">${esc(o.id)} · COBROS</div><h2 id="modal-title">Registrar abono</h2></div><button class="close-modal" data-close aria-label="Cerrar">×</button></div><form id="payment-form" data-id="${esc(id)}"><input type="hidden" name="paymentId" value="${newPaymentId()}"><div class="dialog-form"><div class="workflow-frozen"><span>Total acordado: ${money(o.amount)}</span><span>Pagado: ${money(summary.paid)}</span><strong>Saldo: ${money(summary.pending)}</strong></div><label class="field">Importe recibido ($ CLP)<input name="amount" type="number" min="1" max="${summary.pending}" step="1" required value="${summary.pending}"></label><label class="field">Medio de pago<select name="method"><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option><option>Otro</option></select></label><p class="workflow-help">Los abonos se registran manualmente: no se verifican con el banco ni generan comprobantes tributarios.</p></div><div class="dialog-actions"><button class="btn btn-light" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Guardar pago recibido</button></div></form></div></div>`;
}
const gramsTxt=g=>`${(Math.round(Number(g)*10)/10).toLocaleString('es-CL')} g`;
function consumptionSummaryHtml(o){
 const res=o.reservation,reg=registeredConsumption(o),entries=o.consumptions||[];
 const est=res?res.items:estimatedConsumption(db,o);
 if(!est.length&&!entries.length)return '';
 const nameOf=id=>db.materials.find(m=>m.id===id)?.name||est.find(e=>e.materialId===id)?.name||id;
 const ids=[...new Set([...est.map(e=>e.materialId),...reg.map(r=>r.materialId)])];
 const resLabel=res?(res.status==='ACTIVE'?'Reservado (comprometido)':`Reservado · liberado${res.releaseReason?` (${(RELEASE_REASONS[res.releaseReason]||res.releaseReason).toLowerCase()})`:''}`):'Estimado (cotización)';
 return `<div class="consumption-box"><div class="cons-grid"><span></span><small>${esc(resLabel)}</small><small>Registrado (real)</small>${ids.map(id=>`<span>${esc(nameOf(id))}</span><span class="muted">${gramsTxt(est.find(e=>e.materialId===id)?.grams||0)}</span><b>${gramsTxt(reg.find(r=>r.materialId===id)?.grams||0)}</b>`).join('')}</div>${entries.length?`<ul class="cons-list">${entries.map(en=>`<li>${fmtDate(String(en.at).slice(0,10))} · ${esc(CONSUMPTION_KINDS[en.kind]||en.kind)}: ${en.items.map(it=>`${esc(it.name)} ${gramsTxt(it.grams)}${it.shortfallG>0?` <em>(faltaban ${gramsTxt(it.shortfallG)})</em>`:''}`).join(', ')}${en.note?` — ${esc(en.note)}`:''}</li>`).join('')}</ul>`:'<p class="muted">Aún no hay consumo real registrado. La reserva no descuenta el stock físico.</p>'}</div>`;
}
function optionChip(id,label){
 const on=quoteExtras.has(id);
 return `<button type="button" class="option-chip ${on?'selected':''}" data-quote-extra="${id}" aria-pressed="${on}"><span>${on?'✓':'+'}</span> ${label}</button>`;
}
function calculator(){
 const profile=normalizedShopSettings(db.shopSettings);
 const optionalCount=['design','finishing','assembly','packing','planning'].filter(x=>quoteExtras.has(x)).length;
 const note=PROD?(profile.taxRegimeConfirmed?'':`<div class="demo-note">${ic('info',18)} <span>El régimen tributario está <strong>por confirmar</strong> en Configuración.</span></div>`)
  :`<div class="demo-note">${ic('info',18)} <span><strong>Motor de cálculo:</strong> precios calculados con tus perfiles. ${CLOUD?'Datos en la nube.':'Datos solo en este navegador.'} ${profile.taxRegimeConfirmed?`Régimen: <strong>${profile.taxRegime==='NOT_REGISTERED'?'no afecto a IVA':'afecto a IVA'}</strong> (confirmado).`:'El régimen tributario está <strong>por confirmar</strong>.'}</span></div>`;
 return `${note}
 ${revisionSourceId?`<div class="workflow-repricing">${ic('info',17)} Nueva revisión a partir de <strong>${esc(revisionSourceId)}</strong>. Al guardar se creará un folio nuevo. El original no se modifica. <button type="button" id="cancel-repricing">Cancelar revisión</button></div>`:''}
 <div class="quote-grid"><section class="panel quote-panel"><div class="panel-head"><div><h3>Preparar cotización</h3><p>Define el producto y cómo fabricarlo. El precio se calcula automáticamente.</p></div><span class="step-pill">01 / TRABAJO</span></div>
 <form id="quote-form" class="quote-form" novalidate>
 <div id="import-block">${importBlock()}</div>
 ${productsBar()}
 <p class="quote-concept-note"><strong>Producto</strong> es lo que vendes · <strong>Pieza</strong> es cada componente · <strong>Placa</strong> es una impresión preparada en Bambu Studio.</p>
 <div class="quote-section-label">01 · Producto y cliente</div>
 <div class="fields-grid"><label class="field">Cliente <select name="clientId" required>${activeClients().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label class="field">Nombre del producto o trabajo <input name="project" required maxlength="90" value="Macetero geométrico" placeholder="Ej.: Macetero geométrico"></label><label class="field">Cantidad que solicita el cliente <input name="quantity" type="number" min="1" step="1" required value="8"><small>Cuántos productos terminados entregarás. No son placas ni piezas sueltas.</small></label></div>
 <div class="quote-section-label">02 · Preparación de impresión</div>
 <div class="fields-grid"><label class="field span2">Impresora <select name="machineId" id="quote-machine" required>${db.printers.map(m=>`<option value="${esc(m.id)}" ${m.id===selectedMachineId?'selected':''}>${esc(m.name)}</option>`).join('')}</select></label></div>
 <details class="quote-help-details"><summary>Ver costo horario y detalles de la impresora</summary><div class="machine-summary small-summary" id="machine-summary">${machineSummary()}</div></details>
 ${filamentRows()}
 <div class="quote-section-label">03 · Cantidades y tiempo de impresión</div>
 <div class="fields-grid">
 <label class="field">${isMultiPlate()?'Placa 1 · capacidad de productos':'Piezas que salen de una placa completa'} <input name="partsPerPlate" type="number" min="1" step="1" required value="4" ${componentMode?'readonly':''}><small>${componentMode?'Calculado a partir de los componentes de la placa 1.':''}</small></label>
 ${durationField('plateHours',isMultiPlate()?'Placa 1 · tiempo':'Tiempo de la placa completa',{span:true})}
 </div>
 <details class="quote-help-details"><summary>¿Dónde encuentro los gramos y el tiempo en Bambu Studio?</summary><div class="form-tip">${ic('info',16)} <span>Rebana en Bambu Studio la <b>placa completa</b> con todas sus piezas y copia su <b>tiempo</b> (por ejemplo «2h 4m» → 2 h 4 min) y los <b>gramos de cada filamento</b> (incluyen soportes y purga; admite decimales).</span></div></details>
 <div id="component-planner">${componentPlannerHtml()}</div>
 <div id="print-plan-preview">${productionPlanHtml()}</div>
 <div id="last-plate">${lastPlateBlock()}</div>
 <div class="quote-plates-help"><strong>¿El mismo producto necesita más placas?</strong><small>Agrega una placa por cada grupo de componentes que debas imprimir. No agregues placas para representar pedidos diferentes.</small>${isMultiPlate()&&quoteDraft.importFile?'<small class="quote-plates-warning">Importación de varias placas: comprueba cuántos productos completos permite fabricar cada placa; el archivo no establece por sí solo esa relación.</small>':''}</div>
 <div id="extra-plates">${extraPlatesHtml()}</div>
 <details class="quote-optional-panel" ${optionalCount?'open':''}><summary>04 · Personalización del trabajo <small>Diseño, acabados, ensamblaje, embalaje o lotes${optionalCount?` · ${optionalCount} activos`: ' · opcional'}</small></summary>
 <div class="quote-options">${optionChip('design','Diseño 3D')}${optionChip('finishing','Acabados')}${optionChip('assembly','Ensamblaje')}${optionChip('packing','Embalaje especial')}${optionChip('planning','Planificación especial')}</div>
 ${quoteExtras.has('design')?`<div class="inline-optional"><div class="optional-heading"><strong>Diseño o modelado exclusivo</strong><small>Se cobra una sola vez, no por unidad.</small></div><label class="field">Costo del diseño ($) <input name="oneOffDesignCost" type="number" min="0" step="100" value="0"></label></div>`:''}
 ${quoteExtras.has('finishing')?`<div class="inline-optional"><div class="optional-heading"><strong>Acabados</strong><small>Retirar soportes, lijar, pintar, etc.</small></div><label class="field">Minutos de trabajo por unidad <input name="finishingMinutesPerUnit" type="number" min="0" step="1" value="10"></label></div>`:''}
 ${quoteExtras.has('assembly')?`<div class="inline-optional"><div class="optional-heading"><strong>Ensamblaje</strong><small>Se aplica por pieza adicional del producto; configura esas piezas en Planificación especial.</small></div><label class="field">Minutos por pieza adicional <input name="assemblyMinutesPerExtraPart" type="number" min="0" step="1" value="5"></label></div>`:''}
 ${quoteExtras.has('packing')?`<div class="inline-optional"><div class="optional-heading"><strong>Embalaje especial</strong><small>Reemplaza el costo habitual de ${money(profile.packingPerUnit)} por unidad.</small></div><label class="field">Embalaje por unidad ($) <input name="packagingPerUnit" type="number" min="0" step="50" value="${Number(profile.packingPerUnit)}"></label></div>`:''}
 ${quoteExtras.has('planning')?`<div class="inline-optional special-layout"><div class="optional-heading"><strong>Planificación especial</strong><small>Solo si vendes productos con varias piezas, trabajas en lotes o hay material fuera del peso de Bambu Studio.</small></div><div class="fields-grid"><label class="field">Piezas por producto <input name="partsPerUnit" type="number" min="1" step="1" value="1"></label><label class="field">Lotes de trabajo <input name="batches" type="number" min="1" step="1" value="1"></label><label class="field span2">Material no incluido (g por placa) <input name="extraGrPerPlate" type="number" min="0" step="any" value="0"></label></div></div>`:''}
 </details>
 <div class="quote-section-label">05 · Condiciones de venta</div>
 <div class="fields-grid"><label class="field span2">Canal de venta <select name="channel">${DEFAULT_CHANNELS.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></div>
 <div class="shop-applied"><div><strong>Condiciones aplicadas automáticamente</strong><p>Margen objetivo <b>${esc(profile.targetMargin)}%</b> · Vigencia <b>${esc(profile.validDays)} días</b> · Embalaje normal <b>${money(profile.packingPerUnit)}/ud</b></p></div><button class="text-button" type="button" data-quote-extra="sales">${quoteExtras.has('sales')?'Cerrar ajustes':'Ajustar esta venta'} ${ic('arrow',15)}</button></div>
 ${quoteExtras.has('sales')?`<div class="inline-optional"><div class="optional-heading"><strong>Condiciones particulares de la cotización</strong><small>No modifican los ajustes generales.</small></div><div class="fields-grid"><label class="field">Margen objetivo (%) <input name="targetMargin" type="number" min="0" max="90" step="1" value="${esc(profile.targetMargin)}"></label><label class="field">Validez (días) <input name="validDays" type="number" min="1" max="90" step="1" value="${esc(profile.validDays)}"></label><label class="field span2">Condiciones <input name="terms" maxlength="180" value="${esc(profile.terms)}"></label></div></div>`:''}
 <div class="automation-foot">${ic('check',16)} Incluye depreciación, mantenimiento, energía, supervisión, preparación, embalaje y fallas. <button type="button" data-nav="settings">Editar costos predeterminados ${ic('arrow',14)}</button></div>
 <div class="form-actions"><button class="btn btn-light" type="reset">Limpiar trabajo</button><button class="btn btn-primary" type="submit">${ic('check',17)} Guardar borrador</button></div></form></section>
 <section class="quote-side"><div class="panel result-panel"><div class="panel-head"><div><h3>Tu precio sugerido</h3><p>Solo para gestión interna</p></div><span class="step-pill">02 / INTERNO</span></div><div id="quote-results">${quoteResults()}</div></div>
 <div class="panel customer-panel"><div class="panel-head"><div><h3>Lo que verá tu cliente</h3><p>Sin cifras internas ni márgenes</p></div><span class="client-eye">${ic('check',15)} Vista segura</span></div><div id="quote-customer-preview">${quoteCustomerPreview()}</div>
 <div class="customer-actions quote-cta-row"><button id="copy-customer" class="btn btn-light">${ic('copy',16)} Copiar texto</button><button id="print-customer" class="btn btn-primary">${ic('download',16)} Crear PDF / imprimir</button></div></div></section></div>
 <section class="panel last-quotes"><div class="panel-head"><div><h3>Últimos presupuestos guardados</h3><p>Precios y parámetros históricos conservados; no se recalculan.</p></div></div><div class="table-wrap"><table><thead><tr><th>FOLIO</th><th>PROYECTO</th><th>CLIENTE</th><th>TOTAL CLIENTE</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>${db.quotes.slice().reverse().slice(0,12).map(q=>`<tr><td class="strong-td">${esc(q.id)}${q.revisionOf?`<span class="table-sub">Revisión ${q.revision} de ${esc(q.revisionOf)}</span>`:''}</td><td>${esc(q.project)}</td><td>${esc(clientName(q.clientId))}</td><td class="strong-td">${money(q.gross)}</td><td>${statusBadge(q.status)}</td><td><div class="row-actions"><button class="small-action" data-copy-quote="${esc(q.id)}" aria-label="Copiar presupuesto">${ic('copy',16)}</button><button class="small-action" data-print-quote="${esc(q.id)}" aria-label="Imprimir presupuesto">${ic('download',16)}</button>${quoteQuick(q)}${quoteMore(q)}</div></td></tr>`).join('')||tableEmpty(6)}</tbody></table></div></section>`;
}
function machineSummary(){
 const machine=db.printers.find(m=>m.id===selectedMachineId) ?? db.printers[0];
 if(!machine)return 'No hay perfiles de impresora. Agrega uno en el módulo Impresoras.';
 try {const hourly=machineHourlyCosts(machine);
 return `<div class="machine-summary-top"><strong>${esc(machine.name)}</strong><button class="text-button" type="button" data-nav="machines">Administrar perfiles ${ic('arrow',15)}</button></div><span>Consumo estimado: <b>${esc(machine.averageWatts)} W</b> · Vida útil: <b>${esc(machine.lifeHours)} h</b> · Máquina (montos brutos): <b>${money(hourly.machineCostPerHour)}/h</b></span><small>Valores de ejemplo editables; no son mediciones oficiales.</small>`;
 }catch(e){return `<span class="quote-error">${esc(e.message)}</span>`;}
}
/** Contexto que la UI inyecta a la aplicación: datos del MockRepository, reloj y nombre del cliente. */
function quoteContext(clientId){
 return { shop:{shopSettings:db.shopSettings,printers:db.printers,materials:db.materials}, clientName:clientName(clientId), resolvedAt:now(), today:today() };
}
function currentRawForm(){
 const form=document.getElementById('quote-form');
 return form?Object.fromEntries(new FormData(form).entries()):{
   quantity:'8',partsPerPlate:'4',plateWeightGr:'340',plateHours:'5.5',
   materialId:db.materials[0]?.id,channel:'direct',project:'Macetero geométrico',
   clientId:db.clients[0]?.id,machineId:selectedMachineId,
 };
}
/** Vista previa con el motor v1. Lanza un Error con mensaje para el operador si no hay precio posible. */
function currentQuote(){
 const raw=currentRawForm();
 if(!db.printers.length) throw Error('Selecciona o registra una impresora.');
 const result=quoteService.preview(raw,quoteExtras,quoteContext(raw.clientId));
 if(!result.ok){const error=Error(failureMessage(result.error));error.field=result.error.kind==='FORM'?result.error.issues?.[0]?.field:undefined;throw error;}
 return result.value;
}
function currentCustomerDto(){ return currentQuote().customer; }
const pct=v=>v===null||v===undefined?'—':`${v.toLocaleString('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
function stockCheck(p){
 const usage=filamentUsage({request:p.request,output:p.output});
 if(!usage.length)return '';
 const committed=committedGrams(db);
 const rows=usage.map(u=>{const m=db.materials.find(x=>x.id===u.materialId);const st=m?stockStatus(db,m,committed):{physical:0,committed:0,available:0};const ok=st.available>=u.grams;
  return `<div class="stock-row ${ok?'ok':'short'}"><span class="swatch-dot sm" style="background:${/^#[0-9a-fA-F]{6}$/.test(m?.hex||'')?m.hex:'#ccc'}"></span><span>${esc(m?.name||u.materialId)}</span><b>${Math.round(u.grams).toLocaleString('es-CL')} g</b><small>${ok?`disponible ${kg(st.available/1000)} kg`:`faltan ${Math.round(u.grams-Math.max(0,st.available)).toLocaleString('es-CL')} g`}${st.committed>0?` · ${kg(st.committed/1000)} kg comprometidos`:''}</small></div>`;}).join('');
 return `<div class="stock-check"><div class="stock-title">Filamento estimado del trabajo</div>${rows}</div>`;
}
/** Error del formulario junto al campo (no solo en el panel de precio). Solo en campos tocados o tras «Guardar». */
let quoteError=null,quoteSubmitted=false;
function markQuoteField(){
 document.querySelectorAll('#quote-form .field-error').forEach(n=>n.remove());
 document.querySelectorAll('#quote-form [aria-invalid="true"]').forEach(n=>n.removeAttribute('aria-invalid'));
 if(!quoteError?.field)return null;
 const parts=durationParts(quoteError.field),name=parts?parts[0]:quoteError.field;
 if(!quoteSubmitted&&![quoteError.field,...(parts||[name])].some(k=>k in quoteDraft))return null;
 const input=document.querySelector(`#quote-form [name="${CSS.escape(name)}"]`);if(!input)return null;
 input.setAttribute('aria-invalid','true');
 const row=input.closest('.filament-row');const html=`<small class="field-error" role="alert">${esc(quoteError.message)}</small>`;
 if(row)row.insertAdjacentHTML('afterend',html);else (input.closest('.field')||input.parentElement).insertAdjacentHTML('beforeend',html);
 return input;
}
function quoteResults(){quoteError=null;try{
 const p=currentQuote(),s=p.summary;
 const priceLabel=p.customer.taxTreatment==='VAT_INCLUDED'?'Precio sugerido IVA incluido':p.customer.taxTreatment==='VAT_ADDED'?'Precio sugerido + IVA':'Precio sugerido (no afecto a IVA)';
 const alerts=[...s.messages,...p.notices];
 if(!p.issuance.issuable) alerts.unshift('Se puede guardar como borrador, pero no se podrá marcar como enviada.');
 return `<div class="price-main"><span>${priceLabel}</span><strong>${money(s.grossTotal)}</strong><small>${s.plates>0?`${money(s.unitPrice)} por unidad`:''}${PROD?'':` · Motor ${esc(p.request.calculationVersion)}`}</small></div>
 <div class="quote-kpi-grid"><div><small>Costo económico</small><b>${money(s.economicCost)}</b></div><div><small>Utilidad estimada</small><b>${money(s.commercialUtility)}</b></div><div><small>Margen real</small><b>${pct(s.realMarginPct)}</b></div></div>
 <div class="quote-insights"><span>${ic('printer',15)} ${s.lastRun?`${s.fullPlates} completa${s.fullPlates===1?'':'s'} + 1 última (${s.lastRun.parts} pz${s.lastRun.source==='SLICED'?'':' · estimada'})`:`${s.plates} placa(s)`}</span><span>${ic('clock',15)} ${fmtDuration(s.totalPrintHours)}</span><span>${ic('materials',15)} ${s.batches} lote(s)</span></div>
 ${alerts.map(m=>`<div class="quote-alert">${ic('info',16)} ${esc(m)}</div>`).join('')}
 ${plateBreakdownHtml(s)}
 ${stockCheck(p)}
 <details class="quote-detail-toggle"><summary>Ver desglose económico completo <span>⌄</span></summary><div class="calc-lines">
 ${s.breakdown.map(g=>`<div><span>${esc(g.label)}</span><b>${money(g.amount)}</b></div>`).join('')}<div><span>Comisión comercial</span><b>${money(s.commission)}</b></div><div><span>Precio neto</span><b>${money(s.netTotal)}</b></div><div><span>IVA de venta</span><b>${money(s.vatTotal)}</b></div><div><span>Neto mínimo (margen mínimo)</span><b>${money(s.floorNetTotal)}</b></div></div></details>`;
 }catch(e){quoteError={message:e.message,field:e.field};return `<div class="quote-error">${ic('info',18)} ${esc(e.message)}</div>`;}}
function quoteCustomerPreview(){try{
 const dto=currentCustomerDto();return `<div class="customer-preview"><span>Vista previa del documento comercial</span><h4>${esc(dto.project)}</h4><div class="customer-mini"><span>Cliente</span><strong>${esc(dto.clientName)}</strong></div>${dto.lines.map(l=>`<div class="customer-mini"><span>${esc(l.description)} (${l.quantity} × ${money(l.unitPrice)})</span><strong>${money(l.total)}</strong></div>`).join('')}${dto.vatAmount!==null?`<div class="customer-mini"><span>IVA</span><strong>${money(dto.vatAmount)}</strong></div>`:''}<div class="customer-mini"><span>Total (${esc(taxLabel(dto.taxTreatment))})</span><strong>${money(dto.total)}</strong></div><p>Validez: ${dto.validDays} días. La salida pública no contiene desglose de costos ni márgenes.</p></div>`;
 }catch{return `<p class="preview-placeholder">Completa los datos para ver el presupuesto.</p>`;}}
function machines(){return `<div class="machine-page-note">${ic('info',17)} Las fichas son <strong>estimaciones editables</strong>, no fichas oficiales de fabricantes. El uso de resina necesitará otro modelo de costos. El precio/hora incluye depreciación y reserva de mantenimiento por separado.</div>
 <div class="machine-cards">${db.printers.map(m=>{let h;try{h=machineHourlyCosts(m)}catch{h={depreciationPerHour:0,maintenancePerHour:0,machineCostPerHour:0}}
 return `<article class="panel machine-card"><div class="machine-icon">${ic('printer',26)}</div><div class="machine-card-head"><div><div class="eyebrow">${esc(m.technology)} · PERFIL ${esc(m.id)}</div><h3>${esc(m.name)}</h3></div><span class="status green"><i></i>Configurable</span></div><div class="machine-stat-row"><span>Adquisición / residual</span><b>${money(m.purchasePrice)} / ${money(m.residualValue)}</b></div><div class="machine-stat-row"><span>Vida útil</span><b>${Number(m.lifeHours).toLocaleString('es-CL')} h</b></div><div class="machine-stat-row"><span>Consumo promedio</span><b>${esc(m.averageWatts)} W</b></div><div class="machine-stat-row"><span>Depreciación / h</span><b>${money(h.depreciationPerHour)}</b></div><div class="machine-stat-row"><span>Mantenimiento / h</span><b>${money(h.maintenancePerHour)}</b></div><div class="machine-total"><span>Costo máquina por hora</span><strong>${money(h.machineCostPerHour)}</strong></div><div class="machine-buttons"><button type="button" class="btn btn-light" data-edit-machine="${esc(m.id)}">Editar parámetros</button><button type="button" class="btn btn-primary" data-use-machine="${esc(m.id)}">Usar para cotizar</button></div><small>Rev. ${esc(m.revision??1)} · Cambios no alteran cotizaciones anteriores.</small></article>`;}).join('')}</div>`;}
function projects(){return `<div class="project-page-grid">${db.projects.map((p,i)=>`<article class="panel project-large"><div class="large-thumb shape${i%3}"><div class="shape-object"></div><span>${esc(p.category)}</span></div><div class="large-content"><div class="project-title-line"><h3>${esc(p.name)}</h3>${statusBadge(p.status)}</div><p>${esc(clientName(p.clientId))}</p><div class="project-description">${esc(p.notes||'Sin notas adicionales')}</div><div class="large-project-foot"><span>Progreso de referencia</span><strong>${p.progress}%</strong></div><div class="progress-track"><div class="progress-fill mint-bar" style="width:${p.progress}%"></div></div><div class="project-bottom-actions"><select data-project-status="${esc(p.id)}" aria-label="Estado de ${esc(p.name)}">${['Diseño','En pruebas','Listo'].map(s=>`<option ${s===p.status?'selected':''}>${s}</option>`).join('')}</select><button class="text-button" data-nav="calculator">Cotizar ${ic('arrow',15)}</button></div></div></article>`).join('')}</div>`;}
// ── Pedidos: filtros, siguiente paso, corrección y anulación (0.13) ──────────────────────────────────────────────
let orderFilter='open';
let orderSearch='';
let orderMenuOpen=null;
const ORDER_FILTERS=[['open','Por atender'],['delivered','Entregados'],['cancelled','Anulados'],['all','Todos']];
/** «Por atender»: en curso o entregado con saldo pendiente. */
function orderInFilter(o,f){
 if(f==='all')return true;
 if(f==='cancelled')return isOrderCancelled(o);
 if(isOrderCancelled(o))return false;
 if(f==='delivered')return o.status==='Entregado';
 return o.status!=='Entregado'||paymentSummary(o).pending>0;
}
function filteredOrders(){
 return db.orders.filter(o=>orderInFilter(o,orderFilter)&&(!orderSearch||[o.id,o.project,clientName(o.clientId),o.quoteId].some(v=>String(v||'').toLocaleLowerCase('es-CL').includes(orderSearch))));
}
const isLate=o=>!isOrderCancelled(o)&&o.status!=='Entregado'&&o.dueDate&&o.dueDate<today();
/** ¿Falta registrar el consumo real de producción? (pedido con reserva o estimación y sin registro de Producción). */
function needsConsumption(o){
 if(isOrderCancelled(o)||(o.consumptions||[]).some(c=>c.kind==='PRODUCTION'))return false;
 return o.reservation?.status==='ACTIVE'||estimatedConsumption(db,o).length>0;
}
/** Botón del siguiente paso: avanzar producción o, ya entregado, cobrar el saldo. */
function orderNextAction(o,{big=false}={}){
 if(isOrderCancelled(o))return '';
 const next=nextOrderStatus(o),pay=paymentSummary(o);
 const cls=big?'btn btn-primary':'btn btn-primary compact-button order-next';
 if(next)return `<button type="button" class="${cls}" data-order-advance="${esc(o.id)}" title="Pasar a ${esc(next)}">${next==='Entregado'?'Marcar entregado':`Pasar a ${esc(next)}`}</button>`;
 if(pay.pending>0)return `<button type="button" class="${big?'btn btn-primary':'btn btn-light compact-button order-next'}" data-order-payment="${esc(o.id)}">Registrar abono</button>`;
 return big?'':'<span class="order-done">Completo</span>';
}
function orderStateCell(o){
 const pay=paymentSummary(o);
 return `${statusBadge(o.status)}${isOrderCancelled(o)?'':` <span class="order-payment-inline">${statusBadge(pay.status)}</span>`}`;
}
function orderRows(list){
 return list.map(o=>{const pay=paymentSummary(o);
  return `<tr class="${isOrderCancelled(o)?'order-cancelled':''}"><td><button type="button" class="table-title order-open" data-order-detail="${esc(o.id)}">${esc(o.project)}</button><span class="table-sub">${esc(o.id)} · ${esc(o.quantity)} ud${o.quoteId?` · ${esc(o.quoteId)}`:' · manual'}</span></td><td>${esc(clientName(o.clientId))}</td><td>${fmtDate(o.dueDate)}${isLate(o)?'<span class="table-sub late">Atrasado</span>':''}</td><td class="strong-td">${money(o.amount)}<span class="table-sub">${isOrderCancelled(o)?(pay.paid?`Abonado ${money(pay.paid)}`:'—'):pay.pending>0?`Por cobrar ${money(pay.pending)}`:'Pagado'}</span></td><td>${orderStateCell(o)}</td><td><div class="row-actions order-actions">${orderNextAction(o)}<button type="button" class="small-action" data-order-menu="${esc(o.id)}" aria-label="Más acciones de ${esc(o.id)}" aria-haspopup="menu">${ic('more',17)}</button></div></td></tr>`;}).join('')||tableEmpty(6,orderFilter==='open'?'No hay pedidos por atender.':'No hay pedidos en esta vista.');
}
function orders(){
 const counts=Object.fromEntries(ORDER_FILTERS.map(([f])=>[f,db.orders.filter(o=>orderInFilter(o,f)).length]));
 const receivable=db.orders.reduce((t,o)=>t+paymentSummary(o).pending,0);
 return `<section class="panel full-panel"><div class="list-tools order-tools"><div class="order-filters" role="tablist" aria-label="Filtrar pedidos">${ORDER_FILTERS.map(([f,l])=>`<button type="button" role="tab" aria-selected="${orderFilter===f}" class="order-filter ${orderFilter===f?'active':''}" data-order-filter="${f}">${l} <b>${counts[f]}</b></button>`).join('')}</div><div class="search-control">${ic('search',17)}<input id="order-search" value="${esc(orderSearch)}" placeholder="Buscar folio, trabajo o cliente" aria-label="Buscar pedidos"></div><span class="count-chip">${money(moneyReceived())} cobrados · ${money(receivable)} por cobrar</span></div><div class="table-wrap order-table"><table><thead><tr><th>TRABAJO</th><th>CLIENTE</th><th>ENTREGA</th><th>IMPORTE</th><th>ESTADO</th><th class="right">SIGUIENTE PASO</th></tr></thead><tbody id="order-tbody">${orderRows(filteredOrders())}</tbody></table></div></section>`;
}
function closeOrderMenu(){document.getElementById('order-action-menu')?.remove();orderMenuOpen=null;}
function openOrderMenu(btn,id){
 if(orderMenuOpen===id){closeOrderMenu();return;}
 closeOrderMenu();closeQuoteMenu();closeClientMenu();const o=db.orders.find(x=>x.id===id);if(!o)return;
 const prev=previousOrderStatus(o),pay=paymentSummary(o);
 const opts=[['detail','Ver pedido y movimientos']];
 if(!isOrderCancelled(o)&&pay.pending>0)opts.push(['payment','Registrar abono']);
 opts.push(['consumption','Registrar consumo de filamento']);
 if(prev)opts.push(['revert',`Volver a «${prev}»…`]);
 if(!isOrderCancelled(o))opts.push(['cancel','Anular pedido…']);
 const menu=document.createElement('div');menu.id='order-action-menu';menu.className='client-popup-menu workflow-popup';menu.setAttribute('role','menu');
 menu.innerHTML=opts.map(([act,label])=>`<button type="button" role="menuitem" class="${act==='cancel'?'danger-menu-item':''}" data-order-action="${act}" data-id="${esc(id)}">${label}</button>`).join('');
 document.body.appendChild(menu);
 const r=btn.getBoundingClientRect(),h=menu.getBoundingClientRect().height;
 menu.style.left=Math.max(8,Math.min(window.innerWidth-232,r.right-220))+'px';menu.style.top=Math.max(8,(window.innerHeight-r.bottom<h+12?r.top-h-6:r.bottom+6))+'px';orderMenuOpen=id;menu.querySelector('button')?.focus();
}
/** Aplica una función del dominio a UN pedido: en la nube, dentro de una transacción; en local, sobre el estado y guarda. */
async function applyToOrder(orderId,fn){
 if(CLOUD){await cloudSaving;const r=await CLOUD.recordPaymentOnce({orderId,apply:mini=>fn(mini)});mergeEntity('orders',r.order);return r.order;}
 fn(db);persist();return db.orders.find(o=>o.id===orderId);
}
function modalShell({eyebrow,title,sub='',body,actions,formId='',dataId='',wide=false}){
 const inner=`${body}<div class="dialog-actions">${actions}</div>`;
 document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog workflow-dialog${wide?' order-dialog':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">${eyebrow}</div><h2 id="modal-title">${title}</h2>${sub?`<p class="client-detail-company">${sub}</p>`:''}</div><button class="close-modal" data-close aria-label="Cerrar">×</button></div>${formId?`<form id="${formId}" data-id="${esc(dataId)}" novalidate>${inner}</form>`:inner}</div></div>`;
}
function revertModal(id){const o=db.orders.find(x=>x.id===id);const prev=o&&previousOrderStatus(o);if(!prev)return;
 modalShell({eyebrow:`${esc(o.id)} · CORRECCIÓN`,title:`Volver a «${esc(prev)}»`,sub:esc(o.project),formId:'revert-form',dataId:o.id,
  body:`<div class="dialog-form"><div class="workflow-frozen"><span>Estado actual</span><strong>${esc(o.status)} → ${esc(prev)}</strong><small>Queda registrado en el historial del pedido con fecha y motivo.</small></div><label class="field">Motivo de la corrección <input name="reason" required minlength="3" maxlength="140" placeholder="Ej.: lo marqué por error"></label>${(o.consumptions||[]).length?`<p class="workflow-help">Los consumos de filamento ya registrados se mantienen. Si hay que ajustarlos, usa «Registrar consumo» → Corrección.</p>`:''}</div>`,
  actions:`<button class="btn btn-light" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Volver a «${esc(prev)}»</button>`});
 document.querySelector('#revert-form input[name="reason"]')?.focus();
}
function cancelModal(id){const o=db.orders.find(x=>x.id===id);if(!o||isOrderCancelled(o))return;const pay=paymentSummary(o);
 const reasons=['Cliente desistió','Pedido duplicado','Error al crear el pedido','Cambio de diseño: se recotiza'];
 modalShell({eyebrow:`${esc(o.id)} · ANULAR`,title:'Anular pedido',sub:`${esc(o.project)} · ${esc(clientName(o.clientId))}`,formId:'cancel-form',dataId:o.id,
  body:`<div class="dialog-form"><div class="cancel-effects"><b>Al anular:</b><ul><li>El pedido se conserva con su historial, pero sale de «Por atender» y de las ventas.</li>${o.reservation?.status==='ACTIVE'?'<li>El filamento reservado vuelve a quedar disponible.</li>':''}${pay.paid>0?`<li>Los abonos recibidos (${money(pay.paid)}) quedan registrados; la devolución al cliente se gestiona fuera de la app.</li>`:''}<li>No se puede deshacer. Para rehacer el trabajo, crea una revisión de la cotización${o.quoteId?` ${esc(o.quoteId)}`:''}.</li></ul></div><div class="reason-chips">${reasons.map(r=>`<button type="button" class="option-chip" data-reason-chip="${esc(r)}">${esc(r)}</button>`).join('')}</div><label class="field">Motivo <input name="reason" required minlength="3" maxlength="140" placeholder="Escribe o elige un motivo"></label></div>`,
  actions:`<button class="btn btn-light" type="button" data-close>Volver</button><button class="btn btn-danger" type="submit">Anular pedido</button>`});
 document.querySelector('#cancel-form input[name="reason"]')?.focus();
}
/** Filas de filamento (material + gramos) para registrar consumo; `prefill` = gramos sugeridos. */
function consumptionRowsHtml(rows,{prefill=true,hint=''}={}){
 const options=sel=>db.materials.map(m=>`<option value="${esc(m.id)}" ${m.id===sel?'selected':''}>${esc(materialLabel(m))}</option>`).join('');
 return `<div class="cons-rows">${rows.map((r,i)=>`<div class="cons-row"><span class="filament-dot sm" style="${dotStyle(r.materialId)}"></span><select name="mat${i}" aria-label="Filamento ${i+1}">${options(r.materialId)}</select><input name="g${i}" type="number" step="any" inputmode="decimal" value="${prefill&&r.grams?esc(Math.round(r.grams*100)/100):''}" placeholder="g" aria-label="Gramos"><small>${r.grams?`${hint} ${gramsTxt(r.grams)}`:''}</small></div>`).join('')}
 <div class="cons-row"><span class="filament-dot sm" style="background:#e9edf0"></span><select name="mat${rows.length}" aria-label="Otro filamento"><option value="">+ Otro material…</option>${options('')}</select><input name="g${rows.length}" type="number" step="any" inputmode="decimal" placeholder="g" aria-label="Gramos"><small></small></div></div>
 <input type="hidden" name="rows" value="${rows.length+1}">`;
}
const consumptionItemsFrom=f=>Array.from({length:Number(f.rows)||0},(_,i)=>({materialId:f[`mat${i}`],grams:f[`g${i}`]===''||f[`g${i}`]===undefined?0:Number(String(f[`g${i}`]).replace(',','.'))})).filter(it=>it.materialId&&it.grams!==0);
function suggestedRows(o){
 const fromReservation=o.reservation?.status==='ACTIVE';
 const est=fromReservation?o.reservation.items:estimatedConsumption(db,o);
 return {fromReservation,est,rows:est.length?est:[{materialId:db.materials[0]?.id,grams:0}]};
}
/** Entrega: confirma el consumo REAL (precargado con la reserva) o lo deja para después. */
function deliveryModal(id){const o=db.orders.find(x=>x.id===id);if(!o)return;
 const {fromReservation,rows}=suggestedRows(o);
 modalShell({eyebrow:`${esc(o.id)} · ENTREGA`,title:'Marcar entregado',sub:`${esc(o.project)} · ${esc(clientName(o.clientId))}`,formId:'delivery-form',dataId:o.id,
  body:`<div class="dialog-form"><input type="hidden" name="consumptionId" value="${newPaymentId().replace('pago-','cons-')}"><div class="quote-section-label">Filamento usado en producción</div><p class="workflow-help">Precargado con lo ${fromReservation?'reservado':'estimado'} en la cotización. Corrígelo con lo que realmente usaste (incluye purgas y placas fallidas, o regístralas después como Reimpresión o Desperdicio).</p>${consumptionRowsHtml(rows,{hint:fromReservation?'reservado':'estimado'})}
  <div class="delivery-choice" role="radiogroup" aria-label="Registro de consumo"><label><input type="radio" name="record" value="now" checked> <span><b>Registrar este consumo ahora</b><small>Descuenta el stock físico y libera la reserva.</small></span></label><label><input type="radio" name="record" value="later"> <span><b>Lo registro después</b><small>La reserva sigue comprometida hasta que registres el consumo desde el pedido.</small></span></label></div></div>`,
  actions:`<button class="btn btn-light" type="button" data-close>Cancelar</button><button class="btn btn-primary" type="submit">Marcar entregado</button>`});
}
function consumptionModal(id){const o=db.orders.find(x=>x.id===id);if(!o)return;
 const first=!(o.consumptions||[]).some(c=>c.kind==='PRODUCTION');const {fromReservation,est,rows}=suggestedRows(o);
 modalShell({eyebrow:`${esc(o.id)} · INVENTARIO`,title:'Registrar consumo de filamento',sub:esc(o.project),formId:'consumption-form',dataId:o.id,
  body:`<div class="dialog-form"><input type="hidden" name="consumptionId" value="${newPaymentId().replace('pago-','cons-')}">
 <label class="field">Tipo <select name="kind">${Object.entries(CONSUMPTION_KINDS).map(([k,l])=>`<option value="${k}" ${k===(first?'PRODUCTION':'REPRINT')?'selected':''}>${l}</option>`).join('')}</select><small>Producción: lo que realmente usaste. Reimpresión y desperdicio: fallas, purgas o pruebas extra. Corrección: ajusta un registro (puede ser negativo).</small></label>
 ${consumptionRowsHtml(rows,{prefill:first,hint:fromReservation?'reservado':'estimado'})}
 <div class="form-tip">${ic('info',16)} <span>${first&&est.length?`Precargado con ${fromReservation?'lo <b>reservado</b> para este pedido':'la <b>estimación de la cotización</b>'}: corrígelo con lo que realmente usaste. `:''}Solo lo que registres aquí descuenta el stock físico${fromReservation?'; el consumo de <b>Producción</b> libera la reserva':''}.</span></div>
 <label class="field">Nota (opcional) <input name="note" maxlength="140" placeholder="Ej.: falló la placa 2, se reimprimió"></label></div>`,
  actions:`<button type="button" class="btn btn-light" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Registrar consumo</button>`});
 document.querySelector('#consumption-form input[name="g0"]')?.focus();
}
/** Registra un consumo real (nube: pedido + materiales en una transacción). Devuelve el registro. */
async function saveConsumption(orderId,args){
 if(CLOUD){
  await cloudSaving;
  const r=await CLOUD.recordConsumptionOnce({orderId,materialIds:args.items.map(it=>it.materialId),apply:mini=>recordConsumption(mini,orderId,args)});
  mergeEntity('orders',r.order);for(const m of r.materials)mergeEntity('materials',m);
 }else{recordConsumption(db,orderId,args);persist();}
 return db.orders.find(o=>o.id===orderId)?.consumptions?.find(c=>c.id===args.id);
}
function orderStepper(o){
 if(isOrderCancelled(o))return `<div class="order-cancel-banner">${ic('info',17)} <span><b>Pedido anulado</b> el ${fmtDate(String(o.cancelled?.at||'').slice(0,10))}${o.cancelled?.fromStatus?` (estaba en ${esc(o.cancelled.fromStatus)})`:''}: ${esc(o.cancelled?.reason||'')}</span></div>`;
 const idx=ORDER_STATUS.indexOf(o.status);
 return `<ol class="order-stepper">${ORDER_STATUS.map((st,i)=>`<li class="${i<idx?'done':i===idx?'current':''}"><span>${i<idx?'✓':i+1}</span>${esc(st)}</li>`).join('')}</ol>`;
}
/** Filamento cotizado vs registrado y su efecto en la utilidad (solo pedidos que vienen de una cotización del motor). */
function realVsQuotedHtml(o){
 const r=realVsQuoted(db,o);if(!r)return '';
 const diffTxt=r.diff===0?'igual a lo cotizado':r.diff>0?`${money(r.diff)} más que lo cotizado`:`${money(-r.diff)} menos que lo cotizado`;
 return `<section class="order-card order-result"><h3>Resultado del pedido</h3><div class="order-money"><span>Filamento cotizado <small>(incluye provisión de fallas)</small></span><b>${money(r.quotedCost)} · ${gramsTxt(r.quotedGrams)}</b><span>Filamento real registrado</span><b>${r.realGrams?`${money(r.realCost)} · ${gramsTxt(r.realGrams)}`:'—'}</b><span>Utilidad cotizada</span><b>${money(r.quotedUtility)}</b>${r.complete?`<span>Utilidad con consumo real</span><b class="${r.realUtility<r.quotedUtility?'due':'pos'}">${money(r.realUtility)}</b>`:''}</div><p class="muted">${r.complete?`Filamento: ${diffTxt}. El resto de los costos se mantiene como en la cotización.`:'Registra el consumo de Producción para ver la utilidad real.'}</p></section>`;
}
function orderDetail(id){const o=db.orders.find(x=>x.id===id);if(!o)return;const pay=paymentSummary(o),prev=previousOrderStatus(o),cancelled=isOrderCancelled(o);
 const cons=consumptionSummaryHtml(o);
 modalShell({wide:true,eyebrow:`${esc(o.id)} · PEDIDO`,title:esc(o.project),sub:`${esc(clientName(o.clientId))} · ${esc(o.quantity)} ud · Entrega ${fmtDate(o.dueDate)}${isLate(o)?' · <b class="late">atrasado</b>':''}${o.quoteId?` · Cotización ${esc(o.quoteId)}`:''}`,
  body:`<div class="workflow-detail order-detail">${orderStepper(o)}
  <div class="order-cards"><section class="order-card"><h3>Cobro</h3><div class="order-money"><span>Total acordado</span><b>${money(o.amount)}</b><span>Cobrado</span><b>${money(pay.paid)}</b>${cancelled?'':`<span>Por cobrar</span><b class="${pay.pending>0?'due':''}">${money(pay.pending)}</b>`}</div>${!cancelled&&pay.pending>0?`<button type="button" class="btn btn-light compact-button" data-order-payment="${esc(o.id)}">Registrar abono</button>`:''}</section>
  <section class="order-card"><h3>Filamento</h3>${cons||'<p class="muted">Pedido sin filamento estimado.</p>'}<div class="order-card-actions"><button type="button" class="btn btn-light compact-button" data-order-consumption="${esc(o.id)}">Registrar consumo</button>${o.reservation?.status==='ACTIVE'?`<button type="button" class="btn btn-light compact-button" data-release-reservation="${esc(o.id)}">Liberar reserva</button>`:''}</div></section>${realVsQuotedHtml(o)}</div>
  <h3>Movimientos del pedido</h3><div class="workflow-events">${(o.events||[]).slice().reverse().map(ev=>`<div><span class="workflow-event-dot ${ev.type==='ORDER_CANCELLED'?'red':ev.type==='PRODUCTION_REVERTED'?'orange':''}"></span><div><b>${esc(eventDesc(ev))}${ev.amount?' · '+money(ev.amount):''}</b><small>${esc(fmtTime(ev.at))}${ev.method?' · '+esc(ev.method):''}${ev.reason&&!['ORDER_CREATED','RESERVATION_RELEASED'].includes(ev.type)?' · '+esc(ev.reason):''}</small></div></div>`).join('')||'<p>Pedido sin historial de movimientos.</p>'}</div></div>`,
  actions:`${cancelled?'':`<button type="button" class="btn btn-light danger-text action-left" data-order-action="cancel" data-id="${esc(o.id)}">Anular pedido</button>`}${prev?`<button type="button" class="btn btn-light" data-order-action="revert" data-id="${esc(o.id)}">Volver a «${esc(prev)}»</button>`:''}${orderNextAction(o,{big:true})||'<button class="btn btn-light" data-close>Cerrar</button>'}`});
}
async function advanceOrder(id){
 const o=db.orders.find(x=>x.id===id);const next=o&&nextOrderStatus(o);if(!next)return;
 if(next==='Entregado'&&needsConsumption(o)){deliveryModal(id);return;}
 try{await applyToOrder(id,mini=>changeOrderStatus(mini,id,next,{at:now()}));const reopen=!!document.querySelector('.order-dialog');closeModal();render();if(reopen)orderDetail(id);
  toast(next==='Entregado'?`${id} entregado.${paymentSummary(db.orders.find(x=>x.id===id)).pending>0?' Queda saldo por cobrar.':''}`:`${id} pasó a «${next}». Si fue un error: ⋯ → Volver.`);}
 catch(err){toast(err.message,'warning');}
}
const kg=n=>(Math.round(Number(n||0)*1000)/1000).toLocaleString('es-CL',{maximumFractionDigits:3});
const tempRange=r=>Array.isArray(r)&&(r[0]!=null||r[1]!=null)?`${r[0]??r[1]}${r[1]!=null&&r[1]!==r[0]?`–${r[1]}`:''} °C`:'';
function materialStock(m){
 if(Number.isFinite(Number(m.spools))&&m.spoolNetG){const open=Number(m.openRemainingG)||0;return `${m.spools} carrete${Number(m.spools)===1?'':'s'}${open?` + ${open.toLocaleString('es-CL')} g`:''} · ${kg(m.stockKg)} kg`;}
 return `${kg(m.stockKg)} kg`;
}
function materials(){
 const committed=committedGrams(db);
 const low=new Set(lowStockMaterials(db,committed).map(r=>r.material.id));
 return `<div class="materials-grid">${db.materials.map(m=>{
  const facts=[m.spoolNetG?`Carrete ${Number(m.spoolNetG).toLocaleString('es-CL')} g`:'',tempRange(m.nozzleC)?`Boquilla ${tempRange(m.nozzleC)}`:'',tempRange(m.bedC)?`Cama ${tempRange(m.bedC)}`:'',m.density?`${String(m.density).replace('.',',')} g/cm³`:'',...(Array.isArray(m.traits)?m.traits.slice(0,3).map(traitLabel):[])].filter(Boolean);
  return `<article class="panel material-card"><div class="material-color" style="background:${/^#[0-9a-fA-F]{6}$/.test(m.hex)?m.hex:'#ccc'}"><div class="spool-ring"></div></div><div class="material-tag">${esc(m.type)}${m.catalogRef?'<span class="material-source" title="Ficha del catálogo">catálogo</span>':''}${low.has(m.id)?`<span class="material-low" title="Disponible bajo el mínimo de ${esc(gramsTxt(minStockOf(m)))}">stock bajo</span>`:''}</div><h3>${esc(m.name)}</h3><p>${esc(m.brand)} · ${esc(m.color)}</p>${facts.length?`<p class="material-facts">${facts.map(esc).join(' · ')}</p>`:''}<div class="material-rows"><div><span>Precio por kg</span><strong>${money(m.priceKg)}</strong></div><div><span>Físico</span><strong>${esc(materialStock(m))}</strong></div>${(()=>{const st=stockStatus(db,m,committed);return st.committed>0?`<div><span>Comprometido</span><strong>${kg(st.committed/1000)} kg</strong></div><div><span>Disponible</span><strong class="${st.available<0?'neg':''}">${kg(st.available/1000)} kg</strong></div>`:'';})()}${m.gtin?`<div><span>Código de barras</span><strong class="mono">${esc(m.gtin)}</strong></div>`:''}</div>${/^https:\/\//.test(m.dataSheetUrl||'')?`<a class="material-sheet" href="${esc(m.dataSheetUrl)}" target="_blank" rel="noopener noreferrer">Ficha técnica del fabricante ↗</a>`:''}<div class="material-actions"><button class="material-edit" data-material-movements="${esc(m.id)}">Movimientos</button><button class="material-edit" data-edit-material="${esc(m.id)}">Editar material ${ic('arrow',16)}</button></div></article>`;}).join('')}</div>`;
}
// ── Formulario de materiales: catálogo encadenado (marca → material → línea → color → formato) ──
let materialDraft=null;
const CATALOG_FIELDS=['pricePerSpool','spools','openRemainingG','spoolNetG','emptySpoolG','gtin','diameter','density','nozzleC','bedC','maxDryC','traits','dataSheetUrl','catalogRef'];
function initMaterialDraft(material){
 const sel=selectionOf(material);
 if(material&&!sel)return {mode:'manual'};
 return {mode:'catalog',brandId:sel?.brandId||'',type:sel?.type||'',lineId:sel?.lineId||'',colorId:sel?.colorId||'',sizeKey:sel?.sizeKey||'',pricePerSpool:material?.pricePerSpool??'',spools:material?.spools??'',openRemainingG:material?.openRemainingG||''};
}
function autoPick(d){
 if(d.brandId&&!d.type){d.type=catalogMaterialTypes(d.brandId)[0]||'';}
 if(d.type&&!d.lineId){const lines=catalogLines(d.brandId,d.type);if(lines.length===1)d.lineId=lines[0].id;}
 if(d.lineId&&d.colorId&&!d.sizeKey){const sizes=catalogSizes(d.lineId,d.colorId);d.sizeKey=(sizes.find(s=>s.grams===1000&&!s.refill)||sizes.find(s=>!s.refill)||sizes[0])?.key||'';}
}
const opt=(value,label,selected)=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(label)}</option>`;
function materialPreview(){
 const d=materialDraft;const entry=catalogEntry(d);
 if(!entry)return '<p class="material-preview-empty">Elige el filamento para ver su ficha.</p>';
 let calc='';
 try{const m=materialFromCatalog(d,{pricePerSpool:d.pricePerSpool,spools:d.spools,openRemainingG:d.openRemainingG});calc=`<div class="material-calc"><span>Precio por kg <b>${money(m.priceKg)}</b></span><span>Stock <b>${kg(m.stockKg)} kg</b></span></div>`;}
 catch{calc='<div class="material-calc muted">Completa precio y carretes para calcular precio por kg y stock.</div>';}
 const facts=[['Material',`${entry.type} · ${entry.diameter} mm`],['Densidad',entry.density?`${String(entry.density).replace('.',',')} g/cm³`:''],['Boquilla',tempRange(entry.nozzleC)],['Cama',tempRange(entry.bedC)],['Secado máx.',entry.maxDryC?`${entry.maxDryC} °C`:''],['Carrete',`${entry.spoolNetG.toLocaleString('es-CL')} g${entry.refill?' (recarga)':''}`],['Carrete vacío',entry.emptySpoolG?`${entry.emptySpoolG} g`:''],['Código de barras',entry.gtin||''],['Acabado',entry.traits.map(traitLabel).join(', ')]].filter(([,v])=>v);
 return `<div class="material-sheet-head"><span class="swatch-dot" style="background:${esc(entry.hex)}"></span><div><b>${esc(entry.line)} ${esc(entry.color)}</b><small>${esc(entry.brand)}</small></div></div><dl class="material-specs">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${!tempRange(entry.nozzleC)?'<p class="material-preview-empty">El fabricante no publica temperaturas en el catálogo.</p>':''}${calc}`;
}
function materialFieldsInner(material){
 const d=materialDraft;
 const toggle=`<div class="segmented" role="group" aria-label="Origen del material"><button type="button" data-material-mode="catalog" aria-pressed="${d.mode==='catalog'}" class="${d.mode==='catalog'?'active':''}">Desde catálogo</button><button type="button" data-material-mode="manual" aria-pressed="${d.mode==='manual'}" class="${d.mode==='manual'?'active':''}">Fuera del catálogo</button></div>`;
 if(d.mode==='manual')return toggle+`<label class="field">Nombre del material <input name="name" required maxlength="80" value="${esc(material?.name||'')}"></label><div class="fields-grid"><label class="field">Marca <input name="brand" maxlength="80" value="${esc(material?.brand||'')}"></label><label class="field">Tipo <select name="type">${['PLA','PETG','TPU','ABS','ASA','Otro'].map(s=>`<option ${s===material?.type?'selected':''}>${s}</option>`).join('')}</select></label><label class="field">Color / descripción <input name="color" maxlength="40" value="${esc(material?.color||'')}"></label><label class="field">Color de muestra <input name="hex" type="color" value="${/^#[0-9a-fA-F]{6}$/.test(material?.hex||'')?esc(material.hex):'#afc7c0'}"></label><label class="field">Precio kg (CLP) <input name="priceKg" required min="0" max="10000000" type="number" step="1" value="${material?.priceKg??22000}"></label><label class="field">Stock (kg) <input name="stockKg" required min="0" max="100000" type="number" step="0.001" value="${material?.stockKg??1}"></label>${minStockField(material)}</div>`;
 autoPick(d);
 const types=d.brandId?catalogMaterialTypes(d.brandId):[];
 const lines=d.type?catalogLines(d.brandId,d.type):[];
 const colors=d.lineId?catalogColors(d.lineId):[];
 const sizes=d.colorId?catalogSizes(d.lineId,d.colorId):[];
 const sizeLabel=s=>`${s.grams>=1000?`${(s.grams/1000).toLocaleString('es-CL')} kg`:`${s.grams} g`}${s.refill?' · recarga sin carrete':''}`;
 return toggle+`<div class="fields-grid"><label class="field">Marca <select data-cat="brandId" required><option value="">Elige la marca…</option>${catalogBrands().map(b=>opt(b.id,b.name,d.brandId)).join('')}</select></label><label class="field">Material <select data-cat="type" ${types.length?'':'disabled'} required>${types.map(t=>opt(t,t,d.type)).join('')}</select></label><label class="field span2">Línea <select data-cat="lineId" ${lines.length?'':'disabled'} required><option value="">${lines.length?'Elige la línea…':'—'}</option>${lines.map(l=>opt(l.id,`${l.name} (${l.colors} colores)`,d.lineId)).join('')}</select></label></div>
 ${colors.length?`<div class="field"><span>Color <small class="muted">${colors.length} disponibles${d.colorId?` · ${esc(colors.find(c=>c.id===d.colorId)?.name||'')}`:''}</small></span><div class="swatch-grid" role="radiogroup" aria-label="Color">${colors.map(c=>`<button type="button" class="swatch ${c.id===d.colorId?'selected':''}" role="radio" aria-checked="${c.id===d.colorId}" data-cat-color="${esc(c.id)}" title="${esc(c.name)}"><span style="background:${esc(c.hex)}"></span>${esc(c.name)}</button>`).join('')}</div></div>`:''}
 ${sizes.length?`<label class="field">Formato del carrete <select data-cat="sizeKey">${sizes.map(s=>opt(s.key,sizeLabel(s),d.sizeKey)).join('')}</select></label>`:''}
 <div class="material-preview" id="material-preview">${materialPreview()}</div>
 <div class="quote-section-label">Compra e inventario</div><div class="fields-grid"><label class="field">Precio pagado por carrete (CLP) <input name="pricePerSpool" data-mat-input type="number" min="1" max="10000000" step="1" inputmode="numeric" required value="${esc(d.pricePerSpool)}" placeholder="Ej. 22000"><small>Tal como aparece en la boleta (el IVA de compras es costo).</small></label><label class="field">Carretes cerrados <input name="spools" data-mat-input type="number" min="0" max="10000" step="1" inputmode="numeric" required value="${esc(d.spools)}" placeholder="Ej. 2"></label><label class="field span2">Carrete abierto: gramos restantes (opcional) <input name="openRemainingG" data-mat-input type="number" min="0" step="1" inputmode="numeric" value="${esc(d.openRemainingG)}" placeholder="0"><small>${(()=>{const e=catalogEntry(d);return e?.emptySpoolG?`Si lo pesas: peso en balanza − ${e.emptySpoolG} g del carrete vacío.`:'Si no hay carrete abierto, déjalo vacío.';})()}</small></label>${minStockField(material)}</div>`;
}
/** Umbral de aviso de stock bajo (sobre lo DISPONIBLE). Vacío = el por defecto; 0 = sin aviso. */
function minStockField(material){
 const v=material?.minStockG;
 return `<label class="field span2">Avisar cuando queden menos de (g) <input name="minStockG" type="number" min="0" step="1" inputmode="numeric" value="${v===undefined||v===null?'':esc(v)}" placeholder="${DEFAULT_MIN}"><small>Se compara con lo disponible (físico − comprometido). Vacío: ${DEFAULT_MIN} g. 0: sin aviso.</small></label>`;
}
const DEFAULT_MIN=minStockOf({});
function movementsModal(id){const m=db.materials.find(x=>x.id===id);if(!m)return;
 const rows=materialMovements(db,id),st=stockStatus(db,m);
 const sign=g=>g>0?`+${gramsTxt(g)}`:g<0?`−${gramsTxt(-g)}`:'—';
 modalShell({wide:true,eyebrow:`${esc(m.id)} · INVENTARIO`,title:`Movimientos · ${esc(materialLabel(m))}`,sub:`Físico ${gramsTxt(st.physical)} · Comprometido ${gramsTxt(st.committed)} · Disponible ${gramsTxt(st.available)} · Mínimo ${gramsTxt(minStockOf(m))}`,
  body:`<div class="workflow-detail"><div class="movements-wrap"><table class="movements"><thead><tr><th>FECHA</th><th>MOVIMIENTO</th><th class="right">FÍSICO</th><th class="right">COMPROMETIDO</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(fmtTime(r.at))}</td><td>${r.orderId?`<button type="button" class="link-button" data-order-detail="${esc(r.orderId)}">${esc(r.label)}</button>`:esc(r.label)}</td><td class="right ${r.physicalG<0?'neg':r.physicalG>0?'pos':''}">${sign(r.physicalG)}</td><td class="right muted">${sign(r.committedG)}</td></tr>`).join('')||tableEmpty(4,'Sin movimientos registrados todavía.')}</tbody></table></div><p class="history-footnote">Físico: lo que mueven los consumos reales y los ajustes al editar el material. Comprometido: reservas de pedidos (no tocan el físico). Los ajustes se registran desde la versión 0.15.</p></div>`,
  actions:`<button class="btn btn-light" data-close>Cerrar</button><button class="btn btn-primary" data-edit-material="${esc(m.id)}">Editar material</button>`});
}
function renderMaterialFields(){const box=document.getElementById('material-fields');if(box)box.innerHTML=materialFieldsInner(db.materials.find(m=>m.id===document.getElementById('modal-form')?.dataset.id));}
function backupCard(){
 const last=db.meta?.lastBackupAt;
 return `<section class="panel settings-card"><div class="panel-head"><div><h3>Respaldo</h3><p>${last?`Último respaldo: ${esc(String(last).slice(0,10))}`:'Aún no descargas un respaldo'}</p></div></div><p class="settings-copy">Descarga un archivo con todos tus datos (clientes, cotizaciones, pedidos, pagos y configuración). Recomendado: una vez por semana, guardado fuera de este equipo.</p><div class="dialog-actions"><button class="btn btn-primary" id="backup-download">Descargar respaldo</button><label class="btn btn-light" for="backup-file">Restaurar desde archivo</label><input id="backup-file" type="file" accept="application/json,.json" hidden></div><div class="settings-warning">${ic('info',17)} Restaurar solo agrega lo que falta; nunca sobrescribe ni elimina. El archivo incluye costos y márgenes: no lo compartas.</div></section>`;
}
function settings(){const p=normalizedShopSettings(db.shopSettings);
 return `<div class="settings-grid"><section class="panel settings-card shop-settings-panel"><div class="panel-head"><div><h3>Parámetros de tu taller</h3><p>Configúralos una vez, y el cotizador los aplicará automáticamente.</p></div></div><div class="settings-summary-grid"><span>Margen objetivo <b>${esc(p.targetMargin)}%</b></span><span>Fallas esperadas <b>${esc(p.failureRate)}%</b></span><span>Trabajo/h <b>${money(p.laborPerHour)}</b></span><span>Embalaje <b>${money(p.packingPerUnit)}/ud</b></span><span>IVA <b>${p.taxRegime==='NOT_REGISTERED'?'No afecto':esc(p.taxRate)+'%'} (${p.taxRegimeConfirmed?'confirmado':'por confirmar'})</b></span><span>Bajo el mínimo <b>${({WARN:'Advertir',CAP:'Ajustar al mínimo',BLOCK:'Bloquear emisión'})[p.onBelowMin]||'Advertir'}</b></span><span>Revisión <b>${esc(p.revision||1)}</b></span></div><details class="settings-details"><summary>Editar parámetros automáticos <span>⌄</span></summary>
 <form id="shop-settings-form"><div class="quote-section-label">Costos de operación</div><div class="fields-grid"><label class="field">Electricidad ($/kWh)<input name="energyPerKwh" type="number" min="0" step="1" required value="${esc(p.energyPerKwh)}"></label><label class="field">Mano de obra ($/h)<input name="laborPerHour" type="number" min="0" step="50" required value="${esc(p.laborPerHour)}"></label><label class="field">Preparación por lote (min)<input name="preparationMinutes" type="number" min="0" step="1" required value="${esc(p.preparationMinutes)}"></label><label class="field">Supervisión (fracción h/h impresión)<input name="supervisionFactor" type="number" min="0" max="10" step="0.01" required value="${esc(p.supervisionFactor)}"></label><label class="field">Embalaje habitual ($/unidad)<input name="packingPerUnit" type="number" min="0" step="50" required value="${esc(p.packingPerUnit)}"></label><label class="field">Fallas esperadas (%)<input name="failureRate" type="number" min="0" max="99" step="0.5" required value="${esc(p.failureRate)}"></label></div><div class="quote-section-label">Condiciones de venta</div><div class="fields-grid"><label class="field">Margen objetivo (%)<input name="targetMargin" type="number" min="0" max="90" required value="${esc(p.targetMargin)}"></label><label class="field">Margen mínimo (%)<input name="minMargin" type="number" min="0" max="90" required value="${esc(p.minMargin)}"></label><label class="field">Validez (días)<input name="validDays" type="number" min="1" max="90" required value="${esc(p.validDays)}"></label><label class="field">Si el margen queda bajo el mínimo<select name="onBelowMin">${[['WARN','Advertir'],['CAP','Ajustar precio al mínimo'],['BLOCK','Bloquear emisión (permite borrador)']].map(([v,l])=>`<option value="${v}" ${p.onBelowMin===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">Régimen tributario<select name="taxRegime"><option value="VAT_REGISTERED" ${p.taxRegime==='VAT_REGISTERED'?'selected':''}>Afecto a IVA</option><option value="NOT_REGISTERED" ${p.taxRegime==='NOT_REGISTERED'?'selected':''}>No afecto a IVA</option></select></label><label class="field">IVA de venta (%)<input name="taxRate" type="number" min="0" max="90" step="0.5" required value="${esc(p.taxRate)}"><small>Afecto: tasa mayor a 0. No afecto: 0.</small></label><label class="field check-field"><span><input type="checkbox" name="taxRegimeConfirmed" value="1" ${p.taxRegimeConfirmed?'checked':''}> Confirmo este régimen</span><small>Quita el aviso «por confirmar». No reemplaza asesoría tributaria.</small></label><label class="field">Redondeo comercial ($)<select name="priceRounding">${[0,10,100,500,1000].map(v=>`<option value="${v}" ${Number(p.priceRounding)===v?'selected':''}>${v===0?'Sin redondeo':money(v)}</option>`).join('')}</select></label><label class="field span2">Condiciones para el cliente<input name="terms" maxlength="180" value="${esc(p.terms)}"></label></div><div class="form-actions"><button type="submit" class="btn btn-primary">Guardar configuración del taller</button></div></form></details>
 <p class="settings-copy">Los modelos de impresora y los precios de filamentos se gestionan en sus módulos. Los cambios afectarán a cotizaciones nuevas, no a snapshots guardados.${PROD?'':` Catálogo de filamentos: <a href="https://openfilamentdatabase.org" target="_blank" rel="noopener noreferrer">Open Filament Database</a> (MIT), ${esc(catalogMeta().generatedAt)}.`}</p></section>
 ${PROD?'':`<section class="panel settings-card"><div class="panel-head"><div><h3>Alcance de la beta</h3><p>Lo que puedes probar ahora</p></div></div><div class="setting-line"><span>${ic('check',18)} Flujo de cotización, pedido y pagos manuales</span><span class="status green">Demo</span></div><div class="setting-line"><span>${ic('check',18)} Un cotizador con opciones bajo demanda</span><span class="status green">Demo</span></div><div class="setting-line"><span>${ic('check',18)} Perfiles de máquina y material</span><span class="status green">Demo</span></div><div class="setting-line"><span>${ic('check',18)} Motor calculation/v1 en el cotizador</span><span class="status green">Integrado</span></div><div class="setting-line"><span>${ic(CLOUD?'check':'clock',18)} Nube, acceso con Google y respaldo</span><span class="status ${CLOUD?'green':'neutral'}">${CLOUD?'Integrado':'Solo en línea'}</span></div><div class="setting-line"><span>${ic('clock',18)} Lectura de archivos GCODE/3MF</span><span class="status neutral">Pendiente</span></div></section>`}
 ${CLOUD?`<section class="panel settings-card"><div class="panel-head"><div><h3>Cuenta</h3><p>${esc(cloudUser?.email||'')}</p></div></div><p class="settings-copy">Tus datos se guardan en la nube y los ves en cualquier dispositivo con esta cuenta.</p><button class="btn btn-light" id="cloud-import">Importar datos de este navegador</button><div class="settings-warning">${ic('info',17)} La importación agrega lo que no existe en la nube; nunca sobrescribe ni recalcula.</div></section>${backupCard()}</div>`:`<section class="panel settings-card"><div class="panel-head"><div><h3>Datos de demostración</h3><p>Guardados solo en este navegador</p></div></div><p class="settings-copy">El restablecimiento elimina los datos locales y recupera los ejemplos iniciales.</p><button class="btn btn-danger" id="reset-demo">Restablecer datos demo</button><div class="settings-warning">${ic('info',17)} No hay sincronización ni control de acceso.</div></section>${backupCard()}</div>`}`;
}
function modal(kind, id=null){
 const client=db.clients.find(x=>x.id===id);
 const material=db.materials.find(x=>x.id===id);
 const machine=db.printers.find(x=>x.id===id);
 const fields={
  client:`<label class="field">Nombre completo <input name="name" required maxlength="80" value="${esc(client?.name||'')}" placeholder="Nombre y apellido" autocomplete="name"><small>Se guardará automáticamente como «Lucas Martino», aunque escribas «LUCAS MARTINO».</small></label><label class="field">Empresa <input name="company" maxlength="80" value="${esc(client?.company==='Particular'?'':client?.company||'')}" placeholder="Opcional"></label><label class="field">Correo <input name="email" type="email" value="${esc(client?.email||'')}" placeholder="correo@ejemplo.cl" autocomplete="email"></label><label class="field">Teléfono <input name="phone" value="${esc(client?.phone||'')}" placeholder="+56 9 1234 5678" autocomplete="tel"></label>`,
  project:`<label class="field">Nombre del proyecto <input name="name" maxlength="90" required placeholder="Ej. Soporte personalizado"></label><label class="field">Cliente <select name="clientId" required>${activeClients().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label class="field">Categoría <input name="category" maxlength="50" value="Accesorios"></label><label class="field">Notas <textarea name="notes" rows="3" maxlength="300" placeholder="Materiales, ideas, medidas..."></textarea></label>`,
  material:`<div id="material-fields" class="material-form">${kind==='material'?(materialDraft=initMaterialDraft(material),materialFieldsInner(material)):''}</div>`,
  machine:`<label class="field">Modelo / nombre <select name="catalog" id="machine-catalog"><option value="">Selecciona o escribe un nombre...</option>${MACHINE_CATALOG.map(n=>`<option ${n===machine?.name?'selected':''}>${esc(n)}</option>`).join('')}</select></label><label class="field">Nombre identificador <input name="name" required maxlength="90" value="${esc(machine?.name||'')}" placeholder="Ej. Bambu Lab A1"></label><label class="field">Tecnología <select name="technology"><option value="FDM">FDM (filamento)</option></select></label><label class="field">Precio de adquisición (CLP) <input name="purchasePrice" type="number" min="0" required value="${machine?.purchasePrice??0}"></label><label class="field">Valor residual (CLP) <input name="residualValue" type="number" min="0" required value="${machine?.residualValue??0}"></label><label class="field">Vida útil estimada (h) <input name="lifeHours" type="number" min="1" required value="${machine?.lifeHours??5000}"></label><label class="field">Consumo promedio durante impresión (W) <input name="averageWatts" type="number" min="0" step="0.1" required value="${machine?.averageWatts??100}"></label><label class="field">Presupuesto de mantenimiento (CLP) <input name="maintenanceBudget" type="number" min="0" required value="${machine?.maintenanceBudget??0}"></label><label class="field">Horas cubiertas por mantenimiento <input name="maintenanceHours" type="number" min="1" required value="${machine?.maintenanceHours??5000}"></label><p class="profile-help">Estos importes son estimaciones para pruebas; revisa tus propios comprobantes, consumos medidos y mantenimiento real.</p>`,
  order:`<label class="field">Cliente <select name="clientId" required>${activeClients().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></label><label class="field">Proyecto / trabajo <input name="project" maxlength="90" required placeholder="Ej. Letrero decorativo"></label><label class="field">Unidades <input name="quantity" required type="number" min="1" max="100000" value="1"></label><label class="field">Monto total (CLP) <input name="amount" required type="number" min="0" max="1000000000" value="15000"></label><label class="field">Fecha comprometida <input name="dueDate" required type="date" value="2026-10-30"></label>`,
 };
 const titles={client:client?'Editar cliente':'Agregar cliente',project:'Nuevo proyecto',material:material?'Editar material':'Agregar material',order:'Nuevo pedido',machine:machine?'Editar impresora':'Nueva impresora'};
 document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="dialog${kind==='material'?' dialog-wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="dialog-head"><div><div class="eyebrow">${id?'EDITAR REGISTRO':'NUEVO REGISTRO'}</div><h2 id="modal-title">${titles[kind]}</h2></div><button class="close-modal" data-close aria-label="Cerrar">×</button></div><form id="modal-form" data-kind="${kind}" data-id="${esc(id||'')}"><div class="dialog-form">${fields[kind]}</div><div class="dialog-actions">${kind==='material'&&material?`<button type="button" class="btn btn-danger action-left" data-delete-material="${esc(material.id)}">Eliminar</button>`:''}<button type="button" class="btn btn-light" data-close>Cancelar</button><button type="submit" class="btn btn-primary">Guardar cambios</button></div></form></div></div>`;
 document.querySelector('.dialog input, .dialog select')?.focus();
}
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function saveModal(form){
 const kind=form.dataset.kind, id=form.dataset.id, f=Object.fromEntries(new FormData(form).entries());
 const today=new Date().toISOString().slice(0,10);
 if(kind==='client'){const name=normalizeClientName(f.name);if(!name)throw Error('Ingresa un nombre válido.');const data={name,company:f.company?.trim()||'Particular',email:f.email?.trim().toLocaleLowerCase('es-CL')||'',phone:f.phone?.trim()||''};if(id){const existing=db.clients.find(c=>c.id===id);if(!existing)throw Error('Cliente no encontrado.');Object.assign(existing,data);}else{db.clients.unshift({id:allocateClientId(db),...data,createdAt:today});}}
 if(kind==='project'){db.projects.unshift({id:nextId('PRJ',db.projects),name:f.name.trim(),clientId:f.clientId,category:f.category?.trim()||'Otros',notes:f.notes?.trim()||'',status:'Diseño',progress:0});}
 if(kind==='order'){db.orders.unshift({id:nextId('PED',db.orders),project:f.project.trim(),clientId:f.clientId,quantity:Number(f.quantity),amount:Number(f.amount),dueDate:f.dueDate,status:'Pendiente',createdAt:now(),payments:[],events:[{type:'ORDER_CREATED',at:now(),reason:'Pedido manual'}]});}
 if(kind==='machine'){const item={name:f.name.trim(),technology:f.technology,purchasePrice:Number(f.purchasePrice),residualValue:Number(f.residualValue),lifeHours:Number(f.lifeHours),averageWatts:Number(f.averageWatts),maintenanceBudget:Number(f.maintenanceBudget),maintenanceHours:Number(f.maintenanceHours)};validatePrinterProfile(item);if(id){const existing=db.printers.find(p=>p.id===id);if(!existing)throw Error('Impresora no encontrada');Object.assign(existing,item,{revision:(existing.revision||1)+1,isExample:false});}else{const machineId=nextId('MAC',db.printers);db.printers.push({...item,id:machineId,revision:1,isExample:false});selectedMachineId=machineId;}}
 if(kind==='material'){
  let data;
  if(materialDraft?.mode==='catalog'){
   data=materialFromCatalog(materialDraft,{pricePerSpool:f.pricePerSpool,spools:f.spools,openRemainingG:f.openRemainingG});
  }else{
   data={name:String(f.name||'').trim(),brand:f.brand?.trim()||'',type:f.type,color:f.color?.trim()||'',hex:/^#[0-9a-fA-F]{6}$/.test(f.hex||'')?f.hex:'#afc7c0',priceKg:Number(f.priceKg),stockKg:Number(f.stockKg)};
   if(!data.name)throw Error('Indica el nombre del material.');
   if(!Number.isFinite(data.priceKg)||data.priceKg<0||!Number.isFinite(data.stockKg)||data.stockKg<0) throw Error('Precio o stock inválidos');
  }
  const minText=String(f.minStockG??'').trim();
  if(minText!==''){const min=Number(minText);if(!Number.isInteger(min)||min<0||min>1000000)throw Error('El aviso de stock bajo debe ser un número entero de gramos (0 o más).');data.minStockG=min;}
  if(id){const existing=db.materials.find(m=>m.id===id);if(!existing)throw Error('Material no encontrado.');
   const beforeG=availableGrams(existing);
   // Nueva revisión del perfil de material: las cotizaciones guardadas conservan la anterior en su snapshot.
   if(materialDraft?.mode!=='catalog')for(const key of CATALOG_FIELDS)Reflect.deleteProperty(existing,key);
   if(minText==='')Reflect.deleteProperty(existing,'minStockG');
   Object.assign(existing,data,{revision:(Number(existing.revision)||1)+1});
   logStockChange(existing,{beforeG,afterG:availableGrams(existing),at:now()});}
  else{const created={id:nextId('MAT',db.materials),...data,revision:1};logStockChange(created,{beforeG:0,afterG:availableGrams(created),at:now(),reason:'CREATED'});db.materials.unshift(created);}
  materialDraft=null;
 }
 persist();closeModal();render();toast(CLOUD?'Registro guardado.':'Registro guardado en este navegador.');
}
function printCustomer(dto) {
 if(ENV.printUnavailable){toast('La impresión no está disponible en esta vista previa. Usa «Copiar texto».','warning');return;}
 const printRoot=document.getElementById('print-root');
 if(!printRoot) throw Error('No se encontró el formato de impresión.');
 const validDays=Number.isFinite(Number(dto.validDays))?Number(dto.validDays):7;
 const date=esc(dto.createdAt);
 const rows=dto.lines;
 printRoot.innerHTML=`<article class="paper"><header class="paper-header"><div><span class="paper-logo">◇</span><b>FORMA.</b><small>STUDIO · IMPRESIÓN 3D</small></div><div><h2>Cotización</h2><span>${esc(dto.id)} · ${date}</span></div></header><section class="paper-meta"><div><small>PREPARADA PARA</small><strong>${esc(dto.clientName)}</strong></div><div><small>PROYECTO</small><strong>${esc(dto.project)}</strong></div></section><table><thead><tr><th>Descripción</th><th>Cantidad</th><th class="paper-right">Precio unitario</th><th class="paper-right">Importe</th></tr></thead><tbody>${rows.map(l=>`<tr><td>${esc(l.description)}</td><td>${esc(l.quantity)}</td><td class="paper-right">${money(l.unitPrice)}</td><td class="paper-right">${money(l.total)}</td></tr>`).join('')}</tbody></table>${dto.vatAmount!==null?`<div class="paper-amount"><span>IVA</span><strong>${money(dto.vatAmount)}</strong></div>`:''}<div class="paper-amount"><span>Total (${esc(taxLabel(dto.taxTreatment))})</span><strong>${money(dto.total)}</strong></div><footer class="paper-footer">Cotización válida durante ${validDays} día(s) desde ${date}.<p>${esc(dto.terms||'')}</p><p>Presupuesto sujeto a confirmación antes de iniciar producción.</p></footer></article>`;
 try{window.print()}catch{throw Error('No se pudo abrir impresión. Puedes usar Copiar texto.');}
}
async function copyText(value){
 try { if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(value);toast('Texto comercial copiado.');} else {const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('Sin acceso al portapapeles');toast('Texto comercial copiado.');} } catch { window.prompt('Copia este texto comercial:',value); }
}
function refreshQuote(){ const r=document.getElementById('quote-results'),c=document.getElementById('quote-customer-preview');const wasOpen=r?.querySelector('.quote-detail-toggle')?.open;if(r){r.innerHTML=quoteResults();if(wasOpen){const detail=r.querySelector('.quote-detail-toggle');if(detail)detail.open=true;}}if(c)c.innerHTML=quoteCustomerPreview();const m=document.getElementById('machine-summary');if(m)m.innerHTML=machineSummary();markQuoteField(); }
function render(){
 if(CLOUD&&!cloudUser){renderAuthGate('signin');return;}
 if(expireOpenQuotes(db))persist();
 closeClientMenu();closeQuoteMenu();closeOrderMenu();
 if(route==='calculator' && quoteDraft.clientId && !activeClients().some(c=>c.id===quoteDraft.clientId)) quoteDraft.clientId=activeClients()[0]?.id||'';
 app.innerHTML=layout();updateTabTitle();
 if(route==='calculator'){
  const form=document.getElementById('quote-form');
  for(const [k,v] of Object.entries(quoteDraft)){const fld=form.elements.namedItem(k);if(fld && fld.tagName && !durationParts(k))fld.value=v;}
  refreshQuote();
 }
}
/** Pantalla de acceso (solo con nube). Mismo lenguaje visual de la Beta, sin formularios propios. */
function renderAuthGate(mode,message=''){
 document.title=tabTitle(mode==='loading'?'Cargando':'Entrar');
 const body=mode==='loading'?'<p class="settings-copy">Cargando tu taller desde la nube…</p>'
  :mode==='denied'?`<p class="settings-copy">${esc(message||'Tu cuenta no tiene acceso a este taller.')}</p><div class="dialog-actions"><button class="btn btn-light" id="cloud-signout">Usar otra cuenta</button></div>`
  :`<p class="settings-copy">Entra con la cuenta de Google autorizada para este taller.</p><div class="dialog-actions"><button class="btn btn-primary" id="cloud-signin">Entrar con Google</button></div>`;
 app.innerHTML=`<div class="modal-backdrop auth-gate"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div class="dialog-head"><div><div class="eyebrow">${esc(ENV.label)}</div><h2 id="auth-title">FORMA<span class="brand-dot">.</span> Studio</h2></div></div>${body}</div></div><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}
async function bootCloud(){
 renderAuthGate('loading');
 CLOUD.onAuthChange(async user=>{
  cloudUser=user;
  if(!user){renderAuthGate('signin');return;}
  renderAuthGate('loading');
  try{
   const state=await CLOUD.load();
   const empty=!state.shopSettings;
   db=MockRepository.normalize(empty?MockRepository.initialWorkspace(ENV.name==='production'?'empty':'demo'):state);
   selectedMachineId=db.printers[0]?.id??'';
   render();
   if(empty&&await persist()){toast(ENV.name==='production'?'Taller creado en la nube.':'Taller de pruebas creado en la nube con datos ficticios.');}
  }catch(err){cloudUser=null;renderAuthGate('denied',err.code==='PERMISSION_DENIED'?`La cuenta ${user.email||''} no está autorizada para este taller.`:err.message);}
 });
}
if(CLOUD)bootCloud();else render();
app.addEventListener('click', async e=>{
 if(e.target.closest('#cloud-signin')){try{await CLOUD.signIn();}catch(err){toast(`No se pudo iniciar sesión: ${err.message}`,'warning');}return;}
 if(e.target.closest('#cloud-signout')){if(CLOUD){await cloudSaving;await CLOUD.signOut();}return;}
 if(e.target.closest('#cloud-import')){
  const local=MockRepository.loadLocalOnly();
  if(!local){toast('No hay datos guardados en este navegador para importar.','warning');return;}
  if(!await askConfirm({title:'Importar datos de este navegador',message:'Se agregarán a la nube los registros que no existan allí (nunca se sobrescribe nada). Las cotizaciones de la demo quedan marcadas y no cuentan como ventas reales.',confirmLabel:'Importar',danger:false}))return;
  const {added,skipped}=mergeMissing(db,local,{importedFrom:'LOCAL_BROWSER',importedAt:now()});
  const saved=await persist();render();if(saved)toast(`Importados ${added} registros; ${skipped} ya existían y no se tocaron.`);return;
 }
 if(e.target.closest('#backup-download')){
  const at=now();const backup=createBackup(db,{at,source:CLOUD?`firebase:${CLOUD.projectId}`:'navegador'});
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,1)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=backupFileName(at);document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  db.meta={...(db.meta||{}),lastBackupAt:at};persist();render();
  toast(`Respaldo descargado: ${Object.values(backup.counts).reduce((t,n)=>t+n,0)} registros. Guárdalo en un lugar privado: incluye costos y márgenes.`);return;
 }
 const delMat=e.target.closest('[data-delete-material]');if(delMat){
  const mid=delMat.dataset.deleteMaterial;const mat=db.materials.find(m=>m.id===mid);if(!mat)return;
  const usedIn=db.quotes.filter(q=>q.status==='Borrador'&&(q.formState?.materialId===mid||(q.formState?.extraFilaments||[]).some(f=>f.materialId===mid))).map(q=>q.id);
  const msg=`Se eliminará «${mat.name}» del inventario. Las cotizaciones y pedidos guardados conservan sus precios y consumos.${usedIn.length?` Los borradores ${usedIn.join(', ')} lo usan y no podrán recotizarse con este material.`:''}`;
  if(!await askConfirm({title:'Eliminar material',message:msg,confirmLabel:'Eliminar material'}))return;
  db.materials=db.materials.filter(m=>m.id!==mid);
  if(quoteDraft.materialId===mid)delete quoteDraft.materialId;
  materialDraft=null;persist();closeModal();render();toast(`Material «${mat.name}» eliminado.`);return;
 }
 const swatch=e.target.closest('[data-cat-color]');if(swatch&&materialDraft){materialDraft.colorId=swatch.dataset.catColor;materialDraft.sizeKey='';renderMaterialFields();document.querySelector(`[data-cat-color="${CSS.escape(swatch.dataset.catColor)}"]`)?.focus();return;}
 const matMode=e.target.closest('[data-material-mode]');if(matMode&&materialDraft){const mode=matMode.dataset.materialMode;if(mode!==materialDraft.mode){materialDraft=mode==='manual'?{...materialDraft,mode}:{...initMaterialDraft(null),mode};renderMaterialFields();}return;}
 const nav=e.target.closest('[data-nav]');if(nav){if(nav.dataset.nav==='calculator'&&route!=='calculator'){revisionSourceId=null;quoteDraft={};quoteExtras=new Set();amsRows=0;quoteSubmitted=false;resetPlates();}route=nav.dataset.nav;render();window.scrollTo(0,0);return;}
 const qm=e.target.closest('[data-quote-menu]');if(qm){openQuoteMenu(qm,qm.dataset.quoteMenu);return;}
 const relRes=e.target.closest('[data-release-reservation]');if(relRes){
  const oid=relRes.dataset.releaseReservation;
  if(!await askConfirm({title:'Liberar reserva',message:'El filamento reservado para este pedido vuelve a quedar disponible. No cambia el stock físico ni los consumos registrados.',confirmLabel:'Liberar',danger:false}))return;
  try{
   await applyToOrder(oid,mini=>releaseReservation(mini.orders.find(x=>x.id===oid),{at:now(),reason:'MANUAL'}));
   closeModal();render();orderDetail(oid);toast('Reserva liberada.');
  }catch(err){toast(err.message,'warning');}
  return;
 }
 const qcons=e.target.closest('[data-order-consumption]');if(qcons){consumptionModal(qcons.dataset.orderConsumption);return;}
 const qadv=e.target.closest('[data-order-advance]');if(qadv){await advanceOrder(qadv.dataset.orderAdvance);return;}
 const omenu=e.target.closest('[data-order-menu]');if(omenu){openOrderMenu(omenu,omenu.dataset.orderMenu);return;}
 const ofil=e.target.closest('[data-order-filter]');if(ofil){orderFilter=ofil.dataset.orderFilter;render();return;}
 const qdetail=e.target.closest('[data-order-detail]');if(qdetail){orderDetail(qdetail.dataset.orderDetail);return;}
 const qpayment=e.target.closest('[data-order-payment]');if(qpayment){paymentModal(qpayment.dataset.orderPayment);return;}
 const cm=e.target.closest('[data-client-menu]');if(cm){openClientMenu(cm,cm.dataset.clientMenu);return;}
 const detail=e.target.closest('[data-client-detail]');if(detail){closeClientMenu();clientDetail(detail.dataset.clientDetail);return;}
 const editClient=e.target.closest('[data-edit-client]');if(editClient){closeClientMenu();modal('client',editClient.dataset.editClient);return;}

 const mod=e.target.closest('[data-modal]');if(mod){modal(mod.dataset.modal);return;}
 const edit=e.target.closest('[data-edit-material]');if(edit){modal('material',edit.dataset.editMaterial);return;}
 const mov=e.target.closest('[data-material-movements]');if(mov){movementsModal(mov.dataset.materialMovements);return;}
 if(e.target.closest('#copy-customer')){try{await copyText(customerQuoteText(currentCustomerDto()));}catch(err){toast(err.message,'warning');}return;}
 if(e.target.closest('#print-customer')){try{printCustomer(currentCustomerDto());}catch(err){toast(err.message,'warning');}return;}
 const savedPrint=e.target.closest('[data-print-quote]');if(savedPrint){const doc=customerQuoteOf(db,savedPrint.dataset.printQuote);if(doc)printCustomer(doc);else toast('Esta cotización no tiene documento comercial.','warning');return;}
 const editPrinter=e.target.closest('[data-edit-machine]');if(editPrinter){modal('machine',editPrinter.dataset.editMachine);return;}
 const usePrinter=e.target.closest('[data-use-machine]');if(usePrinter){selectedMachineId=usePrinter.dataset.useMachine;quoteDraft.machineId=selectedMachineId;route='calculator';render();return;}
 if(e.target.closest('[data-product-load]')){const p=db.products.find(x=>x.id===selectedProductId);if(p){const missing=missingMaterials(db,p);const clientId=document.querySelector('#quote-form [name="clientId"]')?.value;loadIntoCalculator(p.formState,{clientId});toast(missing.length?`Producto «${p.name}» cargado. Los materiales ${missing.join(', ')} ya no existen: elige otros.`:`Producto «${p.name}» cargado. Ajusta la cantidad y guarda.`,missing.length?'warning':'success');}return;}
 if(e.target.closest('[data-product-delete]')){const p=db.products.find(x=>x.id===selectedProductId);if(p&&await askConfirm({title:'Eliminar producto frecuente',message:`Se eliminará «${p.name}» de tus productos frecuentes. Las cotizaciones hechas con él no cambian.`,confirmLabel:'Eliminar'})){deleteProduct(db,p.id);selectedProductId='';persist();render();toast(`Producto «${p.name}» eliminado.`);}return;}
 if(e.target.closest('[data-component-enable]')){enableComponents();render();document.querySelector('[name="component1Name"]')?.focus();return;}
 if(e.target.closest('[data-component-disable]')){disableComponents();render();return;}
 if(e.target.closest('[data-plate-add]')){if(plateCount<MAX_PLATES){plateCount++;const n=plateCount;plateColors[n]=1;quoteDraft[`plate${n}Units`]='1';quoteDraft[`plate${n}Mat1`]=quoteDraft.materialId??db.materials[0]?.id??'';if(componentMode){quoteDraft[`component${n}Name`]=`Componente placa ${n}`;quoteDraft[`component${n}Required`]='1';quoteDraft[`component${n}Produced`]='1';}render();document.querySelector(`[name="plate${n}Grams1"]`)?.focus();}return;}
 const plRemove=e.target.closest('[data-plate-remove]');if(plRemove){shiftPlatesDown(Number(plRemove.dataset.plateRemove));render();return;}
 const plColorAdd=e.target.closest('[data-plate-color-add]');if(plColorAdd){const n=Number(plColorAdd.dataset.plateColorAdd);const c=(plateColors[n]||1)+1;if(c<=MAX_PLATE_COLORS){plateColors[n]=c;quoteDraft[`plate${n}Mat${c}`]=db.materials.find(m=>!Array.from({length:c-1},(_,i)=>quoteDraft[`plate${n}Mat${i+1}`]).includes(m.id))?.id??db.materials[0]?.id??'';Reflect.deleteProperty(quoteDraft,`plate${n}Grams${c}`);render();document.querySelector(`[name="plate${n}Grams${c}"]`)?.focus();}return;}
 const plColorRemove=e.target.closest('[data-plate-color-remove]');if(plColorRemove){const [n,k]=plColorRemove.dataset.plateColorRemove.split(':').map(Number);const c=plateColors[n]||1;for(let j=k;j<c;j++){quoteDraft[`plate${n}Mat${j}`]=quoteDraft[`plate${n}Mat${j+1}`];quoteDraft[`plate${n}Grams${j}`]=quoteDraft[`plate${n}Grams${j+1}`];}Reflect.deleteProperty(quoteDraft,`plate${n}Mat${c}`);Reflect.deleteProperty(quoteDraft,`plate${n}Grams${c}`);plateColors[n]=c-1;render();return;}
 if(e.target.closest('[data-import-clear]')){importInfo=null;for(const k of ['importFile','importSlicer','importPrinter'])Reflect.deleteProperty(quoteDraft,k);render();toast('Se quitó el vínculo con el archivo. Los datos cargados se mantienen y puedes editarlos.');return;}
 if(e.target.closest('[data-ams-add]')){if(amsRows<AMS_MAX_EXTRA){amsRows++;const used=new Set([quoteDraft.materialId??db.materials[0]?.id,...Array.from({length:amsRows-1},(_,i)=>quoteDraft[`amsMaterial${i+2}`])]);quoteDraft[`amsMaterial${amsRows+1}`]=(db.materials.find(m=>!used.has(m.id))||db.materials[0])?.id||'';Reflect.deleteProperty(quoteDraft,`amsGrams${amsRows+1}`);syncMulticolor();render();document.querySelector(`[name="amsGrams${amsRows+1}"]`)?.focus();}return;}
 const amsRemove=e.target.closest('[data-ams-remove]');if(amsRemove){const n=Number(amsRemove.dataset.amsRemove);for(let k=n;k<=amsRows;k++){quoteDraft[`amsMaterial${k}`]=quoteDraft[`amsMaterial${k+1}`];quoteDraft[`amsGrams${k}`]=quoteDraft[`amsGrams${k+1}`];}Reflect.deleteProperty(quoteDraft,`amsMaterial${amsRows+1}`);Reflect.deleteProperty(quoteDraft,`amsGrams${amsRows+1}`);amsRows--;syncMulticolor();render();return;}
 const extraButton=e.target.closest('[data-quote-extra]');if(extraButton){const id=extraButton.dataset.quoteExtra;if(quoteExtras.has(id)){quoteExtras.delete(id);if(id==='planning')quoteExtras.delete('assembly');}else{quoteExtras.add(id);if(id==='assembly')quoteExtras.add('planning');}render();return;}
 const qbtn=e.target.closest('[data-copy-quote]');if(qbtn){const doc=customerQuoteOf(db,qbtn.dataset.copyQuote);if(doc)await copyText(customerQuoteText(doc));else toast('Esta cotización no tiene documento comercial.','warning');return;}
 if(e.target.closest('#cancel-repricing')){revisionSourceId=null;quoteDraft={};quoteExtras=new Set();amsRows=0;resetPlates();render();return;}
 if(e.target.closest('#reset-demo')){if(await askConfirm({title:'Restablecer datos demo',message:'Se perderán los cambios locales de este navegador y se recuperarán los ejemplos iniciales.',confirmLabel:'Restablecer'})){db=MockRepository.reset();route='dashboard';render();toast('Datos demo restablecidos.');}return;}
});
app.addEventListener('input',e=>{
 if(e.target.matches('[data-mat-input]')&&materialDraft){materialDraft[e.target.name]=e.target.value;const box=document.getElementById('material-preview');if(box)box.innerHTML=materialPreview();}
 if(e.target.closest('#quote-form')){if(e.target.name)quoteDraft[e.target.name]=e.target.value;syncDuration(e.target);updateComponentCapacity(e.target);updateFilamentUi(e.target);refreshQuote();}
 if(e.target.id==='order-search'){orderSearch=e.target.value.toLocaleLowerCase('es-CL').trim();const tb=document.getElementById('order-tbody');if(tb)tb.innerHTML=orderRows(filteredOrders());}
 if(e.target.id==='client-search'){clientSearchTerm=e.target.value.toLocaleLowerCase('es-CL').trim();document.getElementById('client-tbody').innerHTML=clientRows(filteredClients());}
});
app.addEventListener('change',e=>{
 if(e.target.matches('[data-cat]')&&materialDraft){
  const order=['brandId','type','lineId','colorId','sizeKey'];const key=e.target.dataset.cat;
  materialDraft[key]=e.target.value;for(const next of order.slice(order.indexOf(key)+1))materialDraft[next]='';
  if(key==='sizeKey')materialDraft.sizeKey=e.target.value;
  renderMaterialFields();document.querySelector(`[data-cat="${order[Math.min(order.indexOf(key)+1,order.length-1)]}"]`)?.focus();return;
 }
 if(e.target.matches('[data-product-select]')){selectedProductId=e.target.value;return;}
 if(e.target.matches('[data-import-slot]')&&importInfo){const slot=Number(e.target.dataset.importSlot);importInfo.mapping[slot]=e.target.value;importInfo.match[slot]=matchMaterial(importInfo.filaments.find(f=>f.slot===slot),db.materials.filter(m=>m.id===e.target.value)).match;applyImport(importInfo,{materialsOnly:true});render();return;}
 if(e.target.matches('#show-archived-clients')){showArchivedClients=e.target.checked;document.getElementById('client-tbody').innerHTML=clientRows(filteredClients());}
 if(e.target.matches('#quote-machine')) selectedMachineId=e.target.value;
 if(e.target.closest('#quote-form')){if(e.target.name)quoteDraft[e.target.name]=e.target.value;syncDuration(e.target);updateComponentCapacity(e.target);updateFilamentUi(e.target);refreshQuote();}
 if(e.target.matches('#machine-catalog') && e.target.value){const fld=document.querySelector('#modal-form [name="name"]');if(fld) fld.value=e.target.value;}
 if(e.target.matches('[data-project-status]')){const p=db.projects.find(x=>x.id===e.target.dataset.projectStatus);if(p){p.status=e.target.value;p.progress=({'Diseño':30,'En pruebas':65,'Listo':100})[p.status];persist();render();toast('Estado del proyecto actualizado.');}}
});
app.addEventListener('change',async e=>{
 if(e.target.id!=='bambu-file')return;
 const file=e.target.files?.[0];e.target.value='';
 try{await importBambuFile(file);}catch(err){toast(err.message,'warning');}
});
app.addEventListener('change',async e=>{
 if(e.target.id!=='backup-file')return;
 const file=e.target.files?.[0];e.target.value='';
 if(!file)return;
 try{
  const {exportedAt,data}=parseBackup(await file.text());
  if(!await askConfirm({title:'Restaurar desde respaldo',message:`Respaldo del ${String(exportedAt||'').slice(0,10)||'?'}. Se agregarán los registros que no existan; nunca se sobrescribe ni se elimina nada.`,confirmLabel:'Restaurar',danger:false}))return;
  const {added,skipped}=mergeMissing(db,data,{restoredFrom:file.name.slice(0,80),restoredAt:now()});
  if(!db.shopSettings&&data.shopSettings)db.shopSettings=data.shopSettings;
  const saved=await persist();render();if(saved)toast(`Restaurados ${added} registros; ${skipped} ya existían y no se tocaron.`);
 }catch(err){toast(err.message,'warning');}
});
app.addEventListener('reset',e=>{if(e.target.id==='quote-form'){quoteDraft={};quoteExtras=new Set();amsRows=0;revisionSourceId=null;quoteSubmitted=false;resetPlates();setTimeout(render,0);}});
app.addEventListener('submit',async e=>{
 if(e.target.id==='shop-settings-form'){
  e.preventDefault();
  try{
   const formValues=Object.fromEntries(new FormData(e.target).entries());
   const settingNames=['energyPerKwh','laborPerHour','preparationMinutes','supervisionFactor','packingPerUnit','failureRate','targetMargin','minMargin','validDays','priceRounding','taxRate'];
   const next=normalizedShopSettings(db.shopSettings);
   for(const key of settingNames){const value=Number(formValues[key]);if(!Number.isFinite(value)||value<0)throw Error(`Revisa el valor de ${key}.`);next[key]=value;}
   if(next.failureRate>=100||next.targetMargin>90||next.minMargin>90||next.minMargin>next.targetMargin||next.validDays<1||next.validDays>90)throw Error('Revisa márgenes, fallas o validez de la cotización.');
   if(!['WARN','CAP','BLOCK'].includes(formValues.onBelowMin))throw Error('Política bajo el mínimo inválida.');
   if(!['VAT_REGISTERED','NOT_REGISTERED'].includes(formValues.taxRegime))throw Error('Selecciona el régimen tributario.');
   next.taxRegime=formValues.taxRegime;
   next.taxRegimeConfirmed=formValues.taxRegimeConfirmed==='1';
   if(next.taxRegime==='NOT_REGISTERED'&&next.taxRate!==0)throw Error('No afecto a IVA: la tasa de IVA de venta debe ser 0.');
   if(next.taxRegime==='VAT_REGISTERED'&&!(next.taxRate>0))throw Error('Afecto a IVA: indica una tasa mayor a 0.');
   next.onBelowMin=formValues.onBelowMin;
   next.terms=String(formValues.terms??'').trim();
   // Nueva revisión del perfil: las cotizaciones guardadas conservan la anterior en su snapshot.
   next.revision=(Number(db.shopSettings?.revision)||1)+1;
   db.shopSettings=next;persist();render();toast(`Parámetros del taller actualizados (revisión ${next.revision}).`);
  }catch(err){toast(err.message,'warning');}
  return;
 }
 if(e.target.id!=='quote-form')return;
 e.preventDefault();
 try {
   const raw=currentRawForm();
   const source=revisionSourceId?db.quotes.find(q=>q.id===revisionSourceId):null;
   if(revisionSourceId&&!source)throw Error('La versión original ya no existe.');
   const root=source?(source.revisionOf||source.id):null;
   const revision=root?Math.max(1,...db.quotes.filter(q=>(q.revisionOf||q.id)===root).map(q=>Number(q.revision)||1))+1:null;
   // Se valida y calcula ANTES de reservar el folio: un error no consume números.
   const check=quoteService.preview(raw,quoteExtras,quoteContext(raw.clientId));
   if(!check.ok){quoteSubmitted=true;refreshQuote();const bad=markQuoteField();if(bad){bad.focus();bad.scrollIntoView?.({block:'center'});}throw Error(failureMessage(check.error));}
   if(CLOUD)await reserveQuoteNumber();
   const id=nextQuoteId(db);
   const result=quoteService.createDraft(raw,quoteExtras,quoteContext(raw.clientId),{id,...(source?{revisionOf:root,revision,fromQuote:source.id}:{})});
   if(!result.ok)throw Error(failureMessage(result.error));
   const {internal,customer}=result.value;
   db.customerQuotes??=[];db.customerQuotes.push(customer);
   db.quotes.push(internal);persist();quoteDraft={};quoteExtras=new Set();revisionSourceId=null;quoteSubmitted=false;amsRows=0;resetPlates();render();toast(internal.issuance.issuable?`Cotización ${id} guardada como borrador.`:`Cotización ${id} guardada como borrador. No se podrá enviar: margen bajo el mínimo (política Bloquear).`,internal.issuance.issuable?'success':'warning');
 } catch(err){toast(err.message,'warning');}
});
document.addEventListener('click', async e=>{
 const qa=e.target.closest('[data-quote-action]');
 if(qa){const {quoteAction:act,id}=qa.dataset;closeQuoteMenu();
  if(act==='send-quick'||act==='accept-quick'){
    try{
      transitionQuote(db,id,act==='send-quick'?'Enviada':'Aceptada',{channel:'No especificado'});
      persist();closeModal();render();
      toast(act==='send-quick'?'Cotización marcada como enviada.':'Aceptación registrada. Puedes crear el pedido cuando corresponda.');
    }catch(err){toast(err.message,'warning');}
    return;
  }
  if(act==='delete'){
    const q=db.quotes.find(x=>x.id===id);
    if(!q){toast('Cotización no encontrada.','warning');return;}
    if(await askConfirm({title:`Eliminar borrador ${q.id}`,message:`¿Eliminar definitivamente el borrador ${q.id} · ${q.project}? Esta acción no se puede deshacer. No se eliminará el cliente ni sus pedidos.`,confirmLabel:'Eliminar borrador'})){
      try{
        const fromClientProfile=!!document.querySelector('.client-detail-dialog');
        const clientId=q.clientId;
        deleteQuoteDraft(db,id);persist();closeModal();render();
        if(fromClientProfile&&db.clients.some(c=>c.id===clientId))clientDetail(clientId);
        toast(`Borrador ${id} eliminado. El folio no se reutilizará.`);
      }catch(err){toast(err.message,'warning');}
    }
  }
  if(act==='detail')quoteDetail(id);
  if(act==='edit')editQuoteModal(id);
  if(act==='duplicate'){const q=db.quotes.find(x=>x.id===id);if(q?.formState){closeModal();loadIntoCalculator(q.formState,{clientId:q.clientId});toast(`Copia de ${id} cargada como cotización nueva, con tus costos actuales. ${id} no cambia.`);}}
  if(act==='product')productModal(id);
  if(act==='whatsapp'){const q=db.quotes.find(x=>x.id===id),doc=customerQuoteOf(db,id);if(q&&doc){const phone=db.clients.find(c=>c.id===q.clientId)?.phone;window.open(whatsappLink(phone,customerQuoteText(doc)),'_blank','noopener');toast(q.status==='Borrador'?'Se abrió WhatsApp con el texto. Cuando lo envíes, márcala con «Ya la envié».':'Se abrió WhatsApp con el texto de la cotización.');}}
  if(act==='reprice')try{closeModal();startReprice(id);}catch(err){toast(err.message,'warning');}
  if(['send','accept','reject','convert','accept-order'].includes(act))workflowForm(act,id);
  if(act==='revision')try{if(CLOUD)await reserveQuoteNumber();const newQ=cloneQuoteRevision(db,id);persist();render();quoteDetail(newQ.id);toast(`Revisión ${newQ.id} creada desde ${id}. Conserva importes; no se recalculó.`);}catch(err){toast(err.message,'warning');}
  return;
 }
 const oa=e.target.closest('[data-order-action]');
 if(oa){const {orderAction:act,id}=oa.dataset;closeOrderMenu();
  if(act==='detail')orderDetail(id);
  if(act==='payment')paymentModal(id);
  if(act==='consumption')consumptionModal(id);
  if(act==='revert')revertModal(id);
  if(act==='cancel')cancelModal(id);
  return;
 }
 const chip=e.target.closest('[data-reason-chip]');if(chip){const input=chip.closest('form')?.querySelector('[name="reason"]');if(input){input.value=chip.dataset.reasonChip;input.focus();}return;}
 const action=e.target.closest('[data-client-action]');
 if(action){const {clientAction:which,id}=action.dataset;closeClientMenu();const client=db.clients.find(c=>c.id===id);if(!client)return;
  if(which==='detail') clientDetail(id);
  if(which==='edit') modal('client',id);
  if(which==='restore'){delete client.archivedAt;persist();render();toast('Cliente restaurado en el CRM.');}
  if(which==='remove'){
   const h=clientRelations(db,id);
   const prompt=h.hasHistory?`¿Archivar a ${client.name}? Ya tiene pedidos, proyectos o cotizaciones. Se ocultará del CRM activo, pero su historial seguirá intacto y podrás restaurarlo.`:`¿Eliminar definitivamente a ${client.name}? Esta acción no se puede deshacer.`;
   if(await askConfirm({title:h.hasHistory?'Archivar cliente':'Eliminar cliente',message:prompt,confirmLabel:h.hasHistory?'Archivar':'Eliminar'})){const mode=removeOrArchiveClient(db,id,new Date().toISOString().slice(0,10));persist();render();toast(mode==='archived'?'Cliente archivado. Su historial se conserva.':'Cliente eliminado del CRM.');}
  }
  return;
 }
 if(!e.target.closest('[data-client-menu]')&&!e.target.closest('#client-action-menu'))closeClientMenu();
 if(!e.target.closest('[data-quote-menu]')&&!e.target.closest('#quote-action-menu'))closeQuoteMenu();
 if(!e.target.closest('[data-order-menu]')&&!e.target.closest('#order-action-menu'))closeOrderMenu();
 if(e.target.matches('[data-close]')||e.target.id==='modal-backdrop')closeModal();
});
window.addEventListener('scroll',closeClientMenu,true); // Keep quote menu stable while keyboard focuses a menu item.
window.addEventListener('resize',()=>{closeClientMenu();closeQuoteMenu();closeOrderMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeClientMenu();closeQuoteMenu();closeOrderMenu();closeModal();}});
document.addEventListener('submit',e=>{if(e.target.id==='modal-form'){e.preventDefault();try{saveModal(e.target);}catch(err){toast(err.message,'warning');}}});

document.addEventListener('submit',async e=>{
 if(e.target.id==='quote-conditions-form'){
   e.preventDefault();const q=db.quotes.find(x=>x.id===e.target.dataset.id);const values=Object.fromEntries(new FormData(e.target));
   try{if(!q)throw Error('Cotización no encontrada.');updateDraftConditions(db,q.id,{validDays:values.validDays,terms:values.terms,at:now()});persist();closeModal();render();toast('Condiciones del borrador actualizadas.');}catch(err){toast(err.message,'warning');}
 }
 if(e.target.id==='workflow-form'){
  e.preventDefault();const form=e.target,f=Object.fromEntries(new FormData(form));
  try{
   if(form.dataset.action==='send')transitionQuote(db,form.dataset.id,'Enviada',{channel:f.channel});
   if(form.dataset.action==='accept')transitionQuote(db,form.dataset.id,'Aceptada',{channel:f.channel});
   if(form.dataset.action==='reject')transitionQuote(db,form.dataset.id,'Rechazada',{reason:f.reason});
   const creates=['convert','accept-order'].includes(form.dataset.action);
   if(creates&&CLOUD){
    // Transacción en la nube: un solo pedido por cotización aunque se repita el clic o actúen dos sesiones.
    const quoteId=form.dataset.id,at=now();
    await cloudSaving;
    const localMaxOrder=Math.max(0,...db.orders.map(o=>Number(/-(\d+)$/.exec(o.id)?.[1])||0));
    const r=await CLOUD.createOrderOnce({quoteId,localMaxOrder,apply:(mini,orderId)=>form.dataset.action==='accept-order'
      ?acceptAndCreateOrder(mini,quoteId,{dueDate:f.dueDate,channel:f.channel,at,orderId})
      :createOrderFromQuote(mini,quoteId,{dueDate:f.dueDate,at,orderId})});
    mergeEntity('quotes',r.quote);mergeEntity('orders',r.order,{prepend:true});
    closeModal();render();toast(r.alreadyExisted?`Esta cotización ya tenía el pedido ${r.order.id}; no se creó otro.`:`Pedido ${r.order.id} creado y vinculado a la cotización aceptada.`);
    return;
   }
   if(form.dataset.action==='convert')createOrderFromQuote(db,form.dataset.id,{dueDate:f.dueDate});
   if(form.dataset.action==='accept-order')acceptAndCreateOrder(db,form.dataset.id,{dueDate:f.dueDate,channel:f.channel});
   persist();closeModal();render();toast(creates?'Pedido creado y vinculado a la cotización aceptada.':'Estado comercial actualizado.');
  }catch(err){toast(err.message,'warning');}
 }
 if(e.target.id==='consumption-form'){
  e.preventDefault();const form=e.target,f=Object.fromEntries(new FormData(form));
  try{
   const orderId=form.dataset.id;
   const args={id:f.consumptionId,at:now(),kind:f.kind,items:consumptionItemsFrom(f),note:f.note||''};
   const entry=await saveConsumption(orderId,args);
   const short=(entry?.items||[]).filter(it=>it.shortfallG>0);
   closeModal();render();orderDetail(orderId);toast(`Consumo registrado: ${(entry?.items||[]).map(it=>`${gramsTxt(it.grams)} ${it.name}`).join(', ')}.${short.length?` Stock insuficiente: ${short.map(it=>it.name).join(', ')}.`:''}`,short.length?'warning':'success');
  }catch(err){toast(err.message,'warning');}
  return;
 }
 if(e.target.id==='delivery-form'){
  e.preventDefault();const form=e.target,f=Object.fromEntries(new FormData(form));const orderId=form.dataset.id;
  try{
   let msg='';
   if(f.record==='now'){
    const items=consumptionItemsFrom(f);
    if(!items.length)throw Error('Ingresa los gramos usados o elige «Lo registro después».');
    const entry=await saveConsumption(orderId,{id:f.consumptionId,at:now(),kind:'PRODUCTION',items,note:''});
    const short=(entry?.items||[]).filter(it=>it.shortfallG>0);
    msg=` Consumo registrado (${gramsTxt(items.reduce((t,it)=>t+it.grams,0))}).${short.length?` Stock insuficiente: ${short.map(it=>it.name).join(', ')}.`:''}`;
   }
   await applyToOrder(orderId,mini=>changeOrderStatus(mini,orderId,'Entregado',{at:now()}));
   const pending=paymentSummary(db.orders.find(o=>o.id===orderId)).pending;
   closeModal();render();toast(`${orderId} entregado.${msg}${f.record==='later'?' Consumo pendiente: regístralo desde el pedido.':''}${pending>0?` Saldo por cobrar ${money(pending)}.`:''}`);
  }catch(err){toast(err.message,'warning');}
  return;
 }
 if(e.target.id==='product-form'){
  e.preventDefault();const form=e.target;
  try{const p=productFromQuote(db,form.dataset.id,{name:new FormData(form).get('name'),at:now()});selectedProductId=p.id;persist();closeModal();render();toast(`Producto frecuente «${p.name}» guardado. Lo encuentras al inicio del cotizador.`);}
  catch(err){toast(err.message,'warning');}
  return;
 }
 if(e.target.id==='revert-form'||e.target.id==='cancel-form'){
  e.preventDefault();const form=e.target,orderId=form.dataset.id,reason=String(new FormData(form).get('reason')||'');
  const isCancel=form.id==='cancel-form';
  try{
   if(reason.trim().length<3){form.querySelector('[name="reason"]')?.focus();throw Error('Indica el motivo (mínimo 3 caracteres).');}
   const o=await applyToOrder(orderId,mini=>isCancel?cancelOrder(mini,orderId,{reason,at:now()}):revertOrderStatus(mini,orderId,{reason,at:now()}));
   closeModal();render();orderDetail(orderId);toast(isCancel?`${orderId} anulado. Se conserva su historial.`:`${orderId} volvió a «${o.status}». Quedó registrado en el historial.`);
  }catch(err){toast(err.message,'warning');}
  return;
 }
 if(e.target.id==='payment-form'){
  e.preventDefault();const form=e.target,f=Object.fromEntries(new FormData(form));
  try{
   const orderId=form.dataset.id,args={amount:Number(f.amount),method:f.method,paymentId:f.paymentId,at:now()};
   if(CLOUD){
    await cloudSaving;
    const r=await CLOUD.recordPaymentOnce({orderId,apply:mini=>recordPayment(mini,orderId,args)});
    mergeEntity('orders',r.order);
   }else{recordPayment(db,orderId,args);persist();}
   closeModal();render();toast('Abono registrado. La entrega se controla por separado.');
  }catch(err){toast(err.message,'warning');}
 }
});
