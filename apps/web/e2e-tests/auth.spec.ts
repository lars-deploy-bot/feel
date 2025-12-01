import { WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { login } from "./helpers"
import { expect, test } from "./fixtures"

test("can access chat with worker tenant auth", async ({ page, tenant }) => {
  await login(page, tenant)
  await page.goto("/chat")
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()

  // Verify workspace is set correctly using typed constants from @webalive/shared
  const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
  expect(storageValue).not.toBeNull()
  const parsed = JSON.parse(storageValue!) as WorkspaceStorageValue
  expect(parsed.state.currentWorkspace).toBe(tenant.workspace)
})
