import { test, expect } from "@playwright/test";

async function dismissOverlays(page: import("@playwright/test").Page) {
  await page.waitForTimeout(1500);
  // Try close buttons inside fixed overlays
  const closeBtn = page.locator(".fixed.inset-0 button, [role='dialog'] button")
    .filter({ hasText: /close|dismiss|×|✕|skip|later|ok/i })
    .first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    // Fallback: press Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

test.describe("Lobby", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/lobby");
  });

  test("shows lobby page when logged in", async ({ page }) => {
    await expect(page).toHaveURL(/lobby/);
    await expect(page.locator("text=7 Cards Show")).toBeVisible();
  });

  test("can create a room", async ({ page }) => {
    await dismissOverlays(page);

    const createBtn = page.getByRole("button", { name: /create/i });
    await expect(createBtn).toBeVisible({ timeout: 10_000 });
    await createBtn.click();
    // Modal or form should appear
    await expect(page.locator("text=/room|game/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("notification bell is visible", async ({ page }) => {
    await expect(page.locator("button[aria-label='Notifications']")).toBeVisible();
  });

  test("user avatar / username visible in header", async ({ page }) => {
    await expect(page.getByText("PlaywrightUser")).toBeVisible();
  });
});
