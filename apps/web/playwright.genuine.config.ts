import { defineConfig } from "@playwright/test"

/**
 * Playwright Config - Genuine API Integration Tests
 *
 * This config is for E2E tests that make REAL API calls (no mocks).
 * Uses a separate test server without PLAYWRIGHT_TEST=true.
 *
 * Run with: bun run test:e2e:genuine
 */

// Use staging server (already running without PLAYWRIGHT_TEST=true)
const BASE_URL = "https://staging.terminal.goalive.nl"

export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*-genuine.spec.ts", // Only run *-genuine.spec.ts tests
  timeout: 60000, // Longer timeout for real API calls
  workers: 1, // Sequential execution

  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true, // For self-signed certs in dev
  },

  // No webServer - use existing production server
  // This avoids Next.js lock conflicts and tests the real production environment

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
})
