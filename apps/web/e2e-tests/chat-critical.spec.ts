/**
 * Critical Chat E2E Tests — Issue #185
 *
 * These are the golden tests for the core product promise:
 * "send a message, get a response." If these fail, the platform is broken.
 *
 * Rules:
 * - No test.skip. Ever.
 * - No time-based sleeps as synchronization.
 * - No real API calls (uses deterministic stream mocks).
 * - Must be idempotent and parallel-safe.
 * - Must pass 10 consecutive local runs without flake.
 *
 * Stream lifecycle verified: start → message → complete
 *
 * @see https://github.com/eenlars/alive/issues/185
 */

import { BridgeStreamType } from "@/features/chat/lib/streaming/ndjson"
import { expect, test } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { StreamBuilder } from "./lib/stream-builder"
import { ChatPage } from "./pages/ChatPage"

interface ChatStreamRequestBody {
  message: string
  tabId: string
  tabGroupId: string
  model: string
}

/**
 * Parse NDJSON response body into individual stream event types.
 * Used to verify the SSE lifecycle (stream_start → stream_message → stream_complete).
 */
function parseNDJSONEventTypes(body: string): string[] {
  return body
    .split("\n")
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed !== "object" || parsed === null || !("type" in parsed) || typeof parsed.type !== "string") {
        throw new Error(`Unexpected NDJSON event format: ${line}`)
      }
      return parsed.type
    })
}

function parseChatStreamRequestBody(rawBody: string | null): ChatStreamRequestBody {
  if (!rawBody) {
    throw new Error("Missing /api/claude/stream request body")
  }

  const parsed: unknown = JSON.parse(rawBody)
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid /api/claude/stream request payload")
  }

  const candidate = parsed as Record<string, unknown>
  const message = candidate.message
  const tabId = candidate.tabId
  const tabGroupId = candidate.tabGroupId
  const model = candidate.model

  if (typeof message !== "string" || message.length === 0) {
    throw new Error("Invalid /api/claude/stream payload: missing message")
  }
  if (typeof tabId !== "string" || tabId.length === 0) {
    throw new Error("Invalid /api/claude/stream payload: missing tabId")
  }
  if (typeof tabGroupId !== "string" || tabGroupId.length === 0) {
    throw new Error("Invalid /api/claude/stream payload: missing tabGroupId")
  }
  if (typeof model !== "string" || model.length === 0) {
    throw new Error("Invalid /api/claude/stream payload: missing model")
  }

  return { message, tabId, tabGroupId, model }
}

function expectLifecycleOrder(eventTypes: string[]): void {
  const startIdx = eventTypes.indexOf(BridgeStreamType.START)
  const messageIdx = eventTypes.indexOf(BridgeStreamType.MESSAGE)
  const completeIdx = eventTypes.indexOf(BridgeStreamType.COMPLETE)
  const doneIdx = eventTypes.indexOf(BridgeStreamType.DONE)

  expect(startIdx).toBeGreaterThanOrEqual(0)
  expect(messageIdx).toBeGreaterThanOrEqual(0)
  expect(completeIdx).toBeGreaterThanOrEqual(0)
  expect(doneIdx).toBeGreaterThanOrEqual(0)
  expect(startIdx).toBeLessThan(messageIdx)
  expect(messageIdx).toBeLessThan(completeIdx)
  expect(completeIdx).toBeLessThan(doneIdx)
}

