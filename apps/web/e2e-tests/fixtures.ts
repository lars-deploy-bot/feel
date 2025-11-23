/**
 * Playwright Fixtures - Worker-Isolated Tenants
 *
 * Each worker gets dedicated tenant with JWT authentication.
 */

import { test as base, type Page } from "@playwright/test"
import jwt from "jsonwebtoken"
import { TEST_CONFIG } from "@webalive/shared"

export interface TestUser {
  userId: string
  email: string
  orgId: string
  orgName: string
  workspace: string
  workerIndex: number
}

type TestFixtures = {
  workerTenant: TestUser
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

      // Fetch tenant for this worker
      const email = `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${workerIndex}@${TEST_CONFIG.EMAIL_DOMAIN}`
      const workspace = `${TEST_CONFIG.WORKSPACE_PREFIX}${workerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`

      const res = await fetch(`${TEST_CONFIG.BASE_URL}/api/test/bootstrap-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          workerIndex,
          email,
          workspace,
        }),
      })

      if (!res.ok) {
        throw new Error(
          `Failed to bootstrap tenant for worker ${workerIndex} (runId=${runId}): ` +
            `${res.status} ${res.statusText}`,
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

  // Test-scoped: authenticated page for each test
  authenticatedPage: async ({ page, context, workerStorageState }, use) => {
    // Create JWT - fail fast if JWT_SECRET is missing in non-local environments
    const JWT_SECRET =
      process.env.JWT_SECRET ??
      (process.env.BRIDGE_ENV === "local" ? "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION" : undefined)

    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET must be set for non-local E2E runs")
    }

    const token = jwt.sign(
      {
        sub: workerStorageState.userId,
        userId: workerStorageState.userId,
        email: workerStorageState.email,
        name: workerStorageState.orgName,
        workspaces: [workerStorageState.workspace],
      },
      JWT_SECRET,
      { expiresIn: "30d" },
    )

    // Set auth cookie
    await context.addCookies([
      {
        name: "auth_session",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ])

    // Set workspace in sessionStorage
    await page.goto("/")
    await page.evaluate(workspace => {
      sessionStorage.setItem("workspace", workspace)
    }, workerStorageState.workspace)

    await use(page)
  },
})

export { expect } from "@playwright/test"
