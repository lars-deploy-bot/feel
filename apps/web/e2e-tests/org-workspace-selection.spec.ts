import { login } from "./helpers"
import { expect, test } from "./setup"

/**
 * Organization and Workspace Selection - Worker Isolated
 *
 * Tests workspace selection with dedicated worker tenant.
 */

test.describe("Organization and Workspace Selection", () => {
  test("loads workspace after authentication", async ({ page, tenant }) => {
    await login(page, tenant)
    await page.goto("/chat")

    // Wait for chat interface
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({ timeout: 10000 })

    // Verify workspace is set (from fixture)
    const workspace = await page.evaluate(() => sessionStorage.getItem("workspace"))
    expect(workspace).toBe(tenant.workspace)

    // Check workspace section displays correct workspace
    const workspaceSection = page.getByTestId("workspace-section")
    if (await workspaceSection.isVisible()) {
      await expect(workspaceSection).toContainText(tenant.workspace)
    }
  })

  test("chat interface is functional with workspace", async ({ page, tenant }) => {
    await login(page, tenant)
    await page.goto("/chat")

    const messageInput = page.getByTestId("message-input")
    await expect(messageInput).toBeVisible()
    await expect(messageInput).toBeEnabled()

    // Send button should be enabled when workspace is set
    await messageInput.fill("test message")
    const sendButton = page.getByTestId("send-button")
    await expect(sendButton).toBeEnabled()
  })
})
