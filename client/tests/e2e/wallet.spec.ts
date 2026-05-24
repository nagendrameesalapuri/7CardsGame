import { test, expect } from "@playwright/test";

test.describe("Wallet", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/wallet");
  });

  test("shows wallet balance", async ({ page }) => {
    await expect(page.locator("text=/₹|balance/i").first()).toBeVisible();
  });

  test("shows transaction history section", async ({ page }) => {
    await expect(
      page.locator("text=/transaction|history/i").first()
    ).toBeVisible();
  });

  test("deposit button is present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /deposit/i })
    ).toBeVisible();
  });
});
