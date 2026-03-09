import { randomUUID } from "node:crypto"
import type { BrowserContext, Page } from "@playwright/test"
import { COOKIE_NAMES, createWorkspaceStorageValue, TEST_CONFIG, WORKSPACE_STORAGE } from "@webalive/shared"
import jwt from "jsonwebtoken"
import type { TestTenant } from "@/app/api/test/test-route-schemas"
import { DEFAULT_USER_SCOPES } from "@/features/auth/lib/jwt"

/**
 * Login helper for e2e tests
 * Uses worker-specific tenant credentials
 */
export async function login(
  page: Page,
  tenant: Pick<TestTenant, "email" | "workspace"> & { orgId?: TestTenant["orgId"] },
) {
  await page.goto("/")

  // Set workspace in localStorage using typed helper from @webalive/shared
  // This ensures E2E tests stay in sync with workspaceStore schema
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: WORKSPACE_STORAGE.KEY,
    value: createWorkspaceStorageValue(tenant.workspace, tenant.orgId || null),
  })

  // Reload to ensure Zustand hydrates with the localStorage state
  // Without this, Zustand would have already hydrated with empty state
  await page.reload()

  await page.getByTestId("email-input").fill(tenant.email)
  await page.getByTestId("password-input").fill(TEST_CONFIG.TEST_PASSWORD)

  // Intercept login request to capture response
  const loginResponsePromise = page.waitForResponse(
    response => response.url().includes("/api/login") && response.request().method() === "POST",
  )

  await page.getByTestId("login-button").click()

  // Log login response for debugging
  const loginResponse = await loginResponsePromise

  if (!loginResponse.ok()) {
    const errorText = await loginResponse.text()
    throw new Error(`Login failed: ${loginResponse.status()} - ${errorText}`)
  }

  const loginData: unknown = await loginResponse.json()
  console.log(`[Login Debug] Email: ${tenant.email}, Status: ${loginResponse.status()}`)

  // Don't wait for redirect - tests handle their own navigation
  return { loginResponse, loginData }
}

/**
 * Create a valid JWT auth cookie for E2E tests
 * Uses standalone JWT signing (no Next.js dependencies)
 * @param user - Test user from fixture
 * @param context - Playwright browser context
 */
export async function setAuthCookie(user: TestTenant, context: BrowserContext) {
  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) throw new Error("JWT_SECRET not set — add it to .env.e2e.local")

  // Create JWT payload with all required fields
  const payload = {
    role: "authenticated" as const,
    sub: user.userId, // Standard JWT claim
    userId: user.userId,
    email: user.email,
    name: user.orgName, // Use org name as display name
    sid: randomUUID(),
    scopes: DEFAULT_USER_SCOPES,
    orgIds: [user.orgId],
    orgRoles: { [user.orgId]: "owner" as const },
  }

  // Sign JWT (30 day expiration to match server)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" })

  // Set auth cookie
  await context.addCookies([
    {
      name: COOKIE_NAMES.SESSION,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false, // Must be false for local test server (HTTP, not HTTPS)
      sameSite: "Lax",
    },
  ])

  console.log(`[E2E Auth] Set JWT cookie for user: ${user.email}`)
}
