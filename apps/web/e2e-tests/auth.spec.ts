import { WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { gotoChatFast } from "./helpers/assertions"
import { expect, test } from "./fixtures"

/**
 * Auth test using pre-authenticated page (fast)
 *
 * Uses authenticatedPage fixture which pre-sets JWT cookie.
 * gotoChatFast injects localStorage and navigates.
 */
test.skip("can access chat with worker tenant auth", async ({ authenticatedPage, workerTenant }) => {
  await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)
  await expect(authenticatedPage.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 3000 })

  // Verify workspace is set correctly
  const storageValue = await authenticatedPage.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
  expect(storageValue).not.toBeNull()
  const parsed = JSON.parse(storageValue!) as WorkspaceStorageValue
  expect(parsed.state.currentWorkspace).toBe(workerTenant.workspace)
})
