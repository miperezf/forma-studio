# Gate 1 · Informe de entrega (2026-10-20)

## 1. Resumen del incremento

El cotizador de la Beta (misma pantalla, mismos ~9 campos y chips opcionales) ahora llama a un **servicio de aplicación**
(`src/modules/quoting`) que valida con Zod, arma **perfiles tipados con revisión**, construye el `CalculationRequest` real y calcula con la
fachada **`QuoteCalculator`** (registro de versiones, v1 = `calculateCost` → `calculatePricing`). De su resultado salen un **`InternalQuote`**
(snapshot completo + versión + revisiones + emisión) y un **`CustomerQuote`** (whitelist) que se guardan en **claves de almacenamiento distintas**.
BLOCK permite borrador y bloquea «Ya la envié». CRM, flujo comercial, pedidos y pagos siguen funcionando (tests originales adaptados y E2E).

Antes de integrar se rehízo el **cierre de v1/pricing** perdido con el reinicio del contenedor (margen comercial vs real, errores de
factibilidad explícitos, descuento + amortización).

**Lo que NO se hizo:** Firebase/Auth/Rules/Storage; parser GCODE/3MF; casos de uso transaccionales idempotentes entre sesiones (gate A);
selector de régimen por contribuyente real e IVA de comisión por canal (D2/D6 quedan provisionales); tramos de descuento en la UI (D4);
proyectos/laboratorio/BI; React. No se ejecutaron Vitest, ESLint, dependency-cruiser, fast-check ni tsd (registro npm bloqueado).
**No es apto para producción.**

## 2. Archivos reales cambiados

| Archivo | Por qué |
|---|---|
| `src/modules/calculation/contracts/results.ts` | `PricingResult`: `commercialUtility/Margin/Markup`, `realUtility/Margin/Markup` (`null` si denominador ≤ 0) |
| `src/modules/calculation/contracts/errors.ts` | `INFEASIBLE_MARGIN.reason`, nuevo `NO_FEASIBLE_PRICE` |
| `src/modules/calculation/contracts/enums.ts` | flag `REAL_MARGIN_BELOW_MIN` |
| `src/modules/calculation/contracts/invariants.ts` | invariantes comercial/real, precios enteros finitos, equilibrio ≤ piso y ≤ objetivo (D13) |
| `src/modules/calculation/contracts/quote-input.ts` + `validate/quote-input.ts` | `ServiceSelection.laborMinutes?` (minutos de la cotización; la tarifa sigue en el perfil) |
| `src/modules/calculation/contracts/validate/consistency.ts` | D13: override de margen bajo el mínimo permitido |
| `src/modules/calculation/v1/pricing/{engine,outcome}.ts` | factibilidad con razón, búsqueda sin excepción → `NO_FEASIBLE_PRICE`, CAP/BLOCK, margen real |
| `src/modules/calculation/v1/cost/generators/services.ts` | usa `selection.laborMinutes ?? service.laborMinutes` |
| `src/modules/calculation/calculator.ts` (nuevo) + `index.ts` | registro de versiones, `createQuoteCalculator`, `calculateFromRaw` (replay) |
| `src/modules/customer-quote/*` (nuevo) | `CustomerQuote` whitelist, `customerQuoteText`, `formatClp`, migración del documento 0.5.2 |
| `src/modules/quoting/*` (nuevo) | `form.ts` (Zod), `shop-data.ts` (Zod de datos guardados), `profiles.ts`, `mapper.ts`, `service.ts`, `internal-quote.ts`, `presentation.ts` |
| `src/app-bridge/beta-bridge.ts`, `scripts/build-beta-bridge.mjs` (nuevos) | bundle esbuild para la Beta en JS plano |
| `scripts/check-architecture.mjs` | reglas R7–R9 y R4–R6 extendidas a `customer-quote` y `quoting` |
| `.dependency-cruiser.cjs` | mismas reglas (sin ejecutar) |
| `apps/beta-web/src/ui/app.js` | `currentQuote`/vista cliente/guardar/copiar/imprimir/recotizar vía servicio; avisos; Configuración: política y régimen; revisión de perfiles |
| `apps/beta-web/src/domain/workflow.js` | colección `customerQuotes`, `issuanceProblem`, `updateDraftConditions`, revisiones y borrado con documento separado |
| `apps/beta-web/src/data/repository.js` | dos claves, escritura con reversión, migración 0.5.2 → v2 |
| `apps/beta-web/src/domain/quote-inputs.js` | defaults del taller propios (`revision`, `onBelowMin`) |
| `apps/beta-web/src/domain/legacy/*` | estimador demo y CustomerQuote del prototipo retirados de la UI |
| `apps/beta-web/src/styles.css`, `index.html`, `package.json` | aviso «No emitible», línea de trazabilidad, versión 0.6.0 |
| `apps/beta-web/tests/*` | tests adaptados a la colección separada; `engine-integration.test.mjs` y `browser_engine_flow.py` nuevos; E2E parametrizados |

