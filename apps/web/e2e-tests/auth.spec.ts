import { login } from "./helpers"
import { expect, test } from "./setup"

test("can access chat with worker tenant auth", async ({ page, tenant }) => {
  await login(page, tenant)
  await page.goto("/chat")
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()

  // Verify workspace is set correctly
  const workspace = await page.evaluate(() => sessionStorage.getItem("workspace"))
  expect(workspace).toBe(tenant.workspace)
})
