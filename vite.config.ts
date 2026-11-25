import { defineConfig } from 'vitest/config'

// Fase 1 no tiene UI: Vite solo actúa como base de Vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
