"""E2E del respaldo manual (modo local): crear un borrador, descargar respaldo, perder los datos del navegador,
restaurar desde el archivo y comprobar que el borrador vuelve sin tocar lo existente."""
import json, os, socket, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
LAUNCH = dict(headless=True, args=['--no-sandbox'], **({'executable_path': os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
with socket.socket() as s:
    s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
# FORMA_SERVE_DIR / FORMA_ENTRY: probar también el ARCHIVO ÚNICO generado (lo que se publica), no solo los módulos.
serve_dir = Path(os.environ.get('FORMA_SERVE_DIR', BASE))
if not serve_dir.is_absolute(): serve_dir = BASE / serve_dir
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '--directory', str(serve_dir)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
URL = f'http://127.0.0.1:{port}/' + os.environ.get('FORMA_ENTRY', 'index.html')
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(**LAUNCH)
        ctx = browser.new_context(viewport={'width': 1440, 'height': 940}, accept_downloads=True)
        page = ctx.new_page(); page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(URL)
        page.get_by_role('button', name='Cotizador', exact=True).click()
        page.locator('#quote-form [name=project]').fill('Respaldo E2E')
        page.locator('#quote-form button[type=submit]').click()
        page.locator('.last-quotes tbody tr').filter(has_text='Respaldo E2E').wait_for()

        page.locator('[data-nav=settings]:visible').first.click()
        with page.expect_download() as info:
            page.locator('#backup-download').click()
        download = info.value
        assert download.suggested_filename.startswith('forma-respaldo-') and download.suggested_filename.endswith('.json'), download.suggested_filename
        path = Path(tempfile.mkdtemp()) / download.suggested_filename
        download.save_as(path)
        backup = json.loads(path.read_text(encoding='utf-8'))
        assert backup['format'] == 'forma-studio-backup' and any(q.get('project') == 'Respaldo E2E' for q in backup['data']['quotes']), backup['counts']
        assert 'Último respaldo' in page.locator('.settings-card').filter(has=page.get_by_role('heading', name='Respaldo', exact=True)).inner_text()

        # Se pierden los datos del navegador: vuelve la demo inicial, sin el borrador
        page.evaluate('localStorage.clear()'); page.reload()
        page.get_by_role('button', name='Cotizador', exact=True).click()
        assert page.locator('.last-quotes tbody tr').filter(has_text='Respaldo E2E').count() == 0
        quotes_before = page.locator('.last-quotes tbody tr').count()

        page.locator('[data-nav=settings]:visible').first.click()
        page.locator('#backup-file').set_input_files(str(path))
        page.locator('[data-confirm=yes]').click()
        page.wait_for_timeout(300)
        assert 'Restaurados 1 registros' in page.locator('#toast').inner_text() or 'Restaurados' in page.locator('#toast').inner_text(), page.locator('#toast').inner_text()
        page.get_by_role('button', name='Cotizador', exact=True).click()
        assert page.locator('.last-quotes tbody tr').filter(has_text='Respaldo E2E').count() == 1
        assert page.locator('.last-quotes tbody tr').count() == quotes_before + 1

        # archivo inválido: aviso, sin cambios
        bad = path.with_name('malo.json'); bad.write_text('{"format":"otro"}', encoding='utf-8')
        page.locator('[data-nav=settings]:visible').first.click()
        page.locator('#backup-file').set_input_files(str(bad))
        page.wait_for_timeout(200)
        assert 'no es un respaldo de FORMA' in page.locator('#toast').inner_text()
        page.screenshot(path=os.environ.get('FORMA_SHOT', str(Path(tempfile.gettempdir()) / 'backup.png')), full_page=True)
        assert not errors, errors
        print('OK respaldo (' + URL.rsplit('/', 1)[-1] + '): descarga', download.suggested_filename, '· restauración no destructiva · archivo inválido rechazado')
        browser.close()
finally:
    server.terminate()
