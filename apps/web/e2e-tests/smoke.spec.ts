import { expect, test } from "./setup"

test("homepage loads", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByTestId("email-input")).toBeVisible()
  await expect(page.getByTestId("password-input")).toBeVisible()
  await expect(page.getByTestId("login-button")).toBeVisible()
})
