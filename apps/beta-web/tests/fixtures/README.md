Archivos `.3mf` SINTÉTICOS para las pruebas del importador de Bambu Studio (generados a mano con los campos que lee
`src/domain/bambu-3mf.js`; no contienen modelos de terceros):
- `multiplaca.gcode.3mf`: 3 placas, 4 colores, 74 g y 6,2 h en total (como un perfil de MakerWorld con varias placas).
- `una-placa.gcode.3mf`: 1 placa con 4 piezas, 24,73 g, 2 h 15 min 30 s, impresora A1 mini; tamaños ZIP64 en los encabezados locales (el lector usa el directorio central).
- `sin-laminar.3mf`: proyecto sin placas laminadas (debe dar el mensaje que explica cómo exportar).