test.describe("Critical Chat Path", () => {
  test("single message round-trip with stream lifecycle", async ({ authenticatedPage, workerTenant }) => {
    const userMessage = "Hello from critical test"
    const assistantResponse = "I received your message. Everything works."

    // Track request payloads for contract verification
    const capturedRequestBodies: ChatStreamRequestBody[] = []

    await authenticatedPage.route("**/api/claude/stream", async route => {
      const requestBody = parseChatStreamRequestBody(route.request().postData())
      capturedRequestBodies.push(requestBody)

      const ndjsonBody = new StreamBuilder().start().text(assistantResponse).complete().toNDJSON()

      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson; charset=utf-8",
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
        body: ndjsonBody,
      })
    })

    const chat = new ChatPage(authenticatedPage)
    await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

    // Verify chat interface is ready
    await expect(chat.messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
    await expect(chat.sendButton).toBeVisible({ timeout: TEST_TIMEOUTS.fast })

    // Send message
    const responsePromise = authenticatedPage.waitForResponse(
      response => response.url().includes("/api/claude/stream") && response.request().method() === "POST",
    )
    await chat.sendMessage(userMessage)
    const response = await responsePromise

    // Verify user message appears in UI
    await chat.expectMessage(userMessage)

    // Verify assistant response renders in UI
    await chat.expectMessage(assistantResponse)

    // Verify stream completed: input is ready for new message
    // (send button is correctly disabled when input is empty — fill text to prove input works)
    await chat.messageInput.fill("ready")
    await chat.expectSendButtonEnabled()

    // --- Stream lifecycle verification ---
    expect(capturedRequestBodies).toHaveLength(1)

    const firstRequest = capturedRequestBodies[0]
    if (!firstRequest) {
      throw new Error("Critical chat round-trip capture is incomplete")
    }

    expect(firstRequest.message).toBe(userMessage)

    const responseBody = await response.text()
    expectLifecycleOrder(parseNDJSONEventTypes(responseBody))
  })

  test("multi-turn context retention", async ({ authenticatedPage, workerTenant }) => {
    const firstUserMessage = "My name is Alice"
    const firstAssistantResponse = "Hello Alice! Nice to meet you."
    const secondUserMessage = "What is my name?"
    const secondAssistantResponse = "Your name is Alice, as you told me."

    const capturedRequestBodies: ChatStreamRequestBody[] = []

    await authenticatedPage.route("**/api/claude/stream", async route => {
      const requestBody = parseChatStreamRequestBody(route.request().postData())
      capturedRequestBodies.push(requestBody)

      const turnCount = capturedRequestBodies.length

      const isFirstTurn = turnCount === 1
      const responseText = isFirstTurn ? firstAssistantResponse : secondAssistantResponse

      const stream = new StreamBuilder().start().text(responseText).complete({ totalTurns: turnCount })
      const ndjsonBody = stream.toNDJSON()

      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson; charset=utf-8",
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
        body: ndjsonBody,
      })
    })

    const chat = new ChatPage(authenticatedPage)
    await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

    // --- Turn 1: establish context ---
    const firstResponsePromise = authenticatedPage.waitForResponse(
      response => response.url().includes("/api/claude/stream") && response.request().method() === "POST",
    )
    await chat.sendMessage(firstUserMessage)
    const firstResponse = await firstResponsePromise
    await chat.expectMessage(firstUserMessage)
    await chat.expectMessage(firstAssistantResponse)

    // Verify stream complete: send button re-enabled
    await chat.messageInput.fill("ready")
    await chat.expectSendButtonEnabled()
    await chat.messageInput.fill("") // clear before sending the real message

    // --- Turn 2: verify context retained ---
    const secondResponsePromise = authenticatedPage.waitForResponse(
      response => response.url().includes("/api/claude/stream") && response.request().method() === "POST",
    )
    await chat.sendMessage(secondUserMessage)
    const secondResponse = await secondResponsePromise
    await chat.expectMessage(secondUserMessage)
    await chat.expectMessage(secondAssistantResponse)

    // Verify both turns stayed in the SAME conversation key (tab ID and tab group ID)
    expect(capturedRequestBodies).toHaveLength(2)

    const firstRequest = capturedRequestBodies[0]
    const secondRequest = capturedRequestBodies[1]

    if (!firstRequest || !secondRequest) {
      throw new Error("Critical multi-turn capture is incomplete")
    }

    expect(firstRequest.message).toBe(firstUserMessage)
    expect(secondRequest.message).toBe(secondUserMessage)
    expect(secondRequest.tabId).toBe(firstRequest.tabId)
    expect(secondRequest.tabGroupId).toBe(firstRequest.tabGroupId)

    const firstResponseBody = await firstResponse.text()
    const secondResponseBody = await secondResponse.text()
    expectLifecycleOrder(parseNDJSONEventTypes(firstResponseBody))
    expectLifecycleOrder(parseNDJSONEventTypes(secondResponseBody))

    // Verify all 4 messages are visible in the UI (both turns in one conversation)
    await chat.expectMessage(firstUserMessage)
    await chat.expectMessage(firstAssistantResponse)
    await chat.expectMessage(secondUserMessage)
    await chat.expectMessage(secondAssistantResponse)
  })
})
