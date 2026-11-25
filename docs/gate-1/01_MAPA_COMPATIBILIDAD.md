# Gate 1 · Mapa de compatibilidad Beta 0.5.2 → motor `calculation/v1`

Fuentes verificadas en archivos (no en resúmenes):
- Beta: `apps/beta-web/src/ui/app.js` (formulario `#quote-form`, `currentQuote()`, guardado), `src/domain/quote-inputs.js`
  (`assembleQuoteInputs`, `QUOTE_EXTRAS`, `DEFAULT_SHOP_SETTINGS`), `src/domain/quote-estimate.js` (`estimateQuote`, `CHANNELS`,
  `DEFAULT_PROFILE`), `src/domain/printer-profiles.js`, `src/data/repository.js` (seed de materiales/impresoras).
- Motor: `src/modules/calculation/contracts/{quote-input,parameters,overrides,cost-spec,request,results}.ts`.
- Adaptador nuevo: `src/modules/quoting/{form,profiles,mapper}.ts` (este gate).

Unidades: la Beta guarda porcentajes (35 = 35 %); el motor usa fracciones (0,35). Toda conversión ocurre UNA vez, en
`quoting/profiles.ts` (perfiles) o `quoting/form.ts` (formulario), nunca en la UI ni en el motor.

## 1. Cantidades, placas y lotes (prioridad máxima)

| Campo UI (Beta) | Contrato real | Ubicación | Conversión / unidad | Default | Validación | Prueba | Estado |
|---|---|---|---|---|---|---|---|
| `quantity` «Cantidad a vender» | `QuoteInput.quantity` (N) | quote-input.ts | entero, unidades vendidas | 8 (UI) | Zod int 1–100000 + motor `parseQuantity` | `quoting/mapper.test.ts` cantidades | ✔ |
| `partsPerPlate` «Piezas en una placa» | `PlateSpec.partsPerPlate` | quote-input.ts | entero | 4 (UI) | int 1–1000 | mapper + golden | ✔ |
| `partsPerUnit` (extra «Planificación») | `PlateSpec.partsPerUnit` | quote-input.ts | entero; si el extra está apagado = 1 | 1 | int 1–1000 | mapper (extra apagado neutraliza) | ✔ |
| `batches` (extra «Planificación») | `QuoteInput.batches` (B) | quote-input.ts | solo multiplica PER_BATCH (preparación) | 1 | int 1–10000 | mapper + golden B=3 | ✔ |
| placas | derivadas: `ceil(N×partsPerUnit/partsPerPlate)` WHOLE_PLATES | v1/cost/quantities.ts | — | — | motor | golden 8u/4 = 2 placas | ✔ |
| `plateHours` «Tiempo de una placa (h)» | `PlateSpec.printHours` | quote-input.ts | horas POR PLACA (nunca × piezas) | 5,5 | > 0 | golden | ✔ |

## 2. Material y merma

| Campo UI | Contrato real | Ubicación | Conversión | Default | Validación | Prueba | Estado |
|---|---|---|---|---|---|---|---|
| `materialId` | `FilamentUse.materialId` + `params.materials[id]` | quote-input / parameters | id de catálogo | MAT-001 | debe existir | mapper | ✔ |
| `material.priceKg` | `MaterialValues.spool = {price: TaxedAmount, netGrams: 1000}` | parameters.ts | precio por kg → carrete de 1000 g; **base de monto: ver D1** | 22.000 | ≥ 0 | mapper (bruto/neto) | ⚠ D1 |
| `material.revision` (nuevo) | `MaterialValues.ref.revision` | parameters.ts | entero ≥ 1; sube al editar | 1 | — | profiles.test | ✔ (migración) |
| `plateWeightGr` «Filamento de una placa (g)» | `FilamentUse.grams` (por placa) | quote-input.ts | gramos por placa | 340 | ≥ 0 | golden | ✔ |
| `extraGrPerPlate` «Material no incluido» | sumado a `grams`, `weightIncludesWaste: true` | mapper.ts | g/placa absolutos (equivale a la Beta) | 0 | ≥ 0 | mapper | ✔ |
| — | `CostProfileValues.materialWaste.fraction` | parameters.ts | 0 (la Beta no tiene merma porcentual) | 0 | — | — | ✔ |
| `weightGr` (legado, por producto) | **sin equivalente**: no se infiere | — | — | — | borradores legados no se recalculan | legacy.test | ✔ (D11) |

## 3. Máquina (desgaste, energía, supervisión)

