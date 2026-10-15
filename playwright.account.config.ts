import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'account*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  outputDir: 'test-results/accounts',
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    locale: 'en-US',
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'account-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'account-mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: [
    {
      // Avoid npm/shell wrappers intercepting the fixture shutdown signal.
      command: 'exec node --import tsx server/tests/browser-fixture.ts',
      url: 'http://127.0.0.1:3100/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
      env: {
        VITE_ACCOUNT_API_URL: 'http://127.0.0.1:3100',
        VITE_CONTENT_BASE_URL: 'http://localhost:4176',
      },
      url: 'http://127.0.0.1:4175',
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
  ],
});
