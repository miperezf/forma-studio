# Changelog

## 0.15.0 — 2026-10-22 (operación diaria: panel «Hoy», inventario y productos frecuentes)
Aprobado por el propietario el 2026-10-21 («Apruebo vamos»), con favicon y título pedidos el mismo día.
- **Favicon y título:** ícono de la marca (cubo verde) en SVG, PNG 32 px e ícono de inicio de iPhone. Van incrustados en el archivo publicado, así que no hay archivos extra ni cambios en la CSP. La pestaña dice «Pedidos (3) · FORMA Studio», «Cotizador · FORMA Studio», etc. Fuera de producción agrega «· Staging» o «· Demo». El título fijo ya no muestra «Beta 0.x»; la versión queda en `<meta name="forma-version">`.
- **Panel «Hoy»** al inicio del panel, con resumen («1 atrasado · 2 por entregar en 3 días · $211.000 por cobrar…») y cuatro tarjetas que abren el pedido, la cotización o el material:
  - producción y entregas, ordenadas por fecha, con «atrasado», «hoy», «mañana» o «en N días»;
  - cotizaciones esperando respuesta y su vencimiento;
  - por cobrar, con los entregados primero;
  - filamento bajo.
- **Recordatorio de respaldo** cuando pasan 7 días o más sin respaldo, con botón para descargarlo.
- **Stock mínimo:** campo «Avisar cuando queden menos de (g)» en cada material. Se compara con lo **disponible** (físico − comprometido); 250 g por defecto y 0 desactiva el aviso. La tarjeta muestra «stock bajo».
- **Movimientos por material:** botón «Movimientos» con la fecha y el efecto en el físico y en lo comprometido. Muestra los ajustes manuales (desde 0.15 se registra cada cambio de stock al editar), las reservas y liberaciones y los consumos reales (producción, reimpresión, desperdicio, corrección), con enlace al pedido.
- **Resultado del pedido (real vs. cotizado):** filamento cotizado (incluida su provisión de fallas) frente al registrado, valorizado al costo por gramo de la cotización. Con el consumo de Producción registrado se ve la **utilidad con consumo real**; el resto de los costos se mantiene como en la cotización.
- **Productos frecuentes:** «Guardar como producto frecuente…» desde cualquier cotización. Guarda placas, filamentos, tiempos y extras, sin precio ni cliente. «Cotizar este» lo carga al inicio del cotizador y recalcula con los costos actuales, y avisa si algún material ya no existe. Nueva colección `products`, con reglas de solo propietario y que viaja en el respaldo; un respaldo anterior sin productos se sigue aceptando.
- **Duplicar como nueva cotización** (misma configuración, folio nuevo, la original intacta) y **Enviar por WhatsApp**, que abre WhatsApp con el texto de la cotización y el teléfono del cliente si existe. Abrirlo no la marca como enviada.
- Pruebas nuevas: agenda, stock bajo, movimientos, real vs. cotizado, productos, WhatsApp y respaldo (8 unitarias). Reglas de productos (emulador). E2E del panel, el inventario, el resultado y los productos, en módulos y en archivo único.

