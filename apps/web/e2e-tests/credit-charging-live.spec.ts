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
 * Run with: ENV_FILE=.env.staging bun run test:e2e:live
 *
 * Prerequisites:
 * - Live staging base URL in .env.staging (NEXT_PUBLIC_APP_URL)
 * - Tenant bootstrap via e2e-tests/global-setup.ts
 * - ASK_LARS_KEY exported in environment
 */

import { expect, type Page, test } from "@playwright/test"
import { TokensResponseSchema } from "@/lib/api/types"
import { sendMessageAndCapture } from "./lib/chat-actions"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { annotate } from "./lib/log"

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

  const data = TokensResponseSchema.parse(result.data)
  return data.credits
}

test.describe("Credit Charging - Haiku (#282)", () => {
  test("credits decrease after sending a Haiku message", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    // 1. Read initial credit balance via real /api/tokens endpoint
    const initialCredits = await getCreditsViaApi(page, user.workspace)
    expect(initialCredits).toBeGreaterThan(0)
    annotate("credits", `Initial balance: ${initialCredits}`)

    // 2. Send a simple Haiku message (real Claude API)
    const { assistantText } = await sendMessageAndCapture(page, "Say just the word hello")
    annotate("credits", `Assistant responded: "${assistantText.slice(0, 80)}"`)

    // 3. Read credit balance after — must be lower
    const finalCredits = await getCreditsViaApi(page, user.workspace)
    const creditsCharged = initialCredits - finalCredits
    annotate("credits", `Final balance: ${finalCredits}, charged: ${creditsCharged}`)

    // Positive assertion: credits decreased
    expect(creditsCharged).toBeGreaterThan(0)

    // Negative assertion: credits must NOT be unchanged (#282 regression)
    expect(finalCredits).toBeLessThan(initialCredits)
  })
})
