import { expect, test } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { gotoChatFast } from "./helpers/assertions"
import { buildJsonMockResponse } from "./lib/strict-api-guard"

/**
 * Settings E2E tests
 *
 * Settings is inline in the sidebar. The entrypoint has moved over time:
 * older builds expose a gear button in the sidebar header, newer builds
 * expose a user account/settings button at the bottom of the sidebar.
 * Both should open the same settings UI.
 *
 * Flow: open sidebar → click a settings entrypoint → verify settings content.
 *
 * IMPORTANT: The FlowgladProvider in the layout makes API calls to /api/flowglad
 * which can crash for E2E test users (no Flowglad customer record). We mock all
 * billing-related APIs to isolate the test from these issues.
 */

test("can open settings and see General tab", async ({ authenticatedPage, workerTenant }) => {
  // Mock billing/user/token APIs to prevent crashes for test users
  await authenticatedPage.route("**/api/flowglad/**", route =>
    route.fulfill(buildJsonMockResponse({ data: null, error: null })),
  )
  await authenticatedPage.route("**/api/user**", route =>
    route.fulfill(
      buildJsonMockResponse({
        user: {
          id: workerTenant.userId,
          email: workerTenant.email,
          name: workerTenant.orgName,
          firstName: "Test",
          lastName: "User",
          isAdmin: false,
          isSuperadmin: false,
          canSelectAnyModel: false,
          enabledModels: [],
        },
      }),
    ),
  )
  await authenticatedPage.route("**/api/tokens**", route =>
    route.fulfill(buildJsonMockResponse({ ok: true, credits: 100, tokens: 100000 })),
  )

  await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)

  // Sidebar defaults to closed — open it first via the Nav toggle button
  const openSidebarButton = authenticatedPage.locator('button[aria-label="Open sidebar"]').first()
  await expect(openSidebarButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
  await openSidebarButton.click()

  // Click the settings button inside the sidebar.
  // Scope to the desktop sidebar to avoid strict mode violations.
  const desktopSidebar = authenticatedPage.locator('aside[aria-label="Conversation history"]').first()
  const settingsButton = desktopSidebar.locator('button[aria-label="Settings"]').first()
  await expect(settingsButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
  await settingsButton.click()

  // Settings content should appear in the main area
  await expect(authenticatedPage.locator('[data-testid="settings-overlay"]')).toBeVisible({
    timeout: TEST_TIMEOUTS.max,
  })

  // General tab: model select in main content, logout button in sidebar settings nav
  await expect(authenticatedPage.locator("#claude-model")).toBeAttached({ timeout: TEST_TIMEOUTS.medium })
  // Both desktop and mobile sidebars render a logout button — scope to the desktop sidebar
  await expect(desktopSidebar.locator('[data-testid="logout-button"]')).toBeAttached({
    timeout: TEST_TIMEOUTS.medium,
  })
})
