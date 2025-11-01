import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('has chat interface', async ({ page }) => {
  await page.goto('/chat')

  // Check basic elements exist
  await expect(page.getByPlaceholder('Message')).toBeVisible()
  await expect(page.getByRole('button', { name: 'new chat' })).toBeVisible()
})

test('can send a message', async ({ page }) => {
  await page.goto('/chat')

  const textarea = page.getByPlaceholder('Message')
  await textarea.fill('Hello')

  // Send button is the form submit button with arrow icon
  await textarea.press('Enter')

  // User message should appear (timeout increased for API call)
  await expect(page.getByText('Hello')).toBeVisible({ timeout: 10000 })
})
