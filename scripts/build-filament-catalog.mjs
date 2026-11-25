// Genera el catálogo de filamentos de FORMA a partir de Open Filament Database (MIT, © Open Filament Collective).
// Uso: node scripts/build-filament-catalog.mjs <ruta-al-repo-open-filament-database> [commit]
//   git clone --depth 1 https://github.com/OpenFilamentCollective/open-filament-database ofd
// Salida: apps/beta-web/src/data/filament-catalog.js (instantánea VERSIONADA; la app no consulta la API en línea:
// funciona sin conexión, con la CSP estricta y con datos reproducibles).
// Criterio: marcas que se venden en Chile (lista abajo), filamento FFF de 1,75 mm, sin discontinuados.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Marcas incluidas (id de carpeta en OFD). Cambiar aquí y regenerar. */
export const BRANDS = ['bambu_lab', 'esun_3d', 'elegoo', 'creality', 'polymaker', 'sunlu', 'jayo', 'anycubic', 'kingroon', 'eryone']
const DIAMETER = 1.75
/** Rasgos de la variante útiles para inventario/cotización (los demás se omiten para no inflar el archivo). */
const TRAITS = ['matte', 'silk', 'translucent', 'transparent', 'glow', 'glitter', 'metal', 'imitates_wood', 'imitates_marble', 'imitates_metal', 'imitates_stone', 'gradual_color_change', 'coextruded', 'abrasive', 'high_flow', 'high_temperature', 'recycled']

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ofd = process.argv[2] ? resolve(process.argv[2]) : ''
const commit = (process.argv[3] ?? '').slice(0, 12)
if (!ofd || !existsSync(join(ofd, 'data'))) {
  console.error('Uso: node scripts/build-filament-catalog.mjs <repo open-filament-database> [commit]')
  process.exit(1)
}
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const dirs = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [])
const int = (value) => (Number.isFinite(value) ? Math.round(value) : null)
const num = (value) => (Number.isFinite(value) ? value : null)
const text = (value, max = 120) => (typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null)
const hexOf = (value) => {
  const list = (Array.isArray(value) ? value : [value]).filter((h) => typeof h === 'string' && /^#?[0-9a-fA-F]{6}$/.test(h)).map((h) => (h.startsWith('#') ? h : `#${h}`).toUpperCase())
  return list
}
const range = (min, max) => (min === null && max === null ? null : [min, max])
const genericTemps = (settings) => settings?.generic ?? null

const brands = []
const lines = []
let colorCount = 0
for (const brandId of BRANDS) {
  const brandPath = join(ofd, 'data', brandId)
  if (!existsSync(join(brandPath, 'brand.json'))) throw Error(`Marca ${brandId} no encontrada en ${ofd}`)
  const brand = readJson(join(brandPath, 'brand.json'))
  const brandIndex = brands.length
  brands.push({ id: brandId, name: text(brand.name, 60), origin: text(brand.origin, 4) })
  for (const materialDir of dirs(brandPath)) {
    const materialFile = join(brandPath, materialDir, 'material.json')
    if (!existsSync(materialFile)) continue
    const material = readJson(materialFile)
    if (material.material_class && material.material_class !== 'FFF') continue
    const materialType = text(material.material, 20) ?? materialDir
    for (const filamentDir of dirs(join(brandPath, materialDir))) {
      const filamentFile = join(brandPath, materialDir, filamentDir, 'filament.json')
      if (!existsSync(filamentFile)) continue
      const filament = readJson(filamentFile)
      if (filament.discontinued) continue
      const generic = genericTemps(filament.slicer_settings) ?? genericTemps(material.default_slicer_settings)
      const colors = []
      for (const variantDir of dirs(join(brandPath, materialDir, filamentDir))) {
        const base = join(brandPath, materialDir, filamentDir, variantDir)
        if (!existsSync(join(base, 'variant.json')) || !existsSync(join(base, 'sizes.json'))) continue
        const variant = readJson(join(base, 'variant.json'))
        if (variant.discontinued) continue
        const sizes = readJson(join(base, 'sizes.json'))
          .filter((s) => s && s.diameter === DIAMETER && !s.discontinued && Number.isFinite(s.filament_weight) && s.filament_weight > 0)
          .map((s) => [int(s.filament_weight), text(s.gtin ?? s.ean, 14), int(s.empty_spool_weight), s.spool_refill ? 1 : 0])
        if (sizes.length === 0) continue
        const unique = [...new Map(sizes.map((s) => [`${s[0]}|${s[3]}`, s])).values()].sort((a, b) => a[0] - b[0] || a[3] - b[3])
        const traits = TRAITS.filter((t) => variant.traits?.[t] === true)
        const hex = hexOf(variant.color_hex)
        colors.push([text(variant.id, 60), text(variant.name, 60) ?? variant.id, hex[0] ?? null, unique, traits.length ? traits : 0, hex.length > 1 ? hex.slice(1, 4) : 0])
      }
      if (colors.length === 0) continue
      colorCount += colors.length
      lines.push({
        id: `${brandId}/${materialDir}/${filamentDir}`,
        b: brandIndex,
        m: materialType,
        n: text(filament.name, 80) ?? filamentDir,
        d: num(filament.density),
        nz: range(int(filament.min_print_temperature ?? generic?.nozzle_temp), int(filament.max_print_temperature ?? generic?.nozzle_temp)),
        bd: range(int(filament.min_bed_temperature ?? generic?.bed_temp), int(filament.max_bed_temperature ?? generic?.bed_temp)),
        dry: int(filament.max_dry_temperature ?? material.default_max_dry_temperature),
        ds: text(filament.data_sheet_url, 300),
        c: colors,
      })
    }
  }
}

const catalog = {
  meta: {
    source: 'Open Filament Database',
    url: 'https://openfilamentdatabase.org',
    license: 'MIT © Open Filament Collective',
    commit: commit || null,
    generatedAt: new Date().toISOString().slice(0, 10),
    diameter: DIAMETER,
    brands: brands.length,
    lines: lines.length,
    colors: colorCount,
    // Formato compacto: c = [idColor, nombre, hex, tamaños[[gramos, gtin, carreteVacío_g, recarga]], rasgos|0, hexExtra|0]
  },
  brands,
  lines,
}
const out = resolve(root, 'apps/beta-web/src/data/filament-catalog.js')
writeFileSync(out, `// GENERADO por scripts/build-filament-catalog.mjs — no editar a mano.\n// Datos: Open Filament Database (https://openfilamentdatabase.org), licencia MIT © Open Filament Collective.\nexport const FILAMENT_CATALOG = ${JSON.stringify(catalog)};\n`)
console.log(`✓ Catálogo: ${brands.length} marcas · ${lines.length} líneas · ${colorCount} colores → ${out} (${Math.round(readFileSync(out).length / 1024)} KB)`)
