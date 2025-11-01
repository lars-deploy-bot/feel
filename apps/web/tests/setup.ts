/**
 * Global test setup
 * Runs before all tests
 *
 * IMPORTANT: Mocks AI SDK to prevent accidental real API calls that cost money!
 */

import { vi } from 'vitest'

// Set deterministic timezone for date tests
process.env.TZ = 'UTC'

// Disable color output in CI for cleaner logs
if (process.env.CI) {
  process.env.FORCE_COLOR = '0'
}

// Set test environment
process.env.BRIDGE_ENV = 'local'
process.env.NODE_ENV = 'test'

/**
 * SAFETY: Mock Anthropic Claude SDK to prevent real API calls
 *
 * This throws an error if the SDK is called during tests, forcing developers
 * to explicitly mock API responses. This prevents accidental API calls that:
 * - Cost real money (💸)
 * - Make tests slow
 * - Make tests non-deterministic
 * - Require network access
 *
 * Inspired by lucky-1's AI SDK mocking pattern
 */
vi.mock('@anthropic-ai/claude-agent-sdk', async () => {
  const actual = await vi.importActual('@anthropic-ai/claude-agent-sdk')
  return {
    ...actual,
    query: vi.fn(() => {
      throw new Error(
        '🚨 Anthropic SDK query() called in test without mocking!\n' +
        'This would make a REAL API call and cost money.\n\n' +
        'To fix this:\n' +
        '1. Mock the API response in your test\n' +
        '2. Or use route mocking for e2e tests (Playwright)\n' +
        '3. Never call real Anthropic API in unit tests'
      )
    }),
  }
})
