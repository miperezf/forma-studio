# FORMA Studio — `app-web-3d` · 0.6.1: motor `calculation/v1` en la Beta + staging preparado

Plataforma modular para un taller de impresión 3D en Chile. Este repositorio contiene:

| Parte | Ruta | Estado |
|---|---|---|
| Núcleo (`core`) | `src/core` | tipos de dinero/unidades, `Result`, validación, versionado, JSON canónico, puertos |
| Motor de cálculo v1 | `src/modules/calculation` | contratos + validadores, `v1/{tax,cost,pricing}`, **registro + fachada `QuoteCalculator`** |
| Documento comercial | `src/modules/customer-quote` | `CustomerQuote` (whitelist), texto WhatsApp, migración del documento de la Beta. **No importa el motor.** |
| Aplicación (cotizaciones) | `src/modules/quoting` | formulario (Zod) → perfiles tipados con revisión → `CalculationRequest` → `QuoteCalculator` → `InternalQuote` + `CustomerQuote` |
| Puente para la Beta | `src/app-bridge/beta-bridge.ts` | se empaqueta con esbuild en `apps/beta-web/src/vendor/forma-engine(.iife).js` |
| Beta visual (0.6.1) | `apps/beta-web` | UI aprobada de la 0.5.2 (JS plano) con el cotizador conectado al motor real y `MockRepository` con separación física |

Sin Firebase desplegado, sin parser GCODE/3MF, sin React todavía. **No es una versión de producción.**
Estado por gate: `docs/releases/ESTADO_GATES.md` · PRD: `docs/prd/PRD_MAESTRO.md` · staging: `docs/DEPLOY_STAGING.md`.

## ⚠️ Estado de la verificación (leer primero)

El registro npm está bloqueado en el entorno donde se escribió (proxy: `403 host not allowed`). No se instaló nada desde npm.
Herramientas disponibles: TypeScript 6.0.3 y tsx (globales), **zod 3.25.76 y esbuild 0.28.2 preinstalados** en el sistema, Node 22 (`node:test`), Python Playwright 1.56 + Chromium.

| Herramienta | ¿Se ejecutó realmente? | Resultado |
|---|---|---|
| `tsc` estricto (código + tests + pruebas de tipos `*.test-d.ts`) | ✔ SÍ | 0 errores |
| `scripts/check-architecture.mjs` (reglas R1–R9) | ✔ SÍ | 0 violaciones en 151 archivos; 5 violaciones sembradas detectadas |
| Tests TS (`src/**/*.test.ts`) | ⚠️ **solo con shim** | **947/947** con un shim local de la API de Vitest sobre `node:test`. **No es Vitest.** El shim no se incluye. |
| Test runner de Node (Beta, `apps/beta-web/tests/*.test.mjs` + `legacy/`) | ✔ SÍ (real) | **53/53** (45 originales adaptados + 8 de integración nuevas) |
| E2E navegador (Playwright + Chromium) | ✔ SÍ (real) | 4/4 scripts: 3 originales (parametrizados) + `browser_engine_flow.py` |
| Mutaciones manuales sobre la integración | ✔ SÍ | 20/20 detectadas |
| esbuild (bundle de la Beta) | ✔ SÍ | `forma-engine.js` (ESM) y `forma-engine.iife.js` |
| **Vitest** | ✘ **NO** | no instalable aquí |
| **ESLint** | ✘ **NO** | no instalable; `eslint.config.js` sin probar |
| **dependency-cruiser** | ✘ **NO** | no instalable; lo cubre en parte `check-architecture.mjs` |
| **fast-check** | ✘ **NO** | los barridos usan generadores con semilla fija |
| **tsd** | ✘ **NO** | pruebas de tipos con `tsc` + `@ts-expect-error` |

Hasta correr `npm install && npm run check` con acceso al registro (CI: `.github/workflows/ci.yml`), "947 pasan" significa "pasan con el shim local".

## Comandos

