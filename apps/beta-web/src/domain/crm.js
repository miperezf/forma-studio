/** Name formatting for contacts; do not alter company branding or historic quotes. */
const LOWERCASE_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'do', 'dos']);
export function normalizeClientName(value) {
  const normalized = String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es-CL');
  return normalized.split(' ').map((word, index) => {
    if (index > 0 && LOWERCASE_PARTICLES.has(word)) return word;
    return word.replace(/(^|[-'’])([\p{L}])/gu, (_, boundary, letter) => boundary + letter.toLocaleUpperCase('es-CL'));
  }).join(' ');
}
export function clientRelations(db, clientId) {
  const orders = db.orders.filter(o => o.clientId === clientId);
  const quotes = db.quotes.filter(q => q.clientId === clientId);
  const projects = db.projects.filter(p => p.clientId === clientId);
  const delivered = orders.filter(o => o.status === 'Entregado');
  return {
    orders, quotes, projects,
    hasHistory: !!(orders.length || quotes.length || projects.length),
    deliveredCount: delivered.length,
    deliveredAmount: delivered.reduce((total, o) => total + (Number(o.amount) || 0), 0),
  };
}
/** Keep client identifiers monotonically increasing even after a deletion. */
export function allocateClientId(db) {
  if (!db.meta || typeof db.meta !== 'object') db.meta = {};
  const ids = [...db.clients, ...db.orders, ...db.quotes, ...db.projects].map(r => /^CLI-(\d+)$/.exec(String(r.clientId ?? r.id ?? ''))?.[1]).filter(Boolean).map(Number);
  const next = Math.max(0, Number(db.meta.lastClientSerial) || 0, ...ids) + 1;
  db.meta.lastClientSerial = next;
  return 'CLI-' + String(next).padStart(4,'0');
}
/** Returns a structural result; caller persists to its repository. */
export function removeOrArchiveClient(db, id, date) {
  const index = db.clients.findIndex(c => c.id === id);
  if (index === -1) throw Error('Cliente no encontrado.');
  const relations = clientRelations(db, id);
  if (relations.hasHistory) {
    db.clients[index].archivedAt = date;
    return 'archived';
  }
  db.clients.splice(index, 1);
  return 'deleted';
}
