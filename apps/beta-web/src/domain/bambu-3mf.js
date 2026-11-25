/**
 * Lector de proyectos LAMINADOS de Bambu Studio (.gcode.3mf). Puro: recibe los bytes del archivo y una función
 * `inflateRaw(bytes) → Promise<Uint8Array>` (navegador: DecompressionStream; Node: zlib). No usa red ni librerías.
 *
 * Lee solo tres entradas del ZIP:
 *  - Metadata/slice_info.config   → por placa: tiempo estimado (s), peso (g), objetos y gramos/metros POR FILAMENTO;
 *  - Metadata/project_settings.config → impresora y perfiles de filamento (tipo, color, marca, nombre);
 *  - 3D/3dmodel.model             → título del modelo (metadato «Title»).
 * Los gramos por filamento ya incluyen purga y torre de limpieza (así los informa Bambu Studio).
 */
const SIG_EOCD = 0x06054b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_U32 = 0xffffffff;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const WANTED = ['Metadata/slice_info.config', 'Metadata/project_settings.config', '3D/3dmodel.model'];

export const NOT_SLICED_MESSAGE = 'Este archivo no tiene placas laminadas. En Bambu Studio: «Laminar todas las placas» y luego Archivo → Exportar → «Exportar todas las placas laminadas» (.gcode.3mf).';
export const NOT_3MF_MESSAGE = 'El archivo no es un proyecto de Bambu Studio (.3mf / .gcode.3mf).';

/** Códigos de impresora de slice_info (printer_model_id) → nombre comercial. */
const PRINTER_MODELS = { N1: 'Bambu Lab A1 mini', N2S: 'Bambu Lab A1', C11: 'Bambu Lab P1P', C12: 'Bambu Lab P1S', 'BL-P001': 'Bambu Lab X1 Carbon', 'BL-P002': 'Bambu Lab X1', C13: 'Bambu Lab X1E', N7: 'Bambu Lab P2S', O1D: 'Bambu Lab H2D' };

const fail = (message) => { const error = Error(message); error.code = 'BAMBU_3MF'; return error; };

/** Entradas pedidas del ZIP (nombre → bytes descomprimidos). Lanza si no es un ZIP válido. */
export async function readZipEntries(bytes, names, inflateRaw) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (at) => view.getUint16(at, true);
  const u32 = (at) => view.getUint32(at, true);
  const u64 = (at) => u32(at) + u32(at + 4) * 2 ** 32;
  if (data.length < 22) throw fail(NOT_3MF_MESSAGE);
  let eocd = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 22 - 65535); at--) if (u32(at) === SIG_EOCD) { eocd = at; break; }
  if (eocd < 0) throw fail(NOT_3MF_MESSAGE);
  let count = u16(eocd + 10);
  let cdOffset = u32(eocd + 16);
  // ZIP64: el localizador está justo antes del registro final.
  if ((cdOffset === MAX_U32 || count === 0xffff) && eocd >= 20 && u32(eocd - 20) === SIG_EOCD64_LOCATOR) {
    const at64 = u64(eocd - 20 + 8);
    if (at64 + 56 > data.length || u32(at64) !== SIG_EOCD64) throw fail(NOT_3MF_MESSAGE);
    count = u64(at64 + 32);
    cdOffset = u64(at64 + 48);
  }
  const wanted = new Set(names);
  const out = new Map();
  let at = cdOffset;
  const decoder = new TextDecoder();
  for (let i = 0; i < count && at + 46 <= data.length; i++) {
    if (u32(at) !== SIG_CENTRAL) throw fail(NOT_3MF_MESSAGE);
    const method = u16(at + 10);
    let compressed = u32(at + 20);
    let size = u32(at + 24);
    const nameLength = u16(at + 28), extraLength = u16(at + 30), commentLength = u16(at + 32);
    let local = u32(at + 42);
    const name = decoder.decode(data.subarray(at + 46, at + 46 + nameLength));
    // Campo extra ZIP64 (id 0x0001): tamaños/offset de 8 bytes en el orden de los que valen 0xFFFFFFFF.
    let extra = at + 46 + nameLength;
    const extraEnd = extra + extraLength;
    while (extra + 4 <= extraEnd) {
      const id = u16(extra), length = u16(extra + 2);
      if (id === 0x0001) {
        let p = extra + 4;
        if (size === MAX_U32) { size = u64(p); p += 8; }
        if (compressed === MAX_U32) { compressed = u64(p); p += 8; }
        if (local === MAX_U32) { local = u64(p); }
      }
      extra += 4 + length;
    }
    at = extraEnd + commentLength;
    if (!wanted.has(name)) continue;
    if (size > MAX_ENTRY_BYTES || local + 30 > data.length || u32(local) !== SIG_LOCAL) throw fail(NOT_3MF_MESSAGE);
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    const raw = data.subarray(start, start + compressed);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
    else throw fail(`Compresión no soportada en ${name}.`);
  }
  return out;
}

