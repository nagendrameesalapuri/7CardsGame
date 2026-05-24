import { test, expect } from "@playwright/test";

test.describe("Progression / Lucky Spin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/progression");
  });

  test("shows progression page", async ({ page }) => {
    await expect(page.locator("text=/progression|level|xp/i").first()).toBeVisible();
  });

  test("lucky spin wheel is visible", async ({ page }) => {
    await expect(page.locator("text=/spin|lucky/i").first()).toBeVisible();
  });

  test("spin button is present", async ({ page }) => {
    const spinBtn = page.getByRole("button", { name: /spin/i });
    await expect(spinBtn).toBeVisible();
  });
});
