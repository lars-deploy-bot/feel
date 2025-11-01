import { test, expect } from "./setup"

test("homepage loads", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByPlaceholder("domain (e.g. demo.goalive.nl)")).toBeVisible()
  await expect(page.getByPlaceholder("passcode")).toBeVisible()
  await expect(page.getByRole("button", { name: "ENTER" })).toBeVisible()
})
