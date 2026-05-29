import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const SERVER_URL = 'http://localhost:5000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: !CI,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  // Cap at 2 workers locally to prevent guest-login rate limiting (server allows 15/15min per IP)
  workers: CI ? 2 : 2,
  timeout: 120_000,        // per-test default; long tests call test.setTimeout()
  reporter: CI
    // Sharded CI runs: blob reporter enables merge-reports; github reporter gives inline PR annotations
    ? [['blob'], ['github'] as any]
    // Local runs: human-readable list + HTML report
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 12_000,
    navigationTimeout: 25_000,
    // Grant notification permission so the "Notifications are blocked" dialog never appears
    permissions: ['notifications'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: CI
    ? [
        {
          // Server — ts-node-dev; NODE_ENV=test disables rate limiting for E2E stability
          command: 'npm run dev',
          cwd: './server',
          url: `${SERVER_URL}/api/admin/config/public`,
          reuseExistingServer: false,
          timeout: 90_000,
          stdout: 'pipe',
          stderr: 'pipe',
          env: { NODE_ENV: 'test' },
        },
        {
          // Client — pre-built in CI; served via vite preview
          command: 'npx vite preview --port 3000',
          cwd: './client',
          url: BASE_URL,
          reuseExistingServer: false,
          timeout: 30_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      ]
    : [
        {
          // Local dev — reuse running dev server
          command: 'npm run dev',
          cwd: './client',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60_000,
        },
      ],
});
