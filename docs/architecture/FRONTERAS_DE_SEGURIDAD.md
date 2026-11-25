# Fronteras de seguridad

| Frontera | Hoy (0.6.1, staging) | Objetivo 1.0 |
|---|---|---|
| Acceso a la app | **Ninguno**: quien tenga la URL la abre. Por eso solo datos ficticios | Firebase Auth (propietario), rutas protegidas, cierre de sesión |
| Costos internos vs cliente | Construcción (R3/R7) + whitelist + tests de no fuga; almacenamiento local en 2 claves | Además: colecciones separadas con reglas; el cliente nunca recibe la interna |
| Integridad de históricos | Snapshot + replay; UI no edita importes | Reglas: documentos emitidos inmutables; correcciones como eventos |
| Concurrencia | Una sola pestaña; `localStorage` sin transacciones | Transacciones Firestore + ids deterministas/idempotentes |
| Navegador | CSP con hashes, sin `unsafe-inline` en scripts, `frame-ancestors 'none'`, nosniff, no-referrer, HSTS, noindex | Igual, con orígenes de Firebase permitidos en `connect-src` |
| Secretos | Ninguno en el repo; `.env.example`; `.gitignore` | Cuentas de servicio solo en secretos de CI; configuración web del SDK es pública |
| Indexación | `noindex` (meta + cabecera) + `robots.txt` — **no es control de acceso** | Igual en staging; producción con Auth |
