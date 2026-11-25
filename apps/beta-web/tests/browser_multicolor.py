"""E2E multicolor (Bambu Lab A1 + AMS lite) e inventario: cotizar una placa con 2 filamentos, ver el control de
stock, aceptar y llevar el pedido a producción (descuenta cada filamento UNA vez), y eliminar un material (CRUD).
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
SEED = {'MAT-001': {'stockKg': 2.4}, 'MAT-004': {'stockKg': 1.1}}   # demo inicial (aún sin guardar en el navegador)
stock = lambda page, mid: page.evaluate(f"(() => {{ const raw = localStorage.getItem('forma-studio:internal:v2'); return raw ? JSON.parse(raw).materials.find(m => m.id === '{mid}') : null }})()") or SEED[mid]
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        page = browser.new_page(viewport={'width': 1440, 'height': 940}); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        before1, before2 = stock(page, 'MAT-001')['stockKg'], stock(page, 'MAT-004')['stockKg']

        # 1 · cotización multicolor: color 1 = MAT-001 (340 g/placa), color 2 = MAT-004 (35 g/placa)
        page.get_by_role('button', name='Cotizador', exact=True).click()
        f = page.locator('#quote-form')
        f.locator('[name=project]').fill('Llavero bicolor AMS')
        f.locator('[name=materialId]').select_option('MAT-001')
        price_one = page.locator('.price-main strong').inner_text()
        assert page.locator('[data-quote-extra=multicolor]').count() == 0, 'multicolor ya no es un extra'
        assert 'Filamentos de la placa' in f.inner_text() and f.locator('[name=amsMaterial2]').count() == 0
        f.locator('[data-ams-add]').click()
        f.locator('[name=amsMaterial2]').select_option('MAT-004')
        f.locator('[name=amsGrams2]').fill('35')
        assert '375 g' in f.locator('#filament-total').inner_text()
        assert f.locator('[data-dot-for=amsMaterial2]').evaluate('e => getComputedStyle(e).backgroundColor') == 'rgb(83, 125, 169)'
        # agregar y quitar un tercer color deja todo como estaba
        f.locator('[data-ams-add]').click(); f.locator('[name=amsGrams3]').fill('5')
        f.locator('[data-ams-remove="3"]').click()
        assert f.locator('[name=amsMaterial3]').count() == 0 and '375 g' in f.locator('#filament-total').inner_text()
        f.locator('[data-ams-add]').click(); f.locator('[data-ams-add]').click()
        assert f.locator('[data-ams-add]').count() == 0, 'AMS lite: máximo 4 colores'
        f.locator('[data-ams-remove="4"]').click(); f.locator('[data-ams-remove="3"]').click()
        page.wait_for_timeout(200)
        price_two = page.locator('.price-main strong').inner_text()
        num = lambda t: int(re.sub(r'\D', '', t))
        assert num(price_two) > num(price_one), (price_one, price_two)
        check = page.locator('.stock-check').inner_text()
        assert '680 g' in check and '70 g' in check, check   # 8 uds, 4 por placa ⇒ 2 placas
        page.screenshot(path=str(SHOTS / 'cotizador-ams.png'))
        f.locator('button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Llavero bicolor AMS')
        row.wait_for()
        qid = row.locator('td').first.inner_text().split('\n')[0].strip()

        # 3 · enviar → aceptar + pedido → producción: descuenta 680 g y 70 g una sola vez
        row.get_by_role('button', name='Ya la envié').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Llavero bicolor AMS')
        row.get_by_role('button', name='Aceptar + pedido').click()
        page.locator('#workflow-form [name=dueDate]').fill('2026-11-04')
        page.locator('#workflow-form button[type=submit]').click()
        # reserva: el pedido compromete 680 g + 70 g sin tocar el físico
        page.locator('[data-nav=materials]').first.click()
        card = re.sub(r'\s+', ' ', page.locator('.material-card').filter(has=page.locator('[data-edit-material=MAT-001]')).inner_text())
        assert 'Comprometido 0,68 kg' in card and 'Disponible 1,72 kg' in card, card
        assert stock(page, 'MAT-001')['stockKg'] == before1
        page.get_by_role('button', name='Pedidos', exact=False).first.click()
        order_row = page.locator('tr').filter(has_text=qid)
        oid = re.search(r'PED-\d+', order_row.inner_text()).group(0)
        for status in ['Preparación', 'En producción']:
            page.locator(f'[data-order-advance="{oid}"]').click()
            page.wait_for_timeout(150)
        assert 'En producción' in page.locator('#toast').inner_text()
        # el botón de consumo ya no vive en la tabla: está en el detalle del pedido
        assert page.locator(f'#order-tbody [data-order-consumption="{oid}"]').count() == 0
        # la estimación NO descuenta inventario
        assert stock(page, 'MAT-001')['stockKg'] == before1 and stock(page, 'MAT-004')['stockKg'] == before2
        # 3b · registrar consumo REAL desde el detalle: precargado con la reserva (680 g y 70 g), corregido a 700 g; doble envío = 1 registro
        page.locator(f'[data-order-detail="{oid}"]').click()
        page.locator(f'.order-dialog [data-order-consumption="{oid}"]').click()
        cf = page.locator('#consumption-form')
        assert cf.locator('[name=g0]').input_value() == '680' and cf.locator('[name=g1]').input_value() == '70'
        assert 'reservado 680 g' in cf.inner_text()
        cf.locator('[name=g0]').fill('700')
        page.evaluate("const f=document.querySelector('#consumption-form'); f.requestSubmit(); f.requestSubmit();")
        page.wait_for_timeout(250)
        after1, after2 = stock(page, 'MAT-001')['stockKg'], stock(page, 'MAT-004')['stockKg']
        assert round(before1 - after1, 3) == 0.7 and round(before2 - after2, 3) == 0.07, (before1, after1, before2, after2)
        saved_order = page.evaluate(f"(() => JSON.parse(localStorage.getItem('forma-studio:internal:v2')).orders.find(o => o.id === '{oid}'))()")
        assert saved_order['reservation']['status'] == 'RELEASED' and saved_order['reservation']['releaseReason'] == 'CONSUMED', saved_order['reservation']
        # reimpresión de 40 g (el detalle vuelve a abrirse tras registrar)
        page.locator(f'.order-dialog [data-order-consumption="{oid}"]').click()
        assert cf.locator('[name=kind]').input_value() == 'REPRINT' and cf.locator('[name=g0]').input_value() == ''
        cf.locator('[name=g0]').fill('40'); cf.locator('button[type=submit]').click()
        page.wait_for_timeout(150)
        assert round(after1 - stock(page, 'MAT-001')['stockKg'], 3) == 0.04
        page.locator('.order-dialog [data-close]').first.click()
        # con el consumo de producción ya registrado, «Marcar entregado» no vuelve a pedirlo
        page.locator(f'#order-tbody [data-order-advance="{oid}"]').click()
        page.wait_for_timeout(150)
        assert page.locator('#delivery-form').count() == 0 and 'entregado' in page.locator('#toast').inner_text()
        page.locator(f'[data-order-detail="{oid}"]').first.click()
        box = re.sub(r'\s+', ' ', page.locator('.consumption-box').inner_text())
        assert 'Reservado · liberado (consumo real registrado)' in box and '680 g' in box and '740 g' in box and 'Reimpresión' in box, box
        page.locator('[data-close]').first.click()

        # 4 · eliminar material (CRUD): confirmación en la página y desaparece del inventario y del cotizador
        page.locator('[data-nav=materials]').first.click()
        n = page.locator('.material-card').count()
        page.locator('[data-edit-material=MAT-003]').click()
        page.locator('[data-delete-material=MAT-003]').click()
        assert 'Eliminar material' in page.locator('#confirm-title').inner_text()
        page.locator('[data-confirm=yes]').click()
        page.wait_for_timeout(150)
        assert page.locator('.material-card').count() == n - 1
        assert page.locator('[data-edit-material=MAT-003]').count() == 0
        page.get_by_role('button', name='Cotizador', exact=True).click()
        assert 'MAT-003' not in [o for o in page.locator('#quote-form [name=materialId] option').evaluate_all('els => els.map(e => e.value)')]
        assert not errors, errors
        print(f'OK multicolor AMS ({URL.rsplit("/", 1)[-1]}): {qid} {price_one} → {price_two} · {oid} estimado 680+70 g sin descontar · real 700+70 g (1 vez) + reimpresión 40 g · material eliminado')
        browser.close()
finally:
    server.terminate()
