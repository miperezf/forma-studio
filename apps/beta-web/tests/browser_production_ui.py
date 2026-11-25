"""E2E: la interfaz de PRODUCCIÓN (modo nube, backend falso) no muestra avisos de demo/beta ni detalles técnicos
(Firebase, origen del catálogo, ids de proyecto). Recorre todas las secciones."""
import os, re, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
LAUNCH = dict(headless=True, args=['--no-sandbox'], **({'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(BASE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
NOISE = re.compile(r'\bbeta\b|demostraci|exploraci|ENTORNO|Firebase|forma-fake|Open Filament|calculation/v\d|Motor v\d|ficticio', re.I)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        ctx = browser.new_context(viewport={'width': 1440, 'height': 940})
        ctx.add_init_script(path=str(BASE / 'tests' / 'fake-cloud.js'))
        ctx.add_init_script("window.FORMA_ENV = { name: 'production', version: 'test', label: 'FORMA STUDIO', note: '' }")
        page = ctx.new_page(); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{port}/index.html')
        page.get_by_role('button', name='Entrar con Google').click()
        page.get_by_role('button', name='Cotizador', exact=True).wait_for()
        found = {}
        for nav in ['dashboard', 'clients', 'calculator', 'projects', 'orders', 'materials', 'machines', 'settings']:
            loc = page.locator(f'[data-nav={nav}]:visible').first
            if loc.count() == 0: continue
            loc.click(); page.wait_for_timeout(150)
            text = page.locator('body').inner_text()
            hits = sorted(set(m.group(0) for m in NOISE.finditer(text)))
            if hits: found[nav] = hits
        assert not found, found
        assert 'propietario@forma.test' in page.locator('.side-profile').inner_text()
        assert page.locator('.sidebar-help').count() == 0 and page.locator('.demo-indicator').count() == 0
        assert not errors, errors
        print('OK interfaz de producción sin avisos de demo/beta ni detalles técnicos (8 secciones)')
        browser.close()
finally:
    server.terminate()