```bash
npm install                 # zod ^3.25 (API v3: NO actualizar a v4 sin migrar form.ts/shop-data.ts), esbuild, vitest, eslint…
npm run typecheck           # tsc estricto: código y tests
npm run arch                # reglas de capas R1–R9 (solo Node, sin dependencias)
npm test                    # Vitest (no ejecutado en este entorno)
npm run build:bridge        # motor + aplicación → apps/beta-web/src/vendor/forma-engine(.iife).js
npm run build:standalone    # apps/beta-web/dist/FORMA_STUDIO_BETA.html (un solo archivo)
npm run build:staging       # apps/beta-web/dist/staging + firebase.json (CSP por hashes)
npm run e2e:staging         # E2E sobre el sitio staging con las cabeceras de firebase.json
npm run deploy:staging      # verificación + despliegue (requiere .firebaserc y login; ver docs/DEPLOY_STAGING.md)
npm run test:beta           # node --test de la Beta (no necesita npm install)
npm run e2e                 # Playwright (Python) + Chromium: 4 recorridos
npm run check               # typecheck + arch + test + lint + depcruise
```

Abrir la Beta: `apps/beta-web/dist/FORMA_STUDIO_BETA.html` (doble clic; sin persistencia si el navegador bloquea
`localStorage` en `file://`) o servirla: `python3 -m http.server 8000 --directory apps/beta-web` → <http://127.0.0.1:8000/index.html>.

## Estructura

```
src/core/                       núcleo puro (sin dependencias externas)
src/modules/calculation/        motor puro: contracts/, v1/{tax,cost,pricing}/, calculator.ts (registro + QuoteCalculator)
src/modules/customer-quote/     documento comercial (whitelist) — no conoce el motor
src/modules/quoting/            aplicación: form.ts, shop-data.ts, profiles.ts, mapper.ts, service.ts, internal-quote.ts, presentation.ts
src/app-bridge/beta-bridge.ts   composición para la Beta (infraestructura)
apps/beta-web/                  Beta 0.6.0: index.html, src/{ui,domain,data,vendor}, tests/, scripts/build-standalone.mjs
docs/gate-1/                    mapa de compatibilidad, plan de integración, informe de entrega
scripts/                        check-architecture.mjs, build-beta-bridge.mjs
```

## Reglas de dependencia (verificadas por `npm run arch`)

- **R1** `core` solo importa `core` (orden interno de capas), sin paquetes externos. **R2** `calculation` solo importa `core/{types,result,validation,money,versioning}` y a sí mismo.
- **R3** `customer-quote` nunca importa `calculation` (la fuga de costos se corta por construcción). **R7** `customer-quote` solo usa `core/{types,result,validation}`.
- **R8** `quoting` importa `calculation` y `customer-quote` **solo por su index público**; único paquete externo: `zod`.
- **R9** `calculation` y `customer-quote` nunca importan `quoting` ni `app-bridge`.
- **R4** sin `Date`, `Math.random`, `localStorage`, `window`, `Intl`, `console`… en `core`, `calculation`, `customer-quote` y `quoting` (la hora y el almacenamiento los inyecta la UI).
- **R5** sin números mágicos fuera de `constants.ts` · **R6** sin `any` explícito.

## Gate 1 · Cotizador de la Beta → servicio de aplicación → `QuoteCalculator` v1

```
UI (app.js, sin rediseño) ──FormData + extras + reloj──▶ quoteService.preview / createDraft
  quoting/form.ts       Zod: texto → números; vacío ≠ 0; extra apagado no aporta nada
  quoting/profiles.ts   datos de la Beta (validados con Zod) → perfiles tipados {id, revision}: costo, precio, IVA, canal, material, máquina
  quoting/mapper.ts     → CalculationRequest JSON → validateCalculationRequest (validador del motor)
  calculation           createQuoteCalculator().calculate(request)  (v1: calculateCost → calculatePricing)
  customer-quote        buildCustomerQuote(whitelist) · customerQuoteText
  ⇒ InternalQuote {calculation: {request, output}, calculationVersion, profileRefs, issuance, formState, montos congelados}
  ⇒ CustomerQuote  (otra colección / otra clave de almacenamiento)
```

- **BLOCK** permite guardar el borrador y bloquea «Ya la envié» (`issuanceProblem` en `workflow.js`); CAP sube el precio al mínimo efectivo; WARN advierte.
- **Replay**: `quoteService.replay(internal)` revalida el request guardado y compara canónicamente con el resultado guardado (detecta adulteración).
- **Inmutabilidad**: cambiar perfiles después no cambia cotizaciones ni pedidos; cada guardado de Configuración sube la revisión del perfil;
  editar un material sube su revisión.
