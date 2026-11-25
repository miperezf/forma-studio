// Lector de .gcode.3mf de Bambu Studio (0.14). Archivos SINTÉTICOS en tests/fixtures (ver su README).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { readSlicedProject, readZipEntries, parseSliceInfo, matchMaterial, colorDistance, colorName, normalizeHex, NOT_SLICED_MESSAGE, NOT_3MF_MESSAGE } from '../src/domain/bambu-3mf.js';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const inflateRaw = async (bytes) => inflateRawSync(bytes);
const read = (name) => readSlicedProject(fixture(name), { inflateRaw, fileName: name });

test('producto de 3 placas y 4 colores: tiempo, gramos por color, impresora y título', async () => {
  const p = await read('multiplaca.gcode.3mf');
  assert.equal(p.title, 'Set multicolor de prueba & FORMA');
  assert.equal(p.printer, 'Bambu Lab A1');
  assert.equal(p.slicer, 'Bambu Studio 02.08.02.61');
  assert.equal(p.plates.length, 3);
  assert.deepEqual(p.plates.map((plate) => plate.hours), [2.07, 2.1, 2.03]);
  assert.deepEqual(p.plates[0].filaments.map((f) => [f.slot, f.hex, f.grams]), [[1, '#161616', 9.2], [2, '#FFFFFF', 5.2], [3, '#E1251B', 5.2], [4, '#0A2CA5', 5.1]]);
  assert.deepEqual(p.plates[2].filaments.map((f) => f.slot), [1, 4]);
  assert.deepEqual(p.plates[0].objects, ['Disco A', 'Disco B']);
  assert.deepEqual(p.totals, { plates: 3, hours: 6.2, grams: 74 });
  assert.deepEqual(p.filaments.map((f) => [f.slot, f.type, f.vendor, f.profile]), [[1, 'PLA', 'Bambu Lab', 'Bambu PLA Basic'], [2, 'PLA', 'Bambu Lab', 'Bambu PLA Basic'], [3, 'PLA', 'Bambu Lab', 'Bambu PLA Basic'], [4, 'PLA', 'Bambu Lab', 'Bambu PLA Basic']]);
});

test('una placa (encabezados locales ZIP64); impresora desde el código del laminador (N1 = A1 mini); gramos con 2 decimales', async () => {
  const p = await read('una-placa.gcode.3mf');
  assert.equal(p.printer, 'Bambu Lab A1 mini');
  assert.equal(p.plates.length, 1);
  assert.equal(p.plates[0].objects.length, 4);
  assert.equal(p.plates[0].filaments[0].grams, 24.73);
  assert.equal(p.plates[0].seconds, 8130);
  assert.equal(p.plates[0].hours, 2.2583);
});

test('proyecto sin laminar: mensaje que explica cómo exportar', async () => {
  await assert.rejects(() => read('sin-laminar.3mf'), (error) => error.message === NOT_SLICED_MESSAGE);
});

test('archivo que no es ZIP o ZIP sin entradas de Bambu: mensaje claro', async () => {
  await assert.rejects(() => readSlicedProject(new TextEncoder().encode('hola, no soy un zip'), { inflateRaw }), (error) => error.message === NOT_3MF_MESSAGE);
  await assert.rejects(() => readSlicedProject(new Uint8Array(10), { inflateRaw }), (error) => error.message === NOT_3MF_MESSAGE);
});

test('ZIP: solo descomprime las entradas pedidas', async () => {
  let calls = 0;
  const entries = await readZipEntries(fixture('multiplaca.gcode.3mf'), ['3D/3dmodel.model'], async (bytes) => { calls++; return inflateRawSync(bytes); });
  assert.deepEqual([...entries.keys()], ['3D/3dmodel.model']);
  assert.equal(calls, 1);
});

test('slice_info: ignora objetos omitidos y filamentos sin uso; entidades XML', () => {
  const info = parseSliceInfo(`<config><header><header_item key="X-BBL-Client-Version" value="02.09.00.01"/></header><plate>
    <metadata key="index" value="2"/><metadata key="prediction" value="3600"/><metadata key="weight" value="10"/>
    <object identify_id="1" name="Pieza &amp; tapa" skipped="false"/><object identify_id="2" name="Omitida" skipped="true"/>
    <filament id="1" type="PETG" color="#00ff00FF" used_g="10" used_m="3"/><filament id="2" type="PLA" color="#000000" used_g="0" used_m="0"/></plate></config>`);
  assert.equal(info.slicer, 'Bambu Studio 02.09.00.01');
  assert.deepEqual(info.plates[0].objects, ['Pieza & tapa']);
  assert.deepEqual(info.plates[0].filaments.map((f) => [f.slot, f.type, f.hex, f.grams]), [[1, 'PETG', '#00FF00', 10]]);
  assert.equal(info.plates[0].index, 2);
});

test('asociar con el inventario: mismo tipo y color más cercano; marca como desempate; avisos', () => {
  const materials = [
    { id: 'NEGRO', name: 'PLA Basic Black', brand: 'Bambu Lab', type: 'PLA', color: 'Black', hex: '#161616' },
    { id: 'ROJO', name: 'PLA Basic Red', brand: 'Bambu Lab', type: 'PLA', color: 'Red', hex: '#C12E1F' },
    { id: 'PETG-AZUL', name: 'PETG Azul', brand: 'eSUN', type: 'PETG', color: 'Azul', hex: '#0A2CA5' },
  ];
  assert.deepEqual(matchMaterial({ type: 'PLA', hex: '#000000', vendor: 'Bambu Lab', profile: 'Bambu PLA Basic' }, materials), { materialId: 'NEGRO', match: 'exact' });
  assert.deepEqual(matchMaterial({ type: 'PLA', hex: '#E1251B', vendor: 'Bambu Lab', profile: 'Bambu PLA Basic' }, materials), { materialId: 'ROJO', match: 'exact' });
  // Azul PLA: no hay PLA azul → se prefiere el mismo tipo (aviso «revisa el color») antes que otro material.
  assert.equal(matchMaterial({ type: 'PLA', hex: '#0A2CA5' }, materials).match, 'type');
  assert.deepEqual(matchMaterial({ type: 'ABS', hex: '#0A2CA5' }, materials), { materialId: 'PETG-AZUL', match: 'none' });
  assert.deepEqual(matchMaterial({ type: 'PLA', hex: '#000000' }, []), { materialId: '', match: 'none' });
});

test('colores: normalización, distancia y nombre', () => {
  assert.equal(normalizeHex('ff0000'), '#FF0000');
  assert.equal(normalizeHex('#00ff00ff'), '#00FF00');
  assert.equal(normalizeHex('rojo'), null);
  assert.equal(colorDistance('#000000', '#000000'), 0);
  assert.ok(colorDistance('#000000', '#FFFFFF') > 700);
  assert.equal(colorDistance('#000000', null), Infinity);
  assert.equal(colorName('#FF0000'), 'Rojo');
  assert.equal(colorName('#306AF3'), 'Azul');
  assert.equal(colorName('#FFFF00'), 'Amarillo');
  assert.equal(colorName(null), 'Color');
});
