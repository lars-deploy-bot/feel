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
 * - ASK_LARS_KEY exported in environment
 */

import Anthropic from "@anthropic-ai/sdk"
import { expect, type Page, type Request, test } from "@playwright/test"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { PATTERNS, TEST_MESSAGES, TEST_MODELS } from "./fixtures/test-constants"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { getLiveStagingUser, getProjectBaseUrl, loginLiveStaging } from "./lib/live-tenant"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

/**
 * Type-safe chat request body
 */
interface ChatRequest {
  message: string
  tabId: string
  model: string
  workspace: string
}

/**
 * Type-safe error response
 */
interface ErrorResponse {
  ok: false
  error: string
  message: string
  category?: string
}

interface LLMJudgeResult {
  verdict: "PASS" | "FAIL"
  rationale: string
}

async function sendMessage(page: Page, message: string): Promise<void> {
  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill(message)
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await sendButton.click()
}

function parseChatRequest(request: Request): ChatRequest {
  const postData = request.postData()
  if (!postData) {
    throw new Error("Missing chat request payload")
  }
  return JSON.parse(postData) as ChatRequest
}

function getJudgeApiKey(): string {
  const key = process.env.ASK_LARS_KEY
  if (!key) {
    throw new Error("ASK_LARS_KEY is required for live staging E2E LLM judge")
  }
  return key
}

async function judgeContextRetention(firstAssistant: string, secondAssistant: string): Promise<LLMJudgeResult> {
  const client = new Anthropic({ apiKey: getJudgeApiKey() })

  const evaluationPrompt = `
Evaluate whether the second assistant response preserves the core meaning of the first assistant response.

Rules:
- PASS if the second response accurately recalls the first response's main idea.
- FAIL if it contradicts, misses, or invents a different idea.
- Ignore style differences.

Return format (strict):
First line must be exactly PASS or FAIL.
Second line must be a short rationale (max 25 words).

First assistant response:
"""${firstAssistant}"""

Second assistant response:
"""${secondAssistant}"""
`.trim()

  const result = await client.messages.create({
    model: TEST_MODELS.HAIKU,
    max_tokens: 120,
    temperature: 0,
    messages: [{ role: "user", content: evaluationPrompt }],
  })

  const output = result.content
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n")
    .trim()

  const [rawVerdict = "", ...rest] = output.split("\n")
  const normalizedVerdict = rawVerdict.trim().toUpperCase()
  if (normalizedVerdict !== "PASS" && normalizedVerdict !== "FAIL") {
    throw new Error(`LLM judge returned unexpected verdict: ${output}`)
  }

  return {
    verdict: normalizedVerdict,
    rationale: rest.join(" ").trim() || "No rationale provided",
  }
}

