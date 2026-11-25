/**
 * Catálogo de filamentos (instantánea de Open Filament Database) y alta/edición de materiales a partir de él.
 * Puro: sin DOM. La UI elige marca → material → línea → color → formato; el operador solo digita el precio pagado
 * por carrete y cuántos carretes tiene. El motor sigue recibiendo `priceKg` (no cambia el cálculo de precios).
 */
import { FILAMENT_CATALOG } from '../data/filament-catalog.js';

export const CATALOG_SOURCE = 'OFD';
const MAX_SPOOLS = 10000;
const MAX_PRICE = 10_000_000;

const byBrand = new Map();
const byLine = new Map();
for (const line of FILAMENT_CATALOG.lines) {
  const brand = FILAMENT_CATALOG.brands[line.b];
  if (!byBrand.has(brand.id)) byBrand.set(brand.id, []);
  byBrand.get(brand.id).push(line);
  byLine.set(line.id, line);
}
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export const catalogMeta = () => FILAMENT_CATALOG.meta;

export function catalogBrands() {
  return FILAMENT_CATALOG.brands.map((brand) => ({ id: brand.id, name: brand.name })).sort((a, b) => collator.compare(a.name, b.name));
}

export function catalogMaterialTypes(brandId) {
  const counts = new Map();
  for (const line of byBrand.get(brandId) ?? []) counts.set(line.m, (counts.get(line.m) ?? 0) + line.c.length);
  // Primero los más comunes (más colores), luego alfabético.
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0])).map(([type]) => type);
}

export function catalogLines(brandId, materialType) {
  return (byBrand.get(brandId) ?? []).filter((line) => line.m === materialType)
    .map((line) => ({ id: line.id, name: line.n, colors: line.c.length }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

export function catalogColors(lineId) {
  const line = byLine.get(lineId);
  if (!line) return [];
  return line.c.map(([id, name, hex, , traits]) => ({ id, name, hex, traits: traits || [] })).sort((a, b) => collator.compare(a.name, b.name));
}

/** Formatos de carrete de un color: gramos netos, recarga o carrete, gtin y peso del carrete vacío. */
export function catalogSizes(lineId, colorId) {
  const color = byLine.get(lineId)?.c.find((entry) => entry[0] === colorId);
  if (!color) return [];
  return color[3].map(([grams, gtin, emptySpool, refill]) => ({ key: `${grams}${refill ? 'R' : ''}`, grams, gtin: gtin || null, emptySpoolG: emptySpool ?? null, refill: refill === 1 }));
}

const TRAIT_LABELS = {
  matte: 'mate', silk: 'seda', translucent: 'translúcido', transparent: 'transparente', glow: 'brilla en la oscuridad', glitter: 'brillantina',
  imitates_wood: 'efecto madera', imitates_marble: 'efecto mármol', imitates_metal: 'efecto metal', imitates_stone: 'efecto piedra',
  gradual_color_change: 'degradado', coextruded: 'multicolor', abrasive: 'abrasivo (boquilla endurecida)', high_flow: 'alta velocidad',
  high_temperature: 'alta temperatura', recycled: 'reciclado', metal: 'metálico',
};
export const traitLabel = (trait) => TRAIT_LABELS[trait] ?? trait;

/** Ficha técnica completa de una selección, o null si no existe en el catálogo. */
export function catalogEntry({ lineId, colorId, sizeKey }) {
  const line = byLine.get(lineId);
  const color = line?.c.find((entry) => entry[0] === colorId);
  const size = color ? catalogSizes(lineId, colorId).find((entry) => entry.key === sizeKey) : null;
  if (!line || !color || !size) return null;
  const brand = FILAMENT_CATALOG.brands[line.b];
  return {
    brandId: brand.id, brand: brand.name, type: line.m, lineId: line.id, line: line.n,
    colorId: color[0], color: color[1], hex: color[2] || '#CCCCCC', extraHex: color[5] || [], traits: color[4] || [],
    density: line.d, nozzleC: line.nz, bedC: line.bd, maxDryC: line.dry, dataSheetUrl: line.ds,
    diameter: FILAMENT_CATALOG.meta.diameter, spoolNetG: size.grams, emptySpoolG: size.emptySpoolG, gtin: size.gtin, refill: size.refill, sizeKey: size.key,
  };
}

const finiteNumber = (value) => (value === '' || value === null || value === undefined ? NaN : Number(value));

/**
 * Construye los campos del material desde el catálogo + datos de compra/inventario del operador.
 * - pricePerSpool: CLP pagados por un carrete (con IVA si así aparece en la boleta: D1, el IVA no se recupera).
 * - spools: carretes cerrados; openRemainingG: gramos restantes del carrete abierto (opcional).
 * Devuelve los campos que guarda la app; `priceKg` y `stockKg` son los que usa el cotizador.
 */
export function materialFromCatalog(selection, { pricePerSpool, spools, openRemainingG = 0 } = {}) {
  const entry = catalogEntry(selection);
  if (!entry) throw Error('Elige marca, material, línea, color y formato del catálogo.');
  const price = finiteNumber(pricePerSpool);
  const closed = finiteNumber(spools);
  const open = openRemainingG === '' ? 0 : finiteNumber(openRemainingG);
  if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) throw Error('Indica el precio pagado por carrete (mayor a $0).');
  if (!Number.isInteger(closed) || closed < 0 || closed > MAX_SPOOLS) throw Error('Indica cuántos carretes cerrados tienes (número entero, 0 o más).');
  if (!Number.isFinite(open) || open < 0 || open > entry.spoolNetG) throw Error(`El carrete abierto debe tener entre 0 y ${entry.spoolNetG} g.`);
  const stockG = closed * entry.spoolNetG + open;
  return {
    name: `${entry.line} ${entry.color}`.slice(0, 80),
    brand: entry.brand,
    type: entry.type,
    color: entry.color.slice(0, 40),
    hex: /^#[0-9A-F]{6}$/i.test(entry.hex) ? entry.hex : '#CCCCCC',
    priceKg: Math.round((price * 1000) / entry.spoolNetG),
    stockKg: Math.round(stockG) / 1000,
    pricePerSpool: Math.round(price),
    spools: closed,
    openRemainingG: Math.round(open),
    spoolNetG: entry.spoolNetG,
    emptySpoolG: entry.emptySpoolG,
    gtin: entry.gtin,
    diameter: entry.diameter,
    density: entry.density,
    nozzleC: entry.nozzleC,
    bedC: entry.bedC,
    maxDryC: entry.maxDryC,
    traits: entry.traits,
    dataSheetUrl: entry.dataSheetUrl,
    catalogRef: { source: CATALOG_SOURCE, lineId: entry.lineId, colorId: entry.colorId, sizeKey: entry.sizeKey, snapshot: FILAMENT_CATALOG.meta.generatedAt },
  };
}

/** Selección guardada de un material (para reabrir el formulario de edición con todo preseleccionado). */
export function selectionOf(material) {
  const ref = material?.catalogRef;
  if (!ref || ref.source !== CATALOG_SOURCE || !byLine.has(ref.lineId)) return null;
  const line = byLine.get(ref.lineId);
  return { brandId: FILAMENT_CATALOG.brands[line.b].id, type: line.m, lineId: ref.lineId, colorId: ref.colorId, sizeKey: ref.sizeKey };
}
