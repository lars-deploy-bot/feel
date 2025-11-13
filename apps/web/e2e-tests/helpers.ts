import type { Page } from "@playwright/test"

/**
 * Login helper for e2e tests
 * Uses test/test credentials in local dev mode
 */
export async function login(page: Page) {
  await page.goto("/")
  await page.getByPlaceholder("myapp.alive.best").fill("test")
  await page.getByPlaceholder("Enter your password").fill("test")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.waitForURL("/chat", { timeout: 5000 })
}
