/**
 * E2E Live Test - E2B Sandbox Lifecycle
 *
 * Verifies that a live worker tenant can:
 * 1. obtain a sandbox in E2B mode
 * 2. reuse the same sandbox across sequential chat requests
 *
 * REQUIRES: stream route must pass executionMode/sandboxDomain to worker payload.
 * See: apps/web/app/api/claude/stream/route.ts (worker payload construction)
 */

import { expect, test } from "@playwright/test"
import type { VerifyTenantSandbox } from "@/app/api/test/test-route-schemas"
import { sendMessageAndCapture } from "./lib/chat-actions"
import {
  getDomainRuntime,
  getLiveStagingUser,
  getProjectBaseUrl,
  getTenantSandboxState,
  loginLiveStaging,
  updateTestDomainRuntime,
} from "./lib/live-tenant"

const SANDBOX_WAIT_TIMEOUT_MS = 30_000
const SANDBOX_WAIT_INTERVAL_MS = 600

async function waitForSandboxState(baseUrl: string, email: string, predicate: (state: VerifyTenantSandbox) => boolean) {
  const deadline = Date.now() + SANDBOX_WAIT_TIMEOUT_MS
  let lastState: VerifyTenantSandbox | null = null

  while (Date.now() < deadline) {
    try {
      const state = await getTenantSandboxState(baseUrl, email)
      if (state) {
        lastState = state
        if (predicate(state)) {
          return state
        }
      }
    } catch {
      // transient error; retry until deadline
    }
    await new Promise(resolve => setTimeout(resolve, SANDBOX_WAIT_INTERVAL_MS))
  }

  throw new Error(`Timed out waiting for sandbox state. Last state: ${JSON.stringify(lastState)}`)
}

test.describe("E2B sandbox lifecycle", () => {
  test.setTimeout(5 * 60 * 1000)

  test("reuses the same sandbox across consecutive chat requests", async ({ page }) => {
    const baseUrl = getProjectBaseUrl(test.info())
    const user = await getLiveStagingUser(test.info().workerIndex, baseUrl)

    // Skip if e2b-domain endpoint doesn't exist in this environment
    const probe = await getDomainRuntime(baseUrl, user.workspace, { allow404AsNull: true })
    if (!probe) {
      test.skip(true, "Requires /api/test/e2b-domain in target environment.")
      return
    }

    await updateTestDomainRuntime(baseUrl, {
      workspace: user.workspace,
      executionMode: "e2b",
      killSandbox: true,
      resetSandboxFields: true,
      restartWorkspaceWorkers: true,
    })

    await loginLiveStaging(page, user)

    await sendMessageAndCapture(page, "Reply with exactly: sandbox lifecycle check one")

    const stateAfterFirst = await waitForSandboxState(baseUrl, user.email, state => {
      return state.executionMode === "e2b" && typeof state.sandboxId === "string" && state.sandboxId.length > 0
    })

    await sendMessageAndCapture(page, "Reply with exactly: sandbox lifecycle check two")

    const stateAfterSecond = await waitForSandboxState(baseUrl, user.email, state => {
      return state.executionMode === "e2b" && state.sandboxId === stateAfterFirst.sandboxId
    })

    expect(stateAfterSecond.executionMode).toBe("e2b")
    expect(stateAfterSecond.sandboxId).toBe(stateAfterFirst.sandboxId)
    expect(stateAfterSecond.sandboxStatus).not.toBe("dead")
  })
})
