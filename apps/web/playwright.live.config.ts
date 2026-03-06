// FIRST: Load env file (side effect import - must be first!)
import "./e2e-tests/lib/load-env"

import { defineConfig } from "@playwright/test"
import { requireEnvAppBaseUrl } from "./e2e-tests/lib/base-url"
import { TEST_ENV, assertLiveE2ETarget } from "./e2e-tests/lib/test-env"

/**
 * Playwright Config - Live Preview/Staging API Integration Tests
 *
 * This config is for E2E tests that make REAL API calls (no mocks)
 * against deployed preview/staging environments.
 *
 * Run with: bun run test:e2e:live
 */

const APP_BASE_URL = requireEnvAppBaseUrl()
assertLiveE2ETarget(TEST_ENV, APP_BASE_URL)

export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*-live.spec.ts", // Only run live deployed-environment tests
  timeout: 120000, // Live tests include real API calls and LLM judge pass
  workers: 1, // Sequential execution

  // Use shared tenant bootstrap/cleanup against staging
  globalSetup: "./e2e-tests/global-setup.ts",
  globalTeardown: "./e2e-tests/global-teardown.ts",

  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  // Live remote lane: never start local server
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
