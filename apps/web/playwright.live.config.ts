// FIRST: Load env file (side effect import - must be first!)
import "./e2e-tests/lib/load-env"

import { defineConfig } from "@playwright/test"
import { requireEnvAppBaseUrl } from "./e2e-tests/lib/base-url"

/**
 * Playwright Config - Live Staging API Integration Tests
 *
 * This config is for E2E tests that make REAL API calls (no mocks)
 * against the deployed staging environment.
 *
 * Run with: bun run test:e2e:live
 */

const APP_BASE_URL = requireEnvAppBaseUrl()

export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*-live.spec.ts", // Only run live staging tests
  timeout: 120000, // Live tests include real API calls and LLM judge pass
  workers: 1, // Sequential execution

  // Use shared tenant bootstrap/cleanup against staging
  globalSetup: "./e2e-tests/global-setup.ts",
  globalTeardown: "./e2e-tests/global-teardown.ts",

  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  // Staging-only lane: never start local server
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
