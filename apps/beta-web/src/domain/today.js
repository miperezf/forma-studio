/**
 * Agenda del panel «Hoy» (0.15). Pura: recibe el estado y la fecha local AAAA-MM-DD; no lee el reloj.
 * Qué imprimir y entregar, cotizaciones esperando respuesta, saldos por cobrar, filamento bajo y respaldo.
 */
import { isOrderCancelled, paymentSummary, validThrough } from './workflow.js';
import { lowStockMaterials } from './inventory.js';

export const BACKUP_EVERY_DAYS = 7;
export const SOON_DAYS = 3;
const DAY_MS = 86_400_000;
/** Días de `from` a `to` (fechas AAAA-MM-DD; negativo = ya pasó). */
export function daysBetween(from, to) {
  const a = Date.parse(`${String(from).slice(0, 10)}T12:00:00Z`), b = Date.parse(`${String(to).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY_MS) : null;
}
/** «atrasado 2 días», «vence hoy», «mañana», «en 5 días». */
export function dueLabel(days) {
  if (days === null) return 'sin fecha';
  if (days < 0) return `atrasado ${-days} día${days === -1 ? '' : 's'}`;
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `en ${days} días`;
}
export const urgency = (days) => (days === null ? 'none' : days < 0 ? 'late' : days <= 1 ? 'today' : days <= SOON_DAYS ? 'soon' : 'later');

export function todayAgenda(db, today) {
  const live = (db.orders || []).filter((o) => !isOrderCancelled(o));
  const production = live.filter((o) => o.status !== 'Entregado')
    .map((order) => ({ order, days: daysBetween(today, order.dueDate) }))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  const quotes = (db.quotes || []).filter((q) => q.status === 'Enviada')
    .map((quote) => ({ quote, days: daysBetween(today, validThrough(quote)), sentDaysAgo: quote.issuedAt ? daysBetween(quote.issuedAt, today) : null }))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  const receivables = live.map((order) => ({ order, pending: paymentSummary(order).pending }))
    .filter((row) => row.pending > 0)
    .sort((a, b) => Number(b.order.status === 'Entregado') - Number(a.order.status === 'Entregado') || b.pending - a.pending);
  const last = db.meta?.lastBackupAt;
  const backupDays = last ? daysBetween(last, today) : null;
  const hasData = (db.clients || []).length + (db.quotes || []).length + (db.orders || []).length > 0;
  return {
    production,
    late: production.filter((row) => row.days !== null && row.days < 0).length,
    dueSoon: production.filter((row) => row.days !== null && row.days >= 0 && row.days <= SOON_DAYS).length,
    quotes,
    expiringQuotes: quotes.filter((row) => row.days !== null && row.days <= SOON_DAYS).length,
    receivables,
    receivableTotal: receivables.reduce((sum, row) => sum + row.pending, 0),
    lowStock: lowStockMaterials(db),
    backup: { lastAt: last || null, days: backupDays, due: hasData && (backupDays === null || backupDays >= BACKUP_EVERY_DAYS) },
  };
}
