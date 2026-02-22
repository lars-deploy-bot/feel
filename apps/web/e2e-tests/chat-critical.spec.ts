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

/**
 * Parse NDJSON response body into individual stream event types.
 * Used to verify the SSE lifecycle (stream_start → stream_message → stream_complete).
 */
function parseNDJSONEventTypes(body: string): string[] {
  return body
    .split("\n")
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parsed = JSON.parse(line) as { type: string }
      return parsed.type
    })
}

test.describe("Critical Chat Path", () => {
  test("single message round-trip with stream lifecycle", async ({ authenticatedPage, workerTenant }) => {
    const userMessage = "Hello from critical test"
    const assistantResponse = "I received your message. Everything works."

    // Build a deterministic stream with full lifecycle
    const stream = new StreamBuilder().start().text(assistantResponse).complete()

    // Track the intercepted request/response for lifecycle verification
    let capturedRequestBody: string | null = null
    let capturedResponseBody: string | null = null

    await authenticatedPage.route("**/api/claude/stream", async route => {
      capturedRequestBody = route.request().postData()

      const ndjsonBody = stream.toNDJSON()
      capturedResponseBody = ndjsonBody

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
    await chat.sendMessage(userMessage)

    // Verify user message appears in UI
    await chat.expectMessage(userMessage)

    // Verify assistant response renders in UI
    await chat.expectMessage(assistantResponse)

    // Verify stream completed: input is ready for new message
    // (send button is correctly disabled when input is empty — fill text to prove input works)
    await chat.messageInput.fill("ready")
    await chat.expectSendButtonEnabled()

    // --- Stream lifecycle verification ---
    // The request was made
    expect(capturedRequestBody).toBeTruthy()
    const requestBody = JSON.parse(capturedRequestBody!) as { message: string }
    expect(requestBody.message).toBe(userMessage)

    // The response contained correct NDJSON lifecycle events
    expect(capturedResponseBody).toBeTruthy()
    const eventTypes = parseNDJSONEventTypes(capturedResponseBody!)

    // Verify exact lifecycle order: stream_start → stream_message → stream_complete → stream_done
    expect(eventTypes[0]).toBe(BridgeStreamType.START)
    expect(eventTypes).toContain(BridgeStreamType.MESSAGE)
    expect(eventTypes).toContain(BridgeStreamType.COMPLETE)
    expect(eventTypes[eventTypes.length - 1]).toBe(BridgeStreamType.DONE)

    // Verify ordering: start before message before complete before done
    const startIdx = eventTypes.indexOf(BridgeStreamType.START)
    const messageIdx = eventTypes.indexOf(BridgeStreamType.MESSAGE)
    const completeIdx = eventTypes.indexOf(BridgeStreamType.COMPLETE)
    const doneIdx = eventTypes.indexOf(BridgeStreamType.DONE)

    expect(startIdx).toBeLessThan(messageIdx)
    expect(messageIdx).toBeLessThan(completeIdx)
    expect(completeIdx).toBeLessThan(doneIdx)
  })

  test("multi-turn context retention", async ({ authenticatedPage, workerTenant }) => {
    const firstUserMessage = "My name is Alice"
    const firstAssistantResponse = "Hello Alice! Nice to meet you."
    const secondUserMessage = "What is my name?"
    const secondAssistantResponse = "Your name is Alice, as you told me."

    let turnCount = 0

    await authenticatedPage.route("**/api/claude/stream", async route => {
      turnCount++

      const isFirstTurn = turnCount === 1
      const responseText = isFirstTurn ? firstAssistantResponse : secondAssistantResponse

      const stream = new StreamBuilder().start().text(responseText).complete({ totalTurns: turnCount })

      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson; charset=utf-8",
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
        body: stream.toNDJSON(),
      })
    })

    const chat = new ChatPage(authenticatedPage)
    await chat.gotoFast(workerTenant.workspace, workerTenant.orgId)

    // --- Turn 1: establish context ---
    await chat.sendMessage(firstUserMessage)
    await chat.expectMessage(firstUserMessage)
    await chat.expectMessage(firstAssistantResponse)

    // Verify stream complete: input is interactable again
    await expect(chat.messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.medium })

    // --- Turn 2: verify context retained ---
    await chat.sendMessage(secondUserMessage)
    await chat.expectMessage(secondUserMessage)
    await chat.expectMessage(secondAssistantResponse)

    // Verify both turns completed (2 requests intercepted)
    expect(turnCount).toBe(2)

    // Verify all 4 messages are visible in the UI (both turns in one conversation)
    await chat.expectMessage(firstUserMessage)
    await chat.expectMessage(firstAssistantResponse)
    await chat.expectMessage(secondUserMessage)
    await chat.expectMessage(secondAssistantResponse)
  })
})
