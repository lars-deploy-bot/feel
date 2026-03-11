/**
 * E2E Live Test - Deploy Website to Staging Until It Is Reachable
 *
 * Trigger: authenticated user deploys a staging subdomain via /api/deploy-subdomain.
 * Expected user-visible outcome: deployed site URL returns 200 and renders HTML.
 * Negative boundary: redeploying the same slug is rejected with 409/SLUG_TAKEN.
 * Completion signal: live site probe succeeds and cleanup endpoint deletes the site.
 */

import type { Dirent } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { type APIRequestContext, expect, test } from "@playwright/test"
import type { Req, Res } from "@/lib/api/schemas"
import { apiSchemas, validateRequest } from "@/lib/api/schemas"
import {
  CleanupDeployedSiteRequestSchema,
  CleanupDeployedSiteResponseSchema,
  extractReusableLiveDeploySlugsFromCaddy,
  isReusableLiveDeploySlug,
} from "@/lib/testing/e2e-site-deployment"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { buildE2ETestHeaders } from "./lib/test-headers"

const LIVE_DEPLOY_TIMEOUT_MS = 540_000
const LIVE_PROBE_INTERVAL_MS = 5_000
const LIVE_PROBE_FAST_FAIL_525_COUNT = 8
const CADDY_CERT_STORE_ROOT = "/var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory"
const GENERATED_CADDY_SITES_PATH = "/var/lib/alive/generated/Caddyfile.sites"

function resolveWildcardDomain(baseUrl: string): string {
  const hostname = new URL(baseUrl).hostname
  const labels = hostname.split(".")
  if (labels.length < 2) {
    throw new Error(`Unable to derive wildcard domain from base URL host: ${hostname}`)
  }
  return labels.slice(1).join(".")
}

async function listPrewarmedDeploySlugs(wildcardDomain: string): Promise<string[]> {
  const suffix = `.${wildcardDomain}`
  let entries: Dirent<string>[]

  try {
    entries = await readdir(CADDY_CERT_STORE_ROOT, { withFileTypes: true, encoding: "utf8" })
  } catch {
    return []
  }

  const candidateSlugs = new Set<string>()
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!entry.name.endsWith(suffix)) continue

    const slug = entry.name.slice(0, -suffix.length)
    if (!isReusableLiveDeploySlug(slug)) continue
    candidateSlugs.add(slug)
  }

  return [...candidateSlugs].sort()
}

async function listRoutedDeploySlugs(wildcardDomain: string): Promise<string[]> {
  try {
    const raw = await readFile(GENERATED_CADDY_SITES_PATH, "utf8")
    return extractReusableLiveDeploySlugsFromCaddy(raw, wildcardDomain)
  } catch {
    return []
  }
}

function rotateCandidates(slugs: string[], workerIndex: number): string[] {
  if (slugs.length === 0) return slugs
  const offset = workerIndex % slugs.length
  return [...slugs.slice(offset), ...slugs.slice(0, offset)]
}

function parseErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null
  const errorValue = payload.error
  if (typeof errorValue !== "string") return null
  return errorValue
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function isSlugDirectoryAvailable(request: APIRequestContext, slug: string): Promise<boolean> {
  const response = await request.get(`/api/sites/check-availability?slug=${encodeURIComponent(slug)}`)
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok()) return false
  if (!payload || typeof payload !== "object" || !("available" in payload)) return false
  return payload.available === true
}

async function prepareReusableDomain(request: APIRequestContext, domain: string): Promise<"ready" | "blocked"> {
  const body = CleanupDeployedSiteRequestSchema.parse({ domain })
  const response = await request.delete("/api/test/delete-site", {
    data: body,
    headers: buildE2ETestHeaders(),
  })

  if (response.status() === 404) {
    return "ready"
  }

  const payload: unknown = await response.json().catch(() => null)
  if (response.ok()) {
    CleanupDeployedSiteResponseSchema.parse(payload)
    return "ready"
  }

  const errorCode = parseErrorCode(payload)
  if (errorCode === "FORBIDDEN" || errorCode === "UNAUTHORIZED") {
    return "blocked"
  }

  if (errorCode === "SITE_NOT_FOUND") {
    return "ready"
  }

  throw new Error(`Reusable-domain cleanup failed (${response.status()}): ${JSON.stringify(payload)}`)
}

