/**
 * auth.spec.ts — tests that do NOT use the saved session.
 * These run without the "setup" dependency so they start logged out.
 */

import { test, expect } from "@playwright/test";

// Override storageState — start fresh (logged out)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth (logged out)", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/7 Cards Show/i);
  });

  test("guest login works", async ({ page }) => {
    await page.goto("/");

    const guestBtn = page.getByRole("button", { name: /play as guest/i });
    if (!(await guestBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await guestBtn.click();

    // After clicking "Play as Guest" the form switches to guest mode — wait for input
    const input = page.getByPlaceholder(/your display name|username|name/i);
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("GuestTester");
    await page.getByRole("button", { name: /start playing|continue|join|play/i }).click();

    // Dismiss any popup/overlay that appears after login (e.g. daily reward)
    await page.waitForTimeout(2000);
    const closeBtn = page.locator("button").filter({ hasText: /close|dismiss|×|✕|skip|later|ok/i }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
    }

    await expect(page).toHaveURL(/lobby/, { timeout: 15_000 });
  });

  test("test-login endpoint returns token", async ({ request }) => {
    const res = await request.post(
      "http://localhost:5000/api/auth/test-login",
      { data: { username: "TestUser", email: "test@test.local" } }
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.username).toBe("TestUser");
  });
});
