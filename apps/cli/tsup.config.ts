import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src/cli.ts'],
  outDir: 'dist',
  target: 'esnext',
  format: 'esm',
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  clean: true,
  dts: false,
  minify: true,
  sourcemap: false,
  splitting: false,
});