## 0.14.0 — 2026-10-21 (multicolor real: importar desde Bambu Studio · producto con varias placas)
Aprobado por el propietario el 2026-10-21 («Apruebo vamos»). Validado con su archivo real `Color_Test_AMS___No_AMS.gcode.3mf`: 1 placa, 23 min (1.385 s), 4,24 g en 4 colores (1,26 / 0,70 / 0,95 / 1,33 g), Bambu Lab A1, Bambu Studio 02.08.02.61.
- **Importar desde Bambu Studio:** botón al inicio del cotizador para elegir el `.gcode.3mf`. Se exporta con «Laminar todas las placas» y luego Archivo → Exportar → «Exportar todas las placas laminadas». El archivo **se lee en el navegador y no se sube a ningún lado**. Carga por placa el tiempo, los gramos de cada color (incluyen purga y torre), la impresora (si está en el taller) y el nombre del modelo. Con una sola placa, las piezas por placa se toman de los objetos del archivo. Un proyecto sin laminar muestra cómo exportarlo.
- **Colores del archivo → tu inventario:** cada color del archivo se asocia al material más parecido (mismo tipo y color más cercano; la marca desempata), con aviso «✓ coincide», «revisa el color» o «sin ese tipo en inventario». Cambiar la asociación actualiza ese color en todas las placas.
- **Producto con varias placas:** «＋ Agregar placa» crea placas 2 a 8. Cada una tiene sus filamentos (1 a 4), su tiempo en h + min y cuántas unidades salen de ella; se pueden quitar placas y colores. El motor ya soportaba varias placas: no cambian las fórmulas. Cada placa se cobra con su propio tiempo y gramos, y las placas requeridas son `ceil(N / unidades por placa)` por placa.
- **Desglose por placa** en el precio sugerido: impresiones, tiempo y gramos de cada una, y costo directo. El tiempo total se muestra en h + min.
- **Trazabilidad:** la cotización guarda `extraPlates` e `importedFrom` (archivo, laminador, impresora) en el `formState`; las placas importadas van al motor con origen `SLICER_IMPORT`. Recotizar restaura todas las placas. La reserva del pedido incluye los filamentos de todas las placas.
- **Guardia nueva del archivo único:** falla al compilar si dos módulos declaran el mismo nombre. Durante el desarrollo detectó un caso que habría dejado la página en blanco solo en la versión publicada (staging y producción usan el archivo único).
- Pruebas nuevas: lector `.gcode.3mf` (8, con archivos **sintéticos** en `apps/beta-web/tests/fixtures`), cotizador con varias placas (9 en TypeScript) y E2E de importación y varias placas, en módulos y archivo único.

## 0.13.0 — 2026-10-21 (pedidos sin miedo · prueba de usabilidad 0.12)
Aprobado por el propietario el 2026-10-21 («Apruebo vamos»), a partir de la prueba de usabilidad `docs/ux/PRUEBA_USABILIDAD_0.12.md`.
- **Corregir un avance:** «Volver a «estado anterior»…» desde el menú ⋯ o el detalle. Retrocede un paso, pide motivo (mínimo 3 caracteres) y queda en el historial como «Corrección de estado». Al volver desde Entregado se borra la fecha de entrega. No toca importes, abonos, reserva ni consumos.
- **Anular pedido** (nunca se borra): pide motivo, con sugerencias rápidas. Libera la reserva de filamento, saca el pedido de «Por atender», de las ventas y de los contadores, y no admite nuevos abonos. Conserva historial, abonos y consumos reales. Es definitivo: para rehacer el trabajo se crea una revisión de la cotización.
- **Siguiente paso en vez de selector:** cada pedido muestra un botón («Pasar a Preparación», «Marcar entregado» o «Registrar abono») y un menú ⋯. Filtros Por atender / Entregados / Anulados / Todos, búsqueda y total por cobrar. En escritorio, las acciones siempre visibles; en el celular, tarjetas.
- **El consumo sale de la tabla:** al «Marcar entregado» se pide el consumo real, precargado con lo reservado, con la opción «Lo registro después». Registrar consumo, liberar reserva y abonos quedan en el detalle del pedido: etapas, cobro, filamento y movimientos.
- **Cotizador:** tiempo en **h + min**, como Bambu Studio («2h 4m»). Gramos con decimales libres (24,73 g). Los errores aparecen **junto al campo**, en rojo; al guardar se enfoca el campo con problema y nunca hay un rechazo silencioso. Los filamentos se muestran «PLA Basic Blue · Bambu Lab · 1,2 kg disp.», sin repetir el color.
- **Detalles:** el panel de producción no muestra el banner ni contadores «00». Las muestras claras (blanco, amarillo) tienen borde y número oscuro. La barra inferior del celular tiene texto y acceso a Configuración.
- **Reglas de Firestore:** el historial del pedido solo se agrega. La anulación exige motivo, es definitiva (estado y motivo inmutables) y ya no admite abonos. Pruebas en el emulador.
- Pruebas nuevas: corrección y anulación (8 unitarias), reglas (2, emulador) y E2E «pedidos sin miedo» (h + min, error junto al campo, volver atrás, entregar con y sin consumo, anular, filtros, celular), en módulos y en el archivo único. Se ajustaron las E2E existentes al nuevo flujo de pedidos.

