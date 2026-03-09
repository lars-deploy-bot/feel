/**
 * Playwright Fixtures - Worker-Isolated Tenants
 *
 * Each worker gets dedicated tenant with JWT authentication.
 * All persisted stores are pre-injected via localStorage to ensure
 * deterministic hydration and eliminate race conditions.
 */

import { randomUUID } from "node:crypto"
import { test as base, type Page, type Response } from "@playwright/test"
import { COOKIE_NAMES, createTestStorageState, DOMAINS, TEST_CONFIG } from "@webalive/shared"
import jwt from "jsonwebtoken"
import { BootstrapTenantResponseSchema, type TestTenant } from "@/app/api/test/test-route-schemas"
import { DEFAULT_USER_SCOPES } from "@/features/auth/lib/jwt"
import { requireProjectBaseUrl } from "./lib/base-url"
import {
  buildJsonMockResponse,
  E2E_MOCK_HEADER,
  getStrictApiGuardEnabled,
  isGuardedApiPath,
} from "./lib/strict-api-guard"
import { buildE2ETestHeaders } from "./lib/test-headers"

/**
 * Mock HTML for preview iframe - loads instantly instead of real sites
 */
const MOCK_PREVIEW_HTML = `<!DOCTYPE html>
<html>
<head><title>Mock Preview</title></head>
<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:#666;font-family:system-ui">
  <div style="text-align:center">
    <div style="font-size:48px;margin-bottom:16px">🧪</div>
    <div>E2E Test Preview</div>
  </div>
</body>
</html>`

export const test = base.extend<
  {
    workerTenant: TestTenant
    tenant: TestTenant
    authenticatedPage: Page
  },
  {
    workerStorageState: TestTenant
  }