- **Persistencia mock**: `forma-studio:internal:v2` (CRM, perfiles, pedidos, cotizaciones internas) y `forma-studio:customer:v2` (solo documentos comerciales).
  Escritura con reversión si falla la segunda clave. Migración automática desde `app-web-3d-beta-v1` (no recalcula montos; el origen queda como respaldo).
- **Legado**: el estimador demo (`estimateQuote`) y el `CustomerQuote` del prototipo quedan en `apps/beta-web/src/domain/legacy/` solo con sus tests;
  la UI no los importa (test que lo verifica). Un borrador demo (`DEMO-UI-0.3`) no se puede enviar: debe recotizarse.

Mapa campo por campo y decisiones D1–D13: `docs/gate-1/01_MAPA_COMPATIBILIDAD.md`. Informe completo: `docs/gate-1/03_INFORME_ENTREGA.md`.

## Procedimiento de recuperación

1. **La Beta muestra «Configuración del taller inválida»**: Configuración → Editar parámetros → Guardar (normaliza), o «Restablecer datos demo».
2. **Datos 0.5.2 perdidos tras actualizar**: la clave `app-web-3d-beta-v1` no se borra al migrar. En la consola del navegador:
   `localStorage.removeItem('forma-studio:internal:v2'); localStorage.removeItem('forma-studio:customer:v2'); location.reload()` → se vuelve a migrar.
3. **Volver a la Beta 0.5.2**: abrir el HTML 0.5.2 original; sigue leyendo `app-web-3d-beta-v1` (los cambios hechos en 0.6 no se ven allí).
4. **El bundle no corresponde al código**: `npm run build:bridge && npm run build:standalone` (o `node scripts/build-beta-bridge.mjs`).
5. **Zod v4 instalado por error**: `npm install zod@^3.25` (el código usa la API v3).
6. **Tests TS sin Vitest**: crear el shim descrito en `docs/gate-1/03_INFORME_ENTREGA.md` §4 (solo para entornos sin registro npm) — nunca reportarlo como Vitest.

## Capa cost (`calculation/v1/cost`)

### Pipeline

```
resolveQuantities → generadores (orden fijo) → [overrides de recuperación] → modelo de fallas
→ [overrides de recuperación sobre ítems FAILURE] → redondeo por ítem → desglose → autoverificación (invariantes)
```

`calculateCost(request)` recibe una solicitud ya validada y devuelve `{ breakdown, quantities, flags }` o un `CalculationError`.
Puro y determinista. Errores de entrada → `INVALID_INPUT` / `MISSING_PARAMETER` / `INCONSISTENT_SNAPSHOT`;
una invariante interna rota → `INTERNAL_INVARIANT`. Un costo nuevo = un generador nuevo (`options.generators`).

### Modelo de cantidades (confirmado)

| Magnitud | Definición |
|---|---|
| **N** | unidades vendidas |
| **B** | lotes de trabajo. Multiplica **solo** costos `PER_BATCH`. No recalcula placas; no se asume 1 lote = 1 placa; ninguna relación `B ↔ N ↔ placas` se valida |
| **placas** | `ceil(N × partsPerUnit / partsPerPlate)` por placa (política `WHOLE_PLATES`); la última puede quedar incompleta y las piezas sobrantes se informan (`surplusParts`) |
| **piezas extra** | `N × max(0, Σ partsPerUnit − 1)` (la primera pieza no se ensambla) |

Una planificación de producción real (placas y lotes efectivos) será del módulo de producción y **no** modifica esta fórmula base.

### Semántica de los comportamientos (`quantityFor`, única fuente de verdad)

| `behavior` | Multiplica por | Ejemplo | Nunca multiplica por |
|---|---|---|---|
| `PER_UNIT` | N | embalaje | placas, lotes |
| `PER_PLATE` | placas requeridas (de su `plateId`, o Σ) | material, electricidad, desgaste, supervisión, cambio de placa | N, lotes |
| `PER_BATCH` | B | preparación del trabajo | N, placas |
| `ONE_OFF` | 1, siempre | modelado 3D, desarrollo | N, B, placas |
| `PER_EXTRA_PART` | N × (Σ partsPerUnit − 1) | ensamblaje | placas, lotes |

