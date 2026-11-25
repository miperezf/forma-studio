#!/usr/bin/env node
// Verificador de arquitectura sin dependencias (solo Node). Complementa a ESLint y dependency-cruiser:
// corre en cualquier entorno y falla con código 1 si se rompe una regla.
//
// Reglas (ver README):
//  R1 core: solo importa core, respetando el orden de capas interno; sin paquetes externos.
//  R2 calculation: solo core/{types,result,validation,money,versioning} y sí mismo; sin paquetes externos.
//  R3 customer-quote: nunca importa calculation (la fuga de costos se corta por construcción).
//  R4 determinismo: sin Date, Math.random, window, document, localStorage, fetch, process, Intl, crypto, console…
//  R5 sin números mágicos (solo 0 y 1) fuera de constants.ts, tests y testing/.
//  R6 sin `any` explícito.
//  R7 customer-quote: solo core/{types,result,validation} y sí mismo; sin paquetes externos.
//  R8 quoting (aplicación): importa calculation y customer-quote SOLO por su index público; único paquete externo: zod.
//  R9 dirección de capas: calculation y customer-quote nunca importan quoting ni app-bridge.
//  R4–R6 también aplican a customer-quote, quoting y workspace-sync (la hora y el almacenamiento se inyectan desde la UI).
//  R10 workspace-sync: puro; solo core y sí mismo; sin paquetes externos.
//  R11 infrastructure/firebase: único lugar donde se importa `firebase/*`; usa módulos solo por su index público;
//      ningún módulo de dominio/aplicación importa infrastructure.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'src')

// ── configuración de reglas ────────────────────────────────────────────────

/** Qué subcarpetas de core puede importar cada subcarpeta de core. */
const CORE_LAYERS = {
  types: [],
  result: [],
  validation: ['result'],
  money: ['types', 'result', 'validation'],
  versioning: ['types', 'result', 'validation', 'money'],
  canonical: ['result'],
  ports: ['versioning'],
}

const CALCULATION_ALLOWED_CORE = ['types', 'result', 'validation', 'money', 'versioning']
const CUSTOMER_QUOTE_ALLOWED_CORE = ['types', 'result', 'validation']
const QUOTING_ALLOWED_PACKAGES = ['zod']
const PUBLIC_INDEX = {
  'src/modules/calculation': 'src/modules/calculation',
  'src/modules/customer-quote': 'src/modules/customer-quote',
}

const FORBIDDEN_IDENTIFIERS = [
  ['Date', /\bDate\b/],
  ['Math.random', /\bMath\s*\.\s*random\b/],
  ['window', /\bwindow\b/],
  ['document', /\bdocument\b/],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['fetch', /\bfetch\b/],
  ['process', /\bprocess\b/],
  ['require', /\brequire\b/],
  ['Intl', /\bIntl\b/],
  ['crypto', /\bcrypto\b/],
  ['setTimeout', /\bsetTimeout\b/],
  ['setInterval', /\bsetInterval\b/],
  ['console', /\bconsole\b/],
  ['performance', /\bperformance\b/],
  ['globalThis', /\bglobalThis\b/],
]

const ALLOWED_NUMBERS = new Set(['0', '1'])

// ── utilidades ─────────────────────────────────────────────────────────────

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const posix = (p) => p.split(sep).join('/')
const isTestFile = (rel) => /\.test\.ts$|\.test-d\.ts$/.test(rel)
const isTestingDir = (rel) => rel.includes('/testing/')
const isConstantsFile = (rel) => rel.endsWith('/constants.ts')

/**
 * Elimina comentarios, cadenas, plantillas (conservando el código de `${...}`) y regex literales.
 * Devuelve el código "desnudo" con la misma estructura de líneas.
 */
