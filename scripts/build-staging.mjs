#!/usr/bin/env node
// Build reproducible del sitio STAGING (datos ficticios) para Firebase Hosting:
//  1. motor + aplicación → bundle (esbuild)      2. sitio de archivo único en apps/beta-web/dist/staging
//  3. firebase.json con cabeceras de seguridad y CSP con hashes SHA-256 de los scripts en línea (sin 'unsafe-inline').
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const run = (script, ...args) => execFileSync(process.execPath, [resolve(root, script), ...args], { stdio: 'inherit' })
run('scripts/build-beta-bridge.mjs')
run('apps/beta-web/scripts/build-standalone.mjs', '--env=staging')

const publicDir = 'apps/beta-web/dist/staging'
const html = readFileSync(resolve(root, publicDir, 'index.html'), 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1])
if (scripts.length === 0) throw new Error('No se encontraron scripts en línea')
const hashes = scripts.map((code) => `'sha256-${createHash('sha256').update(code, 'utf8').digest('base64')}'`)
const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const firebase = {
  hosting: {
    public: publicDir,
    ignore: ['firebase.json', '**/.*'],
    cleanUrls: true,
    headers: [
      {
        source: '**',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          // Evita indexación casual. NO es control de acceso: la URL es pública para quien la conozca.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // La raíz y el HTML se revalidan siempre (cleanUrls sirve index.html en '/'): un despliegue nuevo se ve de inmediato.
      { source: '/', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '**/*.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ],
  },
}
writeFileSync(resolve(root, 'firebase.json'), JSON.stringify(firebase, null, 2) + '\n')
console.log(`firebase.json generado (${String(hashes.length)} hash(es) CSP) → público: ${publicDir}`)
