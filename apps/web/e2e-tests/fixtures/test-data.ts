/**
 * Shared test data constants for E2E tests
 *
 * Benefits:
 * - Single source of truth
 * - Easy to update
 * - Type-safe
 * - Self-documenting
 */

import { SECURITY, TEST_CONFIG, TIMEOUTS } from "@webalive/shared"

export const TEST_USER = {
  email: SECURITY.LOCAL_TEST.EMAIL,
  password: SECURITY.LOCAL_TEST.PASSWORD,
  workspace: `test.${TEST_CONFIG.EMAIL_DOMAIN}`,
} as const

export const TEST_MESSAGES = {
  simple: "Hello",
  greeting: "Hi there",
  question: "What can you help me with?",
  complex: "Build a todo app with React and TypeScript",
  protected: "Protected!",
} as const

/**
 * Test timeouts calibrated for parallel execution (4 workers)
 *
 * Rule of thumb: if a single test needs X seconds, budget 3X for parallel.
 * These values are intentionally higher than "feels necessary" because:
 * 1. Parallel workers share server resources
 * 2. React hydration can be slow under load
 * 3. Flaky tests waste more time than generous timeouts
 *
 * @see docs/postmortems/2025-11-30-e2e-test-flakiness.md
 */
export const TEST_TIMEOUTS = {
  /** Fast UI operations (button clicks, input fills) - should be instant */
  fast: TIMEOUTS.TEST.SHORT, // 1s

  /** Medium operations (API responses, DOM updates) */
  medium: TIMEOUTS.TEST.MEDIUM, // 3s

  /**
   * Slow operations (React hydration, workspace initialization)
   * This is the PRIMARY wait - put it first, then use fast/medium for confirmations
   */
  slow: 10_000, // 10s - accounts for parallel load

  /** Maximum timeout for any single assertion */
  max: 15_000, // 15s - escape hatch, investigate if hit regularly
} as const

export const TEST_SELECTORS = {
  workspaceReady: '[data-testid="workspace-ready"]',
  workspaceLoading: '[data-testid="workspace-loading"]',
  messageInput: '[data-testid="message-input"]',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
} as const

/**
 * Test workspace configuration
 * This workspace is created by genuine-setup.ts for genuine E2E tests
 */
export const TEST_WORKSPACE = {
  /** Physical path where test workspace is created */
  path: "/tmp/test-workspace",
  /** Workspace name used in API requests */
  name: `test.${TEST_CONFIG.EMAIL_DOMAIN}`,
} as const