test.describe("Chat API - Request Validation", () => {
  test("can send message without INVALID_REQUEST error", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    // Verify chat interface is ready (using data-testids)
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible()

    // Type a simple message (using constant, not hardcoded)
    const messageInput = page.locator('[data-testid="message-input"]')
    await messageInput.fill(TEST_MESSAGES.SIMPLE)

    // Setup request/response promises BEFORE clicking send (event-based approach)
    const requestPromise = page.waitForRequest(isClaudeStreamPostRequest)

    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    // Get the captured request and response
    await sendMessage(page, TEST_MESSAGES.SIMPLE)
    const request = await requestPromise
    const response = await responsePromise

    // Parse request body (type-safe)
    const postData = request.postData()
    expect(postData).toBeTruthy()

    const requestBody: ChatRequest = JSON.parse(postData!)
    console.log("📤 Request body:", requestBody)

    // Verify request structure (using constants)
    expect(requestBody.message).toBe(TEST_MESSAGES.SIMPLE)
    expect(requestBody.tabId).toMatch(PATTERNS.UUID)
    expect(requestBody.model).toBe(TEST_MODELS.HAIKU)
    expect(requestBody.workspace).toBe(user.workspace)
    console.log("✅ Request structure valid")

    // Verify response status
    const responseStatus = response.status()
    console.log("📥 Response status:", responseStatus)

    // If error response, parse and fail explicitly
    if (responseStatus !== 200) {
      const errorBody: ErrorResponse = await response.json()
      console.error("❌ Error response:", errorBody)

      if (errorBody.error === "INVALID_REQUEST") {
        throw new Error(`INVALID_REQUEST error: ${errorBody.message}`)
      }

      throw new Error(`API error (${responseStatus}): ${errorBody.error} - ${errorBody.message}`)
    }

    // Verify user message appears in UI
    // Note: Using data-testid would be better, but getByText is acceptable for message content
    await expect(page.getByText(TEST_MESSAGES.SIMPLE).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.slow,
    })
    console.log("✅ User message displayed")

    // Verify Claude starts thinking (using data-testid, not brittle text selector)
    await expect(page.locator('[data-testid="thinking-indicator"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.slow,
    })
    console.log("✅ Claude response started (no INVALID_REQUEST error)")

    console.log("✅ Test passed - chat works without INVALID_REQUEST error")
  })

  test("handles insufficient tokens gracefully", async ({ page }) => {
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    const responsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, TEST_MESSAGES.SIMPLE)

    const response = await responsePromise
    const status = response.status()

    // Test should handle both success (200) and insufficient tokens (402/403)
    // This makes the test resilient to credit/token availability
    if (status === 200) {
      console.log("✅ Request succeeded (user has credits)")
    } else if (status === 402 || status === 403) {
      const errorBody: ErrorResponse = await response.json()
      console.log("✅ Request blocked due to insufficient tokens (expected):", errorBody.error)
      expect(errorBody.error).toMatch(/INSUFFICIENT_TOKENS|TEST_MODE_BLOCK/)
    } else {
      throw new Error(`Unexpected status ${status}`)
    }
  })

  test("real two-turn context retention (LLM-verified)", async ({ page }) => {
    test.setTimeout(120000)
    const user = await getLiveStagingUser(test.info().workerIndex, getProjectBaseUrl(test.info()))
    await loginLiveStaging(page, user)

    await expect(page.locator('[data-testid="message-input"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    const firstPrompt =
      "In 2 short sentences, explain one practical reason E2E tests prevent regressions. Be concrete and concise."
    const secondPrompt =
      "What did you just explain in your previous answer? Restate the same core idea in one sentence."

    const firstRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const firstResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, firstPrompt)

    const firstRequest = await firstRequestPromise
    const firstResponse = await firstResponsePromise
    const firstRequestBody = parseChatRequest(firstRequest)

    expect(firstRequestBody.message).toBe(firstPrompt)
    expect(firstRequestBody.tabId).toMatch(PATTERNS.UUID)
    expect(firstRequestBody.model).toBe(TEST_MODELS.HAIKU)
    expect(firstRequestBody.workspace).toBe(user.workspace)
    expect(firstResponse.status()).toBe(200)

    const firstNDJSON = await firstResponse.text()
    const firstAssistantText = extractAssistantTextFromNDJSON(firstNDJSON)
    expect(firstAssistantText.length).toBeGreaterThan(20)

    const secondRequestPromise = page.waitForRequest(isClaudeStreamPostRequest)
    const secondResponsePromise = page.waitForResponse(isClaudeStreamPostResponse)

    await sendMessage(page, secondPrompt)

    const secondRequest = await secondRequestPromise
    const secondResponse = await secondResponsePromise
    const secondRequestBody = parseChatRequest(secondRequest)

    expect(secondRequestBody.message).toBe(secondPrompt)
    expect(secondRequestBody.tabId).toBe(firstRequestBody.tabId)
    expect(secondRequestBody.model).toBe(TEST_MODELS.HAIKU)
    expect(secondRequestBody.workspace).toBe(user.workspace)
    expect(secondResponse.status()).toBe(200)

    const secondNDJSON = await secondResponse.text()
    const secondAssistantText = extractAssistantTextFromNDJSON(secondNDJSON)
    expect(secondAssistantText.length).toBeGreaterThan(10)

    const judgeResult = await judgeContextRetention(firstAssistantText, secondAssistantText)
    console.log(`[LLM Judge] verdict=${judgeResult.verdict}; rationale=${judgeResult.rationale}`)
    expect(judgeResult.verdict).toBe("PASS")
  })
})
