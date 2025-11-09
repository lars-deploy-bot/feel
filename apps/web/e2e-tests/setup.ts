/**
 * E2E Test Setup - Real Fail-Fast Protection
 */
import { test as base, expect, type Page } from "@playwright/test"

/**
 * API endpoints that require mocking (expensive external calls)
 */
const PROTECTED_ENDPOINTS = ["/api/claude"]

/**
 * Check if URL is for a protected endpoint that needs mocking
 */
function isProtectedEndpoint(url: string): boolean {
  return PROTECTED_ENDPOINTS.some(endpoint => url.includes(endpoint))
}

/**
 * Check if a URL matches any registered route pattern
 */
function hasMatchingRoute(url: string, patterns: Set<string>): boolean {
  const urlPath = url.replace(/^https?:\/\/[^/]+/, "")

  for (const pattern of patterns) {
    const patternPath = pattern
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")

    if (urlPath.includes(patternPath) || patternPath.includes(urlPath)) {
      return true
    }
  }
  return false
}

export const test = base.extend<{
  page: Page
}>({
  page: async ({ page }, use) => {
    const registeredRoutes = new Set<string>()
    let testStarted = false

    // Monitor requests to protected endpoints only
    page.on("request", request => {
      if (!testStarted) return

      const url = request.url()
      const method = request.method()

      // Only check protected endpoints (Claude API, not login/verify/etc)
      if (isProtectedEndpoint(url)) {
        const hasHandler = hasMatchingRoute(url, registeredRoutes)

        if (!hasHandler) {
          throw new Error(
            `\n\n🚨 UNMOCKED API CALL: ${method} ${url}\n\nAdd handler BEFORE page.goto():\n  await page.route('**/api/claude/stream', handlers.text('...'))\n\nSee: tests/e2e/lib/handlers.ts\n`,
          )
        }
      }
    })

    // Track route registrations
    const originalRoute = page.route.bind(page)
    page.route = async (
      pattern: string | RegExp,
      handler: Parameters<typeof originalRoute>[1],
      options?: Parameters<typeof originalRoute>[2],
    ) => {
      registeredRoutes.add(pattern.toString())
      return originalRoute(pattern, handler, options)
    }

    // Track test start
    const originalGoto = page.goto.bind(page)
    page.goto = async (url: string, options?: Parameters<typeof originalGoto>[1]) => {
      testStarted = true
      return originalGoto(url, options)
    }

    await use(page)
  },
})

export { expect }
