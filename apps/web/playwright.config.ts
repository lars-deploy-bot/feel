import { defineConfig } from "@playwright/test"
import dotenv from "dotenv"
import { TEST_CONFIG } from "@webalive/shared"

// Load environment variables from .env for test fixtures
dotenv.config()

// Use port 9547 for testing to avoid conflicts with production (8999)
const TEST_PORT = "9547"
const BASE_URL = `http://localhost:${TEST_PORT}`

// Support staging environment tests
const isStaging = process.env.TEST_ENV === "staging"

// Enforce worker limits against centralized config (single source of truth)
const desiredWorkers = process.env.CI ? 2 : 4
const maxWorkers = TEST_CONFIG.MAX_WORKERS

if (desiredWorkers > maxWorkers) {
  throw new Error(
    `Playwright workers (${desiredWorkers}) exceeds TEST_CONFIG.MAX_WORKERS (${maxWorkers}). ` +
      `Update TEST_CONFIG.MAX_WORKERS in packages/shared/src/constants.ts`,
  )
}

export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*.spec.ts", // Standard Playwright convention
  testIgnore: "**/*-genuine.spec.ts", // Exclude genuine tests (run separately with playwright.genuine.config.ts)
  timeout: 30000,
  workers: desiredWorkers, // Validated against TEST_CONFIG.MAX_WORKERS
  globalSetup: "./e2e-tests/global-setup.ts",
  globalTeardown: "./e2e-tests/global-teardown.ts",

  use: {
    baseURL: isStaging ? "https://staging.terminal.goalive.nl" : BASE_URL,
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
