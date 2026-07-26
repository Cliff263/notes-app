import { expect, test } from "@playwright/test";
import { signIn, TEST_USER } from "./helpers";

// This file exercises signing in, so it must not inherit a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("access control", () => {
  test("the workspace redirects to sign in when signed out", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("the data endpoints answer 401 rather than redirecting", async ({ request }) => {
    for (const path of ["/api/notes", "/api/notes/summary", "/api/events"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });

  test("the public auth pages stay reachable", async ({ page }) => {
    for (const path of ["/login", "/signup", "/forgot"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path));
    }
  });
});

test.describe("password reset", () => {
  test("an unknown address is answered the same way as a known one", async ({ request }) => {
    const unknown = await request.post("/api/auth/forgot", {
      data: { email: "definitely-not-registered@squarenotes.test" },
    });
    const known = await request.post("/api/auth/forgot", {
      data: { email: TEST_USER.email },
    });

    expect(unknown.status()).toBe(200);
    expect(known.status()).toBe(200);
    expect(await unknown.json()).toEqual(await known.json());
  });

  test("a short password is refused", async ({ request }) => {
    const response = await request.post("/api/auth/reset", {
      data: { token: "whatever", password: "short" },
    });
    expect(response.status()).toBe(400);
  });

  test("an unknown token is refused", async ({ request }) => {
    const response = await request.post("/api/auth/reset", {
      data: { token: "not-a-real-token", password: "long-enough-password" },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toMatch(/expired or was already used/);
  });
});

test.describe("rate limiting", () => {
  test("repeated signups are throttled", async ({ request }) => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await request.post("/api/auth/signup", {
        data: {
          email: `throttle-${Date.now()}-${attempt}@squarenotes.test`,
          password: "password-1234",
        },
      });
      statuses.push(response.status());
    }

    // The exact cut-off depends on what else has run, but it must stop.
    expect(statuses).toContain(429);
  });
});

test.describe("session", () => {
  test("signing in and out works", async ({ page }) => {
    await signIn(page);

    await page.locator("aside button").filter({ hasText: TEST_USER.email }).click();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
