/**
 * Playwright Fixtures - Worker-Isolated Tenants
 *
 * Each worker gets dedicated tenant with JWT authentication.
 */

import { test as base, type Page } from "@playwright/test"
import { COOKIE_NAMES, TEST_CONFIG, WORKSPACE_STORAGE, createWorkspaceStorageValue } from "@webalive/shared"
import jwt from "jsonwebtoken"

export interface TestUser {
  userId: string
  email: string
  orgId: string
  orgName: string
  workspace: string
  workerIndex: number
}

type TestFixtures = {
  /** Full tenant info from bootstrap - use this in new tests */
  workerTenant: TestUser
  /** Alias for workerTenant - backwards compatibility */
  tenant: TestUser
  /** Pre-authenticated page with JWT cookie and localStorage set */
  authenticatedPage: Page
}

type WorkerFixtures = {
  workerStorageState: TestUser
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped: fetch tenant once per worker
  workerStorageState: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring even when no fixtures are used
    async ({}, use, workerInfo) => {
      const runId = process.env.E2E_RUN_ID
      const workerIndex = workerInfo.workerIndex

      if (!runId) {
        throw new Error("E2E_RUN_ID not set - global setup not run?")
      }

      // Use baseURL from Playwright config (handles staging/production)
      // Falls back to TEST_CONFIG.BASE_URL for local tests
      const baseUrl = workerInfo.project.use.baseURL || TEST_CONFIG.BASE_URL

      // Get test secret for staging/production E2E tests
      const testSecret = process.env.E2E_TEST_SECRET
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (testSecret) {
        headers["x-test-secret"] = testSecret
      }

      // Fetch tenant for this worker
      const email = `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${workerIndex}@${TEST_CONFIG.EMAIL_DOMAIN}`
      const workspace = `${TEST_CONFIG.WORKSPACE_PREFIX}${workerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`

      const res = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          runId,
          workerIndex,
          email,
          workspace,
        }),
      })

      if (!res.ok) {
        throw new Error(
          `Failed to bootstrap tenant for worker ${workerIndex} (runId=${runId}): ${res.status} ${res.statusText}`,
        )
      }

      const data = await res.json()

      if (!data.ok) {
        throw new Error(`Failed to get tenant for worker ${workerIndex}: ${data.error}`)
      }

      await use(data.tenant)
    },
    { scope: "worker" },
  ],

  // Test-scoped: pass worker storage to tests
  workerTenant: async ({ workerStorageState }, use) => {
    await use(workerStorageState)
  },

  // Alias for backwards compatibility with tests using `tenant`
  tenant: async ({ workerStorageState }, use) => {
    await use(workerStorageState)
  },

  // Test-scoped: authenticated page for each test
  authenticatedPage: async ({ page, context, workerStorageState, baseURL }, use) => {
    // Determine if we're running against a remote environment
    const isRemote = baseURL?.startsWith("https://") ?? false

    // For remote environments, use JWT_SECRET from env; for local use TEST_CONFIG
    const jwtSecret = isRemote ? process.env.JWT_SECRET : TEST_CONFIG.JWT_SECRET
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not set for E2E tests (required for staging/production)")
    }

    const token = jwt.sign(
      {
        sub: workerStorageState.userId,
        userId: workerStorageState.userId,
        email: workerStorageState.email,
        name: workerStorageState.orgName,
        workspaces: [workerStorageState.workspace],
      },
      jwtSecret,
      { expiresIn: "30d" },
    )

    // Extract domain from baseURL for cookie (e.g., "staging.terminal.goalive.nl")
    const cookieDomain = baseURL ? new URL(baseURL).hostname : "localhost"

    // Set auth cookie
    await context.addCookies([
      {
        name: COOKIE_NAMES.SESSION,
        value: token,
        domain: cookieDomain,
        path: "/",
        httpOnly: true,
        secure: isRemote,
        sameSite: "Lax",
      },
    ])

    // Set workspace in localStorage using typed helper from @webalive/shared
    // This ensures E2E tests stay in sync with workspaceStore schema
    await page.goto("/")
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: WORKSPACE_STORAGE.KEY,
      value: createWorkspaceStorageValue(workerStorageState.workspace, workerStorageState.orgId),
    })

    // Reload page to pick up the localStorage state
    await page.reload()

    await use(page)
  },
})

export { expect } from "@playwright/test"
