# FORMA Studio — Beta 0.6.1

**0.6.1:** régimen tributario explícito en Configuración (afecto / no afecto + tasa, coherencia validada) · confirmaciones de
acciones destructivas dentro de la página · etiqueta de entorno · build de staging para Firebase Hosting (`npm run build:staging` en la raíz)
y variante de vista previa para claude.ai.

## Beta 0.6.0: el cotizador usa el motor `calculation/v1`

Misma interfaz y navegación aprobadas en la 0.5.2. Cambia lo que hay detrás del cotizador:

- **Precios del motor revisado** (`calculation/v1` vía `QuoteCalculator`), con los perfiles del taller (configuración, impresoras, materiales, canales),
  validados y versionados. El estimador demo quedó en `src/domain/legacy/` solo como referencia; la UI no lo usa.
- **Documento comercial separado**: la cotización interna y el documento del cliente se guardan en claves distintas
  (`forma-studio:internal:v2` / `forma-studio:customer:v2`). Copiar, WhatsApp e imprimir leen solo el documento comercial.
- **Política bajo el mínimo** (Configuración): Advertir · Ajustar precio al mínimo · Bloquear emisión. Con «Bloquear», el borrador se guarda
  pero aparece **No emitible** y «Ya la envié» se rechaza con el motivo.
- **Régimen tributario** (Configuración): afecto (19 %) o no afecto. Aviso interno: régimen **por confirmar**; no reemplaza asesoría tributaria.
- **Revisiones de perfil**: cada guardado de Configuración o edición de material sube su revisión; las cotizaciones guardan las revisiones usadas
  (ficha → trazabilidad) y nunca se recalculan.
- **Migración automática** desde la 0.5.2 (sin recalcular importes). La clave antigua queda intacta como respaldo.
  Un borrador calculado con el estimador demo muestra **No emitible**: crea una cotización nueva con el motor.

## Uso
- Archivo único: `dist/FORMA_STUDIO_BETA.html` (generado). Algunos navegadores no guardan datos en `file://`.
- Con persistencia: `npm run serve` y abrir <http://127.0.0.1:8000/index.html>.
- Pruebas: `npm test` (node:test, 53) · E2E: `python3 tests/browser_engine_flow.py` (y los otros `browser_*.py`).
  Variables opcionales: `FORMA_HTML`, `FORMA_OUT`, `CHROMIUM`.
- `src/vendor/forma-engine*.js` es **generado** desde `src/` del repositorio raíz (`npm run build:bridge`): no editar a mano.

---

# FORMA Studio — Beta 0.5.2: menos clics y confirmaciones

La beta mantiene el motor económico provisional; no integra todavía calculation/v1 de Claude. **No utilizar sus importes para presupuestos comerciales reales.**

## Flujo rápido

- **Ya la envié** (visible en cada borrador): registra *Enviada* inmediatamente al pulsarlo, sin formulario adicional. Es una declaración manual: copiar, imprimir o abrir WhatsApp **nunca** implica envío confirmado. El canal se anota como «No especificado». Para registrar el canal, abre **··· → Indicar canal de envío…**.
- **Aceptar + pedido** (visible en las cotizaciones enviadas): un único formulario pide fecha de entrega y canal de aceptación; registra la aceptación y crea el pedido en una operación validada, sin pasar por un segundo formulario.
- **Solo marcar aceptada** está en **···** para cuando el cliente acepta, pero aún no quieres abrir el pedido. No abre formulario extra; posteriormente puedes pulsar **Crear pedido**.
- **Rechazo:** mantiene un formulario para anotar el motivo, si corresponde. **Eliminar borradores o clientes:** continúa solicitando una sola confirmación por su naturaleza destructiva.
- El motor valida los estados, fechas y relaciones; bloquea pedidos duplicados, conserva el importe acordado y evita una aceptación parcial ante una fecha inválida.

Los datos se almacenan localmente. Abriendo HTMLs desde rutas diferentes es posible que el navegador no comparta el almacenamiento. Mantén una copia de la versión previa si tiene datos útiles.

---

# FORMA Studio — Beta 0.5.1: gestión de borradores y flujo comercial

Beta exploratoria basada en **Beta 0.5**. Conserva el CRM, el cotizador unificado, perfiles de impresora, materiales, proyectos y pedidos. El motor de costos sigue siendo **provisional**: esta beta **NO usa calculation/v1 ni QuoteCalculator de Claude** y **no debe emitir cotizaciones reales basadas en sus valores económicos**.

## Gestión de borradores (Beta 0.5.1)

- Desde **Cotizador → Últimos presupuestos guardados**, abre los **tres puntos (···)** del borrador y selecciona **Eliminar borrador**.
- También puedes hacerlo desde **Clientes / CRM → ficha del cliente → Historial de cotizaciones → ···**.
- La interfaz solicita confirmación explícita. La eliminación es definitiva y **solo se permite para cotizaciones en estado Borrador sin pedido ni referencias dependientes**. No borra clientes, pedidos ni cotizaciones anteriores.
- Los borradores de revisión se pueden eliminar sin modificar el presupuesto original.
- Los folios eliminados no se reutilizan, para evitar confusiones en el historial comercial.
- Los presupuestos enviados, aceptados, rechazados y vencidos se conservan (historial comercial inmutable). No hay papelera ni deshacer para los borradores eliminados.
- La lista del cotizador muestra los últimos 12 presupuestos; la ficha del cliente conserva el historial completo de sus cotizaciones.

