"""E2E 0.15: favicon y título de pestaña, panel «Hoy», stock mínimo y movimientos por material, resultado real vs
cotizado del pedido, productos frecuentes, duplicar cotización y WhatsApp. FORMA_SERVE_DIR/FORMA_ENTRY permiten probar el
archivo único publicado."""
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
txt = lambda loc: re.sub(r'\s+', ' ', loc.inner_text())
saved = lambda page: page.evaluate("JSON.parse(localStorage.getItem('forma-studio:internal:v2'))")

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)

        # 1 · favicon (SVG + PNG) y título de pestaña por sección
        icons = page.evaluate("[...document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')].map(l => l.getAttribute('href'))")
        assert len(icons) == 3 and any('svg' in h for h in icons), icons
        ok_icon = page.evaluate("""async (href) => { const img = new Image(); img.src = href; await img.decode(); return img.naturalWidth > 0 }""", icons[0] if icons[0].startswith('data:') else URL.rsplit('/', 1)[0] + '/' + icons[0].lstrip('./'))
        assert ok_icon
        assert page.title() == 'Panel · FORMA Studio · Demo', page.title()

        # 2 · panel «Hoy»: 4 tarjetas; una fila abre el pedido
        assert page.locator('.today-card').count() == 4
        assert 'Hoy' in page.locator('.today-title h2').inner_text()
        prod = page.locator('.today-card').nth(0)
        assert prod.locator('.today-row').count() >= 1
        prod.locator('.today-row').first.click()
        assert page.locator('.order-dialog').is_visible()
        page.locator('.order-dialog [data-close]').first.click()
        page.screenshot(path=str(SHOTS / 'panel-hoy.png'), full_page=False)

        # 3 · stock mínimo: subirlo hace aparecer el aviso en Materiales y en «Hoy»; el ajuste queda en Movimientos
        page.locator('[data-nav=materials]').first.click()
        page.locator('[data-edit-material=MAT-001]').click()
        form = page.locator('#modal-form')
        form.locator('[name=minStockG]').fill('50000')
        if form.locator('[name=stockKg]').count():
            form.locator('[name=stockKg]').fill(str(float(form.locator('[name=stockKg]').input_value()) + 1))
        else:
            form.locator('[name=spools]').fill(str(int(form.locator('[name=spools]').input_value()) + 1))
        form.locator('button[type=submit]').click(); page.wait_for_timeout(150)
        card = page.locator('.material-card').filter(has=page.locator('[data-edit-material=MAT-001]'))
        assert 'stock bajo' in card.inner_text().lower()
        card.locator('[data-material-movements]').click()
        mov = txt(page.locator('.order-dialog'))
        assert 'Ajuste manual' in mov and '+1.000 g' in mov, mov
        page.locator('.order-dialog').screenshot(path=str(SHOTS / 'material-movimientos.png'))
        page.locator('.order-dialog [data-close]').first.click()
        page.locator('[data-nav=dashboard]').first.click()
        low = txt(page.locator('.today-card').nth(3))
        assert 'mínimo 50.000 g' in low, low

        # 4 · cotizar → aceptar → entregar con consumo: «Resultado del pedido» con utilidad real
        page.get_by_role('button', name='Cotizador', exact=True).click()
        f = page.locator('#quote-form')
        f.locator('[name=project]').fill('Resultado E2E')
        f.locator('button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Resultado E2E'); row.wait_for()
        qid = row.locator('td').first.inner_text().split()[0]
        # WhatsApp desde el borrador: abre wa.me con el texto de la cotización
        page.evaluate("() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null } }")
        row.get_by_role('button', name=f'Opciones de {qid}').click()
        page.get_by_role('menuitem', name='Enviar por WhatsApp').click()
        opened = page.evaluate('window.__opened')
        assert len(opened) == 1 and opened[0].startswith('https://wa.me/') and 'Resultado%20E2E' in opened[0], opened
        row.get_by_role('button', name='Ya la envié').click()
        page.locator('.last-quotes tbody tr').filter(has_text='Resultado E2E').get_by_role('button', name='Aceptar + pedido').click()
        page.locator('#workflow-form button[type=submit]').click(); page.wait_for_timeout(150)
        oid = next(o['id'] for o in saved(page)['orders'] if o['project'] == 'Resultado E2E')
        page.get_by_role('button', name='Pedidos', exact=False).first.click()
        assert page.title().startswith('Pedidos (') and page.title().endswith('· FORMA Studio · Demo'), page.title()
        page.locator(f'[data-order-detail="{oid}"]').click()
        assert 'Registra el consumo de Producción' in txt(page.locator('.order-result'))
        for _ in range(3):
            page.locator('.order-dialog [data-order-advance]').click(); page.wait_for_timeout(100)
        df = page.locator('#delivery-form')
        df.locator('[name=g0]').fill('760')   # 680 g cotizados + provisión de fallas ≈ 715 g: 760 g cuesta más
        df.locator('button[type=submit]').click(); page.wait_for_timeout(150)
        page.locator(f'[data-order-detail="{oid}"]').click()
        result = txt(page.locator('.order-result'))
        assert 'Utilidad con consumo real' in result and 'más que lo cotizado' in result and '760 g' in result, result
        page.locator('.order-dialog').screenshot(path=str(SHOTS / 'pedido-resultado.png'))
        page.locator('.order-dialog [data-close]').first.click()

        # 5 · producto frecuente: guardar desde la cotización y volver a cotizarlo en 2 clics
        page.get_by_role('button', name='Cotizador', exact=True).click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Resultado E2E')
        row.get_by_role('button', name=f'Opciones de {qid}').click()
        page.get_by_role('menuitem', name='Guardar como producto frecuente…').click()
        page.locator('#product-form [name=name]').fill('Macetero estándar')
        page.locator('#product-form button[type=submit]').click(); page.wait_for_timeout(150)
        products = saved(page)['products']
        assert len(products) == 1 and products[0]['name'] == 'Macetero estándar' and 'clientId' not in products[0]['formState'], products
        assert page.locator('.products-bar').is_visible()
        f.locator('[name=project]').fill('otra cosa'); f.locator('[name=quantity]').fill('3')
        page.locator('[data-product-load]').click(); page.wait_for_timeout(100)
        assert f.locator('[name=project]').input_value() == 'Macetero estándar' and f.locator('[name=quantity]').input_value() == '8'
        assert 'Macetero estándar' in page.locator('#toast').inner_text()

        # 6 · duplicar una cotización: misma configuración, folio nuevo al guardar, la original intacta
        row = page.locator('.last-quotes tbody tr').filter(has_text='Resultado E2E')
        row.get_by_role('button', name=f'Opciones de {qid}').click()
        page.get_by_role('menuitem', name='Duplicar como nueva cotización').click()
        assert f.locator('[name=project]').input_value() == 'Resultado E2E' and page.locator('.workflow-repricing').count() == 0
        n_before = len(saved(page)['quotes'])
        f.locator('button[type=submit]').click(); page.wait_for_timeout(150)
        assert len(saved(page)['quotes']) == n_before + 1

        # 7 · celular: panel «Hoy» sin desborde
        page.locator('[data-nav=dashboard]').first.click()
        page.set_viewport_size({'width': 390, 'height': 844}); page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth') <= 390
        page.screenshot(path=str(SHOTS / 'panel-hoy-movil.png'), full_page=False)
        assert not errors, errors
    print('E2E panel Hoy, inventario, resultado real y productos frecuentes: OK')
finally:
    server.terminate()