const decodeXml = (text) => String(text).replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, entity) => {
  const map = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
  if (map[entity.toLowerCase()]) return map[entity.toLowerCase()];
  const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
  return Number.isFinite(code) ? String.fromCodePoint(code) : '';
});
/** Atributos de una etiqueta XML (`<x a="1" b="2"/>` → {a:'1', b:'2'}). */
function attributes(tag) {
  const out = {};
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[match[1]] = decodeXml(match[2]);
  return out;
}
const num = (value) => { const n = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const round = (value, digits) => { const f = 10 ** digits; return Math.round(value * f) / f; };
const HEX = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i;
export const normalizeHex = (value) => { const m = HEX.exec(String(value ?? '').trim()); return m ? `#${m[1].toUpperCase()}` : null; };

/** slice_info.config → { slicer, printerCode, plates[] } */
export function parseSliceInfo(xml) {
  const text = String(xml);
  const slicer = attributes(/<header_item[^>]*key="X-BBL-Client-Version"[^>]*>/.exec(text)?.[0] ?? '').value ?? '';
  const plates = [];
  let printerCode = '';
  for (const block of text.matchAll(/<plate>([\s\S]*?)<\/plate>/g)) {
    const meta = {};
    for (const tag of block[1].matchAll(/<metadata\b[^>]*>/g)) { const a = attributes(tag[0]); if (a.key) meta[a.key] = a.value; }
    const objects = [...block[1].matchAll(/<object\b[^>]*>/g)].map((tag) => attributes(tag[0])).filter((o) => o.skipped !== 'true').map((o) => o.name || '');
    const filaments = [...block[1].matchAll(/<filament\b[^>]*>/g)].map((tag) => attributes(tag[0])).map((f) => ({
      slot: Math.trunc(num(f.id)), type: f.type || '', hex: normalizeHex(f.color), grams: round(num(f.used_g), 2), meters: round(num(f.used_m), 2), trayId: f.tray_info_idx || '',
    })).filter((f) => f.slot > 0 && f.grams > 0);
    const seconds = num(meta.prediction);
    printerCode ||= meta.printer_model_id || '';
    plates.push({ index: Math.trunc(num(meta.index)) || plates.length + 1, seconds, weightG: round(num(meta.weight), 2), objects, filaments });
  }
  return { slicer: slicer ? `Bambu Studio ${slicer}` : '', printerCode, plates };
}

/** project_settings.config (JSON) → impresora y perfiles de filamento por posición (slot 1..n). */
export function parseProjectSettings(jsonText) {
  let settings;
  try { settings = JSON.parse(String(jsonText)); } catch { return { printer: '', filaments: [] }; }
  const list = (key) => (Array.isArray(settings?.[key]) ? settings[key] : []);
  const names = list('filament_settings_id');
  const length = Math.max(names.length, list('filament_colour').length, list('filament_type').length);
  const filaments = Array.from({ length }, (_, i) => ({
    slot: i + 1,
    type: String(list('filament_type')[i] ?? ''),
    hex: normalizeHex(list('filament_colour')[i]),
    vendor: String(list('filament_vendor')[i] ?? ''),
    // «Bambu PLA Basic @BBL A1» → «Bambu PLA Basic»
    profile: String(names[i] ?? '').replace(/\s*@.*$/, '').trim(),
  }));
  return { printer: typeof settings?.printer_model === 'string' ? settings.printer_model : '', filaments };
}

export function parseModelTitle(xml) {
  const match = /<metadata\s+name="Title"\s*>([\s\S]*?)<\/metadata>/.exec(String(xml));
  // Bambu Studio guarda el título con entidades dobles («&amp;amp;»): se decodifica hasta que no cambie.
  let title = match ? match[1] : '';
  for (let i = 0; i < 3; i++) { const next = decodeXml(title); if (next === title) break; title = next; }
  return title.replace(/<[^>]*>/g, '').trim().slice(0, 90);
}

/**
 * Lee un .gcode.3mf: título, laminador, impresora, filamentos del proyecto y placas laminadas (con tiempo > 0).
 * Lanza un Error con mensaje para el operador si no es un 3MF o si no tiene placas laminadas.
 */
export async function readSlicedProject(bytes, { inflateRaw, fileName = '' } = {}) {
  const entries = await readZipEntries(bytes, WANTED, inflateRaw);
  const text = (name) => (entries.has(name) ? new TextDecoder().decode(entries.get(name)) : '');
  if (!entries.has('3D/3dmodel.model') && !entries.has('Metadata/project_settings.config')) throw fail(NOT_3MF_MESSAGE);
  const slice = parseSliceInfo(text('Metadata/slice_info.config'));
  const project = parseProjectSettings(text('Metadata/project_settings.config'));
  const plates = slice.plates.filter((plate) => plate.seconds > 0 && plate.filaments.length > 0)
    .map((plate) => ({ ...plate, hours: round(plate.seconds / 3600, 4), filaments: plate.filaments.map((f) => {
      const profile = project.filaments[f.slot - 1];
      return { ...f, type: f.type || profile?.type || '', hex: f.hex || profile?.hex || null, vendor: profile?.vendor || '', profile: profile?.profile || '' };
    }) }));
  if (!plates.length) throw fail(NOT_SLICED_MESSAGE);
  const slots = [...new Set(plates.flatMap((plate) => plate.filaments.map((f) => f.slot)))].sort((a, b) => a - b);
  return {
    fileName: String(fileName).slice(0, 120),
    title: parseModelTitle(text('3D/3dmodel.model')),
    slicer: slice.slicer,
    printer: project.printer || PRINTER_MODELS[slice.printerCode] || slice.printerCode,
    filaments: slots.map((slot) => { const f = plates.flatMap((plate) => plate.filaments).find((x) => x.slot === slot); return { slot, type: f.type, hex: f.hex, vendor: f.vendor, profile: f.profile }; }),
    plates,
    totals: { plates: plates.length, hours: round(plates.reduce((t, p) => t + p.seconds, 0) / 3600, 4), grams: round(plates.reduce((t, p) => t + p.filaments.reduce((s, f) => s + f.grams, 0), 0), 2) },
  };
}

// ── Asociar los filamentos del archivo con el inventario ────────────────────────────────────────────────────────
const rgb = (hex) => { const n = parseInt(String(hex).slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
/** Distancia de color perceptual aproximada («redmean»), 0–~765. */
export function colorDistance(a, b) {
  if (!normalizeHex(a) || !normalizeHex(b)) return Infinity;
  const [r1, g1, b1] = rgb(normalizeHex(a)), [r2, g2, b2] = rgb(normalizeHex(b));
  const rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
const norm = (value) => String(value ?? '').toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
/** Umbral bajo el cual dos colores se consideran «el mismo» (blancos, negros y colores de catálogo cercanos). */
export const SAME_COLOR = 100;

/**
 * Material del inventario más parecido a un filamento del archivo: mismo tipo (PLA, PETG…) y color más cercano,
 * con preferencia por la misma marca y línea. `match` = 'exact' (tipo y color), 'type' (solo tipo) o 'none'.
 */
export function matchMaterial(filament, materials) {
  let best = null;
  for (const m of materials || []) {
    const sameType = norm(m.type) !== '' && norm(m.type) === norm(filament.type);
    const distance = colorDistance(m.hex, filament.hex);
    const sameBrand = norm(m.brand) !== '' && norm(filament.vendor).includes(norm(m.brand));
    const lineHit = norm(filament.profile) !== '' && norm(m.name).split(/\s+/).filter((w) => w.length > 2).every((w) => norm(filament.profile).includes(w) || norm(m.color).includes(w));
    const score = (sameType ? 0 : 1000) + Math.min(distance, 800) - (sameBrand ? 25 : 0) - (lineHit ? 15 : 0);
    if (!best || score < best.score) best = { materialId: m.id, score, sameType, distance };
  }
  if (!best) return { materialId: '', match: 'none' };
  return { materialId: best.materialId, match: best.sameType && best.distance <= SAME_COLOR ? 'exact' : best.sameType ? 'type' : 'none' };
}

/** Nombre aproximado de un color (para mostrar «Rojo», «Negro»…). */
export function colorName(hex) {
  const value = normalizeHex(hex);
  if (!value) return 'Color';
  const named = [['Negro', '#000000'], ['Blanco', '#FFFFFF'], ['Gris', '#8E9089'], ['Rojo', '#E1251B'], ['Rojo', '#FF0000'], ['Naranjo', '#FF6A13'], ['Amarillo', '#FFE133'], ['Amarillo', '#FFFF00'], ['Verde', '#00AE42'], ['Azul', '#0A2CA5'], ['Azul', '#306AF3'], ['Celeste', '#56B7E6'], ['Morado', '#5E43B7'], ['Rosado', '#F55A74'], ['Café', '#7D6556'], ['Beige', '#F7E6DE']];
  return named.reduce((best, [name, h]) => (colorDistance(value, h) < best.d ? { name, d: colorDistance(value, h) } : best), { name: 'Color', d: Infinity }).name;
}
