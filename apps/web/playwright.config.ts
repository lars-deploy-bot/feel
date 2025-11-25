import { defineConfig } from "@playwright/test"
import dotenv from "dotenv"
import { TEST_CONFIG } from "@webalive/shared"

// Support staging/production environment tests
const isStaging = process.env.TEST_ENV === "staging"
const isProductionEnv = process.env.TEST_ENV === "production"

// Load appropriate environment file
if (isProductionEnv) {
  // For production tests, load .env.production
  dotenv.config({ path: ".env.production", override: true })
} else if (isStaging) {
  // For staging tests, load .env.staging
  dotenv.config({ path: ".env.staging", override: true })
} else {
  // For local tests, load .env.test
  dotenv.config({ path: ".env.test", override: true })
}

// Use port 9547 for testing to avoid conflicts with production (8999)
const TEST_PORT = "9547"
const BASE_URL = `http://localhost:${TEST_PORT}`

// Enforce worker limits against centralized config (single source of truth)
// - CI: 2 workers (conservative for shared runners)
// - Staging/Production: 6 workers (deployed server can handle more)
// - Local: 4 workers (dev machine balance)
const desiredWorkers = process.env.CI ? 2 : isStaging || isProductionEnv ? 6 : 4
const maxWorkers = TEST_CONFIG.MAX_WORKERS

if (desiredWorkers > maxWorkers) {
  throw new Error(
    `Playwright workers (${desiredWorkers}) exceeds TEST_CONFIG.MAX_WORKERS (${maxWorkers}). ` +
      "Update TEST_CONFIG.MAX_WORKERS in packages/shared/src/constants.ts",
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
    baseURL: isProductionEnv
      ? "https://terminal.goalive.nl"
      : isStaging
        ? "https://staging.terminal.goalive.nl"
        : BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  // Only start web server for local tests (staging/production use deployed servers)
  webServer:
    isStaging || isProductionEnv
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