Probado con un "probe" de cada comportamiento sobre 8 geometrías, aislamiento por variación (cambiar una magnitud mueve solo
sus costos) y un barrido de 400 casos con semilla fija.

### Fórmulas (todo en costo económico: sin IVA recuperable)

| Ítem (`code`) | Fórmula | Comportamiento |
|---|---|---|
| `material:<placa>:<material>` | `g × (1 + merma) × costo del rollo / g netos del rollo × placas` | PER_PLATE |
| `electricity:<placa>` | `horas × costo por hora × placas`; costo por hora = override de máquina **o** `W/1.000 × kWh` | PER_PLATE |
| `wear:<placa>` | `horas × desgaste por hora × placas`; override **o** `(compra − residual)/vida útil + reserva` | PER_PLATE |
| `supervision:<placa>` | `horas × ratio × tarifa SUPERVISION × placas` | PER_PLATE |
| `setup:job` | `min/60 × tarifa PREPARATION × B` | PER_BATCH |
| `setup:changeover` | `min/60 × tarifa PREPARATION × Σ placas` (0 min por defecto) | PER_PLATE |
| `service:<id>` | `(insumo + min/60 × tarifa) × quantityFor(behavior)` | según servicio |
| `aux:<code>` / `extra:<code>` | `costo económico × quantityFor(behavior)` | según definición |
| `failure:<código origen>` | `monto exacto del origen × p/(1−p) × costFraction` | hereda del origen |

Precedencias: merma override del material > perfil (0 es un override válido; no se aplica si el peso ya la incluye) · energía override > potencia ·
desgaste override > derivado · ratio de supervisión override de máquina > perfil · tarifa override del servicio > tarifa del tipo > base.

### Modelo de fallas (`GEOMETRIC_RETRY`, estrategia intercambiable)

- Costo esperado = costo / (1 − p) (con `costFraction = 1`); p = 50 % duplica el costo.
- Afecta solo los componentes configurados (por defecto: material, electricidad, desgaste, supervisión). No afecta preparación, ensamblaje ni postproceso.
- Tasa por **placa** (una falla pierde la placa completa): override de la cotización > mayor override entre los materiales de la placa > override de la máquina > perfil. Ítems sin placa: perfil.
- Cada ítem de falla hereda `behavior`, `plateId` y `recoveryConfig` del origen y declara `derivedFrom`; los ítems FAILURE no se vuelven a afectar.
- Sin ítems de falla en modo `TEST`, con el override `DISABLED` o con tasa efectiva 0.

### IVA recuperable y desgaste (revisión)

`vatRecoverable` (por ítem) y `recoverableVat` (total) son un **indicador informativo**: el IVA recuperable *contenido en las compras que
consume la cotización*. **No son un crédito fiscal nuevo generado por cada costo calculado**: el crédito real nace en la compra original
(factura del proveedor) y el ledger tributario del negocio lo reconoce **una sola vez**.

| Ítem | `vatRecoverable` | Razón |
|---|---|---|
| material, electricidad, insumos de servicios, `aux`/`extra` | IVA contenido en lo consumido, prorrateado, según régimen y datos de origen | compras reales |
| **desgaste** (override o derivado) y su falla | **siempre 0** | el IVA de la máquina se recuperó (o no) en su **adquisición**; no se reconoce de nuevo por impresión |
| supervisión, preparación (mano de obra) | 0 | no hay IVA |
| fallas de ítems con compras | proporcional al origen (más material consumido) | consumo adicional de compras reales |
| ítem `ABSORBED` | conserva su valor | no depende de la recuperación del costo |

Para el desgaste, el IVA solo decide el **costo económico** de la compra (neto si era recuperable; completo si no, o si el régimen es no afecto):
`desgaste/h = (costo económico de compra − costo económico del residual) / vida útil + reserva`. Si se necesitara distribuir el IVA de la máquina con fines
analíticos, debe ser un indicador **separado** del ledger tributario (no implementado).

En el ledger, `purchaseVatRecoverable` (= `breakdown.recoverableVat`) y `commissionVatRecoverable` se mantienen separados; el de la comisión **sí** es un
crédito nuevo (la factura de la plataforma ocurre a causa de la venta). `vatPayable = saleVat − recoverableVat` es **indicativo por cotización**, no la
declaración de IVA (que se hace por período con los créditos reales).

