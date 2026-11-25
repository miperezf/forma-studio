# Diseño — Placas completas + última placa real (motor `calculation/v2`)

Estado: **aprobado e implementado en 0.11.0** (2026-10-21). Condiciones del propietario: estimación conservadora emitible con aviso, consumo real registrado (estimado ≠ efectivo, reimpresiones y desperdicio), v2 solo cambia precios con datos de la última placa.
Origen: revisión del propietario sobre los datos de Bambu Studio (placas incompletas, AMS, inventario).

## 1. Diagnóstico de v1 (lo que hay hoy)

- Entrada por placa: `PlateSpec { filaments[g/placa], printHours (h/placa), partsPerPlate, partsPerUnit }`.
- Placas: `platesRequired = ceil(N × partsPerUnit / partsPerPlate)` (política **WHOLE_PLATES**).
- Material, electricidad, desgaste, supervisión y cambio de placa son `PER_PLATE` (cantidad por placa × placas requeridas).
  La preparación del trabajo es `PER_BATCH`, los servicios y el embalaje son `PER_UNIT` y el diseño es `ONE_OFF`.
- **Defecto:** una última placa incompleta se cobra como una placa completa. Por ejemplo, con 4 unidades y 3 por placa se cobran 600 g y 12 h en vez de 400 g y unas 8 h.
- **Riesgo de UI:** el campo «Filamento de una placa» no deja claro que es la placa COMPLETA con N piezas.

## 2. Principios (requisitos del propietario)

1. La referencia es la **placa completa** con N piezas, copiada de Bambu Studio (gramos por filamento y tiempo).
2. El sistema calcula **placas completas** y **piezas restantes**.
3. La **última placa incompleta** puede ingresarse con sus datos **reales de Bambu Studio** (rebanada con las piezas restantes).
4. Total = placas completas × datos de la placa completa + 1 × datos de la última placa.
5. Sin esos datos, la cifra es una **estimación provisional**, marcada como tal y nunca presentada como exacta.
6. **No se asume proporcionalidad** de tiempo, electricidad, mantenimiento, purga ni preparación respecto de las piezas.
7. Los costos por placa, por unidad y por lote siguen separados y sin doble conteo.
8. La cotización **no** descuenta inventario. El consumo efectivo se registra en producción.
9. Snapshots históricos intactos: la nueva estrategia es una **nueva versión del motor**.
10. Pruebas explícitas para cada caso (sección 7).

## 3. Cambios de contrato (aditivos y versionados)

### 3.1 Entrada — `PlateSpec.lastRun` (solo v2)

```ts
export interface LastRunSpec {
  /** Piezas de la última placa; debe ser = piezas restantes (1 … partsPerPlate − 1). */
  readonly parts: Quantity
  /** Gramos POR FILAMENTO de ESA placa (Bambu Studio). Mismos materiales que la placa completa o un subconjunto. */
  readonly filaments: readonly FilamentUse[]
  /** Horas de ESA placa (Bambu Studio). */
  readonly printHours: Hours
  /** SLICED: datos de Bambu Studio. (No existe una fuente «calculada»: sin datos no se envía lastRun.) */
  readonly source: 'SLICED'
}
export interface PlateSpec { /* …v1… */ readonly lastRun?: LastRunSpec }
```

- **Validación:** `lastRun` está prohibido en v1 (`UNSUPPORTED_IN_VERSION`). En v2 solo se admite si hay restante (`parts === requiredParts mod partsPerPlate`, sin piezas sobrantes) y con gramos y horas mayores a 0. Un filamento que no esté en el snapshot es `UNKNOWN_MATERIAL`.

### 3.2 Cantidades — `resolveQuantities` v2

```
requiredParts = N × partsPerUnit
fullPlates    = floor(requiredParts / partsPerPlate)
remainder     = requiredParts − fullPlates × partsPerPlate        (0 … partsPerPlate − 1)
lastRun       = remainder > 0 ? (input.lastRun ?? ESTIMATE) : none
runs          = fullPlates + (remainder > 0 ? 1 : 0)              ← placas físicas
```

`PlateQuantity` suma (aditivo): `fullPlates`, `remainderParts`, `lastRunSource: 'NONE' | 'SLICED' | 'ESTIMATED_FULL_PLATE'`.
`platesRequired` sigue siendo el número de placas físicas, que coincide con v1. Así PER_PLATE «sin plateId» (cambio de placa) no cambia de significado.

### 3.3 Estimación provisional sin datos de la última placa

