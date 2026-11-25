// Guardia rápida (sin dependencias) de reglas de ESLint que ya fallaron antes en el PC y no se pueden correr sin
// `npm install`: hoy, @typescript-eslint/no-dynamic-delete. No reemplaza a ESLint; evita repetir el mismo error.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirs = ['src', 'apps/beta-web/src', 'apps/beta-web/tests']
const skip = /node_modules|[\\/]dist[\\/]|[\\/]vendor[\\/]/
const files = []
const walk = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (skip.test(path)) continue; if (statSync(path).isDirectory()) walk(path); else if (/\.(m?js|ts)$/.test(name)) files.push(path) } }
dirs.forEach((dir) => walk(resolve(root, dir)))
const problems = []
for (const file of files) {
  readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
    if (/\bdelete\s+[\w$.]+\s*\[/.test(line)) problems.push(`${relative(root, file)}:${index + 1} — delete con clave calculada (usa Reflect.deleteProperty)`)
  })
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log(`✓ lint-guard: ${files.length} archivos sin delete dinámico`)
