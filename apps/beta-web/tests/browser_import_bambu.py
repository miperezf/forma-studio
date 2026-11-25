"""E2E 0.14: importar un .gcode.3mf de Bambu Studio (archivos SINTÉTICOS en tests/fixtures) y cotizar un producto con
varias placas: placas y colores cargados, asociación con el inventario, desglose por placa, guardado con trazabilidad,
recotizar, agregar/quitar placas, error junto al campo, reserva de todos los filamentos y vista en el celular.
FORMA_SERVE_DIR/FORMA_ENTRY permiten probar el archivo único publicado."""
import os, re, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
FIX = Path(__file__).resolve().parent / 'fixtures'
LAUNCH = dict(headless=True, args=['--no-sandbox'], **({'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
serve_dir = Path(os.environ.get('FORMA_SERVE_DIR', BASE))
if not serve_dir.is_absolute(): serve_dir = BASE / serve_dir
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(serve_dir)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
URL = f'http://127.0.0.1:{port}/' + os.environ.get('FORMA_ENTRY', 'index.html')
SHOTS = Path(os.environ.get('FORMA_SHOTS', tempfile.gettempdir()))
txt = lambda loc: re.sub(r'\s+', ' ', loc.inner_text())
saved = lambda page: page.evaluate("JSON.parse(localStorage.getItem('forma-studio:internal:v2'))")

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.get_by_role('button', name='Cotizador', exact=True).click()
        f = page.locator('#quote-form')
        val = lambda name: f.locator(f'[name={name}]').input_value()

        # 1 · archivo sin laminar: mensaje que explica cómo exportar, sin tocar el formulario
        page.locator('#bambu-file').set_input_files(str(FIX / 'sin-laminar.3mf'))
        page.wait_for_timeout(300)
        assert 'Exportar todas las placas laminadas' in page.locator('#toast').inner_text()
        assert val('project') == 'Macetero geométrico'

        # 2 · producto de 3 placas y 4 colores: todo cargado desde el archivo
        page.locator('#bambu-file').set_input_files(str(FIX / 'multiplaca.gcode.3mf'))
        page.wait_for_timeout(400)
        toast = page.locator('#toast').inner_text()
        assert 'Importado: 3 placas, 4 colores, 6 h 12 min, 74 g' in toast, toast
        assert val('project') == 'Set multicolor de prueba & FORMA'
        assert (val('plateWeightGr'), val('amsGrams2'), val('amsGrams3'), val('amsGrams4')) == ('9.2', '5.2', '5.2', '5.1')
        assert (val('plateH'), val('plateMin'), val('partsPerPlate')) == ('2', '4', '1')
        assert f.locator('.plate-card').count() == 2
        assert (val('plate2Hours'), val('plate2H'), val('plate2Min'), val('plate2Units')) == ('2.1', '2', '6', '1')
        assert (val('plate2Grams1'), val('plate2Grams2'), val('plate2Grams3')) == ('12.4', '8.1', '7.9')
        assert (val('plate3Grams1'), val('plate3Grams2')) == ('14.6', '6.3') and f.locator('[name=plate3Grams3]').count() == 0
        assert 'Placa 1 · unidades por placa' in txt(f) and 'Placa 1 · filamentos' in txt(f)
        summary = txt(page.locator('.import-summary'))
        assert 'multiplaca.gcode.3mf' in summary and 'Bambu Lab A1' in summary and '3 placas' in summary and 'colores del archivo' in summary.lower(), summary
        assert page.locator('[data-import-slot]').count() == 4
        # la impresora del archivo se elige si está en el taller
        assert 'A1' in f.locator('[name=machineId] option:checked').inner_text()

        # 3 · 2 juegos: desglose por placa, horas y placas totales
        f.locator('[name=quantity]').fill('2')
        page.wait_for_timeout(150)
        res = txt(page.locator('#quote-results'))
        assert 'desglose por placa' in res.lower() and '6 placa(s)' in res and '12 h 24 min' in res, res
        rows = page.locator('.pb-grid > span').all_inner_texts()
        assert rows[:4] == ['Placa 1', '2×', '2 h 4 min', '24,7 g'], rows
        page.locator('.quote-panel').screenshot(path=str(SHOTS / 'importar-bambu-formulario.png'))
        page.locator('.result-panel').screenshot(path=str(SHOTS / 'importar-bambu-precio.png'))

        # 4 · cambiar la asociación de un color del archivo actualiza ese color en TODAS las placas
        slot2 = page.locator('[data-import-slot="2"]')
        other = slot2.locator('option').nth(1).get_attribute('value')
        slot2.select_option(other); page.wait_for_timeout(150)
        assert val('amsMaterial2') == other and val('plate2Mat2') == other
        assert page.locator('[data-import-slot="2"]').input_value() == other

        # 5 · guardar: formState con placas adicionales e importación; el motor recibe 3 placas SLICER_IMPORT
        f.locator('button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Set multicolor de prueba'); row.wait_for()
        q = next(x for x in saved(page)['quotes'] if x['project'].startswith('Set multicolor de prueba'))
        assert len(q['formState']['extraPlates']) == 2 and q['formState']['importedFrom']['fileName'] == 'multiplaca.gcode.3mf', q['formState']
        plates = q['calculation']['request']['input']['plates']
        assert [pl['id'] for pl in plates] == ['plate-1', 'plate-2', 'plate-3'] and {pl['source'] for pl in plates} == {'SLICER_IMPORT'}
        assert f.locator('.plate-card').count() == 0, 'tras guardar, el formulario vuelve a una placa'

        # 6 · enviar → recotizar: se restauran las 3 placas y la nota del archivo
        row.get_by_role('button', name='Ya la envié').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Set multicolor de prueba')
        row.get_by_role('button', name=re.compile('Opciones de COT')).click()
        page.get_by_role('menuitem', name='Nueva revisión y recotizar').click()
        page.wait_for_timeout(200)
        assert f.locator('.plate-card').count() == 2 and val('plate3Grams1') == '14.6' and val('plate2H') == '2' and val('plate2Min') == '6'
        assert 'Datos importados de multiplaca.gcode.3mf' in txt(page.locator('#import-block'))

        # 7 · quitar la placa 2: la placa 3 pasa a ser la 2 con sus datos
        f.locator('[data-plate-remove="2"]').click()
        assert f.locator('.plate-card').count() == 1 and val('plate2Grams1') == '14.6' and val('plate2Grams2') == '6.3'
        # agregar una placa vacía: error junto a sus gramos al guardar (nunca en silencio)
        f.locator('[data-plate-add]').click()
        assert f.locator('.plate-card').count() == 2
        f.locator('[name=plate3H]').fill('1')
        f.locator('button[type=submit]').click()
        assert f.locator('[name=plate3Grams1][aria-invalid=true]').count() == 1
        assert 'Placa 3' in txt(f.locator('.field-error'))
        f.locator('[name=plate3Grams1]').fill('3.25'); page.wait_for_timeout(120)
        assert f.locator('.field-error').count() == 0
        page.locator('#cancel-repricing').click()

        # 8 · una placa con 4 piezas: «piezas en la placa» = objetos del archivo; aceptar → reserva de todos los colores
        page.locator('#bambu-file').set_input_files(str(FIX / 'multiplaca.gcode.3mf'))
        page.wait_for_timeout(300)
        f.locator('[name=quantity]').fill('2'); f.locator('[name=project]').fill('Set reserva E2E')
        f.locator('button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Set reserva E2E'); row.wait_for()
        row.get_by_role('button', name='Ya la envié').click()
        page.locator('.last-quotes tbody tr').filter(has_text='Set reserva E2E').get_by_role('button', name='Aceptar + pedido').click()
        page.locator('#workflow-form button[type=submit]').click(); page.wait_for_timeout(200)
        order = next(o for o in saved(page)['orders'] if o['project'] == 'Set reserva E2E')
        reserved = round(sum(i['grams'] for i in order['reservation']['items']), 1)
        assert reserved == 148.0, order['reservation']   # 74 g × 2 juegos, todas las placas y colores

        page.locator('#bambu-file').set_input_files(str(FIX / 'una-placa.gcode.3mf'))
        page.wait_for_timeout(300)
        assert (val('partsPerPlate'), val('plateWeightGr'), val('plateH'), val('plateMin')) == ('4', '24.73', '2', '15')
        assert f.locator('.plate-card').count() == 0 and val('project') == 'Llavero'

        # 9 · celular: resumen de importación sin desborde
        page.locator('#bambu-file').set_input_files(str(FIX / 'multiplaca.gcode.3mf'))
        page.wait_for_timeout(300)
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth') <= 390
        page.locator('#import-block').screenshot(path=str(SHOTS / 'importar-bambu-movil.png'))
        assert not errors, errors
    print('E2E importación Bambu Studio y varias placas: OK')
finally:
    server.terminate()