### Tasa de falla resuelta y procedencia (va al snapshot)

`CostBreakdown.failureRates` registra, por placa y para los ítems sin placa (`GLOBAL`), la tasa efectiva, su `source`
(`QUOTE_OVERRIDE` > `MATERIAL_OVERRIDE` > `MACHINE_OVERRIDE` > `PROFILE`), el `sourceId` que la aportó, el modelo, `costFraction` y si se aplicó
(`TEST_MODE` / `OVERRIDE_DISABLED` quedan registrados como no aplicados). Con varios materiales con override en una placa se toma el **mayor**:
**política conservadora** (el material más delicado manda sobre el riesgo de toda la placa; en empate, el primero por orden de filamentos).

### Fallas y costos únicos (sin doble amortización)

El ítem de falla hereda `behavior` y `recoveryConfig` del origen y se calcula desde el `rawAmount` **exacto** del origen
(`rawAmount × p/(1−p) × costFraction`), no desde el monto redondeado. Para un `ONE_OFF` amortizado, origen y falla se amortizan **cada uno desde su propio
monto** (`round(raw × N / overUnits)`), nunca la falla desde el `pooledAmount` del origen; y la falla de un `ONE_OFF` tampoco se multiplica por N, B ni placas.
Un override sobre el ítem de falla **reemplaza** (no se acumula con) el heredado.

> Para `v1/pricing`: los ítems `FAILURE` con `SEPARATE_LINE` deben agruparse en la línea de su ítem origen (`derivedFrom`), no generar línea propia.

### Redondeo y relación `amount` / `pooledAmount`

Cada ítem guarda `rawAmount` (exacto) y `amount = round(rawAmount)`; las sumas usan `amount`. Por eso las fallas se redondean ítem por ítem
(ver decisión 1 abajo). `pooledAmount` (qué parte entra al precio) y la identidad **Σ amount = pricingPool + absorbedCost + deferredCost**
están definidos en `contracts/invariants.ts` y el motor se autoverifica con ellos.

### Trazabilidad

Cada ítem cumple `rawAmount = basis.quantity × basis.unitCost × basis.multiplier`, donde `multiplier` es la **única** magnitud que lo multiplicó.
`vatRecoverable` (crédito fiscal prorrateado al consumo del ítem) se informa aparte y no depende de la recuperación del costo.

### Golden tests (valores calculados a mano)

| Caso | Pool de costo |
|---|---|
| Base: N=1, 120 g, 8 h, PLA $15.000/kg, fallas 8 % | **$13.885** (sin fallas: $12.907; fallas: 157 + 125 + 174 + 522 = 978) |
| N=10 en placas de 6 (2 placas, sobran 2 piezas) | $26.101 |
| B=3 lotes | $17.218 (solo cambia la preparación: $1.667 → $5.000) |
| Base + modelado 3D (línea separada) | $40.885 (el NRE aporta $27.000 una sola vez; también con N=50) |
| N=2, 3 piezas por unidad (6 placas) + ensamblaje + modelado | $115.970 (ensamblaje: 4 piezas extra × $3.500 = $14.000) |

| Base con desgaste derivado de una máquina de $450.000 (IVA recuperable) y 8.000 h | $12.122 (desgaste 378 + falla 33); **`recoverableVat` sigue en $670**: el IVA de la máquina no se reconoce por impresión |

> Nota: el ejemplo de la fase de diseño daba $13.884 porque redondeaba las fallas en un solo ítem agregado. Con ítems de falla heredando
> comportamiento y recuperación de su origen, cada uno se redondea por separado y el total es $13.885 (+$1). Los vectores de precios
> se recalcularán en `pricing`.

---

## Capa pricing (`calculation/v1/pricing`)

`calculatePricing(request, cost)` toma una solicitud validada y su desglose de costos y devuelve `{ pricing, flags }`. Puro y determinista.

### Fórmula de margen objetivo (acordada) y todo lo que se recalcula

