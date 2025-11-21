import { expect, test } from "./setup"

test("can login with test credentials", async ({ page }) => {
  await page.goto("/")

  await page.getByTestId("email-input").fill("test@bridge.local")
  await page.getByTestId("password-input").fill("test")
  await page.getByTestId("login-button").click()

  await expect(page).toHaveURL("/chat")
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
})
