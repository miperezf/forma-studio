# FORMA Studio — PRD maestro operativo

Versión del documento: 1.0 · 2026-10-20 · Base: `app-web-3d-gate1.zip` (sha256 `27f729f7…d5c3`) + incremento 0.6.1.
Fuente de verdad del estado implementado: código y pruebas del repositorio. Este PRD no repite el diseño del motor
(ver `README.md` §cost/pricing/tax y `docs/gate-1/01_MAPA_COMPATIBILIDAD.md`).

## 1. Producto

Gestión de un taller de impresión 3D en Chile: **cliente → proyecto → cotización → aceptación → pedido → producción → entrega →
cobro → historial/BI**. Principio: la complejidad vive en motores y perfiles, no en los formularios.

Usuarios 1.0: **Propietario/administrador** (todo) · Operador (cotiza, gestiona pedidos; sin configuración de perfiles ni costos de
máquina) — el rol Operador es opcional para 1.0 (decisión P-1). El cliente final **no** usa la app: recibe solo el documento comercial.

## 2. Alcance

| Release | Incluye | Excluye |
|---|---|---|
| **A · Staging online** (datos ficticios) | Beta 0.6.x publicada por HTTPS, motor v1, CRM, flujo comercial, pedidos, pagos, persistencia local del navegador | Auth, backend, datos reales, sincronización |
| **B · 1.0** | A + Firebase Auth (propietario), Firestore con reglas, InternalQuote/CustomerQuote separados por reglas, aceptar+pedido idempotente, pagos con id único, migración local→nube, backups, CI con herramientas reales, proyecto prod separado | GCODE/3MF, laboratorio de pruebas, BI avanzado, multi-taller, Storage de archivos (salvo decisión) |
| Posterior | Proyectos/laboratorio costable, importadores GCODE/3MF con muestras reales, producción/stock por máquina, BI | — |

## 3. Requisitos (con criterio de aceptación y estado verificado)

Estado: ✅ implementado y probado · 🟡 parcial · ⬜ pendiente. «Evidencia» = prueba que lo demuestra.

