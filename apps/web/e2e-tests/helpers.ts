import type { BrowserContext, Page } from "@playwright/test"
import jwt from "jsonwebtoken"
import type { TestUser } from "./fixtures"

/**
 * Login helper for e2e tests
 * Uses test@bridge.local/test credentials in local dev mode
 */
export async function login(page: Page) {
  await page.goto("/")

  // Set up test workspace in sessionStorage (always terminal mode)
  await page.evaluate(() => {
    sessionStorage.setItem("workspace", "test.bridge.local")
  })

  await page.getByTestId("email-input").fill("test@bridge.local")
  await page.getByTestId("password-input").fill("test")
  await page.getByTestId("login-button").click()
  await page.waitForURL("/chat", { timeout: 5000 })
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
