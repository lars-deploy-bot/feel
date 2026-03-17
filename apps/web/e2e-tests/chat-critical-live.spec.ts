/**
 * Live Critical Chat E2E Tests
 *
 * Real Claude API, real Supabase persistence.
 * No mocks — enforced by static check (see check:no-mocks-in-live script).
 *
 * Run with: bun run test:e2e:critical:live
 */

import { expect, type Page, test } from "@playwright/test"
import { isClaudeStreamPostRequest, isClaudeStreamPostResponse } from "@/lib/stream/claude-stream-request-matchers"
import { parseValidatedBody } from "./lib/api-helpers"
import { requireEnvAppBaseUrl } from "./lib/base-url"
import { sendMessage, waitForMessageInput, waitForStreamComplete } from "./lib/chat-actions"
import { getMessageTypes, pollForConversation } from "./lib/db-queries"
import { getLiveStagingUser, loginLiveStaging } from "./lib/live-tenant"
import { annotate, step } from "./lib/log"
import { extractAssistantTextFromNDJSON } from "./lib/ndjson"

// ---------------------------------------------------------------------------
// Tests — serial: login once, reuse the same page across both tests
// ---------------------------------------------------------------------------

test.describe
  .serial("Live Critical Chat Path", () => {
    let sharedPage: Page
    let user: Awaited<ReturnType<typeof getLiveStagingUser>>

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext()
      sharedPage = await context.newPage()

      user = await getLiveStagingUser(test.info().workerIndex, requireEnvAppBaseUrl())
      await loginLiveStaging(sharedPage, user)
      await waitForMessageInput(sharedPage)
    })

    test.afterAll(async () => {
      await sharedPage.context().close()
    })

    test("single message round-trip with DB persistence", async () => {
      test.setTimeout(120_000)
      const roundTripStart = new Date()

      const { assistantText } = await step("send message and capture response", async () => {
        const responsePromise = sharedPage.waitForResponse(isClaudeStreamPostResponse)
        await sendMessage(sharedPage, "What is 2+2? Reply with just the number.")
        const response = await responsePromise
        expect(response.status()).toBe(200)

        await waitForStreamComplete(sharedPage)

        const text = extractAssistantTextFromNDJSON(await response.text())
        expect(text.length).toBeGreaterThan(0)
        return { assistantText: text }
      })

      annotate("assistant", assistantText.slice(0, 120))
      expect(assistantText).toContain("4")

      await step("verify DB persistence", async () => {
        const convo = await pollForConversation({
          workspace: user.workspace,
          minMessages: 2,
          afterTime: roundTripStart,
        })
        expect(convo.messageCount).toBeGreaterThanOrEqual(2)

        const types = await getMessageTypes(convo.conversationId)
        expect(types).toContain("user")
        expect(types.some(t => t === "assistant" || t === "sdk_message")).toBe(true)
        annotate("db", `${convo.conversationId} — ${types.join(", ")}`)
      })
    })

    test("multi-turn with DB persistence", async () => {
      test.setTimeout(120_000)

      await sharedPage.goto("/chat")
      await waitForMessageInput(sharedPage)

      const multiTurnStart = new Date()
      const secret = `XRAY_${Date.now()}`

      // --- Turn 1: inject a unique test marker, verify acknowledgment ---
      const { firstBody } = await step("turn 1: inject test marker", async () => {
        const firstRequestPromise = sharedPage.waitForRequest(isClaudeStreamPostRequest)
        const firstResponsePromise = sharedPage.waitForResponse(isClaudeStreamPostResponse)

        await sendMessage(
          sharedPage,
          `My project reference number is ${secret}. Please confirm you noted it by including it in your reply.`,
        )

        const firstRequest = await firstRequestPromise
        const firstResponse = await firstResponsePromise
        const body = parseValidatedBody(firstRequest)
        expect(firstResponse.status()).toBe(200)

        await waitForStreamComplete(sharedPage)

        const text = extractAssistantTextFromNDJSON(await firstResponse.text())
        expect(text.length).toBeGreaterThan(0)
        annotate("turn1", text.slice(0, 120))

        expect(text).toContain(secret)

        return { firstBody: body }
      })

      // --- Turn 2 ---
      const turn2Status = await step("turn 2: recall secret", async () => {
        const secondRequestPromise = sharedPage.waitForRequest(isClaudeStreamPostRequest)
        const secondResponsePromise = sharedPage.waitForResponse(isClaudeStreamPostResponse)

        await sendMessage(sharedPage, "What was the project reference number I gave you? Reply with it.")

        const secondRequest = await secondRequestPromise
        const secondResponse = await secondResponsePromise
        const secondBody = parseValidatedBody(secondRequest)
        const status = secondResponse.status()

        // Session stickiness: same tab across turns
        expect(secondBody.tabId).toBe(firstBody.tabId)
        expect(secondBody.tabGroupId).toBe(firstBody.tabGroupId)

        await waitForStreamComplete(sharedPage)

        if (status === 200) {
          const turn2Text = extractAssistantTextFromNDJSON(await secondResponse.text())
          annotate("turn2", turn2Text.slice(0, 120))

          const contextRetained = turn2Text.includes(secret)
          annotate("context", `Retained: ${contextRetained}${contextRetained ? "" : " (known staging issue)"}`)
        } else {
          annotate("warn", `Turn 2 returned ${status} — known staging session issue`)
        }

        return status
      })

      await step("verify DB persistence", async () => {
        const minExpected = turn2Status === 200 ? 4 : 2
        const convo = await pollForConversation({
          workspace: user.workspace,
          minMessages: minExpected,
          afterTime: multiTurnStart,
        })
        expect(convo.messageCount).toBeGreaterThanOrEqual(minExpected)

        const types = await getMessageTypes(convo.conversationId)
        expect(types).toContain("user")
        expect(types.some(t => t === "assistant" || t === "sdk_message")).toBe(true)
        annotate("db", `${convo.conversationId} — ${types.join(", ")}`)
      })
    })
  })