| Campo UI | Contrato real | Conversión | Default | Estado |
|---|---|---|---|---|
| `printer.purchasePrice` / `residualValue` / `lifeHours` | `MachineValues.purchasePrice/residualValue` (TaxedAmount) / `lifetimeHours` | base de monto D1 | 420.000 / 40.000 / 5.000 h | ⚠ D1 |
| `printer.maintenanceBudget / maintenanceHours` | `MachineValues.maintenanceReservePerHour` | presupuesto ÷ horas = 12 $/h | 60.000 / 5.000 | ✔ |
| `printer.averageWatts` | `MachineValues.avgPowerW` | W | 95 | ✔ |
| `settings.energyPerKwh` | `CostProfileValues.energy.kwhPrice` (TaxedAmount) | $/kWh, base D1 | 210 | ⚠ D1 |
| `settings.supervisionFactor` | `CostProfileValues.supervision.hoursPerPrintHour` | h trabajo / h impresión | 0,15 | ✔ |
| `settings.laborPerHour` | `CostProfileValues.labor.ratePerHour` | $/h | 4.500 | ✔ |
| `printer.revision` | `MachineValues.ref.revision` | entero | 1 | ✔ |

## 4. Fallas

| Campo UI | Contrato real | Conversión | Default | Estado |
|---|---|---|---|---|
| `settings.failureRate` (%) | `CostProfileValues.failure = {GEOMETRIC_RETRY, rate, costFraction: 1, affected: MATERIAL, ELECTRICITY, WEAR, SUPERVISION}` | % → fracción; p ∈ [0, 1) (p = 100 % se rechaza) | 5 % | ✔ mismos componentes que la Beta |
| — (no hay override por cotización en la UI) | `OverrideKind.FAILURE_RATE` | — | — | no expuesto (sin cambio de UX) |

## 5. Trabajo, servicios y NRE

| Campo UI | Contrato real | Conversión | Default | Estado |
|---|---|---|---|---|
| `settings.preparationMinutes` | `CostProfileValues.preparation.jobSetupMinutes` (PER_BATCH) | min por lote | 20 | ✔ |
| — | `preparation.plateChangeoverMinutes` | — | 0 | ✔ (la Beta no lo cobra) |
| `finishingMinutesPerUnit` (extra «Acabados») | servicio `finishing` STANDARD PER_UNIT POSTPROCESS + `ServiceSelection.laborMinutes` (**contrato extendido en este gate**) | min/unidad × tarifa del perfil | 10 (UI) | ✔ |
| `assemblyMinutesPerExtraPart` (extra «Ensamblaje») | servicio `assembly` ASSEMBLY PER_EXTRA_PART + `laborMinutes` | min/pieza extra | 5 (UI) | ✔ (un solo ensamblaje activo) |
| `packagingPerUnit` / `settings.packingPerUnit` | `QuoteExtraCost` PER_UNIT PACKAGING IN_PRICE | $/unidad, base D1 | 350 | ⚠ D1 |
| `oneOffDesignCost` (extra «Diseño 3D») | `QuoteExtraCost` ONE_OFF DESIGN `SEPARATE_LINE` | $ una vez; nunca × N | 0 | ⚠ D7 |

## 6. Venta: canal, margen, descuentos, redondeo, IVA

| Campo UI | Contrato real | Conversión | Default | Estado |
|---|---|---|---|---|
| `channel` (direct/instagram/web/marketplace) | `ChannelValues {commission, fixedFee, commissionBase: NET, commissionTax}` | % → fracción; `fixed` → TaxedAmount NET | 0 / 3 % / 4,5 %+$100 / 12 %+$250 | ⚠ D6 |
| `settings.targetMargin` / `minMargin` (%) | `PricingProfileValues.targetMargin/minMargin` (MARGEN, no markup) | % → fracción | 35 / 25 | ✔ |
| `targetMargin` (extra «Ajustar esta venta») | `OverrideEntry TARGET_MARGIN` con `reason` | % → fracción | perfil | ⚠ D12 |
| — (no existe en la Beta) | `PricingProfileValues.onBelowMin` WARN/CAP/BLOCK | selector nuevo en Configuración | WARN | ✔ D5 |
| — (no existe en la Beta) | `PricingProfileValues.discountTiers` | — | sin tramos | ⚠ D4 |
| `settings.priceRounding` (0/10/100/500/1000) | `RoundingStrategy` STEP UP, **target GROSS** | 0 → NONE | 100 | ⚠ D3 |
| `settings.taxRate` (%) | `TaxProfileValues {regime, vatRate, purchaseVatRate: 0,19, customerPriceMode: GROSS}` | 19 → VAT_REGISTERED 0,19; 0 → NOT_REGISTERED | 19 | ⚠ D2 |
| `validDays`, `terms` | solo comerciales (InternalQuote + CustomerQuote), fuera del motor | — | 7 / texto | ✔ |

## 7. Snapshots y versiones

