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

import { expect, test } from "@playwright/test"
import { DEFAULT_CLAUDE_MODEL } from "@webalive/shared"
import type { StructuredError } from "@/lib/error-codes"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { PATTERNS, TEST_MESSAGES, TEST_TIMEOUTS } from "./fixtures/test-data"
import { parseValidatedBody } from "./lib/api-helpers"
import { sendMessage, waitForMessageInput, waitForStreamComplete } from "./lib/chat-actions"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { llmVerify } from "./lib/llm-verify"
import { annotate } from "./lib/log"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

test.describe("Chat API - Request Validation", () => {
  test("can send message without INVALID_REQUEST error", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    // Verify chat interface is ready
    await waitForMessageInput(page)

    // Setup request/response interception BEFORE sending
    const requestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, TEST_MESSAGES.simple)
    const request = await requestPromise
    const response = await responsePromise

    const requestBody = parseValidatedBody(request)
    annotate("request", JSON.stringify(requestBody))

    // Verify request structure
    expect(requestBody.message).toBe(TEST_MESSAGES.simple)
    expect(requestBody.tabId).toMatch(PATTERNS.UUID)
    expect(requestBody.tabGroupId).toMatch(PATTERNS.UUID)
    expect(requestBody.model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(requestBody.workspace).toBe(user.workspace)

    // Verify response status
    const responseStatus = response.status()
    annotate("response", `status: ${responseStatus}`)

    // If error response, parse and fail explicitly
    if (responseStatus !== 200) {
      const errorBody: StructuredError = await response.json()
      if (errorBody.error === "INVALID_REQUEST") {
        throw new Error(`INVALID_REQUEST error: ${errorBody.message}`)
      }

      throw new Error(`API error (${responseStatus}): ${errorBody.error} - ${errorBody.message}`)
    }

    // Verify user message appears in UI
    await expect(page.getByText(TEST_MESSAGES.simple).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.slow,
    })

    await waitForStreamComplete(page)

    // Verify no stream error shown in UI
    const errorVisible = await page.getByText("Something went wrong").isVisible()
    if (errorVisible) {
      const errorText = await page.getByText("Something went wrong").textContent()
      throw new Error(`Stream error shown in UI: ${errorText}`)
    }
  })

  test("handles insufficient tokens gracefully", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    await waitForMessageInput(page)

    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, TEST_MESSAGES.simple)

    const response = await responsePromise
    const status = response.status()

    // Test should handle both success (200) and insufficient tokens (402/403)
    // This makes the test resilient to credit/token availability
    if (status === 200) {
      annotate("credits", "Request succeeded (user has credits)")
    } else if (status === 402 || status === 403) {
      const errorBody: StructuredError = await response.json()
      annotate("credits", `Blocked: ${errorBody.error}`)
      expect(errorBody.error).toMatch(/INSUFFICIENT_TOKENS|TEST_MODE_BLOCK/)
    } else {
      throw new Error(`Unexpected status ${status}`)
    }
  })

  test("real two-turn context retention", async ({ page }) => {
    test.setTimeout(120000)
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    await waitForMessageInput(page)

    const secret = `ECHO_${Date.now()}`

    // --- Turn 1: inject a unique secret ---
    const firstRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const firstResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    const firstPrompt = `The secret code is: ${secret}. Acknowledge by repeating the code back to me.`
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

    await waitForStreamComplete(page)

    const firstNDJSON = await firstResponse.text()
    const firstAssistantText = extractAssistantTextFromNDJSON(firstNDJSON)
    expect(await llmVerify(firstAssistantText, `Does this response contain or acknowledge the code "${secret}"?`)).toBe(
      true,
    )
    annotate("turn1", firstAssistantText.slice(0, 120))

    // --- Turn 2: ask to recall the secret ---
    const secondRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const secondResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    const secondPrompt = "What was the secret code I told you? Reply with it."
    await sendMessage(page, secondPrompt)

    const secondRequest = await secondRequestPromise
    const secondResponse = await secondResponsePromise
    const secondRequestBody = parseValidatedBody(secondRequest)

    // Session stickiness: same tab across turns
    expect(secondRequestBody.tabId).toBe(firstRequestBody.tabId)
    expect(secondRequestBody.tabGroupId).toBe(firstRequestBody.tabGroupId)
    expect(secondRequestBody.model).toBe(DEFAULT_CLAUDE_MODEL)
    expect(secondRequestBody.workspace).toBe(user.workspace)

    expect(secondResponse.status()).toBe(200)
    await waitForStreamComplete(page)

    const secondNDJSON = await secondResponse.text()
    const secondAssistantText = extractAssistantTextFromNDJSON(secondNDJSON)
    annotate("turn2", secondAssistantText.slice(0, 120))

    // Context retention: turn 2 must recall the secret from turn 1
    expect(await llmVerify(secondAssistantText, `Does this response contain or reference the code "${secret}"?`)).toBe(
      true,
    )
    annotate("context", `Secret ${secret} retained across turns`)
  })
})