## 0.12.0 — 2026-10-21 (inventario: físico / comprometido / disponible)
Aprobado por el propietario el 2026-10-21.
- **Reserva al crear el pedido:** aceptar + pedido reserva el filamento estimado de la cotización (incluye AMS y última placa v2). La reserva nace en la misma transacción que el pedido, así que no se duplica entre dispositivos. **No descuenta el stock físico.**
- **Tres cifras por material:** Físico (carretes + abierto; solo lo mueven consumos reales), Comprometido (reservas activas) y Disponible (físico − comprometido). Cada tarjeta de material las muestra.
- **Cotizador:** el control de stock usa el **disponible**, así que avisa si el material ya está comprometido en otros pedidos.
- **Consumo real:** el diálogo viene precargado con lo **reservado**. El registro de tipo Producción descuenta el físico y **libera la reserva completa**; Reimpresión, Desperdicio y Corrección no la liberan. «Liberar reserva» queda en el detalle del pedido, con confirmación.
- **Detalle del pedido:** «Reservado (comprometido)» o «Reservado · liberado (motivo)» frente a «Registrado (real)», más el historial.
- **Reglas de Firestore:** los gramos y la fecha de la reserva son inmutables, solo se permite ACTIVE → RELEASED y no se puede quitar ni reactivar. Prueba en el emulador.
- Pruebas: inventario (10), reglas de reserva (emulador) y E2E con reserva y liberación (local y nube).

## 0.11.1 — 2026-10-21
- ESLint `no-dynamic-delete` (4 casos en el cotizador: filas AMS y datos de la última placa) → `Reflect.deleteProperty`. Nuevo `npm run lint:guard` (sin dependencias) para detectar este error antes de enviar una versión.

## 0.11.0 — 2026-10-21 (motor calculation/v2: última placa real · consumo real de inventario)
Aprobado por el propietario el 2026-10-21 (diseño: `docs/architecture/DISENO_PLACAS_V2.md`). Incluye lo no publicado de 0.10.0.
- **Motor v2** registrado junto a v1. Las cotizaciones nuevas guardan `calculationVersion: v2`; las históricas v1 se reproducen siempre con v1 y no se recalculan.
- **Placas completas + última placa:** el cotizador muestra en vivo «N placas completas de P piezas + 1 última placa con R piezas». La última placa admite su **tiempo y gramos por color** (AMS incluido) rebanados en Bambu Studio con las piezas restantes, y el motor los usa tal cual. No se asume proporcionalidad de tiempo, luz, desgaste, purga ni preparación.
- **Sin esos datos:** se usa la estimación conservadora (como placa completa, igual a v1), marcada «Estimación provisional» con un aviso interno `LAST_PLATE_ESTIMATED` (WARNING, emitible si cumple el resto de las reglas). Nunca se presenta como consumo exacto.
- **Equivalencia:** con placas completas, o sin datos de la última placa, v2 da los mismos ítems, totales y precio que v1 (300 casos aleatorios). Los costos por placa, unidad y lote quedan separados y el cambio de placa se cobra por placa física.
- **Trazabilidad:** el snapshot guarda `lastRun` (piezas, gramos por material y horas), `fullPlates`, `remainderParts` y el origen de la última placa (SLICED / ESTIMATED_FULL_PLATE). Los ítems de la última placa usan `plateId` `<placa>.last`.
- **Inventario (corrige 0.10.0):** pasar a «En producción» ya NO descuenta stock. «Consumo» en cada pedido registra el consumo **real** (producción, reimpresión, desperdicio, corrección), precargado con la estimación de la cotización y editable. Solo esos registros mueven el stock, una vez por registro (id único). En la nube, pedido y materiales se actualizan en una sola transacción. El detalle del pedido compara estimado y registrado. Reglas de Firestore: los consumos solo se agregan.
- Etiquetas: «Filamentos de la placa completa», «Piezas en la placa completa», «Tiempo de la placa completa». Formato chileno en horas y márgenes. La producción no muestra la versión del motor.
- Pruebas nuevas: motor v2 (15, con propiedad de equivalencia), cotizador v2 (9), inventario (7), reglas de consumos (emulador), E2E de última placa y consumo real (módulos y archivo único).

