import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for server-side helpers; the pages themselves are covered by Playwright (e2e/).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    env: {
      INTERNAL_API_URL: 'http://localhost:4000/v1',
      REVALIDATE_SECRET: 'test-revalidate-secret',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
      NEXT_PUBLIC_API_URL: 'http://localhost:4000/v1',
      // Media on a local host, as in dev: next/og refuses to fetch such URLs itself.
      NEXT_PUBLIC_MEDIA_URL: 'http://localhost:9000/bom-public',
    },
  },
});
