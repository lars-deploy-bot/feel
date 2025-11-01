import { defineConfig } from "@playwright/test"

// Use port 9547 for testing to avoid conflicts with production (8999)
const TEST_PORT = "9547"
const BASE_URL = `http://localhost:${TEST_PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,

  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "bun run dev:test",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      PLAYWRIGHT_TEST: "true",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
})
