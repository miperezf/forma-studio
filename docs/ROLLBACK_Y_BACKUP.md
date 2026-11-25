# Rollback y respaldo

## Staging (hoy)
- **Rollback de Hosting:** consola de Firebase → Hosting → historial de versiones → «Revertir», o
  `npx firebase-tools@15 hosting:clone <id-staging>:live@<versión-anterior> <id-staging>:live`.
- **Reconstruir una versión exacta:** el build es reproducible: mismo commit ⇒ mismo `forma-engine.js` (verificado por hash) y mismo
  `firebase.json` (CSP por hashes).
- **Datos:** viven en el navegador de cada tester. Respaldo manual desde la consola del navegador:
  `copy(JSON.stringify({i:localStorage.getItem('forma-studio:internal:v2'),c:localStorage.getItem('forma-studio:customer:v2')}))`.
  Restaurar: `localStorage.setItem('forma-studio:internal:v2', …)` y lo mismo para `customer`, luego recargar.
- **Migración 0.5.2:** la clave `app-web-3d-beta-v1` nunca se borra; para remigrar, borrar las dos claves v2 y recargar.

## 1.0 (objetivo, Gate F/P)
Export programado de Firestore a un bucket (requiere plan Blaze: **costo nuevo, decisión del propietario**), retención definida por el
propietario, restauración probada en un proyecto de ensayo, y rollback de Hosting por versión. Las correcciones de importes se
registran como eventos/asientos, nunca como edición de documentos emitidos.
