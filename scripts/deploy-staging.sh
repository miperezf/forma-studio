#!/usr/bin/env bash
# Despliega el STAGING (datos ficticios) en Firebase Hosting. Requiere:
#   - .firebaserc con el alias "staging" (copiar .firebaserc.example y poner el ID real)
#   - sesión de Firebase CLI (`npx firebase-tools login`) o credenciales de CI (FIREBASE_TOKEN NO; usar
#     GOOGLE_APPLICATION_CREDENTIALS en CI con una cuenta de servicio limitada a Hosting)
# Uso: scripts/deploy-staging.sh            → canal "live" del proyecto staging
#      scripts/deploy-staging.sh preview    → canal de vista previa temporal (expira en 7 días)
set -euo pipefail
cd "$(dirname "$0")/.."
FIREBASE="npx --yes firebase-tools@15"
[ -f .firebaserc ] || { echo "Falta .firebaserc (copiar de .firebaserc.example)"; exit 1; }
grep -q REEMPLAZAR .firebaserc && { echo ".firebaserc todavía tiene IDs de ejemplo"; exit 1; }

echo "== 1/4 verificación previa"
npm run --silent typecheck
npm run --silent arch
npm run --silent test:beta
echo "== 2/4 build staging (bundle + sitio + firebase.json con CSP)"
node scripts/build-staging.mjs
echo "== 3/4 E2E local sobre los archivos a desplegar, con las cabeceras de firebase.json"
FORMA_SERVE_DIR=dist/staging FORMA_APPLY_FIREBASE_HEADERS=1 python3 apps/beta-web/tests/browser_engine_flow.py
echo "== 4/4 despliegue"
if [ "${1:-}" = "preview" ]; then
  $FIREBASE hosting:channel:deploy qa --expires 7d --project staging
else
  $FIREBASE deploy --only hosting --project staging --message "staging $(node -p "require('./apps/beta-web/package.json').version") $(date -u +%Y-%m-%dT%H:%MZ)"
fi
echo "Ahora verifica la URL publicada:  FORMA_BASE_URL=https://<id>.web.app/ npm run verify:staging"