```
margen        = utilidad / precio neto de venta
utilidad      = neto − comisión − costo económico        (definición única en v1/tax/ledger.ts; el IVA no interviene)
neto objetivo = (C + cargo fijo) / (1 − c_eff − margen objetivo)        C = pricingPool
piso          = (C + cargo fijo) / (1 − c_eff − margen mínimo)
equilibrio    = (C + cargo fijo) / (1 − c_eff)
c_eff         = comisión × (base BRUTA ? 1 + IVA de venta : 1) × (IVA de la comisión es costo ? 1 + p : 1)     (v1/tax)
```

Con c_eff + margen ≥ 1 (con tolerancia 1e-9) no existe precio: `INFEASIBLE_MARGIN`.

Flujo: neto objetivo → reparto por costo a las líneas → descuento (solo línea principal) → **redondeo comercial** → separación neto/IVA/bruto →
comisión sobre el precio efectivo → utilidad (ledger) → **margen efectivo**. Nada se hereda del cálculo teórico: margen, markup y flags salen de los precios finales.

### Líneas comerciales

| Línea | Qué agrupa | Cantidad |
|---|---|---|
| `main` | costos `IN_PRICE` (con su `pooledAmount`) | N |
| `<código del ítem origen>` | un costo `SEPARATE_LINE` **y todas sus fallas** (`derivedFrom`) | 1 |

- Una falla de un costo `SEPARATE_LINE` **nunca** genera una línea propia; se suma a la de su origen. El detalle completo queda en `sourceItemCodes` (solo interno).
- Una falla `SEPARATE_LINE` cuyo origen no es `SEPARATE_LINE` es `INVALID_INPUT`. Si una falla se reasigna a `IN_PRICE` por override, va a la línea principal (decisión explícita).
- El costo de las líneas suma **exactamente** el pool (cada ítem está en una sola línea; los `ABSORBED` en ninguna).
- Una línea separada con costo 0 no aparece, salvo que tenga precio fijo.

### `rawAmount` / `amount` / `pooledAmount` en un `ONE_OFF` amortizado

| | Depende de N | Valor (desarrollo $40.000, 100 unidades) |
|---|---|---|
| `rawAmount`, `amount` | **no** (un costo único no se multiplica por N) | $40.000 siempre |
| `pooledAmount` (lo que entra al precio) | **sí**, hasta el tope | N=10 → $4.000 · N=20 → $8.000 · N≥100 → $40.000 |
| `deferredCost` | sí (el resto) | $36.000 · $32.000 · $0 |

El aporte al neto objetivo es `pooledAmount / (1 − margen)`: constante por unidad hasta el tope y luego se diluye.

### Descuentos, redondeo y políticas

- **Descuento por tramos** según N (límites inclusivos), solo sobre la línea principal; override `DISCOUNT` (NONE / MANUAL) lo reemplaza. No se aplica a un `FIXED_UNIT_PRICE`.
- **Redondeo** `NONE` (al peso) o `STEP` (paso, dirección UP/NEAREST/DOWN, sobre neto o bruto). Se aplica al precio unitario y a cada línea separada; los totales salen de esos precios.
- **IVA**: el documento se separa a nivel total (bruto es la fuente de verdad si el cliente ve bruto; neto si ve neto); el neto/IVA por línea se reparte por mayor resto y suma exactamente el documento.
- **`WARN`** (por defecto): advierte `BELOW_MIN`. **`BLOCK`**: agrega `BLOCKED` (severidad `BLOCKING`): impide **emitir** (`isIssuable`), nunca calcular el borrador.
  **`CAP`**: garantiza margen efectivo ≥ mínimo **después de descuento, IVA y redondeo** (búsqueda del primer precio de la grilla que cumple), también cuando solo el redondeo lo rompe.
  No modifica un precio fijado por el usuario: si ese precio queda bajo el mínimo, se agrega `BLOCKED` (CAP no puede protegerlo ⇒ no emitible).
- **Margen comercial vs real (cierre):** `commercialUtility = neto − comisión − pool` gobierna la política; `realUtility = commercialUtility − absorbedCost`;
  márgenes y markups son `null` si el denominador es ≤ 0 (nunca 0 ni NaN). `REAL_MARGIN_BELOW_MIN` (WARNING) si solo el margen real queda bajo el mínimo.
