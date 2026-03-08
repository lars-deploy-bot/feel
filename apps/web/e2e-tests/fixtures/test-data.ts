/**
 * Single source of truth for E2E test constants.
 *
 * Rules:
 * - Import app constants from @webalive/shared or app code — never redefine them here.
 * - Only define things that are genuinely test-specific (test user creds, timeout tuning, test messages).
 */

import { SECURITY, TEST_CONFIG, TIMEOUTS } from "@webalive/shared"
import { CLAUDE_STREAM_ENDPOINTS } from "@/lib/stream/claude-stream-request-matchers"

// Direct env check to avoid circular dependency with test-env.ts
const isRemote = process.env.TEST_ENV !== "local"

// ---------------------------------------------------------------------------
// API endpoints — re-exported from app code, not hardcoded
// ---------------------------------------------------------------------------

export const TEST_API = {
  CLAUDE_STREAM: CLAUDE_STREAM_ENDPOINTS.STREAM,
  CLAUDE_STREAM_RECONNECT: CLAUDE_STREAM_ENDPOINTS.RECONNECT,
  CLAUDE_STREAM_CANCEL: CLAUDE_STREAM_ENDPOINTS.CANCEL,
} as const

// ---------------------------------------------------------------------------
// Validation patterns
// ---------------------------------------------------------------------------

export const PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const

// ---------------------------------------------------------------------------
// Test credentials & identity
// ---------------------------------------------------------------------------

export const TEST_USER = {
  email: SECURITY.LOCAL_TEST.EMAIL,
  password: SECURITY.LOCAL_TEST.PASSWORD,
  workspace: `test.${TEST_CONFIG.EMAIL_DOMAIN}`,
} as const

// ---------------------------------------------------------------------------
// Test messages — only test-specific strings belong here
// ---------------------------------------------------------------------------

export const TEST_MESSAGES = {
  simple: "Hello",
  greeting: "Hi there",
  question: "What can you help me with?",
  complex: "Build a todo app with React and TypeScript",
  protected: "Protected!",
} as const

/**
 * Test timeouts calibrated for parallel execution
 *
 * Rule of thumb: if a single test needs X seconds, budget 3X for parallel.
 * Remote environments (staging/production) need 2x longer due to:
 * 1. More workers (6 vs 4)
 * 2. Network latency
 * 3. Server load from other traffic
 *
 * @see docs/postmortems/2025-11-30-e2e-test-flakiness.md
 */
const TIMEOUT_MULTIPLIER = isRemote ? 2 : 1

export const TEST_TIMEOUTS = {
  /** Fast UI operations (button clicks, input fills) - should be instant */
  fast: TIMEOUTS.TEST.SHORT * TIMEOUT_MULTIPLIER, // 1s local, 2s remote

  /** Medium operations (API responses, DOM updates) */
  medium: TIMEOUTS.TEST.MEDIUM * TIMEOUT_MULTIPLIER, // 3s local, 6s remote

  /**
   * Slow operations (React hydration, workspace initialization)
   * This is the PRIMARY wait - put it first, then use fast/medium for confirmations
   * Turbopack client compilation can take 15s+ under parallel worker load
   */
  slow: 15_000 * TIMEOUT_MULTIPLIER, // 15s local, 30s remote

  /** Maximum timeout for any single assertion (must be > slow for fallback paths) */
  max: 20_000 * TIMEOUT_MULTIPLIER, // 20s local, 40s remote
} as const

export const TEST_SELECTORS = {
  workspaceReady: '[data-testid="workspace-ready"]',
  workspaceLoading: '[data-testid="workspace-loading"]',
  /** Chat is ready to send messages (dexie session + tab initialized) */
  chatReady: '[data-chat-ready="true"]',
  messageInput: '[data-testid="message-input"]',
  sendButton: '[data-testid="send-button"]',
  stopButton: '[data-testid="stop-button"]',
  // Tab-related selectors
  tabBar: '[data-testid="tab-bar"]',
  addTabButton: '[data-testid="add-tab-button"]',
  toggleTabsButton: '[data-testid="toggle-tabs-button"]',
  newTabGroupButton: '[data-testid="new-tab-group-button"]',
  /** Use with string template: `[data-testid="tab-${tabId}"]` */
  tabPrefix: '[data-testid^="tab-"]',
  activeTab: '[data-active="true"]',
} as const

/**
 * Test workspace configuration for live staging E2E tests
 */
export const TEST_WORKSPACE = {
  /** Physical path where test workspace is created */
  path: "/tmp/test-workspace",
  /** Workspace name used in API requests */
  name: `test.${TEST_CONFIG.EMAIL_DOMAIN}`,
} as const