function stripNonCode(source) {
  let out = ''
  let i = 0
  const stack = [] // 'code' | 'template' ; el tope es el modo actual; 'brace' cuenta llaves dentro de ${}
  const braces = []
  let mode = 'code'
  const n = source.length
  const prevSignificant = () => {
    for (let k = out.length - 1; k >= 0; k -= 1) {
      const ch = out[k]
      if (ch !== ' ' && ch !== '\n' && ch !== '\t' && ch !== '\r') return ch
    }
    return ''
  }
  while (i < n) {
    const ch = source[i]
    const next = source[i + 1]
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        while (i < n && source[i] !== '\n') i += 1
        continue
      }
      if (ch === '/' && next === '*') {
        i += 2
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
          if (source[i] === '\n') out += '\n'
          i += 1
        }
        i += 2
        continue
      }
      if (ch === "'" || ch === '"') {
        const quote = ch
        i += 1
        while (i < n && source[i] !== quote) {
          if (source[i] === '\\') i += 1
          i += 1
        }
        i += 1
        out += '""'
        continue
      }
      if (ch === '`') {
        stack.push(mode)
        mode = 'template'
        i += 1
        out += '""'
        continue
      }
      if (ch === '/' && '(,=:[!&|?{};'.includes(prevSignificant()) ) {
        // literal de regex
        i += 1
        let inClass = false
        while (i < n && (source[i] !== '/' || inClass)) {
          if (source[i] === '\\') i += 1
          else if (source[i] === '[') inClass = true
          else if (source[i] === ']') inClass = false
          i += 1
        }
        i += 1
        while (i < n && /[a-z]/.test(source[i])) i += 1
        out += '/re/'
        continue
      }
      if (ch === '{' && braces.length > 0) braces[braces.length - 1] += 1
      if (ch === '}' && braces.length > 0) {
        if (braces[braces.length - 1] === 0) {
          braces.pop()
          mode = 'template'
          i += 1
          continue
        }
        braces[braces.length - 1] -= 1
      }
      out += ch
      i += 1
    } else {
      // dentro de una plantilla
      if (ch === '\\') {
        i += 2
        continue
      }
      if (ch === '`') {
        mode = stack.pop() ?? 'code'
        i += 1
        continue
      }
      if (ch === '$' && next === '{') {
        braces.push(0)
        mode = 'code'
        out += ' '
        i += 2
        continue
      }
      if (ch === '\n') out += '\n'
      i += 1
    }
  }
  return out
}

function importsOf(source) {
  const found = []
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1])
  }
  return found
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

// ── verificación ───────────────────────────────────────────────────────────

const violations = []
const add = (rule, rel, line, message) => violations.push({ rule, rel, line, message })

const files = walk(srcDir).map((full) => ({ full, rel: posix(relative(root, full)) }))
let scanned = 0

