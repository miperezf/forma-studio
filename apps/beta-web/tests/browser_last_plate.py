"""E2E motor v2 · última placa incompleta: plan de placas en vivo, estimación provisional marcada, datos de
Bambu Studio que precisan el precio, AMS por color, reinicio al cambiar el restante y guardado con v2.
FORMA_SERVE_DIR/FORMA_ENTRY permiten probar el archivo único publicado."""
import os, re, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
LAUNCH = dict(headless=True, args=['--no-sandbox'], **({'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
serve_dir = Path(os.environ.get('FORMA_SERVE_DIR', BASE))
if not serve_dir.is_absolute(): serve_dir = BASE / serve_dir
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(serve_dir)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
URL = f'http://127.0.0.1:{port}/' + os.environ.get('FORMA_ENTRY', 'index.html')
SHOTS = Path(os.environ.get('FORMA_SHOTS', tempfile.gettempdir()))
num = lambda t: int(re.sub(r'\D', '', t))
txt = lambda loc: re.sub(r'\s+', ' ', loc.inner_text())
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.get_by_role('button', name='Cotizador', exact=True).click()
        f = page.locator('#quote-form')
        f.locator('[name=project]').fill('Placa parcial E2E')
        # placas completas: 8 / 4 → sin bloque de última placa
        assert '2 placas completas de 4 piezas' in txt(f.locator('#last-plate'))
        assert f.locator('[name=lastRunHours]').count() == 0
        # 4 u / 3 por placa (placa completa 300 g, 6 h) → 1 completa + última con 1 pieza
        f.locator('[name=quantity]').fill('4'); f.locator('[name=partsPerPlate]').fill('3')
        f.locator('[name=plateWeightGr]').fill('300'); f.locator('[name=plateH]').fill('6'); f.locator('[name=plateMin]').fill('0')
        block = txt(f.locator('#last-plate'))
        assert '1 placa completa de 3 piezas + 1 última placa con 1 pieza' in block and 'Estimación provisional' in block, block
        res = txt(page.locator('#quote-results'))
        assert '1 completa + 1 última (1 pz · estimada)' in res and 'estimación conservadora' in res, res
        estimated = num(page.locator('.price-main strong').inner_text())
        # datos reales de Bambu Studio para 1 pieza
        f.locator('[name=lastRunH]').fill('2'); f.locator('[name=lastRunMin]').fill('18'); f.locator('[name=lastRunGrams1]').fill('105')
        assert 'Datos de Bambu Studio' in txt(f.locator('#lp-badge'))
        page.wait_for_timeout(150)
        res = txt(page.locator('#quote-results'))
        sliced = num(page.locator('.price-main strong').inner_text())
        assert sliced < estimated and '· estimada' not in res and 'estimación conservadora' not in res and '8 h 18 min' in res and '405 g' in res, (estimated, sliced, res)
        f.locator('#last-plate').screenshot(path=str(SHOTS / 'ultima-placa-bloque.png'))
        page.screenshot(path=str(SHOTS / 'ultima-placa.png'))
        # cambiar a 5 u cambia el restante (2 piezas): los datos anteriores se descartan
        f.locator('[name=quantity]').fill('5')
        assert 'última placa con 2 piezas' in txt(f.locator('#last-plate'))
        assert f.locator('[name=lastRunH]').input_value() == '' and f.locator('[name=lastRunHours]').input_value() == '' and 'Estimación provisional' in txt(f.locator('#lp-badge'))
        f.locator('[name=quantity]').fill('4')
        # AMS: un campo de gramos por color en la última placa
        f.locator('[data-ams-add]').click()
        f.locator('[name=amsMaterial2]').select_option('MAT-004'); f.locator('[name=amsGrams2]').fill('30')
        assert f.locator('[name=lastRunGrams2]').count() == 1
        f.locator('[name=lastRunH]').fill('2'); f.locator('[name=lastRunMin]').fill('24'); f.locator('[name=lastRunGrams1]').fill('100'); f.locator('[name=lastRunGrams2]').fill('12')
        page.wait_for_timeout(150)
        assert '· estimada' not in txt(page.locator('#quote-results'))
        # guardar: snapshot v2 con la última placa
        f.locator('button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Placa parcial E2E'); row.wait_for()
        saved = page.evaluate("""() => { const db = JSON.parse(localStorage.getItem('forma-studio:internal:v2')); return db.quotes.find(q => q.project === 'Placa parcial E2E') }""")
        assert saved['calculationVersion'] == 'v2', saved['calculationVersion']
        last = saved['calculation']['request']['input']['plates'][0]['lastRun']
        assert last == {'parts': 1, 'filaments': [{'materialId': 'MAT-001', 'grams': 100}, {'materialId': 'MAT-004', 'grams': 12}], 'printHours': 2.4}, last
        assert saved['formState']['lastRun'] == {'printHours': 2.4, 'grams': [100, 12]}
        assert not errors, errors
        print(f'OK última placa ({URL.rsplit("/", 1)[-1]}): estimada ${estimated:,} → Bambu Studio ${sliced:,} · reinicio al cambiar restante · AMS por color · snapshot v2'.replace(',', '.'))
        browser.close()
finally:
    server.terminate()