- **Política v2 `ESTIMATED_FULL_PLATE`:** la última placa se valora con los datos de la placa completa. Es la **cota superior**: nunca subcotiza y no inventa proporcionalidad.
- Se agrega el flag `LAST_PLATE_ESTIMATED` (severidad **WARNING**, emitible). El mensaje es «Última placa (k piezas) estimada como placa completa: rebánala en Bambu Studio para precisar».
- El presentador muestra además una **referencia informativa** («si fuera proporcional: ≈ X g / Y h»), etiquetada como referencia. **No entra en el precio.**
- Esto es configurable a futuro, por ejemplo BLOCK para exigir datos antes de emitir. Por defecto es WARNING.

### 3.4 Generadores (v2) — misma semántica, una «corrida» más

| Ítem | Placas completas | Última placa (si hay) | Comportamiento |
|---|---|---|---|
| Material por filamento | g/placa × `fullPlates` | g de lastRun (o de la placa completa si se estima) × 1 | PER_PLATE |
| Electricidad | h/placa × kW × `fullPlates` | h lastRun × kW × 1 | PER_PLATE |
| Desgaste / mantenimiento | h/placa × tarifa × `fullPlates` | h lastRun × tarifa × 1 | PER_PLATE |
| Supervisión | h/placa × ratio × `fullPlates` | h lastRun × ratio × 1 | PER_PLATE |
| Cambio de placa | min × **runs** (fijo por placa, no proporcional) | (incluido en runs) | PER_PLATE |
| Preparación del trabajo | — | — | PER_BATCH (sin cambio) |
| Acabado, embalaje, servicios | — | — | PER_UNIT (sin cambio) |
| Diseño | — | — | ONE_OFF (sin cambio) |
| Falla (reimpresión esperada) | sobre ítems de placa completa | sobre ítems de la última placa (misma tasa por placa) | derivado |

- Códigos nuevos: `material:<plate>:last:<material>`, `electricity:<plate>:last`, etc., con `plateId` y el nuevo campo `run: 'FULL' | 'LAST'`. Los totales por comportamiento y componente se mantienen y no hay doble conteo, porque cada corrida se cuenta una sola vez.
- **AMS / multicolor:** `lastRun.filaments` trae la purga real de esa placa, que no es proporcional. Si la última placa usa menos colores, los filamentos ausentes valen 0.

### 3.5 Salida (aditiva)

`PlatesRequired` + `fullPlates`, `remainderParts`, `lastRunSource`; `CostItem.run?`.
`summary` (quoting): `fullPlates`, `lastRun {parts, source}`, `totalPrintHours = full × h + h_last`, y `filamentByMaterial` como **estimación de cotización**.

### 3.6 Versionado y snapshots

- Nuevo motor `ENGINE_V2` registrado junto a `ENGINE_V1`. Las cotizaciones nuevas usan `calculationVersion: 'v2'`.
- Las cotizaciones guardadas con `v1` se reproducen **siempre** con v1, porque el registro despacha por versión. No se migran snapshots.
- **Equivalencia:** sin piezas restantes (todas las placas llenas), v2 ≡ v1 en todos los importes. Se exige con una prueba de propiedades. Los goldens G1 ($48.000) y G2 ($44.800) no cambian.

## 4. Formulario (quoting) y UI — cotizador unificado

- Sección 02, «Filamentos de la placa»: gramos de la **placa completa** por filamento.
- Sección 03, «Datos de Bambu Studio»: cantidad, **piezas en la placa completa** y **tiempo de la placa completa**.
- Resumen automático: «2 placas completas (3 piezas c/u) + 1 última placa con 1 pieza».
- Si hay restante, se muestra un bloque compacto **«Última placa (1 pieza)»** con tiempo y gramos por filamento (las mismas filas del AMS) y la indicación «Rebana en Bambu Studio solo 1 pieza y copia aquí».
  - Si queda vacío, se muestra la etiqueta **«Estimación provisional»** y el aviso del flag.
  - Si se completa, se muestra la etiqueta «Datos de Bambu Studio».
- `formState`: `lastRunHours`, `lastRunGrams1..4` (opcionales). `toRawForm` / `parseQuoteForm` hacen ida y vuelta.

## 5. Inventario (corrige lo hecho en 0.10.0, no publicado)

- La cotización **solo estima**: muestra «Filamento estimado del trabajo» y el control de stock.
- **Al pasar a «En producción» ya no se descuenta automáticamente.** Se registra el **consumo real**:
  - El diálogo «Registrar consumo de filamento» viene precargado con la estimación (etiquetada como estimación) y se puede editar por material.
  - Admite reimpresiones o fallas («+ agregar consumo»).
  - Se puede registrar en producción o al entregar, varias veces (por ejemplo, una vez por placa impresa).
