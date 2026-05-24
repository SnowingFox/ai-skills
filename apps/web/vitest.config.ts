import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/tests/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**', 'src/**/*.test.ts'],
      provider: 'v8',
    },
  },
});
