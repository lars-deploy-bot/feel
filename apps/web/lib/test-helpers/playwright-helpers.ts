/**
 * Playwright Test Helpers
 *
 * Reusable utilities for E2E tests with Playwright
 */

import type { BrowserContext, Page } from "@playwright/test"

/**
 * Authentication cookie configuration
 * Centralized to ensure consistency across all tests
 */
export const AUTH_COOKIE_CONFIG = {
  name: "auth_session",
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
}

/**
 * Set authentication cookie in Playwright browser context
 *
 * @param page - Playwright page object
 * @param token - JWT session token
 */
export async function setAuthCookie(page: Page, token: string): Promise<void> {
  await page.context().addCookies([
    {
      ...AUTH_COOKIE_CONFIG,
      value: token,
    },
  ])
}

/**
 * Set authentication cookie in Playwright browser context (direct context access)
 *
 * @param context - Playwright browser context
 * @param token - JWT session token
 */
export async function setAuthCookieInContext(context: BrowserContext, token: string): Promise<void> {
  await context.addCookies([
    {
      ...AUTH_COOKIE_CONFIG,
      value: token,
    },
  ])
}

/**
 * Clear authentication cookie from Playwright browser context
 *
 * @param page - Playwright page object
 */
export async function clearAuthCookie(page: Page): Promise<void> {
  await page.context().clearCookies()
}
