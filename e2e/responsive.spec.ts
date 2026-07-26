import { expect, test } from "@playwright/test";
import { openWorkspace } from "./helpers";

/**
 * Runs on the phone project. These are the cases that were actually broken
 * before the responsive work: the editor was hidden below lg, so a note could
 * not be opened at all, and 13px inputs made iOS zoom on focus.
 */
test.beforeEach(async ({ page }) => {
  await openWorkspace(page);
});

test("nothing scrolls sideways", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a note opens as a full-screen sheet and the back control returns", async ({ page }) => {
  await page.getByText("App Idea: Task Manager").first().click();

  const editor = page.locator('textarea[placeholder^="Start writing"]:visible');
  await expect(editor).toBeVisible();

  await page.getByLabel("Back to list").click();
  await expect(page.getByPlaceholder("Search notes...")).toBeVisible();
});

test("the drawer opens and closes when navigating", async ({ page }) => {
  await page.getByLabel("Open menu").first().click();
  const favorites = page.getByRole("link", { name: /^Favorites/ });
  await expect(favorites).toBeVisible();

  await favorites.click();
  await expect(page).toHaveURL("/favorites");
  await expect(favorites).toBeHidden();
});

test("the tab bar reaches the calendar, which stacks its upcoming panel", async ({ page }) => {
  await page.getByRole("link", { name: "Calendar" }).last().click();
  await expect(page).toHaveURL("/calendar");

  await expect(page.getByText("Upcoming")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("inputs are large enough that iOS will not zoom on focus", async ({ page }) => {
  const size = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>("[data-search-input]");
    return input ? Number.parseFloat(getComputedStyle(input).fontSize) : 0;
  });
  expect(size).toBeGreaterThanOrEqual(16);
});
