// NOTA: configuración escrita sin red para instalar dependency-cruiser; se verifica en el primer `npm run depcruise`.
const NOT_TESTS = '\\.test(-d)?\\.ts$|/testing/'

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'core-solo-importa-core',
      severity: 'error',
      from: { path: '^src/core', pathNot: NOT_TESTS },
      to: { pathNot: '^src/core' },
    },
    {
      name: 'calculation-aislado',
      severity: 'error',
      comment: 'calculation solo conoce core/{types,result,validation,money,versioning} y a sí mismo.',
      from: { path: '^src/modules/calculation', pathNot: NOT_TESTS },
      to: { pathNot: '^src/modules/calculation|^src/core/(types|result|validation|money|versioning)/' },
    },
    {
      name: 'customer-quote-sin-calculation',
      severity: 'error',
      comment: 'La salida al cliente no puede ver costos: no importa calculation.',
      from: { path: '^src/modules/customer-quote' },
      to: { path: '^src/modules/calculation' },
    },
    {
      name: 'customer-quote-solo-core-basico',
      severity: 'error',
      from: { path: '^src/modules/customer-quote', pathNot: NOT_TESTS },
      to: { pathNot: '^src/modules/customer-quote|^src/core/(types|result|validation)/' },
    },
    {
      name: 'capas-internas-no-importan-aplicacion',
      severity: 'error',
      comment: 'calculation y customer-quote nunca dependen de quoting ni del puente de la Beta.',
      from: { path: '^src/modules/(calculation|customer-quote)' },
      to: { path: '^src/(modules/quoting|app-bridge)' },
    },
    {
      name: 'quoting-por-index-publico',
      severity: 'error',
      comment: 'La aplicación usa calculation y customer-quote solo por su index público.',
      from: { path: '^src/modules/quoting', pathNot: NOT_TESTS },
      to: { path: '^src/modules/(calculation|customer-quote)/.+', pathNot: '^src/modules/(calculation|customer-quote)/index\\.ts$' },
    },
    {
      name: 'dominio-sin-infraestructura',
      severity: 'error',
      from: { path: '^src/(core|modules)' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'codigo-no-importa-tests',
      severity: 'error',
      from: { pathNot: NOT_TESTS },
      to: { path: '\\.test(-d)?\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
}
