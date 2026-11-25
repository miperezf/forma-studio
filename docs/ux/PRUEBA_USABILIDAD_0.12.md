# Prueba de usabilidad — FORMA Studio 0.12.0 (2026-10-21)

**Alcance**
- Producción real (https://forma-studio-prd-7bink.web.app): recorrido de solo lectura por las 8 secciones.
- Ciclo completo sobre el mismo código en modo producción, con nube simulada y un taller vacío. Así no quedan pedidos de prueba en producción, donde no se pueden borrar.

**Caso real:** MakerWorld #1079318 «Multi Color Filament – 80g 4/3/2-Colors» (autor fmod). Perfil AMS: 74 g, 6,2 h, 3 placas, 4 colores.
- MakerWorld no publica los gramos por color. Los repartí en 9,2 / 5,2 / 5,2 / 5,1 g por placa promedio; en uso real salen de Bambu Studio.
- Se cotizaron 2 juegos.

## Recorrido (clics medidos)
| Paso | Clics | Resultado |
|---|---|---|
| Crear cliente | 3 | OK; normaliza el nombre («valentina rojas» → «Valentina Rojas») |
| 4 filamentos PLA Basic desde el catálogo | 21 + 8 campos | OK, rápido; muestra físico, comprometido y disponible |
| Armar la cotización multicolor | 5 | Requiere un truco: 3 placas distintas ⇒ «Planificación especial» con 3 piezas por producto y una placa promedio |
| Guardar → enviada → aceptada + pedido | 5 | OK; la reserva aparece en Materiales (comprometido 0,055 kg) |
| Avanzar el pedido y registrar consumo y abono | 6 | OK; al equivocarse no hay vuelta atrás |
| Móvil 390 px | — | Sin desborde de página, pero la tabla de pedidos queda inutilizable |

## Hallazgos (por severidad)
**Altos**
1. **Pedidos sin corrección:** el estado solo avanza. Si pasas a «Entregado» por error no hay vuelta atrás, ni anulación ni eliminación.
2. **Tiempo en horas decimales con paso 0,1:** «2,07 h» se rechaza en silencio (solo con el globo del navegador) y la cotización no se guarda sin ningún aviso. Bambu Studio muestra «2h 4m». Los gramos con 2 decimales (24,73 g) también se rechazan.
3. **Producto con varias placas distintas** (típico de MakerWorld): el cotizador admite una sola placa tipo. Hay que promediar con «Planificación especial», cuando el motor ya admite varias placas.
4. **Tabla de Pedidos:** en escritorio de 1440 px la columna de acciones queda fuera de la vista; en móvil solo se ve la primera columna. No se puede cambiar el estado ni registrar abonos sin desplazarse dentro de la tabla.
5. **Botón «Consumo · pendiente» en la tabla:** agrega ruido y el registro de consumo queda fuera del flujo de producción.

**Medios**
6. El panel en producción muestra un banner de marketing y contadores «00».
7. El nombre de los filamentos repite el color («PLA Basic Blue · Blue») y en móvil se corta.
8. La muestra de color blanca (Jade White) no tiene borde y el número desaparece.
9. La navegación móvil solo tiene íconos, sin texto.

## Notas (1–10)
| Área | Nota |
|---|---|
| Cotizador, un color | 7,5 |
| Cotizador, multicolor con caso real | 5,5 |
| Materiales (catálogo e inventario) | 8 |
| Flujo comercial (enviar, aceptar, pedido) | 8 |
| Pedidos (estados, correcciones, acciones) | 4,5 |
| Inventario (reserva y consumo) | 6 |
| Configuración y respaldo | 7,5 |
| Panel | 6 |
| Móvil | 5 |
| **Global** | **6,5** |

## Recomendaciones (orden propuesto)
1. **Corrección de pedidos:**
   - «Volver al estado anterior», un paso, con motivo, auditado.
   - «Anular pedido», con motivo: libera la reserva, sale de los totales y conserva el historial y los abonos. Sin borrado físico.
2. **Consumo dentro del flujo:** se quita el botón de la tabla. Al pasar a «Entregado» aparece «Confirmar consumo real», precargado con la reserva, con opción «Lo registro después». El consumo queda como sección del detalle del pedido.
3. **Tiempo en «h + min»** como en Bambu Studio, gramos con 2 decimales y errores visibles junto al campo.
4. **«＋ Agregar placa»:** cada placa con sus piezas, tiempo y gramos por color, para modelos de MakerWorld con varias placas. Requiere ampliar el cotizador, no el motor.
5. **Pedidos responsivos:** acciones siempre visibles en escritorio y tarjetas en móvil.
6. **Detalles:** panel sin banner en producción, nombres de filamento sin repetir el color, borde en la muestra blanca, texto en la navegación móvil.
