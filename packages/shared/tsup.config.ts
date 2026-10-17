import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  // The API client is a separate entry so the backend never loads openapi-fetch.
  entry: { index: 'src/index.ts', 'api/index': 'src/api/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // Watch mode must not wipe dist/: the API and site import it while rebuilding.
  clean: !options.watch,
  target: 'es2023',
}));
