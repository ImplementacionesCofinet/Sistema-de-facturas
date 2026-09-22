import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' solo existe para que Next avise si un modulo de servidor
      // se importa desde el cliente. En las pruebas se neutraliza.
      'server-only': path.resolve(__dirname, './tests/vacio.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Las pruebas de integracion comparten una base de datos: sin paralelismo.
    fileParallelism: false,
  },
});
