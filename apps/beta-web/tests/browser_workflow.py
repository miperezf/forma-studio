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
import json

def init(page):
 page.evaluate('''() => { let bag = new Map(); Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return bag.get(k)??null},setItem(k,v){bag.set(k,v)},removeItem(k){bag.delete(k)}}}); }''')
 page.set_content(html,wait_until='domcontentloaded')

with sync_playwright() as p:
 b=p.chromium.launch(**LAUNCH)
 page=b.new_page(viewport={'width':1460,'height':950},device_scale_factor=1)
 page.set_default_timeout(5500)
 errors=[]
 page.on('pageerror',lambda err: errors.append(str(err)))
 init(page)
 page.get_by_role('button',name='Cotizador',exact=True).click()
 assert page.locator('#quote-form').count()==1
 page.locator('#quote-form [name=project]').fill('Prueba flujo FORMA')
 page.locator('#quote-form button[type=submit]').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Prueba flujo FORMA')
 assert row.count()==1
 qid=row.locator('td').first.inner_text().split('\n')[0]
 assert 'Borrador' in row.inner_text()
 row.get_by_role('button',name=f'Opciones de {qid}').click()
 page.get_by_role('menuitem',name='Editar condiciones del borrador').click()
 page.locator('#quote-conditions-form [name=validDays]').fill('15')
 page.locator('#quote-conditions-form [name=terms]').fill('Entrega por coordinar')
 page.locator('#quote-conditions-form button[type=submit]').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Prueba flujo FORMA')
 row.get_by_role('button',name=f'Opciones de {qid}').click()
 page.get_by_role('menuitem',name='Indicar canal de envío…').click()
 assert 'Ya enviaste' in page.locator('#workflow-form').inner_text()
 page.locator('#workflow-form button[type=submit]').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Prueba flujo FORMA')
 assert 'Enviada' in row.inner_text()
 row.get_by_role('button',name=f'Opciones de {qid}').click()
 page.get_by_role('menuitem',name='Solo marcar aceptada').click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Prueba flujo FORMA')
 assert 'Aceptada' in row.inner_text()
 row.get_by_role('button',name=f'Opciones de {qid}').click()
 page.get_by_role('menuitem',name='Convertir a pedido').click()
 assert page.locator('#workflow-form').is_visible()
 page.locator('#workflow-form [name=dueDate]').fill('2026-11-05')
 page.locator('#workflow-form button[type=submit]').click()
 page.screenshot(path=str(root/'screenshot-workflow-quotes.png'),full_page=True)
 page.get_by_role('button',name='Pedidos',exact=False).first.click()
 orderrow=page.locator('table tbody tr').filter(has_text='Prueba flujo FORMA')
 assert orderrow.count()==1
 assert 'Pendiente de pago' in orderrow.inner_text()
 orderid=orderrow.locator('.table-sub').first.inner_text().split(' ')[0]
 orderrow.get_by_role('button',name=f'Más acciones de {orderid}').click()
 page.get_by_role('menuitem',name='Registrar abono').click()
 form=page.locator('#payment-form')
 assert form.is_visible()
 form.locator('[name=amount]').fill('1000')
 form.locator('button[type=submit]').click()
 orderrow=page.locator('table tbody tr').filter(has_text='Prueba flujo FORMA')
 assert 'Abonado' in orderrow.inner_text()
 # Production transition and payment different
 orderrow.get_by_role('button',name='Pasar a Preparación').click()
 orderrow=page.locator('table tbody tr').filter(has_text='Prueba flujo FORMA')
 assert 'Preparación' in orderrow.inner_text()
 orderrow.locator('[data-order-detail]').click()
 assert 'Abono registrado' in page.locator('.workflow-dialog').inner_text()
 page.locator('.workflow-dialog [data-close]').first.click()
 page.screenshot(path=str(root/'screenshot-workflow-orders.png'),full_page=True)
 # Revision with recalculation retaining history
 page.get_by_role('button',name='Cotizador',exact=True).click()
 row=page.locator('.last-quotes tbody tr').filter(has_text='Prueba flujo FORMA')
 row.get_by_role('button',name=f'Opciones de {qid}').click()
 page.get_by_role('menuitem',name='Nueva revisión y recotizar').click()
 assert page.locator('.workflow-repricing').is_visible()
 page.locator('#quote-form [name=quantity]').fill('5')
 page.locator('#quote-form button[type=submit]').click()
 assert page.locator('.last-quotes tbody tr').filter(has_text='Revisión 2').count()==1
 page.get_by_role('button',name='Clientes / CRM').click()
 page.get_by_role('button',name='Camila Rodríguez',exact=True).click()
 assert 'Prueba flujo FORMA' in page.locator('.client-detail-dialog').inner_text()
 page.locator('.client-detail-dialog .dialog-actions [data-close]').click()
 assert not errors, errors
 print('Desktop workflow success:',qid,orderid,'errors:',errors,flush=True)
 m=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
 m.on('pageerror',lambda err:errors.append(str(err)))
 init(m)
 m.get_by_role('button',name='Cotizador',exact=True).click()
 m.screenshot(path=str(root/'screenshot-workflow-mobile.png'),full_page=True)
 print('mobile document width',m.evaluate('document.documentElement.scrollWidth'),'viewport',m.evaluate('window.innerWidth'),flush=True)
 assert not errors,errors
 b.close()
