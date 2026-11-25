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
  browser=p.chromium.launch(**LAUNCH)
  page=browser.new_page(viewport={'width':1440,'height':940},device_scale_factor=1)
  page.set_default_timeout(6500)
  errors=[]
  page.on('pageerror',lambda err:errors.append(str(err)))
  page.set_content(html,wait_until='domcontentloaded')
  page.get_by_role('button',name='Cotizador',exact=True).click()
  page.locator('#quote-form [name=project]').fill('Flujo simplificado v052')
  page.locator('#quote-form button[type=submit]').click()
  row=page.locator('.last-quotes tbody tr').filter(has_text='Flujo simplificado v052')
  assert row.count()==1
  quote_id=row.locator('td').first.inner_text().split('\n')[0].strip()
  assert 'Borrador' in row.inner_text(),row.inner_text()
  row.get_by_role('button',name='Ya la envié').click()
  row=page.locator('.last-quotes tbody tr').filter(has_text='Flujo simplificado v052')
  assert 'Enviada' in row.inner_text(),row.inner_text()
  assert page.locator('#workflow-form').count()==0
  row.get_by_role('button',name='Aceptar + pedido').click()
  modal=page.locator('#workflow-form')
  assert modal.is_visible()
  assert modal.locator('select[name=channel]').count()==1
  assert modal.locator('input[name=dueDate]').count()==1
  modal.locator('[name=dueDate]').fill('2026-11-04')
  modal.locator('button[type=submit]').click()
  row=page.locator('.last-quotes tbody tr').filter(has_text='Flujo simplificado v052')
  assert 'Aceptada' in row.inner_text(),row.inner_text()
  assert row.get_by_role('button',name='Aceptar + pedido').count()==0
  row.get_by_role('button',name=f'Opciones de {quote_id}').click()
  page.get_by_role('menuitem',name='Ver ficha y trazabilidad').click()
  assert page.locator('.workflow-linked').count()==1
  assert 'Pedido vinculado' in page.locator('.workflow-linked').inner_text()
  page.locator('.workflow-dialog [data-close]').first.click()
  page.get_by_role('button',name='Pedidos',exact=False).first.click()
  assert page.locator('table tbody tr').filter(has_text='Flujo simplificado v052').count()==1
  page.get_by_role('button',name='Cotizador',exact=True).click()
  page.screenshot(path=str(root/'screenshot-beta-v060.png'),full_page=True)
  assert not errors, errors
  print('OK desktop: quick send + acceptance/order single modal + no duplicate,',quote_id)
  # Separate accepted only (no order)
  page.locator('#quote-form [name=project]').fill('Aceptación sin pedido v052')
  page.locator('#quote-form button[type=submit]').click()
  row=page.locator('.last-quotes tbody tr').filter(has_text='Aceptación sin pedido v052')
  row.get_by_role('button',name='Ya la envié').click()
  row=page.locator('.last-quotes tbody tr').filter(has_text='Aceptación sin pedido v052')
  qid=row.locator('td').first.inner_text().split('\n')[0].strip()
  row.get_by_role('button',name=f'Opciones de {qid}').click()
  page.get_by_role('menuitem',name='Solo marcar aceptada').click()
  row=page.locator('.last-quotes tbody tr').filter(has_text='Aceptación sin pedido v052')
  assert 'Aceptada' in row.inner_text()
  assert row.get_by_role('button',name='Crear pedido').is_visible()
  assert page.locator('#workflow-form').count()==0
  print('OK accepted-only without extra confirmation')
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
  mobile.on('pageerror',lambda err:errors.append(str(err)))
  mobile.set_content(html,wait_until='domcontentloaded')
  mobile.get_by_role('button',name='Cotizador',exact=True).click()
  mobile.screenshot(path=str(root/'screenshot-beta-v060-mobile.png'),full_page=True)
  assert mobile.evaluate('document.documentElement.scrollWidth')<=mobile.evaluate('window.innerWidth')+2,(mobile.evaluate('document.documentElement.scrollWidth'),mobile.evaluate('window.innerWidth'))
  assert not errors,errors
  print('OK mobile viewport 390 without page overflow')
  browser.close()
