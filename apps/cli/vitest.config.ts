import { defineConfig } from 'vitest/config';

/**
 * Story-style test layout for the CLI package:
 *
 *  - `unit` — pure module and command tests under `tests/unit`
 *  - `e2e` — process-level CLI scenarios under `tests/e2e`
 *
 * Coverage is scoped to TypeScript files in `src`. Tests live beside the
 * package root instead of inside `src`, so production code stays cleanly
 * separated.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['tests/e2e/**/*.e2e.test.ts'],
          testTimeout: 60_000,
          maxConcurrency: 1,
        },
      },
    ],
    coverage: {
      exclude: ['src/types.ts'],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        perFile: true,
        statements: 95,
      },
    },
  },
});