async function resolveDeploySlug(
  request: APIRequestContext,
  workerIndex: number,
  wildcardDomain: string,
): Promise<{ slug: string; source: string }> {
  const prewarmedSlugs = await listPrewarmedDeploySlugs(wildcardDomain)
  const routedSlugs = new Set(await listRoutedDeploySlugs(wildcardDomain))
  const reusableSlugs = rotateCandidates(
    prewarmedSlugs.filter(slug => routedSlugs.has(slug)),
    workerIndex,
  )

  if (prewarmedSlugs.length === 0) {
    throw new Error(`No prewarmed deploy slugs found for *.${wildcardDomain}; refusing to mint new certs in E2E`)
  }

  if (reusableSlugs.length === 0) {
    throw new Error(
      `No reusable prewarmed deploy slug is present in ${GENERATED_CADDY_SITES_PATH} for *.${wildcardDomain}; ` +
        "live deploy requires an already-routed dl* domain.",
    )
  }

  for (const slug of reusableSlugs) {
    const domain = `${slug}.${wildcardDomain}`
    const preparation = await prepareReusableDomain(request, domain)
    if (preparation === "blocked") {
      continue
    }

    const available = await isSlugDirectoryAvailable(request, slug)
    if (!available) {
      continue
    }

    return { slug, source: `prewarmed:${slug}` }
  }

  throw new Error(
    `No reusable prewarmed deploy slug is available for *.${wildcardDomain}; all known candidates are still occupied`,
  )
}

async function waitForSiteToBeLive(domain: string) {
  const targetUrl = `https://${domain}`
  let attempts = 0
  const startedAt = Date.now()
  let consecutiveTls525 = 0
  let lastStatus = -1
  let lastTextSample = ""

  while (Date.now() - startedAt < LIVE_DEPLOY_TIMEOUT_MS) {
    attempts += 1

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(20_000),
      })

      const text = await response.text()
      lastStatus = response.status
      lastTextSample = text.slice(0, 300)

      if (attempts === 1 || attempts % 3 === 0) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000)
        console.log(`[deploy-live] probe #${attempts} after ${elapsed}s -> status ${response.status}`)
      }

      if (response.status === 200) {
        return { status: 200, textSample: lastTextSample, attempts }
      }

      if (response.status === 525) {
        consecutiveTls525 += 1
        if (consecutiveTls525 >= LIVE_PROBE_FAST_FAIL_525_COUNT) {
          throw new Error(
            `Repeated TLS handshake failure (HTTP 525) for ${targetUrl} after ${attempts} probes; cert issuance is likely blocked`,
          )
        }
      } else {
        consecutiveTls525 = 0
      }
    } catch (error) {
      if (attempts === 1 || attempts % 3 === 0) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000)
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log(`[deploy-live] probe #${attempts} after ${elapsed}s -> network error: ${errorMessage}`)
      }
      if (error instanceof Error && error.message.includes("Repeated TLS handshake failure (HTTP 525)")) {
        throw error
      }
      lastStatus = -1
      lastTextSample = error instanceof Error ? error.message : String(error)
      consecutiveTls525 = 0
    }

    await delay(LIVE_PROBE_INTERVAL_MS)
  }

  throw new Error(`Timeout waiting for ${targetUrl} to become live; last status=${lastStatus}, body=${lastTextSample}`)
}

async function cleanupDeployedSite(request: APIRequestContext, domain: string): Promise<void> {
  const body = CleanupDeployedSiteRequestSchema.parse({ domain })
  const response = await request.delete("/api/test/delete-site", {
    data: body,
    headers: buildE2ETestHeaders(),
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
    headers: buildE2ETestHeaders(),
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
    headers: buildE2ETestHeaders(),
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
    const wildcardDomain = resolveWildcardDomain(baseUrl)
    let slugChoice: { slug: string; source: string }
    try {
      slugChoice = await resolveDeploySlug(page.request, test.info().workerIndex, wildcardDomain)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes("live deploy requires an already-routed dl* domain")) {
        test.skip(true, message)
        return
      }
      throw error
    }
    const slug = slugChoice.slug
    console.log(`[deploy-live] Using ${slugChoice.source} slug: ${slug}`)

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