- **Factibilidad explícita:** `INFEASIBLE_MARGIN {reason: EXCEEDS_LIMIT | AT_LIMIT}` (umbral 1e-9) y `NO_FEASIBLE_PRICE {reason: PRICE_OUT_OF_RANGE | SEARCH_EXHAUSTED}`; nunca se emite un precio no finito.
- **D13:** un override `TARGET_MARGIN` de UNA cotización puede quedar bajo el mínimo (la Beta lo permitía); decide la política. El perfil sigue exigiendo mínimo ≤ objetivo.
- Un margen puede quedar apenas bajo el objetivo por el redondeo a pesos enteros (p. ej. 34,9984 %): se informa como `BELOW_TARGET` (INFO).

### Golden tests de precios (contraste con un script independiente)

| Caso (costo) | Precio unitario | Neto / IVA / bruto | Utilidad | Margen |
|---|---|---|---|---|
| A. Directo, margen 35 %, GROSS, $100 ↑ ($13.885) | $25.500 | 21.429 / 4.071 / 25.500 | 7.544 | 35,20 % |
| B. Marketplace 13 % sobre neto | $31.800 | 26.723 / 5.077 / 31.800 | 9.364 | 35,04 % (comisión 3.474) |
| C. 13 % sobre bruto | $33.400 | 28.067 / 5.333 / 33.400 | 9.840 | 35,06 % |
| D. 13 % + cargo fijo $150 | $32.200 | 27.059 / 5.141 / 32.200 | 9.506 | 35,13 % |
| E. Cliente ve neto, redondeo neto | $21.400 | 21.400 / 4.066 / 25.466 | 7.515 | 35,12 % |
| F. No afecto ($14.554) | $22.400 | 22.400 / 0 / 22.400 | 7.846 | 35,03 % |
| G. N=10, tramo 8 % ($26.101) | $4.400 | 36.975 / 7.025 / 44.000 | 10.874 | 29,41 % (BELOW_TARGET) |
| H. N=50, tramo 15 % ($111.624), WARN/BLOCK | $3.500 | 147.059 | 35.435 | 24,10 % → BELOW_MIN (BLOCK: no emitible) |
| H. igual con **CAP** | $3.600 | 151.261 | 39.637 | 26,20 % (descuento efectivo 11,9 %) |
| I. Base + modelado separado ($40.885) | $25.500 + $49.500 | 63.025 / 11.975 / 75.000 | 22.140 | 35,13 % |

## Capa tax (`calculation/v1/tax`)

Mantiene separados: **costo económico · IVA recuperable (crédito fiscal) · IVA de venta (débito fiscal) · comisión · utilidad**.

### Compras → costo económico (tasa de compras `p`, monto `a`)

| Régimen | Base | ¿Recuperable? | Costo económico | IVA recuperable | IVA que es costo |
|---|---|---|---|---|---|
| Afecto | NET | sí | `a` | `a·p` | 0 |
| Afecto | NET | no | `a·(1+p)` | 0 | `a·p` |
| Afecto | GROSS | sí | `a/(1+p)` | `a − a/(1+p)` | 0 |
| Afecto | GROSS | no | `a` | 0 | `a − a/(1+p)` |
| No afecto | cualquiera | (siempre no) | NET: `a·(1+p)` · GROSS: `a` | 0 | todo el IVA |

### Ventas → neto, IVA de venta y bruto (CLP enteros)

`splitFromNet`: `IVA = round(neto × tasa)`. `splitFromGross`: `neto = round(bruto / (1+tasa))`, `IVA = bruto − neto`.
`neto + IVA = bruto` exacto; neto → bruto → neto siempre recupera el neto; bruto → neto → bruto no siempre, por eso con precio al cliente bruto
el bruto es la fuente de verdad.

### Comisión y ledger

`c_eff = c × (base GROSS ? 1 + IVA de venta : 1) × (IVA de la comisión es costo ? 1 + p : 1)`, sobre el neto. Definición única de utilidad (v1):
`utilidad = neto − comisión − costo económico`; el IVA de venta y el crédito fiscal no intervienen.

## Relación `amount` / `pooledAmount`

| `recoveryConfig` | `pooledAmount` (entra al precio) | Línea de precio |
|---|---|---|
| `ABSORBED` | 0 | ninguna (suma a `absorbedCost`) |
| `SEPARATE_LINE` | `amount` | la suya |
| `IN_PRICE` sin amortización | `amount` | principal |
| `IN_PRICE` + amortización (solo `ONE_OFF`) | `round(rawAmount × N / overUnits)`, tope `amount` | principal; el resto es `deferredCost` |

