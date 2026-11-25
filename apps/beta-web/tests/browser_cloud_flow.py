"""E2E de la integración con la nube usando un backend FALSO en memoria (tests/fake-cloud.js) con la misma interfaz
que FormaFirebase. Verifica el cableado de la UI: puerta de acceso, cuenta no autorizada, siembra inicial, folio
reservado, aceptar + pedido idempotente ante doble envío, pago idempotente, cierre de sesión y recarga.
Las garantías reales de Firestore se prueban con tests/rules (emulador) y en el staging."""
import json, os, re, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
LAUNCH = dict(headless=True, args=['--no-sandbox'], **({'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(BASE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
URL = f'http://127.0.0.1:{port}/index.html'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        ctx = browser.new_context(viewport={'width': 1440, 'height': 940})
        rules = (BASE.parent.parent / 'firebase' / 'firestore.rules.template').read_text(encoding='utf-8')
        block = rules[rules.index('match /customerQuotes/'):]
        whitelist = re.findall(r"'([A-Za-z]+)'", re.search(r'hasOnly\(\[(.*?)\]\)', block, re.S).group(1))
        assert 'lines' in whitelist and 'total' in whitelist, whitelist
        ctx.add_init_script(f'window.__customerWhitelist = {json.dumps(whitelist)}')
        ctx.add_init_script(path=str(BASE / 'tests' / 'fake-cloud.js'))
        ctx.add_init_script("window.__saveFailures=[];document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{const t=document.getElementById('toast');if(t&&t.textContent.includes('No se pudo guardar'))window.__saveFailures.push(t.textContent.trim())}).observe(document.body,{subtree:true,childList:true,characterData:true}))")
        page = ctx.new_page(); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: (_ for _ in ()).throw(AssertionError('diálogo nativo: ' + d.message)))
        page.goto(URL)
        fake = lambda: page.evaluate('window.__fakeCloud.read()')

        # 1 · cuenta NO autorizada: el servidor niega y la UI lo dice
        page.evaluate("window.__fakeLoginEmail='intruso@forma.test'")
        page.get_by_role('button', name='Entrar con Google').click()
        page.get_by_text('no está autorizada').wait_for()
        assert page.locator('#quote-form').count() == 0
        page.get_by_role('button', name='Usar otra cuenta').click()

        # 2 · cuenta autorizada: siembra de staging con datos ficticios marcados
        page.evaluate("window.__fakeLoginEmail='propietario@forma.test'")
        page.get_by_role('button', name='Entrar con Google').click()
        page.get_by_role('button', name='Cotizador', exact=True).wait_for()
        page.wait_for_timeout(300)
        st = fake()['state']
        assert st['shopSettings'] and all(c.get('origin') == 'DEMO' for c in st['clients']), 'siembra demo marcada'
        assert 'propietario@forma.test' in page.locator('.page-footer').inner_text()

        # 3 · borrador con folio reservado en la nube
        page.get_by_role('button', name='Cotizador', exact=True).click()
        page.locator('#quote-form [name=project]').fill('Nube E2E')
        page.locator('#quote-form button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Nube E2E')
        row.wait_for()
        qid = row.locator('td').first.inner_text().split('\n')[0].strip()
        assert fake()['counters']['q'] == int(qid.split('-')[1]), (fake()['counters'], qid)
        assert any(q['id'] == qid for q in fake()['state']['quotes'])

        # 4 · enviar → aceptar + pedido con DOBLE envío del formulario: un solo pedido
        row.get_by_role('button', name='Ya la envié').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='Nube E2E')
        row.get_by_role('button', name='Aceptar + pedido').click()
        page.locator('#workflow-form [name=dueDate]').fill('2026-11-04')
        page.evaluate("const f=document.querySelector('#workflow-form'); f.requestSubmit(); f.requestSubmit();")
        page.wait_for_timeout(700)
        orders = [o for o in fake()['state']['orders'] if o.get('quoteId') == qid]
        assert len(orders) == 1, orders
        assert fake()['locks'][qid] == orders[0]['id']
        oid = orders[0]['id']
        assert oid == 'PED-1049', ('el folio supera a los pedidos existentes', oid)

        # 5 · pago con id único: doble envío ⇒ un solo abono
        page.get_by_role('button', name='Pedidos', exact=False).first.click()
        page.locator(f'[data-order-detail="{oid}"]').click()
        page.locator(f'.order-dialog [data-order-payment="{oid}"]').click()
        page.locator('#payment-form [name=amount]').fill('10000')
        page.evaluate("const f=document.querySelector('#payment-form'); f.requestSubmit(); f.requestSubmit();")
        page.wait_for_timeout(500)
        pays = next(o for o in fake()['state']['orders'] if o['id'] == oid)['payments']
        assert len(pays) == 1 and pays[0]['amount'] == 10000 and pays[0]['id'].startswith('pago-'), pays

        # 5b · consumo real en la nube (transacción pedido + materiales; doble envío = 1 registro)
        for status in ['Preparación', 'En producción']:
            page.locator(f'#order-tbody [data-order-advance="{oid}"]').click(); page.wait_for_timeout(300)
        assert next(o for o in fake()['state']['orders'] if o['id'] == oid)['reservation']['status'] == 'ACTIVE', 'la reserva nace en la transacción del pedido'
        before = {m['id']: m['stockKg'] for m in fake()['state']['materials']}
        page.locator(f'[data-order-detail="{oid}"]').click()
        page.locator(f'.order-dialog [data-order-consumption="{oid}"]').click()
        page.evaluate("const f=document.querySelector('#consumption-form'); f.requestSubmit(); f.requestSubmit();")
        page.wait_for_timeout(500)
        order = next(o for o in fake()['state']['orders'] if o['id'] == oid)
        assert len(order.get('consumptions', [])) == 1, order.get('consumptions')
        assert order['reservation']['status'] == 'RELEASED' and order['reservation']['releaseReason'] == 'CONSUMED', order.get('reservation')
        used = order['consumptions'][0]['items'][0]
        after = {m['id']: m['stockKg'] for m in fake()['state']['materials']}
        assert round(before[used['materialId']] - after[used['materialId']], 3) == round(used['grams'] / 1000, 3), (before, after, used)

        # 6 · recarga: sesión y datos vuelven de la nube
        page.reload()
        page.get_by_role('button', name='Cotizador', exact=True).wait_for()
        page.get_by_role('button', name='Cotizador', exact=True).click()
        assert 'Aceptada' in page.locator('.last-quotes tbody tr').filter(has_text='Nube E2E').inner_text()

        # 7 · cerrar sesión ⇒ vuelve la puerta de acceso, sin datos en pantalla
        page.locator('#cloud-signout').click()
        page.get_by_role('button', name='Entrar con Google').wait_for()
        assert page.locator('.last-quotes').count() == 0
        # en modo nube no se escribe el almacenamiento local del navegador
        assert page.evaluate("localStorage.getItem('forma-studio:internal:v2')") is None
        assert not errors, errors
        assert page.evaluate('window.__saveFailures') == [], page.evaluate('window.__saveFailures')
        print('OK E2E nube (backend falso):', qid, oid, 'guardados:', fake()['saves'])
        browser.close()
finally:
    server.terminate()
