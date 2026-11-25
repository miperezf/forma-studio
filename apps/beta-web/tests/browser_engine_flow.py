"""E2E Beta 0.6 · motor v1 con persistencia real (index.html servido por HTTP, módulos ESM + bundle).
Uso:
  python3 tests/browser_engine_flow.py                                  # sirve apps/beta-web (index.html modular)
  FORMA_SERVE_DIR=dist/staging python3 tests/browser_engine_flow.py      # sirve el sitio staging generado
  FORMA_BASE_URL=https://<proyecto>.web.app/ python3 tests/browser_engine_flow.py   # verifica la URL PUBLICADA
Verifica: precio del motor en pantalla, documento del cliente sin fugas (vista, copiar, imprimir, localStorage),
dos claves de almacenamiento, política BLOCK (borrador sí, emisión no), revisión de perfiles y recarga."""
import json, os, re, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get('FORMA_OUT', BASE / 'dist' / 'e2e')); OUT.mkdir(parents=True, exist_ok=True)
LAUNCH = dict(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'], **({'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
FORBIDDEN_WORDS = re.compile(r'costo|margen|comisi[oó]n|utilidad|markup|desgaste|depreciaci|fallas?|supervisi|snapshot', re.I)
FORBIDDEN_KEYS = ['economicCost', 'margin', 'commercialMargin', 'realMargin', 'commission', 'breakdown', 'snapshot', 'formState', 'inputSnapshot',
                  'pricingPool', 'costBasis', 'calculation', 'params', 'profileRefs', 'issuance', 'flags', 'rawAmount', 'pooledAmount', 'commercialUtility']

def keys_of(value):
    if isinstance(value, list): return [k for v in value for k in keys_of(v)]
    if isinstance(value, dict): return [k for key, v in value.items() for k in [key, *keys_of(v)]]
    return []

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); return s.getsockname()[1]

REMOTE = os.environ.get('FORMA_BASE_URL')
server = None
if REMOTE:
    URL = REMOTE if REMOTE.endswith('/') or REMOTE.endswith('.html') else REMOTE + '/'
else:
    port = free_port()
    serve_dir = Path(os.environ.get('FORMA_SERVE_DIR', BASE))
    serve_dir = serve_dir if serve_dir.is_absolute() else BASE / serve_dir
    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(serve_dir)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    URL = f'http://127.0.0.1:{port}/' + os.environ.get('FORMA_ENTRY', 'index.html')
