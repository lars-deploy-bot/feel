/**
 * Shared chat actions for live E2E tests.
 *
 * Single source of truth for sending messages and waiting for stream completion.
 * Uses TEST_SELECTORS — never hardcode selectors in spec files.
 */

import { expect, type Page } from "@playwright/test"
import { isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { TEST_SELECTORS, TEST_TIMEOUTS } from "../fixtures/test-data"
import { extractAssistantTextFromNDJSON } from "./ndjson"

/** Fill the message input and click send. Does NOT wait for the response. */
export async function sendMessage(page: Page, message: string): Promise<void> {
  await page.locator(TEST_SELECTORS.messageInput).fill(message)
  await expect(page.locator(TEST_SELECTORS.sendButton)).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await page.locator(TEST_SELECTORS.sendButton).click()
}

/**
 * Send a message, intercept the stream response, assert 200,
 * and return the parsed assistant text.
 */
export async function sendMessageAndCapture(
  page: Page,
  message: string,
): Promise<{ response: import("@playwright/test").Response; assistantText: string }> {
  const streamResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

  await sendMessage(page, message)

  const response = await streamResponsePromise
  expect(response.status()).toBe(200)

  const ndjson = await response.text()
  const assistantText = extractAssistantTextFromNDJSON(ndjson)
  expect(assistantText.length).toBeGreaterThan(0)

  return { response, assistantText }
}

/** Wait for the stream to complete (send button re-attaches after streaming ends). */
export async function waitForStreamComplete(page: Page): Promise<void> {
  await expect(page.locator(TEST_SELECTORS.sendButton)).toBeAttached({ timeout: TEST_TIMEOUTS.max })
}

/** Wait for the message input to be visible (chat interface ready to type). */
export async function waitForMessageInput(page: Page): Promise<void> {
  await expect(page.locator(TEST_SELECTORS.messageInput)).toBeVisible({ timeout: TEST_TIMEOUTS.max })
}
