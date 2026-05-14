import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Load root .env so tests can read ADMIN_SECRET, JWT_SECRET etc when reusing existing server
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

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, 'server'),
      port: 5000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
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
      },
    },
    {
      command: 'npm run dev',
      cwd: path.join(__dirname, 'client'),
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
