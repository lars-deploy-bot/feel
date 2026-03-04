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

import { expect, type Page, test } from "@playwright/test"
import { isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

interface TokensAPIResponse {
  ok: boolean
  credits: number
  tokens: number
  workspace: string
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