| ID | Requisito | Criterio de aceptación | Estado | Evidencia |
|---|---|---|---|---|
| Q-01 | Un único cotizador con ~9 campos + extras opcionales | Sin modo básico/avanzado; extras apagados no afectan el precio | ✅ | `quoting/form.test.ts`, E2E `browser_engine_flow.py` |
| Q-02 | Precio solo desde `calculation/v1` vía `QuoteCalculator` | Ninguna fórmula de precio en UI; estimador demo no importado | ✅ | `engine-integration.test.mjs` (escaneo), reglas R8 |
| Q-03 | Margen objetivo 35 % / mínimo 25 % configurables; WARN/CAP/BLOCK | CAP ≥ mínimo tras redondeo; BLOCK permite borrador, impide envío | ✅ | `closure.test.ts`, `service.test.ts`, E2E |
| Q-04 | Cantidades: N, placas WHOLE_PLATES, lotes, piezas/unidad, ONE_OFF nunca × N | Goldens G1–G4 | ✅ | `service.test.ts` |
| Q-05 | IVA según régimen **explícito** (D2) | Régimen elegido en Configuración; tasa coherente; aviso «por confirmar» | ✅ (0.6.1) / decisión contable ⬜ | `profiles.test.ts` |
| Q-06 | Comisión por canal (tasa, cargo fijo, base, IVA) configurable | Editar canal crea revisión; motor usa sus valores | 🟡 catálogo fijo en código; sin UI (D6) | — |
| Q-07 | Descuentos por tramos configurables | Deshabilitados sin tramos (D4); UI de tramos | 🟡 motor sí, UI no | `closure.test.ts` |
| Q-08 | Snapshot + `calculationVersion` + revisiones; replay idéntico | Cambiar perfiles no altera históricos; adulteración detectada | ✅ | `service.test.ts` replay, E2E recarga |
| Q-09 | CustomerQuote whitelist; WhatsApp/PDF/impresión solo desde él | 0 claves internas, 0 palabras/cifras internas | ✅ cliente / ⬜ frontera servidor | `customer-quote.test.ts`, barrido 400, E2E |
| C-01 | CRM: normalización, edición, archivo/restauración, eliminación protegida, historial | Tests CRM y E2E | ✅ | `crm.test.mjs`, `browser_workflow.py` |
| W-01 | Estados Borrador/Enviada/Aceptada/Rechazada/Vencida; folios no reutilizables; revisiones | Transiciones autorizadas; folio eliminado no vuelve | ✅ | `workflow.test.mjs` |
| W-02 | «Ya la envié» explícito; WhatsApp/PDF no implican envío | Solo la acción cambia el estado | ✅ | `browser_quick_flow.py` |
| W-03 | «Aceptar + pedido» sin duplicar, también entre sesiones concurrentes | 2 sesiones / doble clic / reintento ⇒ 1 pedido | 🟡 misma sesión ✅; concurrencia ⬜ (requiere backend) | `engine-integration`, `quick-flow` |
| W-04 | Pedido: Pendiente→Preparación→En producción→Entregado; pago independiente; abonos | Sobrepago rechazado; saldo coherente; enteros CLP | ✅ local / id de pago idempotente ⬜ | `workflow.test.mjs` |
| U-01 | Confirmaciones solo en acciones destructivas, dentro de la página | Sin `window.confirm` | ✅ (0.6.1) | `browser_draft_delete.py` |
| U-02 | Responsive 390 px sin desborde | E2E móvil | ✅ | E2E |
| S-01 | Auth propietario; denegación por defecto; sesión/cierre | Reglas probadas en emulador | ⬜ | — |
| S-02 | InternalQuote y CustomerQuote en colecciones separadas con reglas distintas | Usuario sin privilegio no lee costos por API | ⬜ (separación local ✅) | — |
| S-03 | Históricos inmutables tras emisión (reglas) | Update de quote emitida rechazado | ⬜ | — |
| S-04 | Sin secretos en repositorio/frontend | `.env.example` sin secretos; `.gitignore` | ✅ | revisión |
| S-05 | Cabeceras de seguridad y CSP estricta en Hosting | CSP con hashes; noindex | ✅ (config) / despliegue ⬜ | E2E con cabeceras + control negativo |
| D-01 | Migración 0.5.2→v2 sin recalcular; demo no emitible | Respaldo intacto | ✅ | `engine-integration.test.mjs` |
| D-02 | Migración local→Firestore sin convertir demo en ventas reales | Origen/versión conservados | ⬜ | — |
| D-03 | Backups/exportación/recuperación | Restauración probada | ⬜ | — |
| T-01 | Vitest, ESLint, dependency-cruiser, fast-check, tsd reales | CI verde | ⬜ (CI preparado; npm bloqueado aquí) | `.github/workflows/ci.yml` |
| R-01 | Staging HTTPS con datos ficticios | URL verificada tras publicar | 🟡 vista previa claude.ai ✅; Firebase ⬜ | `docs/releases/` |
| R-02 | Producción separada, monitoreo, rollback | Checklist 1.0 | ⬜ | `docs/DEPLOY_PRODUCTION.md` |

## 4. Decisiones abiertas (matriz D)

