/**
 * E2E Live Test - Deploy Website to Staging Until It Is Reachable
 *
 * Trigger: authenticated user deploys a unique subdomain via /api/deploy-subdomain.
 * Expected user-visible outcome: deployed site URL returns 200 and renders HTML.
 * Negative boundary: redeploying the same slug is rejected with 409/SLUG_TAKEN.
 * Completion signal: live site probe succeeds and cleanup endpoint deletes the site.
 */

import { type APIRequestContext, expect, test } from "@playwright/test"
import { TEST_CONFIG } from "@webalive/shared"
import type { Req, Res } from "@/lib/api/schemas"
import { apiSchemas, validateRequest } from "@/lib/api/schemas"
import { CleanupDeployedSiteRequestSchema, CleanupDeployedSiteResponseSchema } from "@/lib/testing/e2e-site-deployment"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"

interface LiveProbeResult {
  status: number
  textSample: string
  attempts: number
}

const LIVE_DEPLOY_TIMEOUT_MS = 540_000

function buildUniqueSlug(workerIndex: number): string {
  const workerPart = workerIndex.toString(36).slice(0, 1)
  const timestampPart = Date.now().toString(36).slice(-8)
  return `dl${workerPart}${timestampPart}`
}

function buildTestHeaders(): Record<string, string> {
  const testSecret = process.env.E2E_TEST_SECRET
  if (!testSecret) {
    return {}
  }
  return { "x-test-secret": testSecret }
}

async function waitForSiteToBeLive(domain: string): Promise<LiveProbeResult> {
  const targetUrl = `https://${domain}`
  let attempts = 0

  await expect
    .poll(
      async () => {
        attempts += 1
        try {
          const response = await fetch(targetUrl, {
            method: "GET",
            redirect: "follow",
            headers: { "Cache-Control": "no-cache" },
            signal: AbortSignal.timeout(20_000),
          })
          const text = await response.text()
          return {
            status: response.status,
            textSample: text.slice(0, 300),
          }
        } catch (error) {
          return {
            status: -1,
            textSample: error instanceof Error ? error.message : String(error),
          }
        }
      },
      {
        timeout: LIVE_DEPLOY_TIMEOUT_MS,
        intervals: [2_000, 4_000, 8_000, 10_000],
        message: `Waiting for deployed site to go live: ${targetUrl}`,
      },
    )
    .toMatchObject({ status: 200 })

  const finalResponse = await fetch(targetUrl, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  })
  const finalText = await finalResponse.text()

  return {
    status: finalResponse.status,
    textSample: finalText.slice(0, 300),
    attempts,
  }
}

async function cleanupDeployedSite(request: APIRequestContext, domain: string): Promise<void> {
  const body = CleanupDeployedSiteRequestSchema.parse({ domain })
  const response = await request.delete("/api/test/delete-site", {
    data: body,
    headers: buildTestHeaders(),
  })

  if (response.status() === 404) {
    throw new Error("Cleanup endpoint /api/test/delete-site is unavailable in this environment")
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok()) {
    throw new Error(`Cleanup failed (${response.status()}): ${JSON.stringify(payload)}`)
  }

  CleanupDeployedSiteResponseSchema.parse(payload)
}

test.describe("Live staging deploy", () => {
  test("deploys a new site and verifies it is live before cleanup", async ({ page }) => {
    test.setTimeout(LIVE_DEPLOY_TIMEOUT_MS + 120_000)

    const baseUrl = getProjectBaseUrl(test.info())
    const user = await getLiveStagingUser(test.info().workerIndex, baseUrl)
    await loginLiveStaging(page, user)

    const slug = buildUniqueSlug(test.info().workerIndex)
    const deployBody: Req<"deploy-subdomain"> = validateRequest("deploy-subdomain", {
      slug,
      orgId: user.orgId,
      siteIdeas: "E2E live deployment verification",
      templateId: TEST_CONFIG.DEFAULT_TEMPLATE_ID,
    })

    let deployedDomain: string | null = null

    try {
      const deployResponse = await page.request.post("/api/deploy-subdomain", { data: deployBody })
      const deployPayload: unknown = await deployResponse.json().catch(() => null)

      expect(deployResponse.status(), `deploy failed: ${JSON.stringify(deployPayload)}`).toBe(200)
      const deployResult: Res<"deploy-subdomain"> = apiSchemas["deploy-subdomain"].res.parse(deployPayload)
      deployedDomain = deployResult.domain

      const liveProbe = await waitForSiteToBeLive(deployedDomain)
      expect(liveProbe.status).toBe(200)
      expect(liveProbe.textSample.length).toBeGreaterThan(0)
      expect(liveProbe.attempts).toBeGreaterThan(0)

      const siteUrl = `https://${deployedDomain}`
      const siteResponse = await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
      expect(siteResponse?.status()).toBe(200)
      await expect(page.locator("body")).toContainText(/\S+/, { timeout: 15_000 })

      const duplicateDeploy = await page.request.post("/api/deploy-subdomain", { data: deployBody })
      const duplicatePayload: unknown = await duplicateDeploy.json().catch(() => null)
      expect(duplicateDeploy.status()).toBe(409)
      expect(duplicatePayload).toMatchObject({ ok: false, error: "SLUG_TAKEN" })
    } finally {
      if (deployedDomain) {
        await cleanupDeployedSite(page.request, deployedDomain)
      }
    }
  })
})
