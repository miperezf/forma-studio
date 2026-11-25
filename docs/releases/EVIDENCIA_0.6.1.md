# Evidencia de verificación — 0.6.1 (2026-10-20, entorno sin registro npm)

| Comando | Resultado observado |
|---|---|
| `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit` (TS 6.0.3) | 0 errores |
| `node scripts/check-architecture.mjs` | 151 archivos, 0 violaciones R1–R9 |
| `node --import tsx --test "src/**/*.test.ts"` **(shim local, NO Vitest)** | 947/947 |
| `npm run test:beta` (node:test real) | 53/53 |
| `npm run e2e` (Playwright 1.56 + Chromium) | 4/4 scripts OK |
| `npm run e2e:staging` (sitio `dist/staging` + cabeceras/CSP de `firebase.json`) | OK |
| Control negativo CSP (hash adulterado) | la app no arranca ⇒ la CSP se aplica |
| E2E de la variante `preview` envuelta como en el visor de claude.ai | OK |
| Publicación vista previa claude.ai | contenido publicado contiene el archivo local íntegro (457.987 bytes, sha256 `12737071…`) |
| `curl https://registry.npmjs.org/…` / `https://firebasehosting.googleapis.com/` | ENOTFOUND / 403 del proxy |
| Vitest · ESLint · dependency-cruiser · fast-check · tsd · emulador Firebase | **no ejecutados** |