| # | Situación actual (0.6.1) | Efecto monetario | Recomendación | Evidencia | Requiere del propietario |
|---|---|---|---|---|---|
| D1 | Compras digitadas = BRUTO; IVA recuperable si régimen afecto (provisional, global) | Afecto: costos de compras ≈ −16 % vs Beta (G1 $48.000; con NETO cambiaría) | Base NET/GROSS **por dato** (material, energía, máquina, embalaje) con default GROSS | `profiles.ts purchaseAmount`, G1/G2 | Confirmar cómo se ingresan los precios (con o sin IVA) y si hay factura |
| D1 ✔ | **Decidido 2026-10-21:** el IVA de compras no se recupera ⇒ montos digitados = costo completo (coherente con régimen no afecto) |
| D2 | Régimen **explícito** en Configuración (0.6.1), marcado «por confirmar» | Afecto vs no afecto: G1 $48.000 vs G2 $44.800 | Mantener selección explícita; confirmar con contador antes de uso real | `profiles.test.ts` | Régimen real del contribuyente y tasa |
| D2 ✔ | **Decidido 2026-10-21:** aún no factura ⇒ no afecto a IVA, confirmado por el propietario (`taxRegimeConfirmed`); se cambia en Configuración al empezar a facturar |
| D3 | Redondeo STEP UP sobre BRUTO visible; márgenes recalculados tras redondeo | +$0 a +$99 por unidad (paso 100) | Mantener | `closure.test.ts`, G6 | Paso de redondeo deseado (0/10/100/500/1000) |
| D4 | Tramos de descuento vacíos (deshabilitados) | Ninguno | Mantener hasta configurar; UI de tramos en Gate A/F | `profiles.ts discountTiers: []` | Tramos reales, si existen |
| D5 | Selector WARN/CAP/BLOCK; default WARN; BLOCK = borrador sí, envío no | Con CAP sube el precio al mínimo | Mantener WARN por defecto | E2E BLOCK | Política por defecto del negocio |
| D6 | Canales fijos de la Beta; comisión sin IVA (provisional) | Si el marketplace factura IVA no recuperable, el costo real sube ≈19 % de la comisión | Configuración por canal (tasa, cargo, base, IVA) con revisión | `constants.ts DEFAULT_CHANNELS` | Datos reales de cada canal |
| D6 ✔ | **Decidido 2026-10-21:** comisiones de canal sin IVA (tasas por canal siguen fijas en código; UI por canal pendiente) |
| D7 | Diseño ONE_OFF en línea separada, precio al margen objetivo (motor) | Diseño $30.000 ⇒ línea $55.000 (G4) | Mantener (sin recargos arbitrarios) | G4 | Confirmar presentación al cliente |
| D11 | Históricos demo congelados; borrador demo «No emitible» | Ninguno | Mantener; en migración a nube marcarlos `origin: DEMO` | `engine-integration.test.mjs` | ¿Migrar o descartar los datos demo locales? |
| D13 | Margen de una venta bajo el mínimo permitido como override; decide la política | Según política | Mantener (reversible) | `closure.test.ts` D13 | Aprobar o revertir |

## 5. Contradicciones detectadas y resolución propuesta

1. **Stack objetivo React+Vite vs Beta en JS plano.** La Beta aprobada es JS plano sin build. Resolución: mantener la Beta como staging;
   migrar la UI a React+Vite **por pantallas, conservando CSS y marcado**, dentro de Gate F (la autenticación y rutas protegidas lo
   requieren). El dominio TS ya es independiente de la UI. (ADR-0003)
2. **D2 «no deducir régimen de la tasa» vs Gate 1 (régimen derivado de 0/19 %).** Corregido en 0.6.1: régimen explícito.
3. **«Staging en Firebase» vs entorno sin acceso a Firebase/npm.** Resolución: build y configuración listos; vista previa interina en
   claude.ai claramente rotulada; despliegue a Firebase por el propietario o CI (un solo paso humano).
4. **Idempotencia entre sesiones** no es posible con `localStorage`. Resolución: Firestore con id determinista del pedido (= id de
   cotización) + transacción + reglas que impiden sobrescritura; no requiere Cloud Functions (sin costo de plan Blaze). (ADR-0005)

## 6. Criterios de lanzamiento 1.0 (bloqueantes)

Ninguno cumplido todavía salvo los marcados en §3: S-01, S-02, S-03, W-03 concurrente, D-02, D-03, T-01 en CI, R-01 en Firebase,
R-02, y aprobación de D1/D2/D6.
