import { expect, test } from "./setup"

test("homepage loads", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByPlaceholder("you@example.com")).toBeVisible()
  await expect(page.getByPlaceholder("Enter your password")).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible()
})
