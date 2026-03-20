import { defineConfig } from "@playwright/test"

const BASE_URL = process.env.MANAGER_BASE_URL ?? "https://mg.alive.best"

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  testMatch: "**/*.test.ts",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Manager tests share auth state

  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
})