## Flujo de cotización

1. En **Cotizador**, completa el trabajo y pulsa **Guardar borrador**.
2. En *Últimos presupuestos*, menú **···** → **Editar condiciones** (solo borrador), **Confirmar envío**; elige el canal de envío utilizado. Copiar WhatsApp o abrir la impresión **no cambia automáticamente el estado**.
3. Una cotización **Enviada** ofrece **Marcar como aceptada** o **Marcar como rechazada**. Ambos cambios requieren confirmación mediante formulario.
4. Una cotización **Aceptada** ofrece **Convertir a pedido**. Indica entrega pactada, y se crea un único pedido **Pendiente**, con cliente, proyecto, unidades, folio origen e importe acordado. La conversión duplicada está bloqueada.
5. Cotizaciones **Enviadas** superadas por su fecha límite pasan a **Vencida** al cargar o navegar en la aplicación. Borradores, aceptadas y rechazadas no caducan retroactivamente. La validez empieza **en la fecha de emisión** confirmada, no al guardar un borrador.
6. Los presupuestos enviados, aceptados, rechazados y vencidos conservan su precio. Para modificarlos hay dos acciones desde **···**: **Crear revisión con mismo precio** (nuevo borrador con importe copiado, sin recalcular) o **Nueva revisión y recotizar** (si existen entradas técnicas guardadas, abre el cotizador con ellas para generar otro folio y nuevo precio). La versión anterior nunca se sobrescribe.

Los cambios guardan eventos con fecha/hora, canal o motivo; consulta **··· → Ver ficha y trazabilidad**. El cliente también mantiene sus registros vinculados en el historial del CRM.

## Pedido y pagos

- Producción: **Pendiente → Preparación → En producción → Entregado**. La beta permite avanzar un estado por vez, no saltos arbitrarios. La entrega **no** significa pago.
- Pago: **Pendiente de pago → Abonado → Pagado**, derivado del total de abonos registrados. **Registrar abono** permite pago parcial o completo, con método, importe, fecha e historial. No acepta importes negativos, decimales CLP o superiores al saldo.
- Pedidos convertidos fijan el `agreedQuote` con importe y cantidad de la cotización aceptada; no cambian al editar después precios de filamento, máquinas o del taller.
- Las filas de pedido y las fichas muestran estado de producción y pago como campos separados. El Dashboard sigue mostrando pedidos entregados como importe operativo, **no como dinero cobrado**.
- Los pedidos manuales siguen disponibles, sin falsificar una referencia de cotización. En los datos de demostración, `COT-0203` y `PED-1048` están vinculados explícitamente; el resto de registros anteriores no se relacionan por coincidencia de importe o nombre.

## Archivos y arquitectura

- `src/domain/workflow.js`: dominio puro de transiciones, vencimiento, revisiones, integridad de pedidos, pagos e historial.
- `src/ui/app.js`: interfaces y formularios para el flujo, manteniendo la navegación y el cotizador de Beta 0.4.
- `src/data/repository.js`: repositorio local intercambiable; conserva la clave `app-web-3d-beta-v1` para migración cuando la procedencia del navegador coincide.
- `src/domain/customer-quote.js`: proyección comercial permitida para copia y PDF. No se envía el desglose interno; en esta beta sigue integrada dentro del objeto guardado y **no** tiene aún aislamiento físico ni reglas de Firestore.
- `tests/workflow.test.mjs`: reglas de negocio del flujo y pruebas negativas, añadidas a las pruebas anteriores.

```bash
npm test
npm run build:standalone
python -m http.server 8000
```

Abre `index.html` a través del servidor local para ejecutar los módulos ESM, o `../FORMA_STUDIO_BETA_0_5_2.html` como archivo independiente. Se ejecutaron **45 pruebas con `node:test`**, todas satisfactorias. También se verificó la eliminación de borradores desde el Cotizador y la ficha del cliente en Chromium, incluyendo la protección de folios y el bloqueo de eliminación de cotizaciones enviadas. Se completó un escenario E2E de la Beta 0.5 en Chromium con Playwright (Borrador → Enviada → Aceptada → Pedido → Abono → Preparación → Revisión recotizada → Historial CRM) y verificación móvil de 390 px, sin errores JavaScript. **No se usó Vitest**.

## Limitaciones importantes

- Todo persiste en `localStorage`, sin respaldo, cifrado específico, roles, ni sincronización remota. Aperturas `file://` desde ubicaciones distintas pueden mostrar almacenes distintos. Conserva una copia de datos importantes de betas anteriores; **no existe aún importación/exportación automática**.
- Los pagos se anotan manualmente; no hay confirmación bancaria, facturas ni conciliación contable. Las cotizaciones y pedidos de ejemplo tienen importes **simulados**, no verificables comercialmente.
- Los cambios de estado son manuales; no se integra la API de WhatsApp ni se confirma recepción o aceptación del cliente por medios externos.
- El vencimiento se evalúa al abrir o interactuar con la aplicación; no hay servicio en segundo plano o aviso automático cuando la página permanece inactiva.
- Se requiere integrar `calculation/v1`, `QuoteCalculator`, Firebase/Firestore, reglas de seguridad, identidad/autenticación y validación de producción antes de cualquier uso real.
