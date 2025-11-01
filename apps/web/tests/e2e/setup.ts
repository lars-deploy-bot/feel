/**
 * E2E Test Setup - Playwright Fixtures
 *
 * SAFETY: Automatically extends Playwright's test fixture to block
 * all real Anthropic API calls by default.
 *
 * Import this at the top of each test file:
 * ```ts
 * import { test, expect } from './setup'
 * ```
 *
 * Inspired by lucky-1's test safety patterns
 */

import { test as base, expect } from '@playwright/test'

/**
 * Extended test fixture that automatically blocks Anthropic API calls
 *
 * Every test that uses this fixture will have API mocking enabled by default.
 * Override in individual tests if you need custom mock responses.
 */
export const test = base.extend({
  // Extend the page fixture to add automatic API blocking
  page: async ({ page, context }, use) => {
    // Block real Anthropic API calls by default
    await context.route('https://api.anthropic.com/**', async route => {
      console.error(
        '🚨 BLOCKED: Real Anthropic API call in e2e test!\n' +
        'Mock the response in your test to avoid charges.'
      )

      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            type: 'payment_required',
            message: 'API calls blocked in tests. Mock responses explicitly.',
          },
        }),
      })
    })

    // Use the page as normal
    await use(page)
  },
})

// Re-export expect for convenience
export { expect }
