import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/paths";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: {
      // Sandboxes that ship their own Chromium can point at it here.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    },
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      // Signing in and out is the one thing that must start signed out.
      name: "auth",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /auth\.spec\.ts/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      testMatch: /workspace\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], storageState: STORAGE_STATE },
      testMatch: /responsive\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
