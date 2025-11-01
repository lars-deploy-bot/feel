import type { Page } from "@playwright/test"

/**
 * Login helper for e2e tests
 * Uses test/test credentials in local dev mode
 */
export async function login(page: Page) {
  await page.goto("/")
  await page.getByPlaceholder("domain (e.g. demo.goalive.nl)").fill("test")
  await page.getByPlaceholder("passcode").fill("test")
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForURL("/chat", { timeout: 5000 })
}
