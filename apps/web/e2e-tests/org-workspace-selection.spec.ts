import { WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { login } from "./helpers"
import { gotoChat } from "./helpers/assertions"
import { expect, test } from "./fixtures"

/**
 * Organization and Workspace Selection - Worker Isolated
 *
 * Tests workspace selection with dedicated worker tenant.
 */

test.describe("Organization and Workspace Selection", () => {
  test("workspace loads and chat interface is functional", async ({ page, tenant }) => {
    await login(page, tenant)
    await gotoChat(page)

    // Workspace-ready already confirmed by gotoChat, just verify UI elements
    const messageInput = page.locator('[data-testid="message-input"]')
    await expect(messageInput).toBeVisible({ timeout: 5000 })

    // Verify workspace is set using typed constants from @webalive/shared
    const storageValue = await page.evaluate(key => localStorage.getItem(key), WORKSPACE_STORAGE.KEY)
    expect(storageValue).not.toBeNull()
    const parsed = JSON.parse(storageValue!) as WorkspaceStorageValue
    expect(parsed.state.currentWorkspace).toBe(tenant.workspace)

    // Fill message and verify send button is enabled (proves workspace is set)
    await messageInput.fill("test message")
    const sendButton = page.getByTestId("send-button")
    await expect(sendButton).toBeEnabled({ timeout: 5000 })
  })
})
