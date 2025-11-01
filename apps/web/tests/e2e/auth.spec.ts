import { test, expect } from '@playwright/test'

test('can login with test credentials', async ({ page }) => {
  await page.goto('/')

  // Fill in login form
  await page.getByPlaceholder('domain (e.g. demo.goalive.nl)').fill('test')
  await page.getByPlaceholder('passcode').fill('test')
  await page.getByRole('button', { name: 'ENTER' }).click()

  // Should redirect to chat
  await expect(page).toHaveURL('/chat')

  // Chat interface should be visible
  await expect(page.getByPlaceholder('Message')).toBeVisible()
})
