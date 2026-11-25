"""E2E 0.13 «Pedidos sin miedo»: siguiente paso, volver atrás con motivo, entregar confirmando el consumo real (o
dejarlo para después), anular con motivo (libera la reserva), filtros, tarjetas en el celular, tiempo h + min y errores
junto al campo. FORMA_SERVE_DIR/FORMA_ENTRY permiten probar el archivo único publicado."""
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
order_of = lambda page, oid: next(o for o in saved(page)['orders'] if o['id'] == oid)


def quote_to_order(page, project):
    """Cotiza con los valores por defecto, marca enviada y acepta creando el pedido. Devuelve el folio del pedido."""
    page.get_by_role('button', name='Cotizador', exact=True).click()
    f = page.locator('#quote-form')
    f.locator('[name=project]').fill(project)
    f.locator('button[type=submit]').click()
    row = page.locator('.last-quotes tbody tr').filter(has_text=project); row.wait_for()
    row.get_by_role('button', name='Ya la envié').click()
    page.locator('.last-quotes tbody tr').filter(has_text=project).get_by_role('button', name='Aceptar + pedido').click()
    page.locator('#workflow-form button[type=submit]').click()
    page.wait_for_timeout(150)
    return next(o['id'] for o in saved(page)['orders'] if o['project'] == project)


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        page = browser.new_page(viewport={'width': 1440, 'height': 940}); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)

        # 1 · cotizador: tiempo «2h 4m» y gramos con 2 decimales; error junto al campo (no en silencio)
        page.get_by_role('button', name='Cotizador', exact=True).click()
        f = page.locator('#quote-form')
        assert f.locator('[name=plateH]').input_value() == '5' and f.locator('[name=plateMin]').input_value() == '30'
        f.locator('[name=plateH]').fill('2'); f.locator('[name=plateMin]').fill('4')
        assert f.locator('[name=plateHours]').input_value() == '2.0667'
        f.locator('[name=plateWeightGr]').fill('24.73')
        page.wait_for_timeout(100)
        assert f.locator('[aria-invalid=true]').count() == 0 and page.locator('.price-main strong').count() == 1
        assert '· Bambu Lab' in f.locator('[name=materialId] option').first.inner_text() and 'kg disp.' in f.locator('[name=materialId] option').first.inner_text()
        f.locator('[name=project]').fill('')
        f.locator('button[type=submit]').click()
        assert f.locator('[name=project][aria-invalid=true]').count() == 1
        assert 'nombre de la pieza' in txt(f.locator('.field-error'))
        assert page.evaluate("document.activeElement.name") == 'project'
        f.locator('[name=project]').fill('Pieza h+min')
        page.wait_for_timeout(100)
        assert f.locator('.field-error').count() == 0
        f.locator('[name=plateH]').fill(''); f.locator('[name=plateMin]').fill('')
        page.wait_for_timeout(100)
        assert f.locator('[name=plateH][aria-invalid=true]').count() == 1, 'tiempo vacío: error junto al campo h'
        f.locator('button[type=reset]').click(); page.wait_for_timeout(100)

        # 2 · pedido: siguiente paso y volver atrás con motivo (queda en el historial)
        oid = quote_to_order(page, 'Corrección E2E')
        page.get_by_role('button', name='Pedidos', exact=False).first.click()
        row = page.locator('#order-tbody tr').filter(has_text='Corrección E2E')
        assert row.locator('select').count() == 0 and row.locator('[data-order-consumption]').count() == 0
        row.get_by_role('button', name='Pasar a Preparación').click()
        assert order_of(page, oid)['status'] == 'Preparación'
        page.locator(f'[data-order-menu="{oid}"]').click()
        page.get_by_role('menuitem', name='Volver a «Pendiente»…').click()
        page.locator('#revert-form button[type=submit]').click()
        assert 'motivo' in page.locator('#toast').inner_text() and order_of(page, oid)['status'] == 'Preparación'
        page.locator('#revert-form [name=reason]').fill('Avancé el pedido equivocado')
        page.locator('#revert-form button[type=submit]').click()
        page.wait_for_timeout(150)
        o = order_of(page, oid)
        assert o['status'] == 'Pendiente' and o['events'][-1]['type'] == 'PRODUCTION_REVERTED' and o['events'][-1]['reason'] == 'Avancé el pedido equivocado', o['events'][-1]
        assert 'Corrección de estado: Preparación → Pendiente' in txt(page.locator('.order-dialog')) and 'Avancé el pedido equivocado' in txt(page.locator('.order-dialog'))
        page.locator('.order-dialog').screenshot(path=str(SHOTS / 'pedido-detalle-correccion.png'))

        # 3 · avanzar hasta «Marcar entregado»: pide el consumo real precargado con la reserva; «lo registro después»
        for _ in range(2):
            page.locator('.order-dialog [data-order-advance]').click(); page.wait_for_timeout(120)
        assert order_of(page, oid)['status'] == 'En producción'
        page.locator('.order-dialog [data-order-advance]').click()
        df = page.locator('#delivery-form'); df.wait_for()
        reserved = order_of(page, oid)['reservation']['items'][0]['grams']
        assert float(df.locator('[name=g0]').input_value()) == reserved and 'reservado' in txt(df)
        page.locator('.workflow-dialog').screenshot(path=str(SHOTS / 'pedido-entrega.png'))
        df.locator('input[name=record][value=later]').check()
        df.locator('button[type=submit]').click(); page.wait_for_timeout(150)
        o = order_of(page, oid)
        assert o['status'] == 'Entregado' and o['reservation']['status'] == 'ACTIVE' and not o.get('consumptions'), o
        assert 'Consumo pendiente' in page.locator('#toast').inner_text()

        # 4 · error al marcar entregado: volver a «En producción» desde el detalle y entregar registrando el consumo
        page.locator(f'[data-order-detail="{oid}"]').click()
        page.locator('.order-dialog [data-order-action=revert]').click()
        page.locator('#revert-form [name=reason]').fill('Aún no lo retira el cliente')
        page.locator('#revert-form button[type=submit]').click(); page.wait_for_timeout(150)
        o = order_of(page, oid)
        assert o['status'] == 'En producción' and 'deliveredAt' not in o
        mat = o['reservation']['items'][0]['materialId']
        stock_before = next(m for m in saved(page)['materials'] if m['id'] == mat)['stockKg']
        page.locator('.order-dialog [data-order-advance]').click()
        df = page.locator('#delivery-form'); df.wait_for()
        df.locator('[name=g0]').fill('350.5')
        df.locator('button[type=submit]').click(); page.wait_for_timeout(150)
        o = order_of(page, oid)
        stock_after = next(m for m in saved(page)['materials'] if m['id'] == mat)['stockKg']
        assert o['status'] == 'Entregado' and o['reservation']['status'] == 'RELEASED' and o['consumptions'][0]['kind'] == 'PRODUCTION', o
        assert abs((stock_before - stock_after) - 0.3505) <= 0.001, (stock_before, stock_after)  # el stock se lleva en gramos enteros

        # 5 · anular otro pedido: motivo obligatorio, libera la reserva, sale de «Por atender», sin abonos nuevos
        oid2 = quote_to_order(page, 'Anulación E2E')
        page.get_by_role('button', name='Pedidos', exact=False).first.click()
        assert order_of(page, oid2)['reservation']['status'] == 'ACTIVE'
        page.locator(f'[data-order-menu="{oid2}"]').click()
        page.get_by_role('menuitem', name='Anular pedido…').click()
        cancel = page.locator('#cancel-form')
        assert 'No se puede deshacer' in txt(cancel) and 'filamento reservado vuelve' in txt(cancel)
        page.locator('.workflow-dialog').screenshot(path=str(SHOTS / 'pedido-anular.png'))
        cancel.locator('[data-reason-chip="Cliente desistió"]').click()
        assert cancel.locator('[name=reason]').input_value() == 'Cliente desistió'
        cancel.locator('button[type=submit]').click(); page.wait_for_timeout(150)
        o2 = order_of(page, oid2)
        assert o2['status'] == 'Anulado' and o2['cancelled']['reason'] == 'Cliente desistió' and o2['reservation']['releaseReason'] == 'CANCELLED', o2
        assert 'Pedido anulado' in txt(page.locator('.order-dialog')) and page.locator('.order-dialog [data-order-payment]').count() == 0
        page.locator('.order-dialog [data-close]').first.click()
        assert page.locator('#order-tbody tr').filter(has_text='Anulación E2E').count() == 0, 'anulado no aparece en «Por atender»'
        page.locator('[data-order-filter=cancelled]').click()
        assert page.locator('#order-tbody tr').filter(has_text='Anulación E2E').count() == 1
        page.locator('[data-order-filter=all]').click()
        page.locator('#order-search').fill('anulación')
        assert page.locator('#order-tbody tr').count() == 1
        page.locator('#order-search').fill('')
        page.screenshot(path=str(SHOTS / 'pedidos-escritorio.png'), full_page=False)
        # el botón del siguiente paso queda dentro de la pantalla en 1440 px
        box = page.locator('#order-tbody tr').first.locator('.order-actions').bounding_box()
        assert box['x'] + box['width'] <= 1440, box

        # 6 · celular: tarjetas con el siguiente paso visible, barra inferior con texto y acceso a Ajustes
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('[data-order-filter=open]').click()
        page.wait_for_timeout(100)
        assert page.evaluate('document.documentElement.scrollWidth') <= 390
        card = page.locator('#order-tbody tr').first
        nb = card.locator('[data-order-advance], [data-order-payment]').first.bounding_box()
        assert nb and nb['x'] >= 0 and nb['x'] + nb['width'] <= 390, nb
        assert page.locator('.side-nav .nav-item.active .nav-short').inner_text() == 'Pedidos'
        assert page.locator('.side-nav .nav-mobile-only').is_visible()
        page.screenshot(path=str(SHOTS / 'pedidos-movil.png'), full_page=False)
        page.locator('.side-nav .nav-mobile-only').click()
        assert 'Configuración' in page.locator('h1').inner_text()
        assert not errors, errors
    print('E2E corrección y anulación de pedidos: OK')
finally:
    server.terminate()
