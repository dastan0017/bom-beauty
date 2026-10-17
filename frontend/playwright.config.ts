import { defineConfig, devices } from '@playwright/test';

// End-to-end checks against a running stack (`pnpm dev` at the repo root: site, API, Postgres, Redis).
// Run them on a settled dev server, not right after `next build`: the build rewrites files the dev server watches, and
// its rebuild refreshes open pages and cancels client navigations mid-test.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
});
