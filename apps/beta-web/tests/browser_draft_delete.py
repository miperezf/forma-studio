import os
from pathlib import Path
from playwright.sync_api import sync_playwright
# Rutas parametrizables (antes fijas en /mnt/data y /usr/bin/chromium):
#   FORMA_HTML  HTML standalone a probar (por defecto dist/FORMA_STUDIO_BETA.html)
#   FORMA_OUT   carpeta para capturas (por defecto dist/e2e)
#   CHROMIUM    ejecutable de Chromium (opcional; por defecto el de Playwright)
BASE=Path(__file__).resolve().parent.parent
html=Path(os.environ.get('FORMA_HTML',BASE/'dist'/'FORMA_STUDIO_BETA.html')).read_text()
root=Path(os.environ.get('FORMA_OUT',BASE/'dist'/'e2e'));root.mkdir(parents=True,exist_ok=True)
LAUNCH=dict(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'],**({'executable_path':os.environ['CHROMIUM']} if os.environ.get('CHROMIUM') else {}))
with sync_playwright() as p:
 b=p.chromium.launch(**LAUNCH)
 page=b.new_page(viewport={'width':1365,'height':940});page.set_default_timeout(6000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 # Beta 0.6: la confirmación es un diálogo de la página (no window.confirm); un diálogo nativo sería un error.
 page.on('dialog',lambda d:(_ for _ in ()).throw(AssertionError('diálogo nativo inesperado: '+d.message)))
 def confirm_in_page():
  dlg=page.get_by_role('alertdialog')
  assert dlg.is_visible() and 'no se puede deshacer' in dlg.inner_text()
  dlg.get_by_role('button',name='Eliminar borrador').click()
  assert page.get_by_role('alertdialog').count()==0
 page.set_content(html,wait_until='domcontentloaded')
 page.get_by_role('button',name='Cotizador',exact=True).click()
 page.locator('#quote-form [name=project]').fill('Borrador temporal de prueba')
 page.locator('#quote-form button[type=submit]').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Borrador temporal de prueba')
 assert row.count()==1
 id=row.locator('td').first.inner_text().split('\n')[0]
 row.get_by_role('button',name=f'Opciones de {id}').click()
 assert page.get_by_role('menuitem',name='Eliminar borrador').is_visible()
 page.screenshot(path=str(root/'screenshot-eliminar-borrador.png'))
 page.get_by_role('menuitem',name='Eliminar borrador').click(); confirm_in_page()
 assert page.locator('.last-quotes tbody tr').filter(has_text='Borrador temporal de prueba').count()==0
 # same folio cannot be reused
 page.locator('#quote-form [name=project]').fill('Segundo borrador')
 page.locator('#quote-form button[type=submit]').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Segundo borrador')
 new_id=row.locator('td').first.inner_text().split('\n')[0]
 assert int(new_id[4:])>int(id[4:]),(id,new_id)
 row.get_by_role('button',name=f'Opciones de {new_id}').click()
 page.get_by_role('menuitem',name='Indicar canal de envío…').click()
 page.locator('#workflow-form button[type=submit]').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Segundo borrador')
 assert 'Enviada' in row.inner_text()
 row.get_by_role('button',name=f'Opciones de {new_id}').click()
 assert page.get_by_role('menuitem',name='Eliminar borrador').count()==0
 page.keyboard.press('Escape')
 # from CRM detail
 page.get_by_role('button',name='Cotizador',exact=True).click()
 page.locator('#quote-form [name=project]').fill('Temporal historial CRM')
 page.locator('#quote-form button[type=submit]').click()
 page.get_by_role('button',name='Clientes / CRM').click()
 page.get_by_role('button',name='Camila Rodríguez',exact=True).click()
 history=page.locator('.client-detail-dialog .history-table-wrap').nth(1)
 row=history.locator('tr').filter(has_text='Temporal historial CRM')
 assert row.count()==1
 qid=row.locator('small').first.inner_text().split(' · ')[0]
 row.get_by_role('button',name=f'Opciones de {qid}').click()
 page.get_by_role('menuitem',name='Eliminar borrador').click(); confirm_in_page()
 assert page.locator('.client-detail-dialog').is_visible()
 assert 'Temporal historial CRM' not in page.locator('.client-detail-dialog').inner_text()
 assert not errors,errors
 print('OK eliminar borrador desde Cotizador y CRM; folios:',id,new_id,qid,'errores:',errors)
 b.close()
