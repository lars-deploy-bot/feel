import { expect, test } from "@playwright/test"

test.describe("Login", () => {
  test("should show login form with passcode input and sign-in button", async ({ page }) => {
    await page.goto("/")

    // Should show the login page heading
    await expect(page.getByRole("heading", { name: "alive" })).toBeAttached()

    // Should have passcode input
    const passcodeInput = page.getByPlaceholder("Passcode")
    await expect(passcodeInput).toBeAttached()
    await expect(passcodeInput).toHaveAttribute("type", "password")

    // Should have sign-in button, disabled when empty
    const signIn = page.getByRole("button", { name: "Sign in" })
    await expect(signIn).toBeAttached()
    await expect(signIn).toBeDisabled()
  })

  test("should enable sign-in button when passcode is entered", async ({ page }) => {
    await page.goto("/")

    const passcodeInput = page.getByPlaceholder("Passcode")
    await passcodeInput.fill("something")

    const signIn = page.getByRole("button", { name: "Sign in" })
    await expect(signIn).toBeEnabled()
  })

  test("should reject invalid passcode and show error", async ({ page }) => {
    await page.goto("/")

    const passcodeInput = page.getByPlaceholder("Passcode")
    await passcodeInput.fill("definitely-wrong-passcode")

    const signIn = page.getByRole("button", { name: "Sign in" })
    await signIn.click()

    // Should show error message
    await expect(page.getByText("Invalid passcode")).toBeVisible({ timeout: 5000 })

    // Should clear the passcode input after failed attempt
    await expect(passcodeInput).toHaveValue("")
  })

  test("should authenticate with valid passcode and show dashboard", async ({ page }) => {
    const passcode = process.env.ALIVE_PASSCODE
    test.skip(!passcode, "ALIVE_PASSCODE env var required for auth test")

    await page.goto("/")
    await page.getByPlaceholder("Passcode").fill(passcode)
    await page.getByRole("button", { name: "Sign in" }).click()

    // After login, should see the dashboard (Organizations is the default page)
    await expect(page.getByText("Organizations")).toBeVisible({ timeout: 10_000 })
  })
})
