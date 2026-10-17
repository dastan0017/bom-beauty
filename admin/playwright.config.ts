import { defineConfig, devices } from '@playwright/test';

// Admin flows against a running stack (`pnpm dev`): admin on 5173, API on 4000, seeded owner from .env.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://localhost:5173',
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
  },
});