## 3. Contratos públicos, invariantes y migraciones

- `QuoteCalculator { calculate(request): Result<CalculationOutput, CalculationError>; supportedVersions() }` — `createQuoteCalculator(engines?)`,
  `calculateFromRaw(calculator, raw)`. Versión desconocida → `UNKNOWN_CALCULATION_VERSION` (nunca se usa otra).
- `quoteService.preview(rawForm, extras, {shop, clientName, resolvedAt, today})` → `QuotePreview {form, profiles, request, output, summary, customer, issuance, notices}`.
  `createDraft(…, {id, revisionOf?, revision?, fromQuote?})` → `{internal: InternalQuote, customer: CustomerQuote}`. `replay(internal)` → `{identical}`.
- `InternalQuote` — `calculation {request, output}` (JSON plano), `calculationVersion`, `profileRefs {cost, pricing, tax, channel, material, machine}` con revisión,
  `formState`/`inputSnapshot`, `issuance {issuable, blockingReasons, warnings}`, montos congelados `net/vat/gross/unitPrice`, `customerQuoteId`.
- `CustomerQuote` — exactamente `kind, schemaVersion, id, clientName, project, createdAt, validDays, terms, currency, taxTreatment, lines[{description, quantity,
  unitPrice, total}], quantity, unitPrice, vatAmount, total`. Construcción verifica: total de línea = cantidad × unitario; Σ líneas (+ IVA si VAT_ADDED) = total.
- Invariantes nuevas: `commercialUtility = neto − comisión − pool`; `realUtility = commercialUtility − absorbedCost`; ratios `null` ⇔ denominador ≤ 0;
  precios emitidos enteros CLP finitos ≥ 0; CAP ⇒ margen comercial efectivo ≥ mínimo o error/BLOCKED.
- Migración de almacenamiento: `app-web-3d-beta-v1` → `forma-studio:internal:v2` + `forma-studio:customer:v2` (`migrateV1`, pura, sin recalcular; respaldo intacto).

## 4. Herramientas realmente ejecutadas

| Comando | Resultado |
|---|---|
| `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json --noEmit` (TS 6.0.3) | ✔ 0 errores |
| `node scripts/check-architecture.mjs` | ✔ 151 archivos, 0 violaciones R1–R9 (+5 violaciones sembradas detectadas) |
| `node --import tsx --test "src/**/*.test.ts"` **con shim** | ⚠ 946/946 (core 93 · calculation 780 · customer-quote 24 · quoting 49). **No es Vitest.** |
| `node --test apps/beta-web/tests/*.test.mjs apps/beta-web/tests/legacy/*.test.mjs` | ✔ 53/53 (test runner real de Node) |
| `python3 apps/beta-web/tests/browser_{engine_flow,quick_flow,workflow,draft_delete}.py` (Playwright 1.56, Chromium) | ✔ 4/4 |
| mutaciones (20 errores sembrados en mapper, perfiles, formulario, servicio, documento, registro, workflow, repositorio) | ✔ 20/20 detectadas |
| `node scripts/build-beta-bridge.mjs` (esbuild 0.28.2) · `build-standalone.mjs` | ✔ |
| Vitest · ESLint · dependency-cruiser · fast-check · tsd | ✘ NO ejecutados: `registry.npmjs.org` → 403 del proxy |

