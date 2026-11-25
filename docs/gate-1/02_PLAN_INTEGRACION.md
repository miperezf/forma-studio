# Gate 1 · Plan de primera integración (incremento vertical mínimo)

## Flujo
```
apps/beta-web/src/ui/app.js  (UI existente; solo cambia currentQuote/guardar/textos/avisos)
   │  FormData + extras activos + db (perfiles de la Beta)
   ▼
apps/beta-web/src/vendor/forma-engine.js   ← bundle esbuild de src/app-bridge/beta-bridge.ts
   ▼
src/modules/quoting  (Application)
   form.ts      parseQuoteForm(raw, extras)        Zod → QuoteFormState (valores neutralizados si el extra está apagado)
   profiles.ts  resolveShopProfiles(betaData)      perfiles tipados con {id, revision}: cost, pricing, tax, channel, material, machine, services
   mapper.ts    buildCalculationRequest(form, profiles, resolvedAt)  → JSON → validateCalculationRequest → CalculationRequest
   service.ts   createQuoteService({calculator, clock})
                  preview(form)        → QuotePreview (interno) + CustomerQuote (vista segura) + issuable/avisos
                  createDraft(form,…)  → {internal: InternalQuote, customer: CustomerQuote}   (BLOCK ⇒ borrador permitido)
                  assertIssuable(internal)                                                       (BLOCK/legado ⇒ no se emite)
                  replay(internal)     → recalcula el request guardado y compara canónicamente
   ▼
src/modules/calculation  createQuoteCalculator() → ENGINE_V1 (calculateCost → calculatePricing)
src/modules/customer-quote  buildCustomerQuote(commercial) / customerQuoteText(dto)   (whitelist; NO importa calculation)
```

## Persistencia (MockRepository, sin Firebase)
- `forma-studio:internal:v2` → clients, materials, printers, settings, projects, orders, **quotes (InternalQuote)**, meta.
- `forma-studio:customer:v2` → **customerQuotes** (solo CustomerQuote). Clave distinta = separación física en el mock.
- Migración automática desde `app-web-3d-beta-v1`: mueve `quote.customerQuote` embebido a `customerQuotes`, agrega
  `revision` a materiales y configuración, no recalcula montos (D11). El origen v1 queda intacto como respaldo.

## Lo que NO entra en este gate
Firebase/Auth/Rules, parser GCODE/3MF, rediseño de pantallas, casos de uso transaccionales idempotentes de pedidos/pagos
(gate A), proyectos/laboratorio, BI.
