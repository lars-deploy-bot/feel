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
 * @see https://github.com/lars-deploy-bot/feel/issues/185
 */

import { BridgeStreamType } from "@/features/chat/lib/streaming/ndjson"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import type { ValidatedBody } from "@/types/guards/api"
import { expect, test } from "./fixtures"
import { TEST_API, TEST_TIMEOUTS } from "./fixtures/test-data"
import { parseValidatedBody } from "./lib/api-helpers"
import { parseNDJSONEventTypes } from "./lib/ndjson"
import { StreamBuilder } from "./lib/stream-builder"
import { ChatPage } from "./pages/ChatPage"

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
    const capturedRequestBodies: ValidatedBody[] = []

    await authenticatedPage.route(`**${TEST_API.CLAUDE_STREAM}`, async route => {
      const request = route.request()
      expect(isClaudeStreamPostRequest(request)).toBe(true)
      const requestBody = parseValidatedBody(request)
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
    const responsePromise = authenticatedPage.waitForResponse(isClaudeStreamPostResponse)
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

    const capturedRequestBodies: ValidatedBody[] = []

    await authenticatedPage.route(`**${TEST_API.CLAUDE_STREAM}`, async route => {
      const request = route.request()
      expect(isClaudeStreamPostRequest(request)).toBe(true)
      const requestBody = parseValidatedBody(request)
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
    const firstResponsePromise = authenticatedPage.waitForResponse(isClaudeStreamPostResponse)
    await chat.sendMessage(firstUserMessage)
    const firstResponse = await firstResponsePromise
    await chat.expectMessage(firstUserMessage)
    await chat.expectMessage(firstAssistantResponse)

    // Verify stream complete: send button re-enabled
    await chat.messageInput.fill("ready")
    await chat.expectSendButtonEnabled()
    await chat.messageInput.fill("") // clear before sending the real message

    // --- Turn 2: verify context retained ---
    const secondResponsePromise = authenticatedPage.waitForResponse(isClaudeStreamPostResponse)
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

  test("stream response matcher ignores reconnect and cancel endpoints", async ({
    authenticatedPage,
    workerTenant,
  }) => {
    const userMessage = "Matcher guard test"
    const assistantResponse = "Stream endpoint matched correctly."

    let reconnectCallCount = 0
    let cancelCallCount = 0

    await authenticatedPage.route(`**${TEST_API.CLAUDE_STREAM_RECONNECT}`, async route => {
      reconnectCallCount += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    })

    await authenticatedPage.route(`**${TEST_API.CLAUDE_STREAM_CANCEL}`, async route => {
      cancelCallCount += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    })

    await authenticatedPage.route(`**${TEST_API.CLAUDE_STREAM}`, async route => {
      const request = route.request()
      expect(isClaudeStreamPostRequest(request)).toBe(true)
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
    await expect(chat.messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.medium })

    // Reconnect can be called by background stream-recovery hooks on mount.
    // Capture baseline counts so this test only asserts the manual calls happened.
    const reconnectCountBeforeManualCall = reconnectCallCount
    const cancelCountBeforeManualCall = cancelCallCount

    const responsePromise = authenticatedPage.waitForResponse(isClaudeStreamPostResponse)

    const manualEndpointStatuses = await authenticatedPage.evaluate(
      async ({ cancelPath, reconnectPath }) => {
        const [reconnectResponse, cancelResponse] = await Promise.all([
          fetch(reconnectPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: "test", sinceTimestamp: Date.now() }),
          }),
          fetch(cancelPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId: "test" }),
          }),
        ])

        return {
          cancelStatus: cancelResponse.status,
          reconnectStatus: reconnectResponse.status,
        }
      },
      {
        cancelPath: TEST_API.CLAUDE_STREAM_CANCEL,
        reconnectPath: TEST_API.CLAUDE_STREAM_RECONNECT,
      },
    )

    expect(manualEndpointStatuses.reconnectStatus).toBe(200)
    expect(manualEndpointStatuses.cancelStatus).toBe(200)
    expect(reconnectCallCount).toBeGreaterThanOrEqual(reconnectCountBeforeManualCall + 1)
    expect(cancelCallCount).toBeGreaterThanOrEqual(cancelCountBeforeManualCall + 1)

    await chat.sendMessage(userMessage)
    const response = await responsePromise

    expect(new URL(response.url()).pathname).toBe(TEST_API.CLAUDE_STREAM)
    await chat.expectMessage(userMessage)
    await chat.expectMessage(assistantResponse)
  })
})
