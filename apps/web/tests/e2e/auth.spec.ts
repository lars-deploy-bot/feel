import { test, expect } from './setup'

test('can login with test credentials', async ({ page }) => {
  await page.goto('/')

  await page.getByPlaceholder('domain (e.g. demo.goalive.nl)').fill('test')
  await page.getByPlaceholder('passcode').fill('test')
  await page.getByRole('button', { name: 'ENTER' }).click()

  await expect(page).toHaveURL('/chat')
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
})
