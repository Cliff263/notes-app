import { expect, test as setup } from "@playwright/test";
import { TEST_USER } from "./global-setup";
import { STORAGE_STATE } from "./paths";

/**
 * Signs in once and saves the session for every other spec. Besides being much
 * faster than signing in per test, it keeps the suite from tripping the app's
 * own sign-in rate limit.
 */
setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]');
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  // Clicking before hydration submits the form natively and never navigates.
  await page.waitForTimeout(1500);

  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/", { timeout: 30_000 });
  await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });

  await page.context().storageState({ path: STORAGE_STATE });
});
