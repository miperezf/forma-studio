/**
 * Productos frecuentes (0.15): una cotización guardada como plantilla para volver a cotizar en 2 clics.
 * Guarda solo CÓMO se fabrica (placas, filamentos, tiempos, extras); no guarda precios ni el cliente. Al usarlo se
 * recalcula con los perfiles actuales (precio de filamento, máquina, margen), como cualquier cotización nueva.
 */
const NAME_MAX = 80;
export function nextProductId(db) {
  const max = Math.max(0, Number(db.meta?.lastProductNumber) || 0, ...(db.products || []).map((p) => Number(/^PRD-(\d+)$/.exec(p.id)?.[1]) || 0));
  db.meta ??= {};
  db.meta.lastProductNumber = max + 1;
  return `PRD-${String(max + 1).padStart(4, '0')}`;
}
/** Crea un producto frecuente desde una cotización con formState (cualquier estado). */
export function productFromQuote(db, quoteId, { name, at, id } = {}) {
  const quote = (db.quotes || []).find((q) => q.id === quoteId);
  if (!quote) throw Error('Cotización no encontrada.');
  if (!quote.formState) throw Error('Esta cotización es anterior al cotizador actual: no se puede guardar como producto.');
  const clean = String(name ?? quote.project ?? '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
  if (clean.length < 2) throw Error('Indica un nombre para el producto.');
  if ((db.products || []).some((p) => p.name.toLocaleLowerCase('es-CL') === clean.toLocaleLowerCase('es-CL'))) throw Error(`Ya existe un producto llamado «${clean}».`);
  const formState = JSON.parse(JSON.stringify(quote.formState));
  Reflect.deleteProperty(formState, 'clientId');
  formState.project = clean;
  const product = { id: id ?? nextProductId(db), name: clean, createdAt: at, sourceQuoteId: quote.id, formState };
  db.products ??= [];
  db.products.push(product);
  return product;
}
export function deleteProduct(db, id) {
  const index = (db.products || []).findIndex((p) => p.id === id);
  if (index < 0) throw Error('Producto no encontrado.');
  return db.products.splice(index, 1)[0];
}
/** Materiales del producto que ya no existen en el inventario (para avisar antes de cotizar). */
export function missingMaterials(db, product) {
  const f = product?.formState || {};
  const ids = [f.materialId, ...(f.extraFilaments || []).map((s) => s.materialId), ...(f.extraPlates || []).flatMap((p) => p.filaments.map((s) => s.materialId))].filter(Boolean);
  return [...new Set(ids)].filter((id) => !(db.materials || []).some((m) => m.id === id));
}
/** Teléfono chileno → formato internacional para wa.me («9 1234 5678» → «56912345678»). Vacío si no es válido. */
export function whatsappNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (/^569\d{8}$/.test(digits)) return digits;
  if (/^9\d{8}$/.test(digits)) return `56${digits}`;
  if (/^\d{10,15}$/.test(digits)) return digits;
  return '';
}
export function whatsappLink(phone, text) {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(String(text ?? ''))}`;
}
