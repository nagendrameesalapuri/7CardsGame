export const ENV = {
  BASE_URL:   process.env.BASE_URL    ?? 'http://localhost:3000',
  API_URL:    process.env.API_BASE_URL ?? 'http://localhost:5000',
  ADMIN_PASS: process.env.ADMIN_SECRET ?? 'admin-test-123',
  JWT_SECRET: process.env.JWT_SECRET   ?? 'playwright-test-jwt-secret-32chars!!',
  // Timeouts
  ACTION_TIMEOUT:  20_000,
  NAV_TIMEOUT:     30_000,
  SOCKET_TIMEOUT:  15_000,
  GAME_TIMEOUT:    60_000,
};
