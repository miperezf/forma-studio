#!/usr/bin/env node
// Build con NUBE (Firebase Auth + Firestore) para staging o producción.
// Uso: node scripts/build-cloud.mjs <staging|production>
// Requiere: dependencias instaladas (firebase, esbuild), firebase/web-config.<env>.json (configuración web PÚBLICA del
// SDK, la genera CONFIGURAR_NUBE) y .env.local con FORMA_OWNER_EMAILS=correo1,correo2 (no se versiona).
// Genera: apps/beta-web/dist/<env>/{index.html,robots.txt}, firestore.rules (desde la plantilla) y firebase.json.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.argv[2]
if (env !== 'staging' && env !== 'production') throw new Error('Uso: node scripts/build-cloud.mjs <staging|production>')
const fail = (message) => { console.error(`✗ ${message}`); process.exit(1) }

// 1 · configuración pública del SDK y propietarios
const configPath = resolve(root, `firebase/web-config.${env}.json`)
if (!existsSync(configPath)) fail(`Falta ${configPath} (lo genera CONFIGURAR_NUBE con firebase apps:sdkconfig).`)
const webConfig = JSON.parse(readFileSync(configPath, 'utf8'))
for (const key of ['apiKey', 'authDomain', 'projectId', 'appId']) if (typeof webConfig[key] !== 'string' || webConfig[key] === '') fail(`web-config sin ${key}`)
const envLocal = existsSync(resolve(root, '.env.local')) ? readFileSync(resolve(root, '.env.local'), 'utf8') : ''
const owners = (/^FORMA_OWNER_EMAILS=(.*)$/m.exec(envLocal)?.[1] ?? process.env.FORMA_OWNER_EMAILS ?? '')
  .split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
if (owners.length === 0) fail('Define FORMA_OWNER_EMAILS en .env.local (correo(s) de Google autorizados).')
for (const email of owners) if (!/^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/.test(email)) fail(`Correo inválido: ${email}`)

// 2 · reglas desde la plantilla
const template = readFileSync(resolve(root, 'firebase/firestore.rules.template'), 'utf8')
if (template.split('__OWNER_EMAILS__').length !== 2) fail('La plantilla de reglas debe tener exactamente un __OWNER_EMAILS__')
const rulesText = template.replaceAll('__OWNER_EMAILS__', owners.map((email) => `'${email}'`).join(', '))
if (rulesText.includes('__OWNER_EMAILS__')) fail('Quedó un marcador sin reemplazar en firestore.rules')
writeFileSync(resolve(root, 'firestore.rules'), rulesText)

// 3 · bundles: motor/aplicación (ya existente) + Firebase (IIFE global FormaFirebase)
execFileSync(process.execPath, [resolve(root, 'scripts/build-beta-bridge.mjs')], { stdio: 'inherit' })
const require = createRequire(import.meta.url)
const esbuild = require(resolve(root, 'node_modules/esbuild'))
const firebaseBundle = resolve(root, `apps/beta-web/dist/.build/forma-firebase.${env}.iife.js`)
mkdirSync(dirname(firebaseBundle), { recursive: true })
await esbuild.build({
  entryPoints: [resolve(root, 'src/app-bridge/firebase-bridge.ts')],
  bundle: true, format: 'iife', globalName: 'FormaFirebase', target: 'es2020', legalComments: 'none',
  minify: true, preserveSymlinks: true, outfile: firebaseBundle, logLevel: 'info',
})

// 4 · sitio de archivo único (mismo HTML de la Beta) + bundle Firebase + configuración pública
const label = env === 'production' ? 'FORMA STUDIO' : 'STAGING · DATOS FICTICIOS'
execFileSync(process.execPath, [resolve(root, 'apps/beta-web/scripts/build-standalone.mjs'), `--env=${env}`, `--label=${label}`], { stdio: 'inherit' })
const outDir = resolve(root, `apps/beta-web/dist/${env}`)
const indexPath = resolve(outDir, 'index.html')
let html = readFileSync(indexPath, 'utf8')
const cloudScript = `<script>window.FORMA_FIREBASE_CONFIG=${JSON.stringify(webConfig)};</script><script>${readFileSync(firebaseBundle, 'utf8').replaceAll('</script>', '<\\/script>')}</script>`
html = html.replace('<script>window.FORMA_ENV=', () => `${cloudScript}<script>window.FORMA_ENV=`)
writeFileSync(indexPath, html)

// 5 · firebase.json con CSP por hashes (los scripts en línea) y orígenes de Google mínimos para Auth/Firestore
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`)
const authOrigin = `https://${webConfig.authDomain}`
const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')} https://apis.google.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com",
  `frame-src ${authOrigin} https://accounts.google.com https://apis.google.com`,
  "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ')
const security = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Permite la ventana emergente de inicio de sesión de Google sin abrir el contexto de la app a otros orígenes.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  ...(env === 'staging' ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
]
const firebaseJson = {
  hosting: {
    public: `apps/beta-web/dist/${env}`,
    ignore: ['firebase.json', '**/.*'],
    cleanUrls: true,
    headers: [
      { source: '**', headers: security },
      { source: '/', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '**/*.html', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ],
  },
  firestore: { rules: 'firestore.rules', indexes: 'firebase/firestore.indexes.json' },
  emulators: { firestore: { port: 8080 }, ui: { enabled: false }, singleProjectMode: true },
}
writeFileSync(resolve(root, 'firebase.json'), JSON.stringify(firebaseJson, null, 2) + '\n')
console.log(`✓ Build ${env}: ${indexPath} · reglas para ${owners.length} propietario(s) · CSP con ${hashes.length} hash(es)`)
