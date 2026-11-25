# Desplegar el STAGING (datos ficticios) en Firebase Hosting

**Qué es:** la Beta 0.6.x como sitio estático, sin Auth ni backend. Cualquiera con la URL puede abrirla: **solo datos ficticios**.
Los datos de cada tester quedan en su navegador (no se sincronizan ni respaldan).

## Una sola vez (propietario)
1. Crear el proyecto Firebase de staging (sugerido: `forma-studio-staging`) en la consola de Firebase, plan **Spark** (gratuito; Hosting no
   requiere Blaze). Mantenerlo separado del de producción.
2. `cp .firebaserc.example .firebaserc` y reemplazar `REEMPLAZAR-forma-studio-staging` por el ID real (el archivo no se versiona).

## Opción 1 — desde tu computador (Node 22 + Python 3 con `pip install playwright && python -m playwright install chromium`)
```bash
npm install
npx --yes firebase-tools@15 login          # abre el navegador; el token queda en tu equipo, nunca en el chat
npm run deploy:staging                      # verifica (tsc, arquitectura, tests, build, E2E con CSP) y despliega
FORMA_BASE_URL=https://<id>.web.app/ npm run verify:staging   # E2E contra la URL PUBLICADA
```
Vista previa temporal en vez de `live`: `bash scripts/deploy-staging.sh preview` (canal `qa`, expira en 7 días).

## Opción 2 — GitHub Actions (sin instalar nada local)
1. Subir el repositorio a GitHub (privado).
2. En Firebase: crear cuenta de servicio con rol **Firebase Hosting Admin** solo en staging y descargar su JSON.
3. En GitHub → Settings → Secrets and variables → Actions: secreto `FIREBASE_SERVICE_ACCOUNT_STAGING` (contenido del JSON) y variable
   `FIREBASE_PROJECT_STAGING` (ID). Environment `staging`.
4. Actions → **deploy-staging** → Run workflow. El workflow verifica, despliega y corre el E2E contra la URL publicada.

## Qué valida el E2E sobre la URL publicada
Etiqueta «STAGING · DATOS FICTICIOS» y `noindex`; precio del motor ($48.000 en el caso por defecto); vista del cliente sin datos internos;
guardar borrador; copiar texto sin fugas; impresión solo con datos comerciales; política BLOCK (borrador sí, envío no); recarga con
persistencia; enviar → aceptar + pedido (un pedido); móvil 390 px sin desborde; sin errores de CSP.

## Límites conocidos del staging
Sin control de acceso real (no es «beta privada segura») · persistencia solo local por navegador · sin sincronización ni backup ·
régimen tributario y tratamientos D1/D6 provisionales · importes no aptos para operaciones reales.

## Modo nube (0.7.0): Google Auth + Firestore

En Windows: copiar `app-web-3d-0.7.0.zip` junto a `scripts/windows/CONFIGURAR_NUBE.cmd` y `configurar-nube.ps1` (carpeta `forma-studio`) y ejecutar `CONFIGURAR_NUBE.cmd`. Hace, en orden y deteniéndose ante cualquier fallo bloqueante:

1. Descomprime 0.7.0 e instala dependencias (`firebase` ^12.19, `@firebase/rules-unit-testing` ^5).
2. Verificaciones reales: typecheck, arquitectura R1–R11, tests Beta, Vitest (bloqueantes); ESLint y dependency-cruiser (informativos).
3. Java 21 (winget `Microsoft.OpenJDK.21` si falta) y **pruebas de reglas en el emulador** (`firebase.emulator.json`); si fallan, no se despliega.
4. Correo(s) propietario(s) en `.env.local` (`FORMA_OWNER_EMAILS`, no versionado).
5. App web de Firebase → `firebase/web-config.staging.json` (configuración pública del SDK; no es un secreto).
6. Base Firestore `(default)` en `southamerica-west1` si no existe (la ubicación no se puede cambiar después).
7. **Manual:** habilitar el proveedor Google en Authentication (la consola se abre sola).
8. `node scripts/build-cloud.mjs staging` y `firebase deploy --only hosting,firestore:rules,firestore:indexes`.

Plan gratuito Spark: Auth y Firestore dentro de la cuota gratuita; sin costos recurrentes.
