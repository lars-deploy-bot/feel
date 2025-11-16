import type { Page } from "@playwright/test"

/**
 * Login helper for e2e tests
 * Uses test@bridge.local/test credentials in local dev mode
 */
export async function login(page: Page) {
  await page.goto("/")
  await page.getByPlaceholder("you@example.com").fill("test@bridge.local")
  await page.getByPlaceholder("Enter your password").fill("test")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.waitForURL("/chat", { timeout: 5000 })

  // Wait for workspace to auto-select
  // In test mode: organizations load → org auto-selects → workspaces load → workspace auto-selects
  // Wait for "Loading workspace..." or "site loading..." to disappear
  await page.waitForTimeout(3000)
}