## Decisiones de `cost` (aprobadas en la revisión, con estos matices)

1. **Fallas por ítem**, calculadas desde `rawAmount` y redondeadas según el contrato (caso base $13.885), con `derivedFrom` hacia el origen.
2. **Tasa de falla por placa**; el mayor override entre materiales es política conservadora; el snapshot registra la tasa resuelta y su procedencia.
3. **Contrato ampliado** (`multiplier`, `vatRecoverable`, `recoverableVat`, `failureRates`); `recoverableVat` es un indicador, no un crédito nuevo.
4. **IVA y desgaste (modificada):** el desgaste no contabiliza crédito fiscal; el IVA de las compras consumidas se conserva según régimen y datos de origen.
5. **Ensamblaje sin piezas extra:** ítem en 0 y `ASSEMBLY_WITHOUT_EXTRA_PARTS` con severidad `INFO`; no bloquea.
6. **Amortización solo `ONE_OFF`**; overrides inválidos → `INVALID_INPUT`; la herencia en fallas no duplica la amortización ni multiplica costos únicos.
7. **Snapshots corruptos** → `INCONSISTENT_SNAPSHOT`; `INTERNAL_INVARIANT` solo para defectos del motor (autoverificación).

## Decisiones tomadas al implementar `pricing` (confirmar)

1. **Condición 3:** `FailureModel.acceptsRate`; `GEOMETRIC_RETRY` acepta `[0, 1)` y rechaza 1 (el validador lo rechaza en perfil, material, máquina y override; el motor también lo rechaza si el dato eludió el validador, **en cualquier modo**, TEST incluido; `extraCostFactor(1, …)` lanza `InvariantViolation`).
2. **Contrato ampliado:** `PricedLine.costBasis` y `sourceItemCodes`, `PricingResult.customerPriceMode`, `PricingOutput`, `isIssuable` / `blockingFlags`, `checkPricingInvariants`.
3. **Totales de documento**: neto/IVA/bruto se separan a nivel total; por línea se reparte con mayor resto (las líneas suman exactamente el documento).
4. **El descuento** aplica solo a la línea principal y no a un precio fijo; con precios fijos que ya cubren el objetivo, las líneas a precio objetivo quedan en **$0** (se ve en el margen resultante).
5. **`CAP` también corrige el redondeo** hacia abajo/cercano si éste rompe el mínimo aunque no haya descuento (`DISCOUNT_CAPPED` solo si un descuento se redujo).
6. **`FIXED_LINE_PRICE`** se refiere al código de la línea (código del ítem origen); un código inexistente advierte `UNKNOWN_OVERRIDE_TARGET` y no cambia el precio.
7. **Factibilidad** con denominador mínimo 1e-9 (evita precios absurdos por error binario cuando c_eff + margen = 1).
8. Los costos `ABSORBED` no entran al precio y reducen `realUtility`; los diferidos no son pérdida de la cotización.

## Decisiones previas (ya aprobadas)

`purchaseVatRate` independiente de `vatRate` · el régimen prevalece sobre `vatRecoverable` (con `recoverabilityOverriddenByRegime`) ·
compra NET con IVA no recuperable incorpora el IVA al costo · `deferredCost` · cero válido y distinto de ausente (precio del rollo, potencia) ·
definición única de utilidad en `v1/tax/ledger.ts` · validadores a mano (sin Zod) en `calculation`; Zod solo en `quoting` (formulario y datos guardados) · pruebas de tipos con `tsc` + `@ts-expect-error` (en vez de `tsd`) ·
`fast-check` instalado pero sin uso (los barridos usan un generador con semilla fija) · redondeo único a CLP: la mitad se aleja de cero, tolerancia `1e-9`.

## Siguiente gate propuesto (no iniciado)

Gate A: casos de uso transaccionales idempotentes de cotizaciones, pedidos y pagos (puerto `TransactionRunner`, claves de idempotencia,
un solo pedido aunque dos sesiones acepten a la vez) + selector explícito de régimen tributario y tratamiento de IVA por canal (D2, D6).
