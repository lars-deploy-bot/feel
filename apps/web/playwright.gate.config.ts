/**
 * Playwright Config - Staging Gate (Deployment Validation)
 *
 * Runs the standard E2E test suite against the ALREADY-DEPLOYED staging server.
 * Used by build-and-serve.sh after deploying and health-checking the staging build.
 *
 * Key differences from playwright.config.ts:
 * - Accepts TEST_ENV=staging (standard config rejects it)
 * - No webServer (staging is already running)
 * - Tests the actual production build, not a dev server
 *
 * Run with: ENV_FILE=.env.staging bun run test:e2e:gate
 */

// FIRST: Load env file (side effect import - must be first!)
import "./e2e-tests/lib/load-env"

import { defineConfig } from "@playwright/test"
import { TEST_CONFIG } from "@webalive/shared"
import { requireEnvAppBaseUrl } from "./e2e-tests/lib/base-url"
import { TEST_ENV, TIMEOUTS } from "./e2e-tests/lib/test-env"

const APP_BASE_URL = requireEnvAppBaseUrl()

// Gate config only makes sense against a deployed server
if (TEST_ENV === "local") {
  throw new Error(
    "playwright.gate.config.ts requires a deployed server (TEST_ENV=staging or TEST_ENV=preview).\n" +
      "For local dev testing, use playwright.config.ts instead.",
  )
}

// Enforce worker limits
const desiredWorkers = 4
const maxWorkers = TEST_CONFIG.MAX_WORKERS

if (desiredWorkers > maxWorkers) {
  throw new Error(
    `Playwright workers (${desiredWorkers}) exceeds TEST_CONFIG.MAX_WORKERS (${maxWorkers}). ` +
      "Update TEST_CONFIG.MAX_WORKERS in packages/shared/src/constants.ts",
  )
}

export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/*-live.spec.ts", // Exclude live-only tests (separate suite)
  timeout: TIMEOUTS.DEFAULT,
  retries: 1,
  workers: desiredWorkers,
  globalSetup: "./e2e-tests/global-setup.ts",
  globalTeardown: "./e2e-tests/global-teardown.ts",

  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  // No webServer — staging is already deployed and healthy
  webServer: undefined,

  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        baseURL: APP_BASE_URL,
      },
    },
  ],
})
