import { defineConfig, devices } from '@playwright/test';

// End-to-end checks against a running stack (`pnpm dev` at the repo root: site, API, Postgres, Redis).
// Run them on a settled dev server, not right after `next build`: the build rewrites files the dev server watches, and
// its rebuild refreshes open pages and cancels client navigations mid-test.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  // The dev server renders every request on demand; with both device projects running at once, a client navigation's
  // RSC request can take 3–4 s (seen in traces), so 5 s assertions on the new URL were flaky. A broken navigation
  // still fails, only later.
  expect: { timeout: 10_000 },
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
