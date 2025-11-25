import type { BrowserContext, Page, Response } from "@playwright/test"
import { TEST_CONFIG } from "@webalive/shared"
import jwt from "jsonwebtoken"
import type { TestUser } from "./fixtures"

interface LoginResult {
  loginResponse: Response
  loginData: unknown
}

/**
 * Login helper for e2e tests
 * Uses worker-specific tenant credentials
 */
export async function login(page: Page, tenant: { email: string; workspace: string }): Promise<LoginResult> {
  await page.goto("/")

  // Set workspace for this tenant
  await page.evaluate(ws => {
    sessionStorage.setItem("workspace", ws)
  }, tenant.workspace)

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
  // The login page may call router.push("/chat") but client-side navigation
  // doesn't always trigger Playwright's navigation detection reliably

  return { loginResponse, loginData }
}

/**
 * Create a valid JWT auth cookie for E2E tests
 * Uses standalone JWT signing (no Next.js dependencies)
 * @param user - Test user from fixture
 * @param context - Playwright browser context
 */
export async function setAuthCookie(user: TestUser, context: BrowserContext) {
  const JWT_SECRET = process.env.JWT_SECRET || "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"

  // Create JWT payload with all required fields
  const payload = {
    sub: user.userId, // Standard JWT claim
    userId: user.userId,
    email: user.email,
    name: user.orgName, // Use org name as display name
    workspaces: [], // Empty for now
  }

  // Sign JWT (30 day expiration to match server)
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" })

  // Set auth cookie
  await context.addCookies([
    {
      name: "auth_session",
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
