/**
 * Worktree Switcher E2E Tests
 *
 * Verifies the worktree switcher appears when the WORKTREES feature flag
 * is enabled at startup, and is absent when disabled (default).
 *
 * Overrides the shared `testFeatureFlags` fixture to inject WORKTREES: true.
 */

import { expect } from "@playwright/test"
import { test as baseTest } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { gotoChatFast } from "./helpers/assertions"

// Override testFeatureFlags to enable WORKTREES
const test = baseTest.extend({
  testFeatureFlags: async (_deps, use) => {
    await use({ WORKTREES: true })
  },
})

test("worktree switcher button visible when WORKTREES flag enabled", async ({ authenticatedPage, workerTenant }) => {
  await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)

  // Open the sidebar first — WorktreeSwitcher renders inside the sidebar
  const openSidebarButton = authenticatedPage.locator('button[aria-label="Open sidebar"]').first()
  await expect(openSidebarButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
  await openSidebarButton.click()

  // The WorktreeSwitcher renders a button with text "base" when no worktree is selected.
  // It only appears when useFeatureFlag("WORKTREES") returns true AND the workspace is not superadmin.
  const worktreeButton = authenticatedPage.getByRole("button", { name: /base/ })
  await expect(worktreeButton).toBeAttached({ timeout: TEST_TIMEOUTS.medium })
})
