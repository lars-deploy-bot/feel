/**
 * Utilities Validation Test
 *
 * Purpose: Test E2E utilities work correctly
 * Uses fast patterns (authenticatedPage + gotoFast) for speed
 */

import { SECURITY, TEST_CONFIG, TIMEOUTS } from "@webalive/shared"
import { expect, test } from "./fixtures"
import { TEST_MESSAGES, TEST_SELECTORS, TEST_TIMEOUTS, TEST_USER } from "./fixtures/test-data"
import { isRemoteEnv } from "./lib/test-env"

test.describe("E2E Utilities Validation", () => {
  test("test-data constants are accessible and have correct types", async () => {
    // Validate TEST_USER - values come from SECURITY.LOCAL_TEST and TEST_CONFIG
    expect(TEST_USER.email).toBe(SECURITY.LOCAL_TEST.EMAIL)
    expect(TEST_USER.password).toBe(SECURITY.LOCAL_TEST.PASSWORD)
    expect(TEST_USER.workspace).toBe(`test.${TEST_CONFIG.EMAIL_DOMAIN}`)

    // Validate TEST_MESSAGES
    expect(TEST_MESSAGES.simple).toBe("Hello")

    // Validate TEST_TIMEOUTS - environment-specific (2x multiplier for remote)
    const multiplier = isRemoteEnv ? 2 : 1
    expect(TEST_TIMEOUTS.fast).toBe(TIMEOUTS.TEST.SHORT * multiplier)
    expect(TEST_TIMEOUTS.medium).toBe(TIMEOUTS.TEST.MEDIUM * multiplier)
    expect(TEST_TIMEOUTS.slow).toBe(15_000 * multiplier)
    expect(TEST_TIMEOUTS.max).toBe(20_000 * multiplier)

    // Validate TEST_SELECTORS
    expect(TEST_SELECTORS.workspaceReady).toBe('[data-testid="workspace-ready"]')
    expect(TEST_SELECTORS.messageInput).toBe('[data-testid="message-input"]')
    expect(TEST_SELECTORS.sendButton).toBe('[data-testid="send-button"]')
  })
})
