import { expect, test } from "./setup"

test("can login with test credentials", async ({ page }) => {
  await page.goto("/")

  await page.getByPlaceholder("you@example.com").fill("test@bridge.local")
  await page.getByPlaceholder("Enter your password").fill("test")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page).toHaveURL("/chat")
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
})
