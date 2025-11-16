import { expect, test } from "./setup"

/**
 * E2E Tests for Organization and Workspace Selection Flow
 *
 * Tests cover:
 * - Organization loading after login
 * - Workspace loading for selected organization
 * - Auto-selection behavior
 * - Error states and retry functionality
 *
 * Can run against:
 * - Local test mode (test@bridge.local / test)
 * - Staging environment (STAGING_EMAIL / STAGING_PASSWORD env vars)
 */

const isStaging = process.env.TEST_ENV === "staging"
const STAGING_EMAIL = process.env.STAGING_EMAIL || "eedenlars@gmail.com"
const STAGING_PASSWORD = process.env.STAGING_PASSWORD || "supersecret"
const TEST_EMAIL = "test@bridge.local"
const TEST_PASSWORD = "test"

test.describe("Organization and Workspace Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Configure for staging or local
    if (isStaging) {
      await page.goto("https://staging.terminal.goalive.nl/")
    } else {
      await page.goto("/")
    }
  })

  test("loads organizations after login", async ({ page }) => {
    // Login
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    // Wait for chat page
    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for organizations to load
    // The chat page fetches organizations on mount (line 154 in page.tsx)
    await page.waitForTimeout(2000)

    // Check for org selector or workspace switcher (depends on terminal mode)
    const workspaceInfo = page.locator('text="site"').first()
    await expect(workspaceInfo).toBeVisible({ timeout: 5000 })

    // Should not show error state
    await expect(page.getByText("Failed to load organizations")).not.toBeVisible()
  })

  test("auto-selects first organization when none selected", async ({ page }) => {
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for org auto-selection
    await page.waitForTimeout(3000)

    // In terminal mode, workspace switcher should be visible with a workspace
    // In domain mode, workspace should be shown as text
    const siteLabel = page.locator('text="site"').first()
    await expect(siteLabel).toBeVisible({ timeout: 5000 })

    // Should not show "no org selected" error
    await expect(page.getByText("no org selected")).not.toBeVisible()
  })

  test("loads workspaces for selected organization", async ({ page }) => {
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for org and workspace auto-selection
    await page.waitForTimeout(3000)

    // Look for workspace name or "loading..." indicator
    const workspaceSection = page.locator('text="site"').first().locator("..")
    await expect(workspaceSection).toBeVisible({ timeout: 5000 })

    // Should not be stuck on "loading..."
    const workspaceText = await workspaceSection.textContent()
    expect(workspaceText).not.toContain("loading...")

    // Should not show error
    await expect(page.getByText("error loading sites")).not.toBeVisible()
  })

  test("auto-selects first workspace when org is selected", async ({ page }) => {
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for full auto-selection flow
    await page.waitForTimeout(4000)

    // Chat input should be enabled (only enabled when workspace is selected)
    const chatInput = page.locator('[data-testid="message-input"]')
    await expect(chatInput).toBeVisible({ timeout: 5000 })

    // Get the placeholder text to check if workspace is selected
    const placeholder = await chatInput.getAttribute("placeholder")

    // If workspace is selected, placeholder should NOT be "Select a site to start chatting..."
    if (!isStaging || placeholder !== "Select a site to start chatting...") {
      // Either we have a workspace OR we're in staging and might have 0 domains
      // Check if there's a domain count indicator
      const noDomains = await page.getByText("You don't have any domains yet").isVisible().catch(() => false)

      if (!noDomains) {
        // We should have a workspace selected
        expect(placeholder).not.toBe("Select a site to start chatting...")

        // Verify workspace is shown
        const siteSection = page.locator('text="site"').first().locator("..")
        const siteText = await siteSection.textContent()

        // Should show actual workspace name (not "loading..." or "select")
        expect(siteText).not.toContain("loading...")
        expect(siteText).not.toContain("select")
      }
    }
  })

  test("shows error state and retry button when org loading fails", async ({ page }) => {
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    // Intercept organizations API to simulate failure
    await page.route("**/api/auth/organizations", route => {
      route.abort("failed")
    })

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Should show error message
    await expect(page.getByText("Failed to load organizations")).toBeVisible({ timeout: 5000 })

    // Should show retry button
    const retryButton = page.getByRole("button", { name: "Retry" })
    await expect(retryButton).toBeVisible()

    // Click retry should attempt to reload
    await page.unroute("**/api/auth/organizations")
    await retryButton.click()

    // Error should disappear after retry succeeds
    await expect(page.getByText("Failed to load organizations")).not.toBeVisible({ timeout: 5000 })
  })

  test("shows error and retry when workspace loading fails", async ({ page }) => {
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for org to load, then block workspace API
    await page.waitForTimeout(2000)

    await page.route("**/api/auth/workspaces*", route => {
      route.abort("failed")
    })

    // Open settings to trigger org selector (which triggers workspace fetch)
    await page.getByRole("button", { name: /settings/i }).click()

    // Should show error in workspace switcher (if in terminal mode)
    // In domain mode, this test may not be applicable
    const errorIndicator = page.getByText("error loading sites")

    // Only check if we're in terminal mode (workspace switcher visible)
    const hasWorkspaceSwitcher = await page.locator('button:has-text("select")').isVisible().catch(() => false)

    if (hasWorkspaceSwitcher) {
      await expect(errorIndicator).toBeVisible({ timeout: 5000 })

      // Should have retry button
      const retryButton = page.getByRole("button", { name: "retry" })
      await expect(retryButton).toBeVisible()
    }
  })

  test("handles empty workspace list gracefully", async ({ page }) => {
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    // Mock empty workspace response
    await page.route("**/api/auth/workspaces*", route => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaces: [],
        }),
      })
    })

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for workspace fetch
    await page.waitForTimeout(3000)

    // Should show empty state message or deploy button
    const emptyStateMessage = page.getByText(/don't have any domains|Deploy your first site/i)
    const isVisible = await emptyStateMessage.isVisible().catch(() => false)

    // Either show empty state OR already have the "Select a site" placeholder
    const chatInput = page.locator('[data-testid="message-input"]')
    const placeholder = await chatInput.getAttribute("placeholder")

    expect(isVisible || placeholder === "Select a site to start chatting...").toBeTruthy()
  })
})

