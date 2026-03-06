import { expect, test } from "@playwright/test"
import { TEST_CONFIG, WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { login } from "./helpers"
import { getProjectBaseUrl } from "./lib/live-tenant"
import { parseNDJSONEvents } from "./lib/ndjson"

interface BootstrapTenantResponse {
  ok: boolean
  tenant: {
    userId: string
    email: string
    orgId: string
    orgName: string
    workspace: string
    workerIndex: number
  }
}

interface LiveSuperadminUser {
  email: string
  password: string
  workspace: string
  orgId: string
}

function getRunId(): string {
  const runId = process.env.E2E_RUN_ID
  if (!runId) {
    throw new Error("E2E_RUN_ID is required for live staging tests")
  }
  return runId
}

function buildBootstrapHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const testSecret = process.env.E2E_TEST_SECRET
  if (testSecret) {
    headers["x-test-secret"] = testSecret
  }
  return headers
}

async function bootstrapLiveSuperadminUser(workerIndex: number, baseUrl: string): Promise<LiveSuperadminUser> {
  const email = process.env.E2E_SUPERADMIN_EMAIL
  if (!email) {
    throw new Error("E2E_SUPERADMIN_EMAIL is required for this test")
  }

  const normalizedWorkerIndex = workerIndex % TEST_CONFIG.MAX_WORKERS
  const workspace =
    process.env.E2E_SUPERADMIN_WORKSPACE || `superadmin-mode-${normalizedWorkerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`

  const response = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
    method: "POST",
    headers: buildBootstrapHeaders(),
    body: JSON.stringify({
      runId: getRunId(),
      workerIndex: normalizedWorkerIndex,
      email,
      workspace,
    }),
  })

  if (!response.ok) {
    throw new Error(`bootstrap-tenant failed (${response.status})`)
  }

  const payload = (await response.json()) as BootstrapTenantResponse
  if (!payload.ok) {
    throw new Error("bootstrap-tenant returned ok=false")
  }

  return {
    email: payload.tenant.email,
    password: TEST_CONFIG.TEST_PASSWORD,
    workspace: payload.tenant.workspace,
    orgId: payload.tenant.orgId,
  }
}

function hasToolUseFor(ndjson: string, toolName: string): boolean {
  const events = parseNDJSONEvents(ndjson)

  for (const event of events) {
    if (event.type !== "message" || typeof event.data !== "object" || event.data === null) continue
    const data = event.data as { messageType?: unknown; content?: { message?: { content?: unknown } } }
    if (data.messageType !== "assistant") continue
    const blocks = data.content?.message?.content
    if (!Array.isArray(blocks)) continue
    for (const block of blocks) {
      if (typeof block !== "object" || block === null) continue
      const toolBlock = block as { type?: unknown; name?: unknown }
      if (toolBlock.type === "tool_use" && toolBlock.name === toolName) return true
    }
  }

  return false
}

test.describe("Superadmin Terminal Mode (live)", () => {
  test.setTimeout(4 * 60 * 1000)

  test("keeps terminal mode bash-only for superadmin site workspace", async ({ page }) => {
    const baseUrl = getProjectBaseUrl(test.info())
    if (!process.env.E2E_SUPERADMIN_EMAIL) {
      test.skip(true, "Requires E2E_SUPERADMIN_EMAIL for live superadmin authentication.")
      return
    }

    // Trigger: superadmin switches to Terminal mode and sends a message that explicitly asks for search_tools.
    // Expected user-visible outcome: request is accepted and assistant responds.
    // Negative boundary: no tool_use event for mcp__alive-tools__search_tools.
    // Completion signal: stream response arrives with streamMode=superadmin and no forbidden tool invocation.
    const user = await bootstrapLiveSuperadminUser(test.info().workerIndex, baseUrl)
    await login(page, user)
    await page.waitForURL("**/chat", { timeout: TEST_TIMEOUTS.max })
    await expect(page.locator('[data-testid="workspace-ready"]')).toBeAttached({ timeout: TEST_TIMEOUTS.max })

    const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
    if (!storageValue) throw new Error("Workspace storage missing after login")
    const parsed = JSON.parse(storageValue) as WorkspaceStorageValue
    expect(parsed.state.currentWorkspace).toBe(user.workspace)

    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: TEST_TIMEOUTS.slow })

    const modeButton = page.getByRole("button", { name: /Mode:/ })
    await expect(modeButton).toBeVisible({ timeout: TEST_TIMEOUTS.slow })
    await modeButton.click()
    await page
      .getByRole("button", { name: /Terminal/ })
      .first()
      .click()

    const prompt =
      "Tool availability test: call mcp__alive-tools__search_tools with query 'terminal-mode-probe'. If unavailable, say UNAVAILABLE."
    const streamRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const streamResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await page.locator('[data-testid="message-input"]').fill(prompt)
    await page.locator('[data-testid="send-button"]').click()

    const streamRequest = await streamRequestPromise
    const requestBody = streamRequest.postDataJSON() as { streamMode?: string }
    expect(requestBody.streamMode).toBe("superadmin")

    const streamResponse = await streamResponsePromise
    expect(streamResponse.status()).toBe(200)
    const ndjson = await streamResponse.text()

    expect(hasToolUseFor(ndjson, "mcp__alive-tools__search_tools")).toBe(false)
  })
})