## 0.10.0 — 2026-10-21 (multicolor AMS, inventario, CRUD de materiales, interfaz de producción limpia)
- **Cotización multicolor (Bambu Lab A1 + AMS lite)** — propuesta A elegida por el propietario: en «¿Con qué lo fabricaremos?» la lista «Filamentos de la placa» (color, filamento, g por placa) con «＋ Agregar color (AMS lite · hasta 4)», quitar color y total por placa; con un solo color se ve como antes. Los gramos de cada filamento se copian de Bambu Studio (incluyen la purga). Ya no es un extra de la sección 04. El motor calcula el costo de cada filamento a su precio; el snapshot guarda todos los materiales usados; recotizar conserva los colores. Un material repetido en dos posiciones se suma.
- **Control de stock en el cotizador:** «Filamento del trabajo» muestra gramos necesarios por material (gramos por placa × placas) y el stock disponible o el faltante.
- **Consumo de inventario:** al pasar un pedido a «En producción» se descuenta UNA vez el filamento cotizado (primero el carrete abierto, luego carretes cerrados); queda registrado en el pedido (evento y detalle «Filamento descontado») e informa faltantes. Entregar no vuelve a descontar; los pedidos manuales (sin cotización) no descuentan.
- **Materiales CRUD:** «Eliminar» en la edición del material, con confirmación en la página (avisa si hay borradores que lo usan). Las cotizaciones y pedidos guardados conservan precios y consumos.
- **Producción sin ruido:** se ocultan el indicador de entorno, la tarjeta «Tu taller, organizado», «Alcance de la beta», «Modo demostración», el origen del catálogo, el proyecto Firebase y la nota técnica del cotizador (solo queda el aviso si el régimen no está confirmado). El perfil lateral muestra el correo de la sesión. Textos «beta» reemplazados en todas las vistas.
- Pruebas: multicolor (Vitest, 6), inventario (node:test, 4), E2E multicolor + consumo + eliminar material (módulos y archivo único) y E2E de la interfaz de producción (8 secciones sin avisos de demo/beta).

## 0.9.1 — 2026-10-21
- ESLint (`no-dynamic-delete`): al pasar un material de catálogo a «fuera del catálogo» los campos se quitan con `Reflect.deleteProperty`. Verificado en staging: material eSUN PLA+ guardado en Firestore con su referencia al catálogo.

## 0.9.0 — 2026-10-21 (Materiales desde catálogo)
- **Formulario de Materiales sin digitación manual:** marca → material → línea → color (muestras) → formato del carrete. Se autocompletan nombre, tipo, color y muestra, densidad, diámetro, temperaturas (si el fabricante las publica), secado, peso neto y del carrete vacío, código de barras (GTIN), acabados y ficha técnica.
- El operador solo digita **precio pagado por carrete**, **carretes cerrados** y (opcional) **gramos del carrete abierto**; `priceKg` y `stockKg` se calculan (el motor no cambia).
- Catálogo: instantánea de **Open Filament Database** (MIT © Open Filament Collective) con 10 marcas vendidas en Chile — Bambu Lab, eSUN, Elegoo, Creality, Polymaker, SUNLU, JAYO, Anycubic, Kingroon, Eryone — 340 líneas y 2.745 colores de 1,75 mm vigentes. Regenerable con `npm run catalog:filaments -- <repo OFD>`; la app no consulta la API en línea (funciona sin conexión y con la CSP estricta).
- Modo «Fuera del catálogo» para marcas que no están en la base (p. ej. marcas locales), con selector de color de muestra.
- Tarjeta de material con carretes + gramos, datos técnicos, código de barras y enlace a la ficha técnica; editar reabre la selección.
- Pruebas: catálogo y cálculo (node:test), documento Firestore válido (Vitest), E2E del formulario en módulos y en el archivo único publicado (incluye móvil).

## 0.8.1 — 2026-10-21 (corrección detectada en staging)
- El archivo único publicado no incluía `domain/backup.js`: «Descargar respaldo», «Restaurar» e «Importar datos de este navegador» fallaban solo en la versión publicada (los módulos sí funcionaban). `build-standalone.mjs` ahora falla si un módulo local importado no está en su lista.
- Nuevo `npm run e2e:standalone`: respaldo y flujo del motor sobre el archivo único que se publica.
- La versión del entorno se toma del `package.json` raíz (antes mostraba 0.6.1).

