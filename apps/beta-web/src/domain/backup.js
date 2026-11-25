/**
 * Respaldo manual del taller (decisión del propietario 2026-10-21: sin plan de pago; respaldo descargado a su PC).
 * Puro: sin DOM ni almacenamiento. La UI descarga el JSON y lo vuelve a leer para restaurar.
 * Restaurar NUNCA sobrescribe ni borra: solo agrega los registros cuyo id no existe (migración no destructiva).
 */
export const BACKUP_FORMAT = 'forma-studio-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_COLLECTIONS = Object.freeze(['clients', 'materials', 'printers', 'projects', 'quotes', 'customerQuotes', 'orders', 'products']);
/** Colecciones nuevas: un respaldo anterior que no las trae se acepta (equivale a lista vacía). */
const OPTIONAL_COLLECTIONS = new Set(['products']);
const MAX_BACKUP_CHARS = 20_000_000;

const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

export function createBackup(db, { at, source = 'local' } = {}) {
  if (!at) throw Error('Falta la fecha del respaldo.');
  const data = {};
  for (const key of BACKUP_COLLECTIONS) data[key] = plain(Array.isArray(db?.[key]) ? db[key] : []);
  data.shopSettings = plain(db?.shopSettings ?? null);
  data.meta = plain(db?.meta ?? null);
  const counts = Object.fromEntries(BACKUP_COLLECTIONS.map((key) => [key, data[key].length]));
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: at, source, counts, data };
}

export function backupFileName(at) {
  return `forma-respaldo-${String(at).slice(0, 10)}.json`;
}

/** Valida el archivo. Devuelve los datos o lanza un error en español explicando qué falta. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length === 0) throw Error('El archivo está vacío.');
  if (text.length > MAX_BACKUP_CHARS) throw Error('El archivo es demasiado grande para un respaldo de FORMA.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw Error('El archivo no es un respaldo válido (JSON ilegible).'); }
  if (parsed?.format !== BACKUP_FORMAT) throw Error('El archivo no es un respaldo de FORMA Studio.');
  if (parsed.version !== BACKUP_VERSION) throw Error(`Versión de respaldo no soportada (${parsed.version}).`);
  const data = parsed.data;
  if (!data || typeof data !== 'object') throw Error('El respaldo no tiene datos.');
  for (const key of BACKUP_COLLECTIONS) {
    if (data[key] === undefined && OPTIONAL_COLLECTIONS.has(key)) data[key] = [];
    if (!Array.isArray(data[key])) throw Error(`El respaldo no tiene la lista «${key}».`);
    for (const entity of data[key]) {
      if (!entity || typeof entity !== 'object' || typeof entity.id !== 'string' || entity.id.trim() === '') throw Error(`Hay un registro sin id en «${key}».`);
    }
  }
  return { exportedAt: parsed.exportedAt ?? null, data };
}

/**
 * Agrega a `db` los registros de `incoming` cuyo id no existe. Nunca modifica ni elimina lo existente.
 * `tag` marca el origen en registros internos; el documento comercial (customerQuotes) no se marca porque solo
 * admite los campos de su lista blanca.
 */
export function mergeMissing(db, incoming, tag = null) {
  let added = 0;
  let skipped = 0;
  for (const key of BACKUP_COLLECTIONS) {
    db[key] ??= [];
    const existing = new Set(db[key].map((entity) => entity.id));
    for (const entity of incoming?.[key] || []) {
      if (existing.has(entity.id)) { skipped += 1; continue; }
      db[key].push(key === 'customerQuotes' || !tag ? plain(entity) : { ...plain(entity), ...tag });
      existing.add(entity.id);
      added += 1;
    }
  }
  return { added, skipped };
}
