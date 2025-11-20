/**
 * Shared test data constants for E2E tests
 *
 * Benefits:
 * - Single source of truth
 * - Easy to update
 * - Type-safe
 * - Self-documenting
 */

export const TEST_USER = {
  email: "test@bridge.local",
  password: "test",
  workspace: "test.bridge.local",
} as const

export const TEST_MESSAGES = {
  simple: "Hello",
  greeting: "Hi there",
  question: "What can you help me with?",
  complex: "Build a todo app with React and TypeScript",
  protected: "Protected!",
} as const

export const TEST_TIMEOUTS = {
  /** Fast UI operations (button clicks, input fills) */
  fast: 1000,
  /** Medium operations (API responses, DOM updates) */
  medium: 3000,
  /** Slow operations (page loads, workspace initialization) */
  slow: 5000,
  /** Maximum timeout for any operation */
  max: 10000,
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
  name: "test.bridge.local",
} as const
