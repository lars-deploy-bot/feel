import { test } from "@playwright/test"

test("debug chat page error", async ({ page }) => {
  // Capture console errors
  const errors: string[] = []
  page.on("console", msg => {
    if (msg.type() === "error") {
      errors.push(msg.text())
      console.log("Browser error:", msg.text())
    }
  })

  // Capture page errors
  page.on("pageerror", error => {
    console.log("Page error:", error.message)
    errors.push(error.message)
  })

  // Login first
  await page.goto("http://localhost:9547/")
  await page.getByTestId("email-input").fill("test@bridge.local")
  await page.getByTestId("password-input").fill("test")
  await page.getByTestId("login-button").click()

  // Wait for navigation
  await page.waitForURL("**/chat", { timeout: 10000 })

  // Wait a bit to see if errors appear
  await page.waitForTimeout(3000)

  console.log("All errors:", errors)

  // Try to find error details
  const errorDetails = await page.locator('details summary:has-text("Error details")').count()
  if (errorDetails > 0) {
    await page.locator('details summary:has-text("Error details")').click()
    const errorText = await page.locator("details pre").textContent()
    console.log("Error details:", errorText)
  }

  // Take a screenshot
  await page.screenshot({ path: "/tmp/debug-chat.png", fullPage: true })
})