- `order.consumptions[] = { id, at, items[{materialId, grams}], note, source: 'ACTUAL' }`. El stock se actualiza solo con registros ACTUAL. Es idempotente por `id` (doble clic o dos sesiones).
- Un pedido sin consumo registrado se marca como «Consumo pendiente» en Pedidos.

## 6. Archivos afectados

| Capa | Archivos |
|---|---|
| Contratos | `contracts/quote-input.ts` (LastRunSpec), `contracts/results.ts` (campos aditivos), `contracts/version.ts` (V2), `contracts/validate/quote-input.ts` (+ reglas por versión), `contracts/flags` (LAST_PLATE_ESTIMATED) |
| Motor | `calculator.ts` (registro V1+V2), `v2/cost/quantities.ts`, `v2/cost/generators/*` (reutilizan v1 vía composición: v2 = v1 con el resolvedor de corridas), `v1/**` **sin cambios** |
| Quoting | `form.ts` (campos lastRun), `mapper.ts` (V2 + lastRun), `presentation.ts` (resumen por corridas), `service.ts` (versión) |
| Beta UI | `app.js` (bloque última placa, etiquetas, diálogo de consumo), `domain/inventory.js` (consumo ACTUAL, sin descuento automático), `workflow.js` (quitar descuento automático) |
| Firestore | Sin cambios de reglas (campos nuevos en pedidos y materiales permitidos). `consumptions[]` queda append-only como los pagos (regla nueva + prueba en el emulador) |

## 7. Pruebas (nuevas y afectadas)

**Afectadas (deben seguir pasando sin cambios):** las de v1 (`quantities.test`, `engine.test`, `failure.test`, `generators.test`, `semantics.test`, goldens G1/G2, `contracts.test`, `types.test-d`), `service.test`, `multicolor.test` y las E2E actuales.

**Nuevas — motor v2:**
1. Placas completas exactas (8 u / 4 por placa): v2 ≡ v1 en cada ítem, en los totales y en el precio.
2. Propiedad (fast-check): para todo N múltiplo de partsPerPlate, v2 ≡ v1.
3. Última placa con datos SLICED (4 u / 3 por placa; placa completa 300 g / 6 h; última 105 g / 2,3 h): material = 300 + 105 g; horas = 6 + 2,3; electricidad, desgaste y supervisión con 8,3 h; cambio de placa × 2 corridas.
4. Última placa SLICED con AMS (purga distinta por filamento, y un filamento ausente en la última placa = 0).
5. Sin datos de la última placa: `ESTIMATED_FULL_PLATE` = cota superior, flag WARNING y emitible; además, la referencia proporcional no altera el precio.
6. Costos fijos: la preparación PER_BATCH no depende de las placas; el cambio de placa se cuenta por corrida (no proporcional); embalaje y acabado PER_UNIT sin cambio.
7. Variaciones de tiempo: una última placa con más h por pieza que la completa (calentamiento o purga) se respeta tal cual, sin «corregirla».
8. Falla: misma tasa por placa aplicada a la última corrida; con tasa 0, sin efecto.
9. Unidades y piezas por unidad mayor que 1: el restante se calcula sobre piezas, no sobre unidades.
10. Límites: N = 1 con partsPerPlate grande (0 completas + 1 última); restante = partsPerPlate − 1; lastRun en v1 → error; lastRun sin restante → error; `parts` distinto del restante → error; gramos u horas en 0 → error; MAX_PLATES.
11. Reproducción: una cotización v1 guardada se recalcula idéntica con el registro V1+V2.

**Nuevas — quoting/UI/inventario:**
12. `parseQuoteForm` / `toRawForm` ida y vuelta con lastRun (1 color y AMS).
13. E2E: aparece el bloque «Última placa» solo con restante; la etiqueta «Estimación provisional» aparece y desaparece; los totales en vivo.
14. Inventario: «En producción» no descuenta; registrar consumo ACTUAL descuenta una vez (idempotente por id); varios registros suman; reglas append-only en el emulador.

## 8. Decisiones que requieren tu aprobación

1. **Estimación sin datos de la última placa:** cota superior = placa completa (recomendada; no subcotiza), con aviso y emitible. ¿O bloquear la emisión hasta tener los datos?
2. **Consumo de inventario:** registro manual del consumo real precargado con la estimación (recomendado). Reemplaza el descuento automático de la 0.10.0, que no se ha publicado.
3. **Nuevas cotizaciones con motor v2:** solo cambian los precios de cotizaciones con placa incompleta y datos reales de la última placa. Las demás quedan idénticas a v1.
