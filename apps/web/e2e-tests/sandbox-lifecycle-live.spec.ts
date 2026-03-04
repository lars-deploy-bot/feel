/**
 * E2E Live Test - E2B Sandbox Lifecycle
 *
 * Verifies that a live worker tenant can:
 * 1. obtain a sandbox in E2B mode
 * 2. reuse the same sandbox across sequential chat requests
 */

import { expect, type Page, test } from "@playwright/test"
import { isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { getLiveStagingUser, getProjectBaseUrl, getTenantSandboxState, loginLiveStaging } from "./lib/live-tenant"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

interface SandboxState {
  executionMode: "systemd" | "e2b"
  sandboxId: string | null
  sandboxStatus: "creating" | "running" | "dead" | null
}

const SANDBOX_WAIT_TIMEOUT_MS = 30_000
const SANDBOX_WAIT_INTERVAL_MS = 600

async function sendMessage(page: Page, message: string): Promise<void> {
  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill(message)
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await sendButton.click()
}

async function waitForSandboxState(
  baseUrl: string,
  email: string,
  predicate: (state: SandboxState) => boolean,
): Promise<SandboxState> {
  const deadline = Date.now() + SANDBOX_WAIT_TIMEOUT_MS
  let lastState: SandboxState | null = null

  while (Date.now() < deadline) {
    const state = await getTenantSandboxState(baseUrl, email)
    if (state) {
      lastState = state
      if (predicate(state)) {
        return state
      }
    }
    await new Promise(resolve => setTimeout(resolve, SANDBOX_WAIT_INTERVAL_MS))
  }

  throw new Error(`Timed out waiting for sandbox state. Last state: ${JSON.stringify(lastState)}`)
}

test.describe("E2B sandbox lifecycle", () => {
  test("reuses the same sandbox across consecutive chat requests", async ({ page }) => {
    const baseUrl = getProjectBaseUrl(test.info())
    const user = await getLiveStagingUser(test.info().workerIndex, baseUrl)

    await loginLiveStaging(page, user)

    const firstResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)
    await sendMessage(page, "Reply with exactly: sandbox lifecycle check one")
    const firstResponse = await firstResponsePromise

    expect(firstResponse.status()).toBe(200)
    const firstNdjson = await firstResponse.text()
    expect(extractAssistantTextFromNDJSON(firstNdjson).length).toBeGreaterThan(0)

    const stateAfterFirst = await waitForSandboxState(baseUrl, user.email, state => {
      return state.executionMode === "e2b" && typeof state.sandboxId === "string" && state.sandboxId.length > 0
    })

    const secondResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)
    await sendMessage(page, "Reply with exactly: sandbox lifecycle check two")
    const secondResponse = await secondResponsePromise

    expect(secondResponse.status()).toBe(200)
    const secondNdjson = await secondResponse.text()
    expect(extractAssistantTextFromNDJSON(secondNdjson).length).toBeGreaterThan(0)

    const stateAfterSecond = await waitForSandboxState(baseUrl, user.email, state => {
      return state.executionMode === "e2b" && state.sandboxId === stateAfterFirst.sandboxId
    })

    expect(stateAfterSecond.executionMode).toBe("e2b")
    expect(stateAfterSecond.sandboxId).toBe(stateAfterFirst.sandboxId)
    expect(stateAfterSecond.sandboxStatus).not.toBe("dead")
  })
})
