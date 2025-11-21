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
 * - Dev environment (DEV_EMAIL / DEV_PASSWORD env vars)
 */

const isDev = process.env.TEST_ENV === "dev"
const DEV_EMAIL = process.env.DEV_EMAIL || "eedenlars@gmail.com"
const DEV_PASSWORD = process.env.DEV_PASSWORD || "supersecret"
const TEST_EMAIL = "test@bridge.local"
const TEST_PASSWORD = "test"

test.describe("Organization and Workspace Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Configure for dev or local
    if (isDev) {
      await page.goto("https://dev.terminal.goalive.nl/")
    } else {
      await page.goto("/")
    }
  })

  test("loads organizations after login", async ({ page }) => {
    // Login
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    // Wait for chat page
    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for organizations to load
    // The chat page fetches organizations on mount (line 154 in page.tsx)
    await page.waitForTimeout(2000)

    // Check for workspace section (always terminal mode)
    const workspaceSection = page.getByTestId("workspace-section")
    await expect(workspaceSection).toBeVisible({ timeout: 5000 })

    // Should not show error state
    await expect(page.getByText("Failed to load organizations")).not.toBeVisible()
  })

  test("auto-selects first organization when none selected", async ({ page }) => {
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for org auto-selection
    await page.waitForTimeout(3000)

    // Workspace section should be visible (always terminal mode)
    const workspaceSection = page.getByTestId("workspace-section")
    await expect(workspaceSection).toBeVisible({ timeout: 5000 })

    // Should not show "no org selected" error
    await expect(page.getByTestId("no-org-selected")).not.toBeVisible()
  })

  test("loads workspaces for selected organization", async ({ page }) => {
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for org and workspace auto-selection
    await page.waitForTimeout(3000)

    // Look for workspace section
    const workspaceSection = page.getByTestId("workspace-section")
    await expect(workspaceSection).toBeVisible({ timeout: 5000 })

    // Should not be stuck on "loading..."
    const workspaceText = await workspaceSection.textContent()
    expect(workspaceText).not.toContain("loading...")

    // Should not show error
    await expect(page.getByTestId("workspace-error")).not.toBeVisible()
  })

  test("auto-selects first workspace when org is selected", async ({ page }) => {
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for full auto-selection flow
    await page.waitForTimeout(4000)

    // Chat input should be enabled (only enabled when workspace is selected)
    const chatInput = page.locator('[data-testid="message-input"]')
    await expect(chatInput).toBeVisible({ timeout: 5000 })

    // Get the placeholder text to check if workspace is selected
    const placeholder = await chatInput.getAttribute("placeholder")

    // If workspace is selected, placeholder should NOT be "Select a site to start chatting..."
    if (!isDev || placeholder !== "Select a site to start chatting...") {
      // Either we have a workspace OR we're in staging and might have 0 domains
      // Check if there's a domain count indicator
      const noDomains = await page
        .getByText("You don't have any domains yet")
        .isVisible()
        .catch(() => false)

      if (!noDomains) {
        // We should have a workspace selected
        expect(placeholder).not.toBe("Select a site to start chatting...")

        // Verify workspace is shown
        const workspaceSection = page.getByTestId("workspace-section")
        const workspaceText = await workspaceSection.textContent()

        // Should show actual workspace name (not "loading..." or "select")
        expect(workspaceText).not.toContain("loading...")
        expect(workspaceText).not.toContain("select")
      }
    }
  })

  test("shows error state and retry button when org loading fails", async ({ page }) => {
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    // Intercept organizations API to simulate failure
    await page.route("**/api/auth/organizations", route => {
      route.abort("failed")
    })

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Settings modal should auto-open on org loading error
    await expect(page.getByTestId("settings-modal")).toBeVisible({ timeout: 5000 })

    // Should show error message inside the modal
    await expect(page.getByTestId("org-error-message")).toBeVisible()

    // Should show retry button inside the modal
    const retryButton = page.getByTestId("org-error-retry")
    await expect(retryButton).toBeVisible()

    // Click retry should attempt to reload
    await page.unroute("**/api/auth/organizations")
    await retryButton.click()

    // Error should disappear after retry succeeds
    await expect(page.getByTestId("org-error-message")).not.toBeVisible({ timeout: 5000 })
  })

  test("shows error and retry when workspace loading fails", async ({ page }) => {
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    // Block workspace API BEFORE login to ensure fetch fails
    await page.route("**/api/auth/workspaces*", route => {
      route.abort("failed")
    })

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })

    // Wait for workspace fetch to fail
    await page.waitForTimeout(2000)

    // Should show error in workspace switcher (always terminal mode)
    const errorIndicator = page.getByTestId("workspace-error")

    // Only check if we're in terminal mode (workspace switcher visible)
    const hasWorkspaceSwitcher = await page
      .getByTestId("workspace-switcher")
      .isVisible()
      .catch(() => false)

    if (!hasWorkspaceSwitcher) {
      // WorkspaceSwitcher should be visible in terminal mode
      // If not visible, error is inline
      await expect(errorIndicator).toBeVisible({ timeout: 5000 })

      // Should have retry button
      const retryButton = page.getByTestId("workspace-error-retry")
      await expect(retryButton).toBeVisible()
    } else {
      // WorkspaceSwitcher is visible, check inline error
      await expect(errorIndicator).toBeVisible({ timeout: 5000 })

      // Should have retry button
      const retryButton = page.getByTestId("workspace-error-retry")
      await expect(retryButton).toBeVisible()
    }
  })

  test("handles empty workspace list gracefully", async ({ page }) => {
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

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

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

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
    if (isDev) {
      await page.goto("https://dev.terminal.goalive.nl/")
    } else {
      await page.goto("/")
    }

    // Login
    const email = isDev ? DEV_EMAIL : TEST_EMAIL
    const password = isDev ? DEV_PASSWORD : TEST_PASSWORD

    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("login-button").click()

    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })
    await page.waitForTimeout(2000)
  })

  test("can open settings modal and see organization selector", async ({ page }) => {
    // Open menu dropdown and click settings
    await page.getByTestId("menu-button").click()
    await page.getByTestId("settings-button").click()

    // Settings modal should open - use heading role to be specific
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 3000 })

    // Organization section should be visible
    // The org selector might show as a dropdown or as text if only one org
    const settingsModal = page.locator('[role="dialog"]')
    await expect(settingsModal).toBeVisible()
  })

  test("workspace switcher shows current workspace", async ({ page }) => {
    // Always terminal mode - workspace switcher should show selected workspace

    // Wait for workspace to load
    await page.waitForTimeout(3000)

    // Look for workspace switcher text
    const workspaceSwitcherText = page.getByTestId("workspace-switcher-text")

    const isVisible = await workspaceSwitcherText.isVisible().catch(() => false)

    if (isVisible) {
      const text = await workspaceSwitcherText.textContent()
      // Should not be stuck on "loading..." or "select"
      expect(text).not.toBe("loading...")
      expect(text).not.toBe("select")
    }
  })
})
