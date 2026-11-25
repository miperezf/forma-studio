#!/usr/bin/env node
// Empaqueta src/app-bridge/beta-bridge.ts (motor + aplicación + customer-quote + zod) para la Beta en JS plano.
//  · apps/beta-web/src/vendor/forma-engine.js       ESM (index.html con <script type="module">, tests de Node)
//  · apps/beta-web/src/vendor/forma-engine.iife.js  IIFE global `FormaEngine` (HTML standalone)
// Requiere esbuild (devDependency). En este entorno se usa el binario preinstalado si existe.
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const candidates = [resolve(root, 'node_modules/esbuild'), '/opt/npm-tools/node_modules/esbuild']
const found = candidates.find((path) => existsSync(path))
if (!found) {
  console.error('esbuild no está instalado: npm install (devDependencies) y reintenta.')
  process.exit(1)
}
const esbuild = require(found)
const common = {
  entryPoints: [resolve(root, 'src/app-bridge/beta-bridge.ts')],
  bundle: true,
  target: 'es2020',
  legalComments: 'none',
  // Rutas estables en los comentarios del bundle aunque node_modules use enlaces simbólicos (build reproducible).
  preserveSymlinks: true,
  banner: { js: '// GENERADO por scripts/build-beta-bridge.mjs desde src/ — no editar a mano.' },
  logLevel: 'info',
}
await esbuild.build({ ...common, format: 'esm', outfile: resolve(root, 'apps/beta-web/src/vendor/forma-engine.js') })
await esbuild.build({ ...common, format: 'iife', globalName: 'FormaEngine', outfile: resolve(root, 'apps/beta-web/src/vendor/forma-engine.iife.js') })
