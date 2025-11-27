// FIRST: Load env file (side effect import - must be first!)
import "./e2e-tests/lib/load-env"

// Now safe to import modules that read process.env
import { defineConfig } from "@playwright/test"
import { TEST_CONFIG } from "@webalive/shared"
import { TEST_ENV, isRemoteEnv, TIMEOUTS } from "./e2e-tests/lib/test-env"

// Use port 9547 for testing to avoid conflicts with production (8999)
const TEST_PORT = "9547"
const LOCAL_BASE_URL = `http://localhost:${TEST_PORT}`

// Determine base URL based on environment (TEST_ENV is validated, no fallback needed)
const BASE_URLS: Record<string, string> = {
  local: LOCAL_BASE_URL,
  staging: "https://staging.terminal.goalive.nl",
  production: "https://terminal.goalive.nl",
}
const baseURL = BASE_URLS[TEST_ENV]

// Enforce worker limits against centralized config (single source of truth)
// - CI: 2 workers (conservative for shared runners)
// - Remote (staging/production): 6 workers (deployed server can handle more)
// - Local: 4 workers (dev machine balance)
const desiredWorkers = process.env.CI ? 2 : isRemoteEnv ? 6 : 4
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
  timeout: TIMEOUTS.DEFAULT,
  workers: desiredWorkers, // Validated against TEST_CONFIG.MAX_WORKERS
  globalSetup: "./e2e-tests/global-setup.ts",
  globalTeardown: "./e2e-tests/global-teardown.ts",

  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  // Only start web server for local tests (remote environments use deployed servers)
  webServer: isRemoteEnv
    ? undefined
    : {
        command: "bash scripts/start-test-server.sh",
        url: LOCAL_BASE_URL,
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