from urllib.parse import urlsplit
ORIGIN = '{0.scheme}://{0.netloc}'.format(urlsplit(URL))
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        context = browser.new_context(viewport={'width': 1440, 'height': 940})
        context.grant_permissions(['clipboard-read', 'clipboard-write'], origin=ORIGIN)
        context.add_init_script('window.print = () => { window.__printed = (window.__printed || 0) + 1 }')
        # FORMA_APPLY_FIREBASE_HEADERS=1: aplica las cabeceras de firebase.json (CSP incluida) a las respuestas locales,
        # para comprobar que la política de seguridad que se desplegará no rompe la aplicación.
        CSP_ERRORS = []
        if os.environ.get('FORMA_APPLY_FIREBASE_HEADERS') == '1':
            cfg = json.loads((BASE.parent.parent / 'firebase.json').read_text())
            extra = {h['key']: h['value'] for rule in cfg['hosting']['headers'] if rule['source'] == '**' for h in rule['headers']}
            def with_headers(route):
                response = route.fetch()
                route.fulfill(response=response, headers={**response.headers, **extra})
            context.route('**/*', with_headers)
        page = context.new_page(); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: CSP_ERRORS.append(m.text) if 'Content Security Policy' in m.text else None)
        page.goto(URL)
        page.evaluate('localStorage.clear()'); page.reload()
        env0 = page.evaluate('window.FORMA_ENV || null')
        if env0 and env0.get('name') == 'staging':
            assert 'STAGING · DATOS FICTICIOS' in page.locator('.demo-indicator').inner_text()
            assert page.evaluate("document.querySelector('meta[name=robots]')?.content") == 'noindex,nofollow'
        page.get_by_role('button', name='Cotizador', exact=True).click()

        # 1 · precio del motor v1 para el formulario por defecto (golden G1: $48.000, $6.000 c/u)
        result = page.locator('#quote-results')
        assert '$48.000' in result.inner_text(), result.inner_text()
        assert 'Motor v2' in result.inner_text()
        assert 'Régimen tributario por confirmar' in result.inner_text()
        # documento mostrado (sin la nota interna del panel, que explica que no hay desglose)
        preview = page.evaluate("() => [...document.querySelectorAll('#quote-customer-preview .customer-preview > :not(p)')].map(e => e.innerText).join('\\n')")
        assert '$48.000' in preview and '8 × $6.000' in preview, preview
        assert not FORBIDDEN_WORDS.search(preview), preview
        page.screenshot(path=str(OUT / 'screenshot-beta-v060-motor.png'), full_page=True)

        # 2 · cambia la cantidad: 9 u / 4 por placa → 2 completas + última de 1 pieza (estimada como completa, v2)
        page.locator('#quote-form [name=quantity]').fill('9')
        assert '2 completas + 1 última (1 pz · estimada)' in page.locator('#quote-results').inner_text()
        page.locator('#quote-form [name=quantity]').fill('8')

        # 3 · guardar borrador → dos claves; la comercial sin nada interno
        page.locator('#quote-form [name=project]').fill('E2E motor v1')
        page.locator('#quote-form button[type=submit]').click()
        row = page.locator('.last-quotes tbody tr').filter(has_text='E2E motor v1')
        assert row.count() == 1 and 'Borrador' in row.inner_text() and '$48.000' in row.inner_text(), row.inner_text()
        qid = row.locator('td').first.inner_text().split('\n')[0].strip()
        storage = page.evaluate("() => ({internal: localStorage.getItem('forma-studio:internal:v2'), customer: localStorage.getItem('forma-studio:customer:v2')})")
        internal, customer = json.loads(storage['internal']), json.loads(storage['customer'])
        saved = next(q for q in internal['quotes'] if q['id'] == qid)
        assert saved['calculationVersion'] == 'v2' and saved['calculation']['output']['pricing']['grossTotal'] == 48000
        assert 'customerQuote' not in saved and 'customerQuotes' not in internal
        doc = next(c for c in customer['customerQuotes'] if c['id'] == qid)
        leaked = [k for k in FORBIDDEN_KEYS if k in keys_of(customer)]
        assert not leaked, leaked
        assert doc['total'] == 48000

        # 4 · copiar (WhatsApp) e imprimir: solo whitelist
        row.get_by_role('button', name='Copiar presupuesto').click()
        copied = page.evaluate('navigator.clipboard.readText()')
        assert 'TOTAL: $48.000 (IVA incluido)' in copied and not FORBIDDEN_WORDS.search(copied), copied
        row.get_by_role('button', name='Imprimir presupuesto').click()
        if (env0 or {}).get('printUnavailable'):
            assert 'impresión no está disponible' in page.locator('#toast').inner_text().lower()
            assert not page.evaluate('window.__printed')
        else:
            printed = page.locator('#print-root').inner_text()
            assert page.evaluate('window.__printed') == 1 and '$48.000' in printed and not FORBIDDEN_WORDS.search(printed), printed

        # 5 · Configuración: política BLOCK → nueva revisión del perfil
        page.get_by_role('button', name='Configuración').first.click()
        page.locator('.settings-details summary').click()
        page.locator('#shop-settings-form [name=onBelowMin]').select_option('BLOCK')
        page.locator('#shop-settings-form button[type=submit]').click()
        assert 'Revisión 2' in page.locator('.settings-summary-grid').inner_text().replace('\n', ' ')

        # 6 · margen de ESTA venta 20 % < mínimo 25 % con BLOCK: borrador sí, envío no
        page.get_by_role('button', name='Cotizador', exact=True).click()
        page.locator('[data-quote-extra=sales]').first.click()
        page.locator('#quote-form [name=targetMargin]').fill('20')
        page.locator('#quote-form [name=project]').fill('E2E bloqueada')
        assert 'no se podrá marcar como enviada' in page.locator('#quote-results').inner_text()
        page.locator('#quote-form button[type=submit]').click()
        blocked = page.locator('.last-quotes tbody tr').filter(has_text='E2E bloqueada')
        assert 'Borrador' in blocked.inner_text() and 'No emitible' in blocked.inner_text(), blocked.inner_text()
        assert blocked.get_by_role('button', name='Ya la envié').count() == 0
        bid = blocked.locator('td').first.inner_text().split('\n')[0].strip()
        blocked.get_by_role('button', name=f'Opciones de {bid}').click()
        page.get_by_role('menuitem', name='Ya la envié · marcar enviada').click()
        assert 'Bloquear emisión' in page.locator('#toast').inner_text()
        assert 'Borrador' in page.locator('.last-quotes tbody tr').filter(has_text='E2E bloqueada').inner_text()

        # 7 · recarga: todo persiste; la primera cotización sigue en $48.000 aunque el perfil cambió
        page.reload(); page.get_by_role('button', name='Cotizador', exact=True).click()
        assert '$48.000' in page.locator('.last-quotes tbody tr').filter(has_text='E2E motor v1').inner_text()
        assert 'No emitible' in page.locator('.last-quotes tbody tr').filter(has_text='E2E bloqueada').inner_text()

        # 8 · flujo comercial con la cotización emitible: enviar → aceptar + pedido (un solo pedido)
        ok_row = page.locator('.last-quotes tbody tr').filter(has_text='E2E motor v1')
        ok_row.get_by_role('button', name='Ya la envié').click()
        ok_row = page.locator('.last-quotes tbody tr').filter(has_text='E2E motor v1')
        ok_row.get_by_role('button', name='Aceptar + pedido').click()
        page.locator('#workflow-form [name=dueDate]').fill('2026-11-04')
        page.locator('#workflow-form button[type=submit]').click()
        orders = page.evaluate("() => JSON.parse(localStorage.getItem('forma-studio:internal:v2')).orders")
        mine = [o for o in orders if o.get('quoteId') == qid]
        assert len(mine) == 1 and mine[0]['amount'] == 48000, mine

        # 9 · móvil sin desborde horizontal en el cotizador
        mobile = context.new_page(); mobile.set_viewport_size({'width': 390, 'height': 844})
        mobile.on('pageerror', lambda e: errors.append(str(e)))
        mobile.goto(URL)
        mobile.get_by_role('button', name='Cotizador', exact=True).click()
        mobile.screenshot(path=str(OUT / 'screenshot-beta-v060-motor-mobile.png'), full_page=True)
        assert mobile.evaluate('document.documentElement.scrollWidth') <= 392
        assert not errors, errors
        assert not CSP_ERRORS, CSP_ERRORS
        env = page.evaluate('window.FORMA_ENV || null')
        print('OK E2E motor v1:', qid, 'bloqueada', bid, 'pedido', mine[0]['id'], '| URL', URL, '| entorno', env and env.get('name'), env and env.get('version'))
        browser.close()
finally:
    if server: server.terminate()
