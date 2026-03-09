import type { BrowserContext, Page, Response } from "@playwright/test"
import { COOKIE_NAMES, createWorkspaceStorageValue, TEST_CONFIG, WORKSPACE_STORAGE } from "@webalive/shared"
import type { TestUser } from "./lib/tenant-types"

interface LoginResult {
  loginResponse: Response
  loginData: unknown
}

function parseSessionCookie(setCookieHeader: string): string {
  const cookiePattern = new RegExp(`${COOKIE_NAMES.SESSION}=([^;]+)`)
  const match = setCookieHeader.match(cookiePattern)
  if (!match) {
    throw new Error(`Could not parse ${COOKIE_NAMES.SESSION} cookie`)
  }
  return match[1]
}

export async function fetchSessionCookie(
  baseUrl: string,
  tenant: { email: string; workspace: string },
): Promise<string> {
  const loginRes = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: tenant.email,
      password: TEST_CONFIG.TEST_PASSWORD,
      workspace: tenant.workspace,
    }),
  })

  if (!loginRes.ok) {
    const errorText = await loginRes.text()
    throw new Error(`Login failed: ${loginRes.status} - ${errorText}`)
  }

  const setCookieHeader = loginRes.headers.get("set-cookie")
  if (!setCookieHeader) {
    throw new Error("No session cookie returned from /api/login")
  }

  return parseSessionCookie(setCookieHeader)
}

/**
 * Login helper for e2e tests
 * Uses worker-specific tenant credentials
 */
export async function login(
  page: Page,
  tenant: { email: string; workspace: string; orgId?: string },
): Promise<LoginResult> {
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

export async function setAuthCookie(user: TestUser, context: BrowserContext, baseUrl: string) {
  const token = await fetchSessionCookie(baseUrl, user)
  await context.addCookies([
    {
      name: COOKIE_NAMES.SESSION,
      value: token,
      httpOnly: true,
      secure: baseUrl.startsWith("https://"),
      sameSite: "Lax",
      url: baseUrl,
    },
  ])

  console.log(`[E2E Auth] Set session cookie for user: ${user.email}`)
}
