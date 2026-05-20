import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SERVER_ENV = {
  NODE_ENV: 'test',
  PORT: '5000',
  MONGODB_URI: process.env.MONGODB_URI_TEST ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017/7cards_test',
  JWT_SECRET: process.env.JWT_SECRET ?? 'playwright-test-jwt-secret-32chars!!',
  ADMIN_SECRET: process.env.ADMIN_SECRET ?? 'admin-test-123',
  RESEND_API_KEY: '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'test',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'test',
  CLIENT_URL: 'http://localhost:3000',
  SESSION_SECRET: process.env.SESSION_SECRET ?? 'test-session-secret',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    // Global test storage state path used by auth fixtures
    storageState: undefined,
  },

  projects: [
    // ── Setup project — runs before all other projects ──────────────────────
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Desktop Chrome ──────────────────────────────────────────────────────
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.setup\.ts/,
    },

    // ── Mobile Chrome ───────────────────────────────────────────────────────
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      testIgnore: [/.*\.setup\.ts/, /.*\/e2e\/(04|05|07|08|09|10)-.*\.spec\.ts/],
    },

    // ── Multiplayer — needs 2+ contexts, desktop only ───────────────────────
    {
      name: 'multiplayer',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\/e2e\/(04|05|07|08|09|10)-.*\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, 'server'),
      port: 5000,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      env: SERVER_ENV,
    },
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, 'client'),
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
    },
  ],
});