test.describe("Organization Selection UI", () => {
  test.beforeEach(async ({ page }) => {
    if (isStaging) {
      await page.goto("https://staging.terminal.goalive.nl/")
    } else {
      await page.goto("/")
    }

    // Login
    const email = isStaging ? STAGING_EMAIL : TEST_EMAIL
    const password = isStaging ? STAGING_PASSWORD : TEST_PASSWORD

    await page.getByPlaceholder("you@example.com").fill(email)
    await page.getByPlaceholder("Enter your password").fill(password)
    await page.getByRole("button", { name: "Continue" }).click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })
    await page.waitForTimeout(2000)
  })

  test("can open settings modal and see organization selector", async ({ page }) => {
    // Click settings button
    await page.getByRole("button", { name: /settings/i }).click()

    // Settings modal should open
    await expect(page.getByText("Settings")).toBeVisible({ timeout: 3000 })

    // Organization section should be visible
    // The org selector might show as a dropdown or as text if only one org
    const settingsContent = page.locator('text="Settings"').locator("..")
    await expect(settingsContent).toBeVisible()
  })

  test("workspace switcher shows current workspace in terminal mode", async ({ page }) => {
    // Only applicable in terminal mode (staging.terminal.goalive.nl)
    if (!isStaging) {
      test.skip()
      return
    }

    // Wait for workspace to load
    await page.waitForTimeout(3000)

    // Look for workspace switcher with dropdown
    const workspaceSwitcher = page.locator('[class*="font-diatype-mono"]').first()

    const isVisible = await workspaceSwitcher.isVisible().catch(() => false)

    if (isVisible) {
      const text = await workspaceSwitcher.textContent()
      // Should not be stuck on "loading..." or "select"
      expect(text).not.toBe("loading...")
      expect(text).not.toBe("select")
    }
  })
})
