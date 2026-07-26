import { expect, type Page } from "@playwright/test";
import { TEST_USER } from "./global-setup";

export { TEST_USER };

/**
 * Opens the workspace with the session saved by `auth.setup.ts` and waits for
 * the first page of notes, so assertions never race the initial fetch.
 */
export async function openWorkspace(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByPlaceholder("Search notes...")).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
}

/** Signs in through the real form — used by the specs that test signing in. */
export async function signIn(page: Page) {
  await page.goto("/login");
  await page.waitForSelector('input[type="email"]');
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await page.waitForTimeout(1500);

  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("/", { timeout: 30_000 });
  await expect(page.locator("article").first()).toBeVisible({ timeout: 30_000 });
}

/** The note list, which is an <article> per card. */
export function cards(page: Page) {
  return page.locator("article");
}

export async function openNote(page: Page, title: string) {
  await page.getByText(title, { exact: false }).first().click();
  await expect(page.locator('textarea[placeholder^="Start writing"]')).toBeVisible();
}