## 0.8.0 — 2026-10-21 (decisiones D1/D2/D6 + respaldo manual + producción preparada)
- **Decisiones del propietario (2026-10-21):** D2 aún no factura ⇒ régimen **no afecto a IVA** (precio al cliente sin IVA); D1 el IVA de las compras no se recupera ⇒ todo lo pagado es costo; D6 las comisiones de canal no llevan IVA. Aplicado como configuración inicial del taller de **producción**; staging conserva la demo con IVA.
- Configuración: casilla «Confirmo este régimen» (`taxRegimeConfirmed`); con ella desaparece el aviso «por confirmar». Cambiar de régimen (p. ej. al empezar a facturar) crea una nueva revisión del perfil; las cotizaciones guardadas conservan su snapshot.
- **Respaldo manual** (sin plan de pago): Configuración › Respaldo › «Descargar respaldo» (JSON con todo el taller) y «Restaurar desde archivo» (solo agrega lo que falta; nunca sobrescribe ni elimina). Funciona en modo local y nube.
- Scripts Windows: `CONFIGURAR_NUBE.cmd` usa el ZIP de versión más alta; nuevo `CREAR_PRODUCCION.cmd` (proyecto Firebase separado, confirmación escrita, verificaciones y reglas bloqueantes).
- Pruebas nuevas: régimen confirmado (Vitest), siembra de producción, respaldo (node:test), E2E de respaldo en navegador.

## 0.7.0 — 2026-10-21 (Gate F + Gate A, pendiente de verificación en staging)
- Modo nube: inicio de sesión con Google solo para el/los correo(s) propietario(s); pantalla de acceso y de cuenta no autorizada; «Cerrar sesión».
- Datos en Firestore (`workspaces/main/…`): clientes, materiales, impresoras, proyectos, pedidos, cotizaciones internas y documentos al cliente en colecciones separadas.
- Reglas de Firestore: denegado por defecto; montos e instantáneas de cotización inmutables; documento al cliente con lista blanca de campos; un solo pedido por cotización (`orderLocks`); pagos solo se agregan; contadores solo suben; pedidos no se eliminan.
- Operaciones comerciales idempotentes entre dispositivos: folio de cotización reservado en el servidor; aceptar+pedido transaccional; pagos con `paymentId`.
- Importación de datos locales del navegador a la nube (solo agrega lo que falta; marca `importedFrom`).
- Módulo puro `workspace-sync` (estado ⇄ documentos, plan de escrituras por lotes) y adaptador `infrastructure/firebase`; reglas de arquitectura R10–R11.
- `scripts/build-cloud.mjs <staging|production>` genera reglas, bundle Firebase, CSP con orígenes de Google y `firebase.json`.
- Pruebas de reglas con el emulador (`npm run test:rules`), E2E de UI con backend falso (`npm run e2e:cloud`).
- Corregido en la verificación de staging: la siembra demo marcaba el documento comercial (rechazado por la lista blanca) y el aviso de éxito aparecía aunque el guardado fallara; la regla de pagos rechazaba cualquier cambio en pedidos sin pagos previos (corte de lista vacía). Ambos casos tienen ahora prueba.

## 0.6.1 — 2026-10-20 (Gate 0 + Gate S preparado)
- D2: régimen tributario explícito (`taxRegime`) con validación de coherencia régimen/tasa; ya no se deduce de 0 %/19 %.
- Confirmaciones destructivas dentro de la página (eliminar borrador, archivar/eliminar cliente, restablecer datos).
- Etiqueta de entorno (`ENTORNO DEMO` / `STAGING · DATOS FICTICIOS` / `VISTA PREVIA · DATOS FICTICIOS`).
- Build de staging reproducible + `firebase.json` con CSP por hashes y cabeceras de seguridad; `robots.txt` y `noindex`.
- Scripts `deploy-staging.sh` (con verificación previa y E2E) y `deploy-production.sh` (bloqueado por release gate).
- Workflows de CI (herramientas reales) y despliegue de staging por GitHub Actions (manual, con secreto).
- E2E principal parametrizable: local, sitio staging con cabeceras de Firebase, o URL publicada (`FORMA_BASE_URL`).
- Vista previa publicada en claude.ai (interina, datos ficticios).
- Archivo standalone renombrado a `FORMA_STUDIO_BETA.html` (la versión va dentro).

## 0.6.0 — 2026-10-20 (Gate 1)
Motor `calculation/v1` integrado al cotizador; InternalQuote/CustomerQuote separados; migración 0.5.2; ver `docs/gate-1/`.
