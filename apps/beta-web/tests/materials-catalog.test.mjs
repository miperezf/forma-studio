// Catálogo de filamentos (Open Filament Database) y alta de material sin digitación manual.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FILAMENT_CATALOG } from '../src/data/filament-catalog.js';
import { catalogBrands, catalogColors, catalogEntry, catalogLines, catalogMaterialTypes, catalogSizes, materialFromCatalog, selectionOf } from '../src/domain/materials-catalog.js';

const BAMBU = { lineId: 'bambu_lab/PLA/basic', colorId: 'black', sizeKey: '1000' };

test('catálogo: 10 marcas vendidas en Chile, 1,75 mm, con atribución MIT', () => {
  const names = catalogBrands().map((b) => b.name);
  assert.equal(names.length, 10);
  for (const brand of ['Bambu Lab', 'eSUN 3D', 'ELEGOO', 'Creality', 'Polymaker', 'SUNLU']) assert.ok(names.includes(brand), brand);
  assert.equal(FILAMENT_CATALOG.meta.diameter, 1.75);
  assert.match(FILAMENT_CATALOG.meta.license, /MIT/);
  for (const line of FILAMENT_CATALOG.lines) {
    assert.ok(line.c.length > 0 && line.d > 0, line.id);
    for (const color of line.c) assert.match(color[2], /^#[0-9A-F]{6}$/, `${line.id}/${color[0]}`);
  }
});

test('selección encadenada: marca → material → línea → color → formato', () => {
  const types = catalogMaterialTypes('bambu_lab');
  assert.equal(types[0], 'PLA', 'el más común primero');
  const line = catalogLines('bambu_lab', 'PLA').find((l) => l.id === BAMBU.lineId);
  assert.equal(line.name, 'PLA Basic');
  const black = catalogColors(BAMBU.lineId).find((c) => c.id === 'black');
  assert.equal(black.hex, '#000000');
  const sizes = catalogSizes(BAMBU.lineId, 'black');
  assert.ok(sizes.some((s) => s.key === '1000' && !s.refill) && sizes.some((s) => s.key === '1000R' && s.refill));
  assert.deepEqual(catalogLines('no_existe', 'PLA'), []);
});

test('autocompleta ficha técnica; el operador solo digita precio por carrete y carretes', () => {
  const m = materialFromCatalog(BAMBU, { pricePerSpool: 22000, spools: 2, openRemainingG: 400 });
  assert.equal(m.name, 'PLA Basic Black');
  assert.equal(m.brand, 'Bambu Lab');
  assert.equal(m.type, 'PLA');
  assert.equal(m.hex, '#000000');
  assert.equal(m.priceKg, 22000, '1 kg a $22.000 ⇒ $22.000/kg');
  assert.equal(m.stockKg, 2.4, '2 carretes de 1 kg + 400 g');
  assert.equal(m.density, 1.24);
  assert.equal(m.gtin, '6975337031383');
  assert.deepEqual(m.catalogRef, { source: 'OFD', lineId: BAMBU.lineId, colorId: 'black', sizeKey: '1000', snapshot: FILAMENT_CATALOG.meta.generatedAt });
  assert.deepEqual(selectionOf(m), { brandId: 'bambu_lab', type: 'PLA', ...BAMBU });
});

test('precio por kg según el formato del carrete (250 g, 3 kg)', () => {
  const line = FILAMENT_CATALOG.lines.find((l) => l.c.some((c) => c[3].some((s) => s[0] === 250)));
  const color = line.c.find((c) => c[3].some((s) => s[0] === 250));
  const m = materialFromCatalog({ lineId: line.id, colorId: color[0], sizeKey: '250' }, { pricePerSpool: 6000, spools: 1 });
  assert.equal(m.priceKg, 24000);
  assert.equal(m.stockKg, 0.25);
});

test('validaciones con mensajes en español; sin catálogo no se crea nada', () => {
  assert.throws(() => materialFromCatalog({ lineId: 'x', colorId: 'y', sizeKey: '1000' }, { pricePerSpool: 1, spools: 1 }), /Elige marca/);
  assert.throws(() => materialFromCatalog(BAMBU, { pricePerSpool: 0, spools: 1 }), /precio pagado/);
  assert.throws(() => materialFromCatalog(BAMBU, { pricePerSpool: 22000, spools: 1.5 }), /carretes cerrados/);
  assert.throws(() => materialFromCatalog(BAMBU, { pricePerSpool: 22000, spools: 1, openRemainingG: 1500 }), /entre 0 y 1000 g/);
  assert.equal(catalogEntry({ ...BAMBU, sizeKey: '999' }), null);
  assert.equal(selectionOf({ name: 'manual' }), null);
});

test('el material del catálogo es aceptado por Firestore (sin arreglos anidados) y por el cotizador (priceKg, stockKg)', () => {
  const m = materialFromCatalog(BAMBU, { pricePerSpool: 22000, spools: 1 });
  const nested = (value) => Array.isArray(value) ? value.some((v) => Array.isArray(v) || (v && typeof v === 'object' && nested(Object.values(v)))) : value && typeof value === 'object' ? Object.values(value).some(nested) : false;
  assert.equal(nested(m), false);
  assert.ok(Number.isFinite(m.priceKg) && Number.isFinite(m.stockKg));
});