for (const { full, rel } of files) {
  const zoneCore = rel.startsWith('src/core/')
  const zoneCalculation = rel.startsWith('src/modules/calculation/')
  const zoneCustomerQuote = rel.startsWith('src/modules/customer-quote/')
  const zoneQuoting = rel.startsWith('src/modules/quoting/')
  const zoneSync = rel.startsWith('src/modules/workspace-sync/')
  const zoneFirebase = rel.startsWith('src/infrastructure/firebase/')
  const pure = zoneCore || zoneCalculation || zoneCustomerQuote || zoneQuoting || zoneSync
  const raw = readFileSync(full, 'utf8')
  const code = stripNonCode(raw)
  const test = isTestFile(rel)
  scanned += 1

  // imports (en el texto original para conservar rutas; los comentarios no importan aquí)
  for (const spec of importsOf(code.replace(/""/g, '""'))) {
    void spec
  }
  for (const spec of importsOf(raw)) {
    const relative_ = spec.startsWith('.')
    if (!relative_) {
      if ((zoneCore || zoneCalculation || zoneCustomerQuote) && !test && !isTestingDir(rel)) {
        add(zoneCustomerQuote ? 'R7' : 'R1/R2', rel, 0, `paquete externo no permitido en el dominio: "${spec}"`)
      }
      if (zoneSync && !test) add('R10', rel, 0, `workspace-sync no puede usar paquetes externos: "${spec}"`)
      if (spec === 'firebase' || spec.startsWith('firebase/') || spec.startsWith('@firebase/')) {
        if (!zoneFirebase && !test) add('R11', rel, 0, `solo infrastructure/firebase puede importar Firebase: "${spec}"`)
      } else if (zoneFirebase && !test) {
        add('R11', rel, 0, `infrastructure/firebase solo admite paquetes firebase/*: "${spec}"`)
      }
      if (zoneQuoting && !test && !QUOTING_ALLOWED_PACKAGES.includes(spec)) {
        add('R8', rel, 0, `quoting solo puede usar los paquetes ${QUOTING_ALLOWED_PACKAGES.join(', ')}: "${spec}"`)
      }
      continue
    }
    const target = posix(relative(root, resolve(dirname(full), spec)))
    if (zoneCore && !test) {
      if (!target.startsWith('src/core/')) {
        add('R1', rel, 0, `core no puede importar fuera de core: "${spec}"`)
        continue
      }
      const from = rel.split('/')[2]
      const to = target.split('/')[2]
      if (from !== undefined && to !== undefined && from !== to) {
        const allowed = CORE_LAYERS[from]
        if (allowed === undefined) add('R1', rel, 0, `subcarpeta de core desconocida: ${from}`)
        else if (!allowed.includes(to)) add('R1', rel, 0, `core/${from} no puede importar core/${to} ("${spec}")`)
      }
    }
    if (zoneCalculation && !test && !isTestingDir(rel)) {
      if (target.startsWith('src/core/')) {
        const to = target.split('/')[2]
        if (!CALCULATION_ALLOWED_CORE.includes(to)) {
          add('R2', rel, 0, `calculation no puede importar core/${to} ("${spec}")`)
        }
      } else if (!target.startsWith('src/modules/calculation/')) {
        add('R2', rel, 0, `calculation solo puede importar core permitido y a sí mismo: "${spec}"`)
      }
    }
    if (zoneCustomerQuote && (target === 'src/modules/calculation' || target.startsWith('src/modules/calculation/'))) {
      add('R3', rel, 0, `customer-quote no puede importar calculation: "${spec}"`)
    }
    if (zoneCustomerQuote && !test) {
      if (target.startsWith('src/core/')) {
        if (!CUSTOMER_QUOTE_ALLOWED_CORE.includes(target.split('/')[2])) add('R7', rel, 0, `customer-quote no puede importar ${target}`)
      } else if (!target.startsWith('src/modules/customer-quote/')) {
        add('R7', rel, 0, `customer-quote solo puede importar core permitido y a sí mismo: "${spec}"`)
      }
    }
    if ((zoneCalculation || zoneCustomerQuote) && (target.startsWith('src/modules/quoting') || target.startsWith('src/app-bridge'))) {
      add('R9', rel, 0, `las capas internas no pueden importar la aplicación: "${spec}"`)
    }
    if (zoneSync && !test && !target.startsWith('src/core/') && !target.startsWith('src/modules/workspace-sync/')) {
      add('R10', rel, 0, `workspace-sync solo puede importar core y a sí mismo: "${spec}"`)
    }
    if ((pure || rel.startsWith('src/modules/')) && target.startsWith('src/infrastructure')) {
      add('R11', rel, 0, `los módulos no pueden importar infraestructura: "${spec}"`)
    }
    if (zoneFirebase && !test && target.startsWith('src/modules/') && !/^src\/modules\/[^/]+$/.test(target)) {
      add('R11', rel, 0, `infrastructure debe usar los módulos por su index público: "${spec}"`)
    }
    if (zoneQuoting && !test) {
      for (const [moduleDir, index] of Object.entries(PUBLIC_INDEX)) {
        if (target.startsWith(moduleDir + '/') && target !== index + '/index') {
          add('R8', rel, 0, `quoting debe importar ${moduleDir} por su index público: "${spec}"`)
        }
      }
      if (!target.startsWith('src/core/') && !target.startsWith('src/modules/quoting/') && !Object.values(PUBLIC_INDEX).includes(target)) {
        add('R8', rel, 0, `quoting no puede importar "${spec}"`)
      }
    }
  }

  if (pure && !test && !isTestingDir(rel)) {
    // R4 determinismo / sin entorno
    for (const [name, pattern] of FORBIDDEN_IDENTIFIERS) {
      const match = pattern.exec(code)
      if (match) add('R4', rel, lineOf(code, match.index), `identificador no permitido en el dominio: ${name}`)
    }
    // R6 sin any
    const anyMatch = /(?::|\bas|<)\s*any\b/.exec(code)
    if (anyMatch) add('R6', rel, lineOf(code, anyMatch.index), 'uso explícito de `any`')
    // R5 números mágicos
    if (!isConstantsFile(rel)) {
      const numberPattern = /(?<![\w.$])(\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)(?![\w.])/gi
      for (const match of code.matchAll(numberPattern)) {
        if (!ALLOWED_NUMBERS.has(match[1])) {
          add('R5', rel, lineOf(code, match.index), `número mágico ${match[1]} (muévalo a constants.ts)`)
        }
      }
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) {
    console.error(`✗ [${v.rule}] ${v.rel}${v.line ? `:${String(v.line)}` : ''} — ${v.message}`)
  }
  console.error(`\n${String(violations.length)} violación(es) en ${String(scanned)} archivos.`)
  process.exit(1)
}
console.log(`✓ Arquitectura OK: ${String(scanned)} archivos revisados, 0 violaciones (R1–R11).`)
