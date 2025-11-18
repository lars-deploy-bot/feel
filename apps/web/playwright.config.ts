import { defineConfig } from "@playwright/test"

// Use port 9547 for testing to avoid conflicts with production (8999)
const TEST_PORT = "9547"
const BASE_URL = `http://localhost:${TEST_PORT}`

// Support staging environment tests
const isStaging = process.env.TEST_ENV === "staging"

export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*.spec.ts", // Standard Playwright convention
  timeout: 30000,
  workers: 1, // Run tests sequentially to avoid state pollution

  use: {
    baseURL: isStaging ? "https://dev.terminal.goalive.nl" : BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  // Only start web server for local tests
  webServer: isStaging
    ? undefined
    : {
        command: "bash scripts/start-test-server.sh",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180000, // Increased timeout for slower starts
      },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
})