Shim (solo entornos sin registro): `node_modules/vitest/{package.json,index.js,index.d.ts}` que reexporta `describe`/`it`/`it.each` de `node:test` y un
`expect` con 17 matchers (`toBe, toEqual, toMatchObject, toBeNull, toBeUndefined, toBeDefined, toBeTruthy, toBeFalsy, toBeGreaterThan(OrEqual),
toBeLessThan(OrEqual), toBeCloseTo, toHaveLength, toContain, toMatch, toThrow`).

**Hallazgos de las pruebas durante el gate** (corregidos): (1) `z.coerce.number('')` convertía una tarifa vacía en $0 → vacío ≠ 0 en perfiles;
(2) el mapper daba al diseño propio base NETO no recuperable (+19 % indebido) → monto = costo; (3) el formulario aceptaba 0 g y el motor no →
formulario exige > 0 (D14); (4) el build standalone corrompía el bundle por patrones `$'` de `String.replace` → reemplazos con función.

## 5. Evidencia de no fuga

- Contrato: `CustomerQuote` tiene exactamente `CUSTOMER_QUOTE_KEYS`; entradas contaminadas no se copian (test); objeto congelado.
- Recursivo: ninguna de 40 claves internas (`economicCost, margin, commission, breakdown, calculation, params, profileRefs, issuance, flags, costBasis…`)
  aparece en el documento (servicio, 400 casos del barrido, `localStorage` de la clave comercial, E2E).
- Texto WhatsApp/copiar e impresión: sin palabras internas (costo, margen, comisión, utilidad, desgaste, fallas…) ni cifras internas (comisión,
  utilidad, pool, piso) — tests unitarios, barrido y E2E (portapapeles real y `#print-root`).
- Arquitectura: `customer-quote` no puede importar `calculation` (R3/R7) y `quoting` solo por index público (R8).
- Persistencia: la clave `internal` no contiene documentos comerciales y las cotizaciones internas no embeben `customerQuote`.

## 6. Pruebas por tema

| Tema | Dónde |
|---|---|
| Cantidades / placas / lotes | `service.test` (horas por placa, placas completas 1/4/5 u, G4 B=3), `v1/cost` |
| IVA | G1 (afecto), G2 (no afecto: «IVA incluido» nunca aparece), `customer-quote` VAT_ADDED |
| NRE | G4 (línea separada $55.000, nunca × N), cierre: amortización + descuento |
| Fallas | G1 (5/95 sobre material, energía, desgaste, supervisión), mutación `failureRate` |
| Comisiones | G3 marketplace 12 % + $250 (margen ≥ 35 % después de la comisión) |
| Descuentos y redondeo | cierre (N=10 $5.100, N=50 WARN/CAP/BLOCK), CAP por redondeo, sin redondeo (G6 en barrido) |
| Replay | `calculator.test`, `service.test` (idéntico, perfiles cambiados, adulteración detectada), barrido |
| Pedidos duplicados | `engine-integration` y `quick-flow` (misma sesión). **Entre dos sesiones simultáneas: pendiente (gate A).** |
| Pagos | `engine-integration` (abono, sobrepago rechazado, pagado), `workflow.test` |

## 7. ZIP

`app-web-3d-gate1.zip`: repositorio completo (sin `node_modules`), Beta con bundle generado y `apps/beta-web/dist/FORMA_STUDIO_BETA_0_6_0.html`,
capturas E2E. Recuperación: README raíz § «Procedimiento de recuperación».

## 8. Riesgos y decisiones pendientes

1. **D1–D14 provisionales** (ver mapa): sobre todo D1 (montos brutos con IVA recuperable si afecto), D2 (régimen), D6 (IVA de comisión), D13.
2. Vitest/ESLint/dependency-cruiser nunca se ejecutaron: pueden aparecer diferencias al correr `npm run check` con registro.
3. `localStorage` sin transacciones entre pestañas: dos sesiones podrían aceptar la misma cotización (gate A).
4. El resumen de impresoras muestra un costo/hora bruto calculado fuera del motor (solo informativo, rotulado «montos brutos»).
5. Zod fijado a ^3.25 (API v3).

**Siguiente gate propuesto (A):** casos de uso transaccionales idempotentes (aceptar + pedido, pagos, revisiones) sobre un puerto `TransactionRunner`
con claves de idempotencia y detección de conflictos entre sesiones; selector explícito de régimen y de IVA por canal; luego Firebase (gate B).
