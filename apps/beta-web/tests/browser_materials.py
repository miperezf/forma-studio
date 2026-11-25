"""E2E del formulario de Materiales desde el catálogo (Open Filament Database): selección encadenada, ficha
autocompletada, precio por kg y stock calculados, edición con preselección, modo «fuera del catálogo», uso en el
cotizador y vista móvil. FORMA_SERVE_DIR/FORMA_ENTRY permiten probar el archivo único publicado."""
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
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        page = browser.new_page(viewport={'width': 1440, 'height': 940}); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
        page.goto(URL)
        page.locator('[data-nav=materials]').first.click()
        assert page.locator('.material-note').count() == 0, 'sin avisos de origen en Materiales'
        page.locator('[data-modal=material]').click()
        dialog = page.locator('.dialog')
        # 1 · catálogo: marca → material (auto el más común) → línea → color → formato (auto 1 kg)
        dialog.locator('[data-cat=brandId]').select_option(label='Bambu Lab')
        assert dialog.locator('[data-cat=type]').input_value() == 'PLA'
        dialog.locator('[data-cat=lineId]').select_option('bambu_lab/PLA/basic')
        dialog.locator('[data-cat-color=black]').click()
        assert dialog.locator('[data-cat=sizeKey]').input_value() == '1000'
        sheet = dialog.locator('#material-preview').inner_text()
        assert 'PLA Basic Black' in sheet and '1,24 g/cm³' in sheet and '6975337031383' in sheet, sheet
        dialog.locator('[name=pricePerSpool]').fill('22000')
        dialog.locator('[name=spools]').fill('2')
        dialog.locator('[name=openRemainingG]').fill('400')
        calc = dialog.locator('.material-calc').inner_text()
        assert '$22.000' in calc and '2,4 kg' in calc, calc
        dialog.screenshot(path=str(SHOTS / 'material-form.png'))
        dialog.locator('button[type=submit]').click()
        card = page.locator('.material-card').filter(has_text='PLA Basic Black')
        card.wait_for()
        text = card.inner_text()
        assert '$22.000' in text and '2 carretes + 400 g · 2,4 kg' in text and 'Carrete 1.000 g' in text and '6975337031383' in text, text
        assert card.locator('.material-sheet').get_attribute('href').startswith('https://')

        # 2 · editar: todo preseleccionado; cambiar carretes recalcula y crea nueva revisión
        card.locator('[data-edit-material]').click()
        assert dialog.locator('[data-cat=lineId]').input_value() == 'bambu_lab/PLA/basic'
        assert dialog.locator('[data-cat-color=black]').get_attribute('aria-checked') == 'true'
        assert dialog.locator('[name=pricePerSpool]').input_value() == '22000'
        dialog.locator('[name=spools]').fill('3')
        dialog.locator('button[type=submit]').click()
        assert '3 carretes + 400 g · 3,4 kg' in page.locator('.material-card').filter(has_text='PLA Basic Black').inner_text()

        # 3 · validación: sin precio no se guarda
        page.locator('[data-modal=material]').click()
        dialog.locator('[data-cat=brandId]').select_option(label='SUNLU')
        dialog.locator('[data-cat=lineId]').select_option(index=1)
        dialog.locator('[data-cat-color]').first.click()
        dialog.locator('[name=spools]').fill('1')
        cards = page.locator('.material-card').count()
        dialog.locator('button[type=submit]').click()
        assert dialog.locator('[name=pricePerSpool]').evaluate('e => e.validity.valueMissing') and page.locator('.material-card').count() == cards
        # 4 · fuera del catálogo (marca local)
        dialog.locator('[data-material-mode=manual]').click()
        dialog.locator('[name=name]').fill('PLA Local Gris')
        dialog.locator('[name=brand]').fill('Marca local')
        dialog.locator('[name=priceKg]').fill('18000')
        dialog.locator('[name=stockKg]').fill('1.5')
        dialog.locator('button[type=submit]').click()
        manual = page.locator('.material-card').filter(has_text='PLA Local Gris').inner_text()
        assert '$18.000' in manual and '1,5 kg' in manual, manual

        # 5 · el cotizador usa el material del catálogo (precio por kg)
        page.get_by_role('button', name='Cotizador', exact=True).click()
        options = page.locator('#quote-form [name=materialId] option').all_inner_texts()
        assert any('PLA Basic Black' in o for o in options), options
        before = page.locator('main').inner_text()
        page.locator('#quote-form [name=materialId]').select_option(label=next(o for o in options if 'PLA Basic Black' in o))
        page.wait_for_timeout(200)
        assert re.search(r'\$\d', page.locator('main').inner_text())

        # 6 · móvil: el formulario no desborda
        page.set_viewport_size({'width': 375, 'height': 812})
        page.locator('[data-nav=materials]').first.click() if page.locator('[data-nav=materials]').first.is_visible() else page.evaluate("document.querySelector('[data-nav=materials]').click()")
        page.evaluate("document.querySelector('[data-modal=material]').click()")
        dialog.locator('[data-cat=brandId]').select_option(label='eSUN 3D')
        dialog.locator('[data-cat=lineId]').select_option(index=1)
        dialog.locator('[data-cat-color]').first.click()
        overflow = page.evaluate("Math.max(document.documentElement.scrollWidth, document.querySelector('.dialog').scrollWidth) - window.innerWidth")
        assert overflow <= 0, overflow
        page.screenshot(path=str(SHOTS / 'material-form-mobile.png'))
        assert not errors, errors
        print('OK materiales desde catálogo (' + URL.rsplit('/', 1)[-1] + '): Bambu PLA Basic Black $22.000/kg 2,4→3,4 kg · edición preseleccionada · manual · cotizador · móvil')
        browser.close()
finally:
    server.terminate()
