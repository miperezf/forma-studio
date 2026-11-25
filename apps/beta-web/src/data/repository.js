import { DEMO_PRINTERS } from '../domain/printer-profiles.js';
import { DEFAULT_SHOP_SETTINGS, normalizedShopSettings } from '../domain/quote-inputs.js';
import { normalizeClientName } from '../domain/crm.js';
import { migrateLegacyCustomerQuote } from '../vendor/forma-engine.js';
/**
 * Separación FÍSICA en el mock (anticipa Firestore con reglas distintas):
 *  - INTERNAL_KEY: CRM, perfiles, pedidos y cotizaciones INTERNAS (costos, snapshot del motor).
 *  - CUSTOMER_KEY: solo documentos comerciales (CustomerQuote). Lo que se envía al cliente sale de aquí.
 * LEGACY_KEY (Beta ≤ 0.5.2) se lee una vez para migrar y NO se borra: queda como respaldo.
 */
export const INTERNAL_KEY = 'forma-studio:internal:v2';
export const CUSTOMER_KEY = 'forma-studio:customer:v2';
export const LEGACY_KEY = 'app-web-3d-beta-v1';
const COLLECTIONS = ['clients','materials','projects','orders','quotes'];
const TODAY = '2026-10-20';
const seedV1 = () => ({
  printers: DEMO_PRINTERS.map(p=>({...p})),
  shopSettings: {...DEFAULT_SHOP_SETTINGS},
  clients: [
    { id:'CLI-001', name:'Camila Rodríguez', company:'Taller Amapola', email:'camila@ejemplo.cl', phone:'+56981234567', createdAt:'2026-10-02' },
    { id:'CLI-002', name:'Matías Herrera', company:'Particular', email:'matias@ejemplo.cl', phone:'+56982345678', createdAt:'2026-10-04' },
    { id:'CLI-003', name:'Valentina Soto', company:'Estudio Norte', email:'valentina@ejemplo.cl', phone:'+56983456789', createdAt:'2026-10-07' },
    { id:'CLI-004', name:'Nicolás Fuentes', company:'Norte Bikes', email:'nicolas@ejemplo.cl', phone:'+56984567890', createdAt:'2026-10-12' },
    { id:'CLI-005', name:'Josefa Muñoz', company:'Particular', email:'josefa@ejemplo.cl', phone:'+56985678901', createdAt:'2026-10-15' },
  ],
  materials: [
    { id:'MAT-001', name:'PLA Basic', brand:'Bambu Lab', color:'Negro carbón', hex:'#374151', priceKg:22000, stockKg:2.4, type:'PLA' },
    { id:'MAT-002', name:'PETG', brand:'Elegoo', color:'Blanco', hex:'#f0f0ec', priceKg:19500, stockKg:1.7, type:'PETG' },
    { id:'MAT-003', name:'PLA Marble', brand:'Elegoo', color:'Mármol', hex:'#d6d1c8', priceKg:26000, stockKg:0.8, type:'PLA' },
    { id:'MAT-004', name:'PETG HF', brand:'Bambu Lab', color:'Azul', hex:'#537da9', priceKg:26500, stockKg:1.1, type:'PETG' },
  ],
  projects: [
    { id:'PRJ-001', name:'Macetero geométrico', clientId:'CLI-001', status:'En pruebas', category:'Decoración', progress:65, notes:'Revisar acabado mármol' },
    { id:'PRJ-002', name:'Soporte para escritorio', clientId:'CLI-002', status:'Diseño', category:'Accesorios', progress:30, notes:'Revisar ajuste' },
    { id:'PRJ-003', name:'Organizador modular', clientId:'CLI-003', status:'Listo', category:'Hogar', progress:100, notes:'Modelo validado' },
    { id:'PRJ-004', name:'Protector no estructural', clientId:'CLI-004', status:'En pruebas', category:'Accesorios', progress:80, notes:'No apto para uso crítico' },
  ],
  orders: [
    { id:'PED-1048', quoteId:'COT-0203', project:'Macetero geométrico', clientId:'CLI-001', status:'En producción', quantity:8, amount:68500, dueDate:'2026-10-25' },
    { id:'PED-1047', project:'Organizador modular', clientId:'CLI-003', status:'Pendiente', quantity:12, amount:92000, dueDate:'2026-10-28' },
    { id:'PED-1046', project:'Soporte para escritorio', clientId:'CLI-002', status:'Preparación', quantity:4, amount:28900, dueDate:'2026-10-22' },
    { id:'PED-1045', project:'Placa decorativa', clientId:'CLI-005', status:'Entregado', quantity:3, amount:21600, dueDate:'2026-10-17' },
  ],
  quotes: [
    { id:'COT-0203', clientId:'CLI-001', project:'Macetero geométrico', quantity:8, gross:68500, net:57563, status:'Aceptada', createdAt:'2026-10-14', customerQuote: { id:'COT-0203', clientName:'Camila Rodríguez', project:'Macetero geométrico', quantity:8, unitGross:8563, gross:68500, createdAt:'2026-10-14', status:'Aceptada' }, calculationVersion:'SEED-DEMO', orderId:'PED-1048', events:[{type:'STATUS_CHANGED',from:'Enviada',to:'Aceptada',at:'2026-10-14T15:00:00Z',reason:'Dato de demostración'}] },
    { id:'COT-0204', clientId:'CLI-003', project:'Organizador modular', quantity:12, gross:92000, net:77311, status:'Enviada', createdAt:'2026-10-17', customerQuote: { id:'COT-0204', clientName:'Valentina Soto', project:'Organizador modular', quantity:12, unitGross:7667, gross:92000, createdAt:'2026-10-17', status:'Enviada' }, calculationVersion:'SEED-DEMO' },
  ],
  meta: { mode:'DEMO', createdAt:TODAY, schema:2 },
});
const seed = () => migrateV1(seedV1()).data;
/**
 * Migración 0.5.2 → v2 (pura; no recalcula ningún monto, D11):
 *  - mueve `quote.customerQuote` embebido a `customerQuotes` (documento comercial v1, whitelist);
 *  - copia validDays/terms al interno (la vigencia se calcula sin leer el documento comercial);
 *  - agrega `revision` a configuración y materiales; normaliza nombres de clientes.
 * Devuelve también los problemas (documentos que no se pudieron migrar) para mostrarlos, nunca los inventa.
 */
