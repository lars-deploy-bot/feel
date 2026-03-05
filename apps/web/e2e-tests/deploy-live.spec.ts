/**
 * E2E Live Test - Deploy Website to Staging Until It Is Reachable
 *
 * Trigger: authenticated user deploys a unique subdomain via /api/deploy-subdomain.
 * Expected user-visible outcome: deployed site URL returns 200 and renders HTML.
 * Negative boundary: redeploying the same slug is rejected with 409/SLUG_TAKEN.
 * Completion signal: live site probe succeeds and cleanup endpoint deletes the site.
 */

import { type APIRequestContext, expect, test } from "@playwright/test"
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
  const startedAt = Date.now()

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
          if (attempts === 1 || attempts % 3 === 0) {
            const elapsed = Math.round((Date.now() - startedAt) / 1000)
            console.log(`[deploy-live] probe #${attempts} after ${elapsed}s -> status ${response.status}`)
          }
          return {
            status: response.status,
            textSample: text.slice(0, 300),
          }
        } catch (error) {
          if (attempts === 1 || attempts % 3 === 0) {
            const elapsed = Math.round((Date.now() - startedAt) / 1000)
            const errorMessage = error instanceof Error ? error.message : String(error)
            console.log(`[deploy-live] probe #${attempts} after ${elapsed}s -> network error: ${errorMessage}`)
          }
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

async function resolveTemplateId(request: APIRequestContext): Promise<string> {
  const response = await request.get("/api/templates")
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok()) {
    throw new Error(`Failed to load templates (${response.status()}): ${JSON.stringify(payload)}`)
  }

  const parsed = apiSchemas.templates.res.parse(payload)
  const templateId = parsed.templates[0]?.template_id
  if (!templateId) {
    throw new Error("No active templates returned by /api/templates")
  }
  return templateId
}

async function hasDeleteSiteEndpoint(request: APIRequestContext): Promise<boolean> {
  const probeBody = CleanupDeployedSiteRequestSchema.parse({ domain: "probe-delete-endpoint.sonno.tech" })
  const response = await request.delete("/api/test/delete-site", {
    data: probeBody,
    headers: buildTestHeaders(),
  })

  const payload: unknown = await response.json().catch(() => null)
  if (response.ok()) return true
  if (!payload || typeof payload !== "object" || !("error" in payload)) return false

  const errorCode = payload.error
  if (typeof errorCode !== "string") return false
  return new Set(["SITE_NOT_FOUND", "VALIDATION_ERROR", "FORBIDDEN", "INTERNAL_ERROR", "UNAUTHORIZED"]).has(errorCode)
}

async function ensureQuotaHeadroom(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post("/api/test/set-quota", {
    headers: buildTestHeaders(),
    data: { email, maxSites: 20 },
  })

  if (response.status() === 404) {
    return
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok()) {
    throw new Error(`Failed to set quota headroom (${response.status()}): ${JSON.stringify(payload)}`)
  }

  if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
    throw new Error(`Unexpected set-quota response: ${JSON.stringify(payload)}`)
  }
}

test.describe("Live staging deploy", () => {
  test("deploys a new site and verifies it is live before cleanup", async ({ page }) => {
    test.setTimeout(LIVE_DEPLOY_TIMEOUT_MS + 120_000)

    const cleanupEndpointAvailable = await hasDeleteSiteEndpoint(page.request)
    if (!cleanupEndpointAvailable) {
      const missingEndpointMessage =
        "Missing /api/test/delete-site endpoint on target environment. Deploy this branch to run deploy-live cleanup safely."
      if (process.env.E2E_REQUIRE_DELETE_SITE_ENDPOINT === "1") {
        throw new Error(missingEndpointMessage)
      }
      test.skip(true, missingEndpointMessage)
      return
    }

    const baseUrl = getProjectBaseUrl(test.info())
    const user = await getLiveStagingUser(test.info().workerIndex, baseUrl)
    await loginLiveStaging(page, user)
    console.log("[deploy-live] Authenticated, setting quota headroom")
    await ensureQuotaHeadroom(page.request, user.email)
    console.log("[deploy-live] Quota headroom ready, selecting template")
    const templateId = await resolveTemplateId(page.request)

    const slug = buildUniqueSlug(test.info().workerIndex)
    const deployBody: Req<"deploy-subdomain"> = validateRequest("deploy-subdomain", {
      slug,
      orgId: user.orgId,
      siteIdeas: "E2E live deployment verification",
      templateId,
    })

    let deployedDomain: string | null = null

    try {
      console.log(`[deploy-live] Deploying slug: ${slug}`)
      const deployResponse = await page.request.post("/api/deploy-subdomain", {
        data: deployBody,
        timeout: LIVE_DEPLOY_TIMEOUT_MS,
      })
      const deployPayload: unknown = await deployResponse.json().catch(() => null)

      expect(deployResponse.status(), `deploy failed: ${JSON.stringify(deployPayload)}`).toBe(200)
      const deployResult: Res<"deploy-subdomain"> = apiSchemas["deploy-subdomain"].res.parse(deployPayload)
      deployedDomain = deployResult.domain
      console.log(`[deploy-live] Deployment accepted for domain: ${deployedDomain}`)

      console.log("[deploy-live] Waiting for site to become reachable")
      const liveProbe = await waitForSiteToBeLive(deployedDomain)
      expect(liveProbe.status).toBe(200)
      expect(liveProbe.textSample.length).toBeGreaterThan(0)
      expect(liveProbe.attempts).toBeGreaterThan(0)

      const siteUrl = `https://${deployedDomain}`
      const siteResponse = await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
      expect(siteResponse?.status()).toBe(200)
      await expect(page.locator("body")).toContainText(/\S+/, { timeout: 15_000 })

      console.log("[deploy-live] Verifying duplicate deploy returns SLUG_TAKEN")
      const duplicateDeploy = await page.request.post("/api/deploy-subdomain", { data: deployBody })
      const duplicatePayload: unknown = await duplicateDeploy.json().catch(() => null)
      expect(duplicateDeploy.status()).toBe(409)
      expect(duplicatePayload).toMatchObject({ ok: false, error: "SLUG_TAKEN" })
    } finally {
      if (deployedDomain) {
        console.log(`[deploy-live] Cleaning up domain: ${deployedDomain}`)
        await cleanupDeployedSite(page.request, deployedDomain)
      }
    }
  })
})
