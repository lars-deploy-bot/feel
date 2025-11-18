import { expect, test } from "./setup"

/**
 * Test JUST the polling mechanism in browser context
 * Uses a site we know is already deployed and live
 */
test.describe("Browser Polling Test", () => {
  test.skip("browser can fetch deployed domain", async ({ page }) => {
    // TODO: Deploy test-poll.alive.best first, or use an existing live site
    // Test expects this domain to be deployed and live
    const testDomain = "test-poll.alive.best"

    // Navigate to a page with our app loaded (so we're in the right origin)
    await page.goto("/deploy")

    // Inject polling code directly into the browser
    const result = await page.evaluate(async domain => {
      try {
        const response = await fetch(`https://${domain}`, {
          method: "GET",
          cache: "no-store",
        })

        return {
          ok: response.ok,
          status: response.status,
          error: null,
        }
      } catch (error) {
        return {
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }, testDomain)

    console.log("[Browser Fetch Test] Result:", result)

    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.error).toBeNull()
  })

  test.skip("browser polling loop works", async ({ page }) => {
    // TODO: Deploy test-poll.alive.best first, or use an existing live site
    const testDomain = "test-poll.alive.best"

    await page.goto("/deploy")

    // Run a polling loop in the browser (like our actual code does)
    const result = await page.evaluate(async domain => {
      return new Promise(resolve => {
        let attempts = 0
        let success = false

        const pollInterval = setInterval(async () => {
          attempts++

          if (attempts > 10) {
            clearInterval(pollInterval)
            resolve({ success, attempts, error: "Timeout after 10 attempts" })
            return
          }

          try {
            const response = await fetch(`https://${domain}`, {
              method: "GET",
              cache: "no-store",
            })

            if (response.ok) {
              success = true
              clearInterval(pollInterval)
              resolve({ success, attempts, error: null })
            }
          } catch (_error) {
            // Continue polling
          }
        }, 1000)
      })
    }, testDomain)

    console.log("[Browser Polling Loop] Result:", result)

    expect(result.success).toBe(true)
    expect(result.attempts).toBeGreaterThan(0)
    expect(result.attempts).toBeLessThanOrEqual(3) // Should succeed quickly for existing site
    expect(result.error).toBeNull()
  })

  test("browser can detect non-existent domain", async ({ page }) => {
    const nonExistentDomain = "definitely-does-not-exist-12345.alive.best"

    await page.goto("/deploy")

    const result = await page.evaluate(async domain => {
      try {
        const response = await fetch(`https://${domain}`, {
          method: "GET",
          cache: "no-store",
        })

        return {
          ok: response.ok,
          status: response.status,
          error: null,
        }
      } catch (error) {
        return {
          ok: false,
          status: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }, nonExistentDomain)

    console.log("[Non-Existent Domain Test] Result:", result)

    // Should either get a non-200 response or an error
    expect(result.ok).toBe(false)
  })
})