| Concepto Beta | Contrato real | Estado |
|---|---|---|
| `calculationVersion: 'DEMO-UI-0.3'` / `'SEED-DEMO'` | `'v1'` (`CALCULATION_V1`), registro `createQuoteCalculator` | ✔ legados conservados, no recalculados (D11) |
| `snapshot: {input, material, machine, profile, channel}` (copias sueltas) | `calculation.request` = `CalculationRequest` completo (input + ParameterSnapshot con `ref {id, revision}` de cada perfil + overrides) y `calculation.output` | ✔ replay: `calculateFromRaw(request)` ≡ output guardado |
| `inputSnapshot` (formulario) | `formState` (QuoteFormState validado por Zod) | ✔ base de «Nueva revisión y recotizar» |
| `costBreakdown`, `economicCost`, `margin`, `commission` en la cotización | `InternalQuote.calculation.output` (CostBreakdown + PricingResult) | ✔ solo interno |
| `quote.customerQuote` embebido | colección separada `customerQuotes` (clave de almacenamiento distinta) | ✔ separación física en el mock |

## 8. Inconsistencias que alteran el negocio — opciones y recomendación

Ninguna se decidió en silencio: cada una queda como **valor provisional configurable** en el perfil, marcado en el snapshot, y
listado aquí para tu aprobación. Cambiarla NO exige tocar el motor.

| # | Tema | Beta 0.5.2 | Opciones | Recomendación (provisional implementada) | Impacto |
|---|---|---|---|---|---|
| D1 | Base de los montos que digita el operador (material $/kg, embalaje, kWh, precio de máquina) | Se usaban tal cual, como costo | (a) BRUTO con IVA recuperable según régimen; (b) NETO; (c) campo por perfil | **(a)** lo que se paga en la boleta/factura; si el régimen es afecto, el motor descuenta el IVA recuperable; si no afecto, todo es costo | Con régimen afecto, los costos de compras bajan ≈ 16 % frente a la Beta → precios menores. Desgaste: el IVA de la máquina nunca se reconoce por hora |
| D2 | Régimen tributario | Solo `taxRate` 19 % | (a) 19 % ⇒ afecto, 0 % ⇒ no afecto; (b) selector explícito de régimen | **(a) provisional** + aviso interno «Régimen tributario por confirmar»; (b) en el gate siguiente | El texto al cliente dice «IVA incluido» solo si el régimen es afecto; no es un documento tributario |
| D3 | Redondeo | `Math.ceil` sobre el NETO, IVA se suma después (bruto no redondo) | (a) STEP UP sobre BRUTO (aprobado en el motor); (b) STEP UP sobre NETO | **(a)** el cliente ve precios redondos | Bruto redondo; neto no redondo |
| D4 | Descuento por volumen | No existe | (a) sin tramos hasta configurarlos; (b) tramos de ejemplo 5/8/12/15 % | **(a)** no introducir descuentos que nadie configuró | Ninguno vs Beta |
| D5 | Bajo el mínimo | Solo aviso | WARN / CAP / BLOCK | **WARN** por defecto; selector en Configuración | BLOCK permite borrador, impide «Ya la envié» |
| D6 | IVA de la comisión del canal | Ignorado | (a) sin IVA (igual que la Beta); (b) IVA cobrado y recuperable; (c) IVA costo | **(a) provisional**; por canal en el gate siguiente con datos reales del marketplace | Puede subestimar el costo del canal si el marketplace factura con IVA y no se recupera |
| D7 | Diseño único (NRE) | `cost/(1−m)` y comisión metida en el agregado | Motor: línea SEPARATE_LINE con su propio precio al margen objetivo (aprobado) | **Motor** | El precio de la línea de diseño cambia; la comisión se calcula sobre el total efectivo |
| D11 | Cotizaciones antiguas (DEMO-UI-0.3 / SEED-DEMO) | — | (a) conservar montos y no recalcular; borradores demo no se pueden marcar enviados; (b) recalcular | **(a)** | Un borrador demo debe recotizarse antes de enviarse |
| D13 | Margen de UNA venta bajo el mínimo | La Beta lo permitía y avisaba; el validador del motor lo rechazaba | (a) override permitido, decide la política (WARN advierte · CAP sube al mínimo · BLOCK borrador sin emisión); (b) seguir rechazándolo | **(a)**: sin esto WARN/CAP/BLOCK serían inalcanzables desde la UX de la Beta. El perfil sigue exigiendo mínimo ≤ objetivo | Cambio de contrato del motor (`validate/consistency.ts`, invariante equilibrio ≤ piso y ≤ objetivo); reversible |
| D14 | Gramos de la placa = 0 | La Beta aceptaba 0 g | El motor exige gramos > 0 por filamento | **Formulario exige > 0** (coherente con el motor) | Un trabajo sin filamento no se puede cotizar como impresión |
| D12 | Margen objetivo por cotización | Campo sin justificación | (a) override `TARGET_MARGIN` con motivo automático; (b) pedir motivo | **(a)** motivo «Ajuste en el cotizador» (auditable) | Ninguno |

Pendientes que no alteran cifras de este gate (doc 11 E): gramos de placa llena vs real, calibración de consumo, Firebase,
GCODE/3MF, idempotencia transaccional de pedidos entre sesiones (gate A).