>({
  // Override page fixture to mock preview iframe requests
  page: async ({ page }, use) => {
    // Mock preview subdomain requests — these load real sites and are slow/unnecessary for tests.
    // Only mock preview--* subdomains, not all subdomains (staging.X, app.X are the actual test server).
    // Uses NEXT_PUBLIC_PREVIEW_BASE from env (loaded by load-env.ts) — DOMAINS requires server-config.json.
    const previewBase = process.env.NEXT_PUBLIC_PREVIEW_BASE || DOMAINS.PREVIEW_BASE
    if (!previewBase) {
      throw new Error("NEXT_PUBLIC_PREVIEW_BASE env var is not set. Cannot mock preview routes.")
    }
    await page.route(`**/preview--*.${previewBase}/**`, route => {
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: MOCK_PREVIEW_HTML,
      })
    })

    await use(page)
  },

  // Worker-scoped: fetch tenant once per worker
  workerStorageState: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring even when no fixtures are used
    async ({}, use, workerInfo) => {
      const runId = process.env.E2E_RUN_ID
      // Wrap workerIndex to stay within configured worker slots
      // Playwright can assign high indices on retries, but we only have MAX_WORKERS slots
      const workerIndex = workerInfo.workerIndex % TEST_CONFIG.MAX_WORKERS

      if (!runId) {
        throw new Error("E2E_RUN_ID not set - global setup not run?")
      }

      const baseUrl = requireProjectBaseUrl(workerInfo.project.use.baseURL)

      // Fetch tenant for this worker
      const email = `${TEST_CONFIG.WORKER_EMAIL_PREFIX}${workerIndex}@${TEST_CONFIG.EMAIL_DOMAIN}`
      const workspace = `${TEST_CONFIG.WORKSPACE_PREFIX}${workerIndex}.${TEST_CONFIG.EMAIL_DOMAIN}`

      const res = await fetch(`${baseUrl}/api/test/bootstrap-tenant`, {
        method: "POST",
        headers: buildE2ETestHeaders(true),
        body: JSON.stringify({
          runId,
          workerIndex,
          email,
          workspace,
        }),
      })

      if (!res.ok) {
        throw new Error(
          `Failed to bootstrap tenant for worker ${workerIndex} (runId=${runId}): ${res.status} ${res.statusText}`,
        )
      }

      const data = BootstrapTenantResponseSchema.parse(await res.json())
      await use(data.tenant)
    },
    { scope: "worker" },
  ],

  // Test-scoped: pass worker storage to tests
  workerTenant: async ({ workerStorageState }, use) => {
    await use(workerStorageState)
  },

  // Alias for backwards compatibility with tests using `tenant`
  tenant: async ({ workerStorageState }, use) => {
    await use(workerStorageState)
  },

  // Test-scoped: authenticated page for each test
  // Sets JWT cookie AND localStorage via context-level init script
  authenticatedPage: async ({ page, context, workerStorageState, baseURL }, use) => {
    const strictApiGuardEnabled = getStrictApiGuardEnabled()
    const strictApiGuardViolations = new Set<string>()

    const responseGuard = (response: Response): void => {
      if (!strictApiGuardEnabled) return

      try {
        const responseUrl = response.url()
        const { pathname } = new URL(responseUrl)
        if (!isGuardedApiPath(pathname)) return

        const headers = response.headers()
        if (headers[E2E_MOCK_HEADER] === "1") return

        strictApiGuardViolations.add(`${pathname} -> ${response.status()} (${responseUrl})`)
      } catch {
        // Ignore malformed URLs from browser internals
      }
    }

    page.on("response", responseGuard)

    const resolvedBaseUrl = requireProjectBaseUrl(baseURL)

    // Determine if we're running against a remote environment
    const isRemote = resolvedBaseUrl.startsWith("https://")

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      throw new Error("JWT_SECRET not set — add it to .env.e2e.local or export it before running tests")
    }

    const token = jwt.sign(
      {
        role: "authenticated" as const,
        sub: workerStorageState.userId,
        userId: workerStorageState.userId,
        email: workerStorageState.email,
        name: workerStorageState.orgName,
        sid: randomUUID(),
        scopes: DEFAULT_USER_SCOPES,
        orgIds: [workerStorageState.orgId],
        orgRoles: { [workerStorageState.orgId]: "owner" as const },
      },
      jwtSecret,
      { expiresIn: "30d" },
    )

    // Extract domain from baseURL for cookie
    const cookieDomain = new URL(resolvedBaseUrl).hostname

    // Set auth cookie
    await context.addCookies([
      {
        name: COOKIE_NAMES.SESSION,
        value: token,
        domain: cookieDomain,
        path: "/",
        httpOnly: true,
        secure: isRemote,
        sameSite: "Lax",
      },
    ])

    // Pre-inject ALL persisted store defaults via context-level init script
    // This runs BEFORE any page JavaScript, ensuring Zustand hydrates correctly
    // and eliminates race conditions from stores that read each other
    const storageEntries = createTestStorageState({
      workspace: workerStorageState.workspace,
      orgId: workerStorageState.orgId,
      // E2E tests should run with clean defaults
      featureFlags: {},
      debug: {
        isDebugView: false,
        showWorkbench: false,
      },
    })

    // Inject all storage entries in a single init script
    // Supports both localStorage (default) and sessionStorage
    await context.addInitScript(entries => {
      for (const { key, value, storage } of entries) {
        if (storage === "sessionStorage") {
          sessionStorage.setItem(key, value)
        } else {
          localStorage.setItem(key, value)
        }
      }
      // Set test mode flag for E2E instrumentation
      ;(window as any).PLAYWRIGHT_TEST = true
    }, storageEntries)

    // Mock the all-workspaces API to include the test workspace
    // Without this, the workspace store validates against real workspaces on disk
    // and clears our injected test workspace to null
    await page.route("**/api/auth/all-workspaces**", async route => {
      await route.fulfill(
        buildJsonMockResponse({
          ok: true,
          workspaces: {
            [workerStorageState.orgId]: [workerStorageState.workspace],
          },
        }),
      )
    })

    // Mock /api/user so auth-dependent effects are deterministic under parallel load.
    await page.route("**/api/user**", route =>
      route.fulfill(
        buildJsonMockResponse({
          user: {
            id: workerStorageState.userId,
            email: workerStorageState.email,
            name: workerStorageState.orgName,
            isAdmin: false,
            isSuperadmin: false,
            canSelectAnyModel: false,
            enabledModels: [],
          },
        }),
      ),
    )

    // Mock org/workspace listing endpoints used during chat bootstrap.
    await page.route("**/api/auth/organizations**", route =>
      route.fulfill(
        buildJsonMockResponse({
          ok: true,
          organizations: [
            {
              org_id: workerStorageState.orgId,
              name: workerStorageState.orgName,
              credits: TEST_CONFIG.DEFAULT_CREDITS,
              workspace_count: 1,
              role: "owner",
            },
          ],
          current_user_id: workerStorageState.userId,
        }),
      ),
    )

    await page.route("**/api/auth/workspaces**", route => {
      const url = new URL(route.request().url())
      const orgId = url.searchParams.get("org_id")

      if (orgId && orgId !== workerStorageState.orgId) {
        return route.fulfill(buildJsonMockResponse({ ok: true, workspaces: [] }))
      }

      return route.fulfill(
        buildJsonMockResponse({
          ok: true,
          workspaces: [workerStorageState.workspace],
        }),
      )
    })

    // Mock /api/user/preferences — syncFromServer() calls this during HydrationManager init.
    // Without this mock, a real Supabase call stalls under parallel load,
    // delaying _appHydrated and causing workspace-ready timeout.
    await page.route("**/api/user/preferences**", route =>
      route.fulfill(
        buildJsonMockResponse({
          currentWorkspace: null,
          selectedOrgId: null,
          recentWorkspaces: [],
          updatedAt: null,
        }),
      ),
    )

    // Mock Flowglad billing to prevent crashes for test users
    await page.route("**/api/flowglad/**", route => route.fulfill(buildJsonMockResponse({ data: null, error: null })))

    // Mock /api/tokens to prevent credit-fetching errors
    await page.route("**/api/tokens**", route =>
      route.fulfill(buildJsonMockResponse({ ok: true, credits: 100, tokens: 100000 })),
    )

    let useError: unknown
    try {
      await use(page)
    } catch (error) {
      useError = error
    } finally {
      page.off("response", responseGuard)
    }

    if (useError) {
      throw useError
    }

    if (strictApiGuardViolations.size > 0) {
      throw new Error(
        "[E2E Strict API Guard] Guarded API endpoint was served without E2E mock header:\n" +
          Array.from(strictApiGuardViolations)
            .map(v => `- ${v}`)
            .join("\n"),
      )
    }
  },
})

export { expect } from "@playwright/test"
