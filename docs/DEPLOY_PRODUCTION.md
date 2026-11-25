# Producción (FORMA Studio 1.0) — checklist de release gate

`npm run deploy:production` se niega a correr mientras no exista `docs/releases/RELEASE_GATE_APROBADO` y el pipeline de Gate F/P.
**El staging estático no es apto para producción.**

Condiciones bloqueantes (todas deben estar ✅ con evidencia en `docs/releases/`):
- [ ] Proyecto Firebase **production** independiente (Auth, Firestore, Hosting; Storage si se usa), región decidida.
- [ ] Auth propietario (y operador si P-1), denegación por defecto, cierre de sesión, rutas protegidas.
- [ ] Reglas Firestore/Storage desplegadas y probadas en emulador (acceso no autorizado, lectura de costos por operador/cliente, inmutabilidad de emitidas).
- [ ] InternalQuote y CustomerQuote en colecciones separadas; exportadores solo desde CustomerQuote.
- [ ] Aceptar + pedido y pagos idempotentes probados con dos sesiones concurrentes y reintentos.
- [ ] Migración local → Firestore probada; datos demo marcados y no contados como ventas.
- [ ] Backup programado (export de Firestore) y restauración probada.
- [ ] CI verde con Vitest, ESLint, dependency-cruiser, fast-check, tsd, E2E.
- [ ] D1, D2 y D6 aprobados por el propietario (con su contador para D2).
- [ ] Presupuesto y alertas de consumo configurados; monitoreo de errores; runbook y rollback probados.
- [ ] Publicación con tag, verificación de la URL con cuenta autorizada y prueba de acceso indebido.
