#!/usr/bin/env bash
# PRODUCCIÓN: bloqueado a propósito hasta cumplir el release gate (docs/DEPLOY_PRODUCTION.md).
# El staging estático actual NO es apto para producción: no tiene Authentication, reglas ni persistencia central.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f docs/releases/RELEASE_GATE_APROBADO ]; then
  echo "Bloqueado: falta docs/releases/RELEASE_GATE_APROBADO (lo crea el propietario tras revisar el checklist de 1.0)."
  exit 1
fi
echo "Release gate presente, pero el pipeline de producción (Gate F/P) aún no existe en este repositorio."
exit 1