export function migrateV1(parsed){
  const data=JSON.parse(JSON.stringify(parsed));
  const problems=[];
  if(!Array.isArray(data.printers)) data.printers=DEMO_PRINTERS.map(p=>({...p}));
  if(!Array.isArray(data.products)) data.products=[];
  data.shopSettings=normalizedShopSettings(data.shopSettings);
  data.materials.forEach(m=>{m.revision ??=1;});
  data.printers.forEach(p=>{p.revision ??=1;});
  data.clients.forEach(c=>{c.name=normalizeClientName(c.name);});
  data.customerQuotes=Array.isArray(data.customerQuotes)?data.customerQuotes:[];
  for(const quote of data.quotes){
    if(quote.customerQuote){
      quote.validDays ??= Number(quote.customerQuote.validDays ?? data.shopSettings.validDays);
      quote.terms ??= String(quote.customerQuote.terms ?? data.shopSettings.terms);
      const migrated=migrateLegacyCustomerQuote(quote.customerQuote,data.shopSettings.terms);
      if(migrated.ok){ if(!data.customerQuotes.some(c=>c.id===quote.id)) data.customerQuotes.push({...migrated.value}); }
      else problems.push({quoteId:quote.id,issues:migrated.error});
      delete quote.customerQuote;
    }
  }
  data.meta={...(data.meta||{}),schema:2};
  return {data,problems};
}
function readJson(key){const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}
const valid=parsed=>parsed && COLLECTIONS.every(k=>Array.isArray(parsed[k]));

