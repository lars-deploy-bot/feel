/**
 * Lightweight deploy-route E2E checks for the default lane.
 *
 * Real deployment-to-live coverage runs in deploy-live.spec.ts (live lane).
 */

import type { Req } from "@/lib/api/schemas"
import { validateRequest } from "@/lib/api/schemas"
import { expect, test } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"

const TEST_SLUG = "test-e2e"

test.describe("Website Deployment Route Guards", () => {
  test("deploy page is accessible without authentication", async ({ page }) => {
    await page.goto("/deploy", { waitUntil: "domcontentloaded" })

    const deployHeading = page
      .getByTestId("deploy-heading")
      .or(page.getByRole("heading", { level: 1, name: /Launch your (site|website)/i }))
    await expect(deployHeading).toBeVisible({ timeout: TEST_TIMEOUTS.max })
    await expect(page.getByTestId("mode-option-quick-launch")).toBeVisible({ timeout: TEST_TIMEOUTS.max })
  })

  test("deployment API rejects unauthenticated requests", async ({ request }) => {
    const body: Req<"deploy-subdomain"> = validateRequest("deploy-subdomain", {
      slug: TEST_SLUG,
      orgId: "org_fake123",
      siteIdeas: "",
    })

    const response = await request.post("/api/deploy-subdomain", { data: body })
    const result: unknown = await response.json().catch(() => null)

    expect(response.status()).toBe(401)
    expect(result).toMatchObject({ ok: false })
  })
})
