/**
 * auth.setup.ts — runs once before all tests.
 * Calls the test-login endpoint (dev only), injects the JWT into
 * localStorage, then saves the browser storage state so every test
 * starts already authenticated.
 */

import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "tests/e2e/.auth/user.json";

setup("authenticate via test login", async ({ page }) => {
  // Hit the test-login endpoint
  const response = await page.request.post(
    "http://localhost:5000/api/auth/test-login",
    {
      data: { username: "PlaywrightUser", email: "playwright@test.local" },
    }
  );

  expect(response.ok()).toBeTruthy();
  const { token, user } = await response.json();
  expect(token).toBeTruthy();

  // Load the app and inject token into localStorage (same keys authStore uses)
  await page.goto("/");
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem("token", token);
      // Zustand persisted state key
      localStorage.setItem(
        "auth-store",
        JSON.stringify({ state: { token, user, isAuthenticated: true }, version: 0 })
      );
    },
    { token, user }
  );

  // Reload so the app reads the stored token
  await page.reload();

  // Wait until the app recognises the session (lobby or any authenticated route)
  await page.waitForURL(/\/(lobby|profile|wallet|leaderboard)/, { timeout: 10_000 })
    .catch(() => {}); // some apps stay on "/" — that's fine too

  // Save full browser storage (cookies + localStorage) for reuse
  await page.context().storageState({ path: AUTH_FILE });
  console.log("✓ Auth session saved →", AUTH_FILE);
});