/** MockRepository is deliberately replaceable by an eventual FirebaseRepository. */
export const MockRepository = {
  lastMigrationProblems: [],
  load() {
    try {
      const internal=readJson(INTERNAL_KEY);
      if (valid(internal)) {
        const customer=readJson(CUSTOMER_KEY);
        const data={...internal,customerQuotes:Array.isArray(customer?.customerQuotes)?customer.customerQuotes:[]};
        // Re-normaliza sin tocar montos: tolera datos antiguos dentro del esquema v2.
        const {data:normalized,problems}=migrateV1(data);
        this.lastMigrationProblems=problems;
        return normalized;
      }
      const legacy=readJson(LEGACY_KEY);
      if (valid(legacy)) {
        const {data,problems}=migrateV1(legacy);
        this.lastMigrationProblems=problems;
        this.save(data);
        return data;
      }
    } catch (err) { console.warn('Usando datos iniciales: almacenamiento no disponible', err); }
    return seed();
  },
  /** Escribe las dos claves; si la segunda falla, restaura la primera (sin estados a medias). */
  save(data) {
    const {customerQuotes=[],...internal}=data;
    let previousCustomer=null;
    try {
      previousCustomer=localStorage.getItem(CUSTOMER_KEY);
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify({customerQuotes}));
      localStorage.setItem(INTERNAL_KEY, JSON.stringify(internal));
      return true;
    } catch (err) {
      try { if(previousCustomer===null) localStorage.removeItem(CUSTOMER_KEY); else localStorage.setItem(CUSTOMER_KEY,previousCustomer); } catch {}
      console.warn('Almacenamiento local no disponible', err);
      return false;
    }
  },
  reset() { try { localStorage.removeItem(INTERNAL_KEY); localStorage.removeItem(CUSTOMER_KEY); localStorage.removeItem(LEGACY_KEY); } catch {} return seed(); },
  /** Datos guardados en ESTE navegador, o null si no hay (no devuelve la demo). Para importarlos a la nube. */
  loadLocalOnly() {
    try {
      const internal=readJson(INTERNAL_KEY);
      if (valid(internal)) { const customer=readJson(CUSTOMER_KEY); return migrateV1({...internal,customerQuotes:Array.isArray(customer?.customerQuotes)?customer.customerQuotes:[]}).data; }
      const legacy=readJson(LEGACY_KEY);
      if (valid(legacy)) return migrateV1(legacy).data;
    } catch {}
    return null;
  },
  /** Normaliza un estado venido de la nube (mismas reglas que la migración, sin recalcular importes). */
  normalize(state) { return migrateV1({clients:[],materials:[],projects:[],orders:[],quotes:[],customerQuotes:[],...state}).data; },
  /** Espacio de trabajo nuevo en la nube. Staging: demo ficticia marcada. Producción: solo configuración y catálogo de ejemplo. */
  initialWorkspace(kind) {
    const demo=seed();
    if (kind==='demo') {
      // customerQuotes NO se marca: es el documento del cliente y las reglas del servidor solo aceptan su lista blanca.
      for (const key of ['clients','projects','orders','quotes']) demo[key].forEach(entity=>{entity.origin='DEMO';});
      demo.meta={...demo.meta,origin:'DEMO'};
      return demo;
    }
    // Decisión del propietario (2026-10-21, D1/D2/D6): aún no factura ⇒ no afecto a IVA; el IVA de compras no se
    // recupera (todo es costo); comisiones de canal sin IVA. Se cambia en Configuración al empezar a facturar.
    const shopSettings={...demo.shopSettings,taxRegime:'NOT_REGISTERED',taxRate:0,taxRegimeConfirmed:true};
    return {...demo,shopSettings,clients:[],projects:[],orders:[],quotes:[],customerQuotes:[],meta:{schema:2,origin:'INITIAL'}};
  },
};
