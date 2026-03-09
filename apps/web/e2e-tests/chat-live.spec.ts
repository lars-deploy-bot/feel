/**
 * E2E Test - Chat API Request Validation
 *
 * Tests the actual bug: INVALID_REQUEST error when sending chat messages
 * Uses real API calls to verify the full request/response flow works.
 *
 * Run with: ENV_FILE=.env.staging bun run test:e2e:live
 *
 * Prerequisites:
 * - Live staging base URL in .env.staging (NEXT_PUBLIC_APP_URL)
 * - Tenant bootstrap via e2e-tests/global-setup.ts
 */

import { expect, type Page, test } from "@playwright/test"
import { DEFAULT_CLAUDE_MODEL } from "@webalive/shared"
import type { StructuredError } from "@/lib/error-codes"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { PATTERNS, TEST_MESSAGES, TEST_SELECTORS, TEST_TIMEOUTS } from "./fixtures/test-data"
import { parseValidatedBody } from "./lib/api-helpers"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

async function sendMessage(page: Page, message: string): Promise<void> {
  const messageInput = page.locator(TEST_SELECTORS.messageInput)
  const sendButton = page.locator(TEST_SELECTORS.sendButton)

  await messageInput.fill(message)
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await sendButton.click()
}

/** Random code for deterministic context retention verification (no LLM judge needed). */
function generateMemoryCode(): string {
  const id = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `ALIVE-${id}`
}

test.describe("Chat API - Request Validation", () => {
  test("can send message without INVALID_REQUEST error", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    // Verify chat interface is ready
    await expect(page.locator(TEST_SELECTORS.messageInput)).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    // Setup request/response interception BEFORE sending
    const requestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, TEST_MESSAGES.simple)
    const request = await requestPromise
    const response = await responsePromise

    const requestBody = parseValidatedBody(request)
    console.log("📤 Request body:", requestBody)

    // Verify request structure
    expect(requestBody.message).toBe(TEST_MESSAGES.simple)
    expect(requestBody.tabId).toMatch(PATTERNS.UUID)
    expect(requestBody.tabGroupId).toMatch(PATTERNS.UUID)
    expect(requestBody.model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(requestBody.workspace).toBe(user.workspace)
    console.log("✅ Request structure valid")

    // Verify response status
    const responseStatus = response.status()
    console.log("📥 Response status:", responseStatus)

    // If error response, parse and fail explicitly
    if (responseStatus !== 200) {
      const errorBody: StructuredError = await response.json()
      console.error("❌ Error response:", errorBody)

      if (errorBody.error === "INVALID_REQUEST") {
        throw new Error(`INVALID_REQUEST error: ${errorBody.message}`)
      }

      throw new Error(`API error (${responseStatus}): ${errorBody.error} - ${errorBody.message}`)
    }

    // Verify user message appears in UI
    await expect(page.getByText(TEST_MESSAGES.simple).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.slow,
    })
    console.log("✅ User message displayed")

    // Wait for stream to complete: send-button reappears in DOM after streaming ends
    // (during streaming it switches to stop-button, then back to send-button)
    // Note: send-button is disabled when input is empty, so we check toBeAttached() not toBeEnabled()
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeAttached({
      timeout: TEST_TIMEOUTS.max,
    })
    console.log("✅ Stream completed (send button re-attached)")

    // Verify no stream error shown in UI
    const errorVisible = await page.getByText("Something went wrong").isVisible()
    if (errorVisible) {
      const errorText = await page.getByText("Something went wrong").textContent()
      throw new Error(`Stream error shown in UI: ${errorText}`)
    }
    console.log("✅ No stream errors — chat works without INVALID_REQUEST error")
  })

  test("handles insufficient tokens gracefully", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    await expect(page.locator(TEST_SELECTORS.messageInput)).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, TEST_MESSAGES.simple)

    const response = await responsePromise
    const status = response.status()

    // Test should handle both success (200) and insufficient tokens (402/403)
    // This makes the test resilient to credit/token availability
    if (status === 200) {
      console.log("✅ Request succeeded (user has credits)")
    } else if (status === 402 || status === 403) {
      const errorBody: StructuredError = await response.json()
      console.log("✅ Request blocked due to insufficient tokens (expected):", errorBody.error)
      expect(errorBody.error).toMatch(/INSUFFICIENT_TOKENS|TEST_MODE_BLOCK/)
    } else {
      throw new Error(`Unexpected status ${status}`)
    }
  })

  test("real two-turn context retention", async ({ page }) => {
    test.setTimeout(120000)
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    await expect(page.locator(TEST_SELECTORS.messageInput)).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    // Use a unique random code so context retention can be verified deterministically
    // without an LLM judge (which was the source of flakiness).
    const memoryCode = generateMemoryCode()
    const firstPrompt = `Remember this exact code: ${memoryCode}. Reply with only "Stored." and nothing else.`
    const secondPrompt = "What was the exact code I asked you to remember? Reply with only the code."

    const firstRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const firstResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, firstPrompt)

    const firstRequest = await firstRequestPromise
    const firstResponse = await firstResponsePromise
    const firstRequestBody = parseValidatedBody(firstRequest)

    expect(firstRequestBody.message).toBe(firstPrompt)
    expect(firstRequestBody.tabId).toMatch(PATTERNS.UUID)
    expect(firstRequestBody.tabGroupId).toMatch(PATTERNS.UUID)
    expect(firstRequestBody.model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(firstRequestBody.workspace).toBe(user.workspace)
    expect(firstResponse.status()).toBe(200)

    // Wait for stream to complete: send-button reappears in DOM after streaming ends
    // (disabled when input is empty, so check toBeAttached() not toBeEnabled())
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeAttached({
      timeout: TEST_TIMEOUTS.max,
    })

    const firstNDJSON = await firstResponse.text()
    const firstAssistantText = extractAssistantTextFromNDJSON(firstNDJSON)
    expect(firstAssistantText.length).toBeGreaterThan(0)
    console.log(`[Turn 1] Assistant: ${firstAssistantText}`)

    const secondRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const secondResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, secondPrompt)

    const secondRequest = await secondRequestPromise
    const secondResponse = await secondResponsePromise
    const secondRequestBody = parseValidatedBody(secondRequest)

    expect(secondRequestBody.message).toBe(secondPrompt)
    expect(secondRequestBody.tabId).toBe(firstRequestBody.tabId)
    expect(secondRequestBody.tabGroupId).toBe(firstRequestBody.tabGroupId)
    expect(secondRequestBody.model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(secondRequestBody.workspace).toBe(user.workspace)
    expect(secondResponse.status()).toBe(200)

    // Wait for stream to complete: send-button reappears in DOM after streaming ends
    await expect(page.locator(TEST_SELECTORS.sendButton)).toBeAttached({
      timeout: TEST_TIMEOUTS.max,
    })

    const secondNDJSON = await secondResponse.text()
    const secondAssistantText = extractAssistantTextFromNDJSON(secondNDJSON)
    console.log(`[Turn 2] Assistant: ${secondAssistantText}`)

    // Deterministic verification: the second response must contain the memory code.
    // This proves context retention without needing an LLM judge.
    expect(secondAssistantText).toContain(memoryCode)
    console.log(`[Context] Verified: response contains ${memoryCode}`)
  })
})
