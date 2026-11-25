# Arquitectura de FORMA Studio (estado 0.6.1 y objetivo 1.0)

```
UI (hoy: Beta JS plano · objetivo: React+Vite conservando CSS/marcado)
 └─ Hooks / presentación (objetivo)            apps/beta-web/src/ui/app.js
     └─ Application: src/modules/quoting       Zod en fronteras, perfiles con revisión, casos de uso
         ├─ Domain: src/modules/calculation    motor puro v1 + registro de versiones (QuoteCalculator)
         ├─ Domain: src/modules/customer-quote documento comercial (whitelist), sin acceso al motor
         └─ Ports: src/core/ports              Clock, IdGenerator, Hasher, TransactionRunner
             └─ Infrastructure                 hoy: MockRepository (localStorage, 2 claves) · objetivo: Firestore/Auth/Storage
```

Reglas de dependencia verificadas por `scripts/check-architecture.mjs` (R1–R9): ver README raíz.

## Persistencia objetivo (Gate F) — colecciones Firestore

| Colección | Contenido | Lectura | Escritura |
|---|---|---|---|
| `workspaces/{w}/clients` | CRM | propietario/operador | propietario/operador |
| `workspaces/{w}/profiles/{kind}/revisions/{rev}` | perfiles costo/precio/IVA/canal/material/máquina | propietario (operador: lectura) | propietario; revisiones **inmutables** (solo create) |
| `workspaces/{w}/internalQuotes` | InternalQuote (costos, snapshot, emisión) | **solo propietario** (operador: decisión P-1) | create; update solo en Borrador; emitida inmutable salvo transición de estado |
| `workspaces/{w}/customerQuotes` | CustomerQuote (whitelist) | propietario/operador | solo junto con su interna (transacción) |
| `workspaces/{w}/orders/{quoteId}` | pedido; **id = id de cotización** ⇒ nunca dos pedidos | propietario/operador | create en transacción con la aceptación; rules: no sobrescribir |
| `workspaces/{w}/orders/{o}/payments/{paymentId}` | abonos; id generado por el cliente (idempotente) | propietario/operador | create único; sin update/delete (correcciones como asiento inverso) |
| `workspaces/{w}/counters/quotes` | último folio | — | transacción |
| `workspaces/{w}/audit` | eventos | propietario | create-only |

Enlace público al cliente (posterior a 1.0): copia firmada/publicada solo de `customerQuotes`, nunca de `internalQuotes`.
