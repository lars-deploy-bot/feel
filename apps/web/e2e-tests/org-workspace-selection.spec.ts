import { WORKSPACE_STORAGE, type WorkspaceStorageValue } from "@webalive/shared"
import { login } from "./helpers"
import { expect, test } from "./fixtures"

/**
 * Organization and Workspace Selection - Worker Isolated
 *
 * Tests workspace selection with dedicated worker tenant.
 */

test.describe("Organization and Workspace Selection", () => {
  test("workspace loads and chat interface is functional", async ({ page, tenant }) => {
    await login(page, tenant)
    await page.goto("/chat")

    // Wait for BOTH critical elements upfront (prevents timeout accumulation)
    // These run concurrently via Promise.all pattern in Playwright's auto-waiting
    const messageInput = page.locator('[data-testid="message-input"]')
    const workspaceReady = page.locator('[data-testid="workspace-ready"]')

    await expect(messageInput).toBeVisible({ timeout: 20000 })
    await expect(workspaceReady).toBeAttached({ timeout: 5000 }) // Should be ready by now

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
