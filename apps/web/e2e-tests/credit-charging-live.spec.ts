/**
 * E2E Test - Credit Charging for Haiku Messages (#282)
 *
 * Verifies that credits are actually charged when sending messages,
 * especially small Haiku messages that previously rounded to 0 credits.
 *
 * The fix changed usdToCredits() from Math.round to Math.ceil, ensuring
 * non-zero costs never round to 0, and moved charging to stream end
 * (not per-chunk).
 *
 * Run with: bun run test:e2e:live
 *
 * Prerequisites:
 * - Live staging base URL in .env.staging (NEXT_PUBLIC_APP_URL)
 * - Tenant bootstrap via e2e-tests/global-setup.ts
 * - ASK_LARS_KEY exported in environment
 */

import { expect, type Page, type TestInfo, test } from "@playwright/test"
import { TEST_CONFIG, WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { login } from "./helpers"
import { requireProjectBaseUrl } from "./lib/base-url"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

interface LiveStagingUser {
  email: string
  password: string
  workspace: string
  orgId: string
}

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

interface TokensAPIResponse {
  ok: boolean
  credits: number
  tokens: number
  workspace: string
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

function getWorkerTenantAddress(workerIndex: number): {
  email: string
  workspace: string
  normalizedWorkerIndex: number
} {
  const normalizedWorkerIndex = workerIndex % TEST_CONFIG.MAX_WORKERS
  return {
    email: `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${normalizedWorkerIndex}@${TEST_CONFIG.EMAIL_DOMAIN}`,
    workspace: `${TEST_CONFIG.WORKSPACE_PREFIX}${normalizedWorkerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`,
    normalizedWorkerIndex,
  }
}

async function getLiveStagingUser(workerIndex: number, baseUrl: string): Promise<LiveStagingUser> {
  const runId = getRunId()
  const { email, workspace, normalizedWorkerIndex } = getWorkerTenantAddress(workerIndex)

  const response = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
    method: "POST",
    headers: buildBootstrapHeaders(),
    body: JSON.stringify({
      runId,
      workerIndex: normalizedWorkerIndex,
      email,
      workspace,
    }),
  })

  if (!response.ok) {
    throw new Error(`bootstrap-tenant failed (${response.status})`)
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    throw new Error(`bootstrap-tenant returned non-JSON response: ${contentType || "unknown"}`)
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

async function loginLiveStaging(page: Page, user: LiveStagingUser): Promise<void> {
  await login(page, user)

  await page.waitForURL("**/chat", { timeout: TEST_TIMEOUTS.max })

  await expect(page.locator('[data-testid="workspace-ready"]')).toBeAttached({
    timeout: TEST_TIMEOUTS.max,
  })

  const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
  if (!storageValue) {
    throw new Error("Workspace storage missing after login")
  }
  const parsed = JSON.parse(storageValue) as WorkspaceStorageValue
  expect(parsed.state.currentWorkspace).toBe(user.workspace)
  expect(parsed.state.selectedOrgId).toBe(user.orgId)

  await expect(page.locator('[data-testid="message-input"]')).toBeVisible({
    timeout: TEST_TIMEOUTS.slow,
  })
}

function getProjectBaseUrl(testInfo: TestInfo): string {
  return requireProjectBaseUrl(testInfo.project.use.baseURL)
}

async function sendMessage(page: Page, message: string): Promise<void> {
  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill(message)
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await sendButton.click()
}

/**
 * Fetch current credit balance via the real /api/tokens endpoint.
 * Runs inside the browser context so the auth cookie is included.
 */
async function getCreditsViaApi(page: Page, workspace: string): Promise<number> {
  const result = await page.evaluate(async (ws: string) => {
    const res = await fetch("/api/tokens", {
      credentials: "include",
      headers: { "X-Workspace": ws },
    })
    const json = await res.json()
    return { ok: res.ok, status: res.status, data: json }
  }, workspace)

  if (!result.ok) {
    throw new Error(`/api/tokens failed (${result.status}): ${JSON.stringify(result.data)}`)
  }

  const data = result.data as TokensAPIResponse
  return data.credits
}

test.describe("Credit Charging - Haiku (#282)", () => {
  test("credits decrease after sending a Haiku message", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    // 1. Read initial credit balance via real /api/tokens endpoint
    const initialCredits = await getCreditsViaApi(page, user.workspace)
    expect(initialCredits).toBeGreaterThan(0)
    console.log(`[Credits] Initial balance: ${initialCredits}`)

    // 2. Send a simple Haiku message (real Claude API)
    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)
    await sendMessage(page, "Say just the word hello")
    const response = await responsePromise

    // Transport assertion: 200 OK
    expect(response.status()).toBe(200)

    // Wait for stream to complete and extract assistant text
    const ndjson = await response.text()
    const assistantText = extractAssistantTextFromNDJSON(ndjson)
    expect(assistantText.length).toBeGreaterThan(0)
    console.log(`[Credits] Assistant responded: "${assistantText.slice(0, 80)}"`)

    // 3. Read credit balance after — must be lower
    const finalCredits = await getCreditsViaApi(page, user.workspace)
    const creditsCharged = initialCredits - finalCredits
    console.log(`[Credits] Final balance: ${finalCredits}, charged: ${creditsCharged}`)

    // Positive assertion: credits decreased
    expect(creditsCharged).toBeGreaterThan(0)

    // Negative assertion: credits must NOT be unchanged (#282 regression)
    expect(finalCredits).toBeLessThan(initialCredits)
  })
})
