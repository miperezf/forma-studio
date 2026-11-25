// NOTA: configuración escrita sin red para instalar ESLint; se verifica en el primer `npm install && npm run lint`.
import tseslint from 'typescript-eslint'

const domainFiles = ['src/core/**/*.ts', 'src/modules/calculation/**/*.ts']
const notDomainCode = ['**/*.test.ts', '**/*.test-d.ts', '**/testing/**', '**/constants.ts']

export default tseslint.config(
  // vendor/ y dist/ son GENERADOS (esbuild / build-standalone): no se lintean; se lintea su fuente en src/.
  { ignores: ['node_modules/**', 'dist/**', '**/dist/**', 'apps/**/src/vendor/**', 'coverage/**', 'scripts/**', 'vite.config.ts', '*.cjs'] },
  ...tseslint.configs.strict,
  {
    // Dominio: puro, determinista y sin entorno.
    files: domainFiles,
    ignores: notDomainCode,
    rules: {
      'no-magic-numbers': ['error', { ignore: [0, 1, -1, '0n', '1n'], ignoreArrayIndexes: true, enforceConst: true }],
      'no-restricted-globals': [
        'error',
        ...['Date', 'window', 'document', 'localStorage', 'sessionStorage', 'fetch', 'process', 'Intl', 'crypto', 'console', 'performance', 'setTimeout', 'setInterval'].map(
          (name) => ({ name, message: 'El dominio no puede depender del entorno ni del reloj.' }),
        ),
      ],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'El dominio debe ser determinista.' }],
    },
  },
  {
    // calculation solo conoce core permitido (ver también scripts/check-architecture.mjs y .dependency-cruiser.cjs).
    files: ['src/modules/calculation/**/*.ts'],
    ignores: notDomainCode,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/core/canonical', '**/core/canonical/*', '**/core/ports', '**/core/ports/*'], message: 'calculation no puede usar canonical ni ports.' },
            { group: ['**/infrastructure/**', '**/modules/!(calculation)/**'], message: 'calculation es independiente de otros módulos e infraestructura.' },
          ],
        },
      ],
    },
  },
)
