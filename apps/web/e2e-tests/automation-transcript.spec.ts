import { randomUUID } from "node:crypto"
import type { APIRequestContext, APIResponse, Page, Response as PageResponse, Request } from "@playwright/test"
import type { Req, Res } from "@/lib/api/schemas"
import { apiSchemas, validateRequest } from "@/lib/api/schemas"
import {
  type CleanupAutomationTranscriptRequest,
  CleanupAutomationTranscriptRequestSchema,
  CleanupAutomationTranscriptResponseSchema,
  SeedAutomationTranscriptRequestSchema,
  type SeedAutomationTranscriptResponse,
  SeedAutomationTranscriptResponseSchema,
} from "@/lib/testing/e2e-automation-transcript"
import { expect, test } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { gotoChatFast, waitForChatReady } from "./helpers/assertions"
import { buildE2ETestHeaders } from "./lib/test-headers"

async function ensureConversationSidebarOpen(authenticatedPage: Page): Promise<void> {
  const sidebar = authenticatedPage.locator('aside[aria-label="Conversation history"]').first()

  // Check if the sidebar is already expanded by looking for a visible "Open sidebar" button.
  // When expanded, this button has w-0/opacity-0, so it's hidden.
  const openSidebarButton = authenticatedPage.locator('button[aria-label="Open sidebar"]').first()
  const isButtonVisible = await openSidebarButton.isVisible({ timeout: 1000 }).catch(() => false)
  if (isButtonVisible) {
    await openSidebarButton.click()
    await authenticatedPage.waitForTimeout(500)
  }

  // Automation conversations appear under the collapsed "Agents" section — expand it
  const agentsSection = sidebar.getByText("Agents", { exact: false }).first()
  if (await agentsSection.isVisible({ timeout: 2000 }).catch(() => false)) {
    await agentsSection.click()
    await authenticatedPage.waitForTimeout(300)
  }
}

async function readJsonOrThrow<T>(
  response: APIResponse,
  context: string,
  parser: { parse: (value: unknown) => T },
): Promise<T> {
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok()) {
    throw new Error(`[${context}] ${response.status()} ${response.statusText()} ${JSON.stringify(payload)}`)
  }
  return parser.parse(payload)
}

async function createAutomationJob(
  request: APIRequestContext,
  siteId: string,
): Promise<Res<"automations/create">["automation"]> {
  const name = `e2e-auto-${Date.now()}-${randomUUID().slice(0, 8)}`
  const body: Req<"automations/create"> = validateRequest("automations/create", {
    site_id: siteId,
    name,
    trigger_type: "webhook",
    action_type: "prompt",
    action_prompt: "Seeded e2e automation transcript",
    is_active: true,
  })

  const response = await request.post("/api/automations", { data: body })
  const created = await readJsonOrThrow(response, "automations/create", apiSchemas["automations/create"].res)
  return created.automation
}

async function seedAutomationTranscript(
  request: APIRequestContext,
  jobId: string,
): Promise<SeedAutomationTranscriptResponse["seed"] | null> {
  const body = SeedAutomationTranscriptRequestSchema.parse({
    jobId,
    initialMessage: "Starting automation...",
  })

  const response = await request.post("/api/test/seed-automation-transcript", {
    headers: buildE2ETestHeaders(),
    data: body,
  })

  if (response.status() === 404) {
    return null
  }

  const payload = await readJsonOrThrow(response, "seed-automation-transcript", SeedAutomationTranscriptResponseSchema)
  return payload.seed
}

async function cleanupAutomationTranscript(
  request: APIRequestContext,
  handles: CleanupAutomationTranscriptRequest,
): Promise<void> {
  const cleanupBody = CleanupAutomationTranscriptRequestSchema.parse({
    jobId: handles.jobId,
    runId: handles.runId,
    conversationId: handles.conversationId,
    tabId: handles.tabId,
  })

  const cleanupResponse = await request.delete("/api/test/seed-automation-transcript", {
    headers: buildE2ETestHeaders(),
    data: cleanupBody,
    timeout: 20_000,
  })

  if (cleanupResponse.status() === 404) {
    const jobDeleteResponse = await request.delete(`/api/automations/${handles.jobId}`, {
      timeout: 20_000,
    })
    if (!jobDeleteResponse.ok() && jobDeleteResponse.status() !== 404) {
      const payload: unknown = await jobDeleteResponse.json().catch(() => null)
      throw new Error(
        `[cleanup automation job] ${jobDeleteResponse.status()} ${jobDeleteResponse.statusText()} ${JSON.stringify(payload)}`,
      )
    }
    return
  }

  if (!cleanupResponse.ok()) {
    const payload: unknown = await cleanupResponse.json().catch(() => null)
    throw new Error(
      `[cleanup transcript] ${cleanupResponse.status()} ${cleanupResponse.statusText()} ${JSON.stringify(payload)}`,
    )
  }

  const cleanupPayload: unknown = await cleanupResponse.json().catch(() => null)
  CleanupAutomationTranscriptResponseSchema.parse(cleanupPayload)

  const jobDeleteResponse = await request.delete(`/api/automations/${handles.jobId}`, { timeout: 20_000 })
  if (!jobDeleteResponse.ok() && jobDeleteResponse.status() !== 404) {
    const payload: unknown = await jobDeleteResponse.json().catch(() => null)
    throw new Error(
      `[cleanup automation job] ${jobDeleteResponse.status()} ${jobDeleteResponse.statusText()} ${JSON.stringify(payload)}`,
    )
  }
}

test.describe("Automation Transcript Read-Only UX", () => {
  test("shows read-only bar and hides ChatInput for automation conversations", async ({
    authenticatedPage,
    workerTenant,
  }) => {
    const automationJob = await createAutomationJob(authenticatedPage.request, workerTenant.siteId)
    const seed = await seedAutomationTranscript(authenticatedPage.request, automationJob.id)
    if (!seed) {
      await authenticatedPage.request.delete(`/api/automations/${automationJob.id}`)
      test.skip(true, "Requires /api/test/seed-automation-transcript in target environment.")
      return
    }

    const handles = {
      jobId: automationJob.id,
      runId: seed.runId,
      conversationId: seed.conversationId,
      tabId: seed.tabId,
    }

    try {
      // Navigate and wait for the app to be ready — don't wait for an intermediate
      // HTTP response. The conversation appearing in the sidebar IS the sync proof.
      await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)
      await waitForChatReady(authenticatedPage)

      // Open sidebar and find the automation conversation
      await ensureConversationSidebarOpen(authenticatedPage)
      const sidebar = authenticatedPage.locator('aside[aria-label="Conversation history"]').first()
      const automationConversation = sidebar.getByText(seed.title, { exact: true })
      await expect(automationConversation).toBeVisible({ timeout: TEST_TIMEOUTS.max })
      await automationConversation.click()

      // Wait for the automation tab to load
      await expect(authenticatedPage.getByRole("tab", { name: "Run" })).toBeVisible({
        timeout: TEST_TIMEOUTS.max,
      })

      // Assert: read-only bar is visible
      const readonlyBar = authenticatedPage.locator('[data-testid="readonly-transcript-bar"]')
      await expect(readonlyBar).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
      await expect(readonlyBar).toContainText("Read-only automation transcript")

      // Assert: ChatInput is NOT present
      const messageInput = authenticatedPage.locator('[data-testid="message-input"]')
      await expect(messageInput).not.toBeVisible()

      // Assert: the seeded message is displayed. Transcript messages arrive via
      // the automation poller, so this follows the slower data path.
      await expect(authenticatedPage.getByText(seed.initialMessage).first()).toBeVisible({
        timeout: TEST_TIMEOUTS.max,
      })
    } finally {
      await cleanupAutomationTranscript(authenticatedPage.request, handles)
    }
  })

  test("toggles between read-only and editable when switching conversations", async ({
    authenticatedPage,
    workerTenant,
  }, testInfo) => {
    // Keep timeout strict; the selector flow is deterministic via ensureConversationSidebarOpen().
    testInfo.setTimeout(120_000)
    const automationJob = await createAutomationJob(authenticatedPage.request, workerTenant.siteId)
    const seed = await seedAutomationTranscript(authenticatedPage.request, automationJob.id)
    if (!seed) {
      await authenticatedPage.request.delete(`/api/automations/${automationJob.id}`)
      test.skip(true, "Requires /api/test/seed-automation-transcript in target environment.")
      return
    }

    const handles: CleanupAutomationTranscriptRequest = {
      jobId: automationJob.id,
      runId: seed.runId,
      conversationId: seed.conversationId,
      tabId: seed.tabId,
    }

    try {
      await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)
      await waitForChatReady(authenticatedPage)

      // The default landing is a fresh chat tab — should have ChatInput
      const messageInput = authenticatedPage.locator('[data-testid="message-input"]')
      const readonlyBar = authenticatedPage.locator('[data-testid="readonly-transcript-bar"]')

      // On fresh chat, ChatInput should be present and read-only bar absent
      await expect(messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
      await expect(readonlyBar).not.toBeVisible()

      // Switch to automation conversation via sidebar
      await ensureConversationSidebarOpen(authenticatedPage)
      const sidebar = authenticatedPage.locator('aside[aria-label="Conversation history"]').first()
      const automationConversation = sidebar.getByText(seed.title, { exact: true })
      await expect(automationConversation).toBeVisible({ timeout: TEST_TIMEOUTS.max })
      await automationConversation.click()

      // Now in automation conversation — read-only bar visible, ChatInput hidden
      await expect(readonlyBar).toBeVisible({ timeout: TEST_TIMEOUTS.max })
      await expect(messageInput).not.toBeVisible()

      // Switch back to a new regular conversation via "New Chat" in sidebar.
      await ensureConversationSidebarOpen(authenticatedPage)
      const newChatButton = sidebar.getByRole("button", { name: "New chat" })
      await expect(newChatButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
      await newChatButton.click()

      // Back in regular chat — ChatInput visible, read-only bar hidden
      await expect(messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.max })
      await expect(readonlyBar).not.toBeVisible()
    } finally {
      await cleanupAutomationTranscript(authenticatedPage.request, handles)
    }
  })
})

test.describe("Automation Transcript Polling", () => {
  test("polls transcript and run-status endpoints while an automation run is open", async ({
    authenticatedPage,
    workerTenant,
  }) => {
    const automationJob = await createAutomationJob(authenticatedPage.request, workerTenant.siteId)
    const seed = await seedAutomationTranscript(authenticatedPage.request, automationJob.id)
    if (!seed) {
      await authenticatedPage.request.delete(`/api/automations/${automationJob.id}`)
      test.skip(true, "Requires /api/test/seed-automation-transcript in target environment.")
      return
    }

    const handles: CleanupAutomationTranscriptRequest = {
      jobId: automationJob.id,
      runId: seed.runId,
      conversationId: seed.conversationId,
      tabId: seed.tabId,
    }

    let tabMessagePollCount = 0
    let runStatusPollCount = 0
    const endpointErrors: string[] = []

    const onRequest = (request: Request) => {
      const url = new URL(request.url())
      const isMessageEndpoint =
        url.pathname === "/api/conversations/messages" && url.searchParams.get("tabId") === seed.tabId
      if (isMessageEndpoint) {
        tabMessagePollCount += 1
        return
      }

      if (url.pathname === `/api/automations/${automationJob.id}/runs/${seed.runId}`) {
        runStatusPollCount += 1
      }
    }

    const onResponse = (response: PageResponse) => {
      const url = new URL(response.url())
      const isTargetResponse =
        (url.pathname === "/api/conversations/messages" && url.searchParams.get("tabId") === seed.tabId) ||
        url.pathname === `/api/automations/${automationJob.id}/runs/${seed.runId}`

      if (isTargetResponse && response.status() >= 400) {
        endpointErrors.push(`${url.pathname} -> ${response.status()}`)
      }
    }

    authenticatedPage.on("request", onRequest)
    authenticatedPage.on("response", onResponse)

    try {
      await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)
      await waitForChatReady(authenticatedPage)

      await ensureConversationSidebarOpen(authenticatedPage)
      const sidebar = authenticatedPage.locator('aside[aria-label="Conversation history"]').first()
      const automationConversation = sidebar.getByText(seed.title, { exact: true })
      await expect(automationConversation).toBeVisible({ timeout: TEST_TIMEOUTS.max })
      await automationConversation.click()

      await expect(authenticatedPage.getByRole("tab", { name: "Run" })).toBeVisible({ timeout: TEST_TIMEOUTS.max })
      await expect(authenticatedPage.getByText(seed.initialMessage).first()).toBeVisible({ timeout: TEST_TIMEOUTS.max })

      const baselineMessagePolls = tabMessagePollCount
      await expect
        .poll(() => tabMessagePollCount - baselineMessagePolls, { timeout: TEST_TIMEOUTS.max })
        .toBeGreaterThanOrEqual(2)

      await expect.poll(() => runStatusPollCount, { timeout: TEST_TIMEOUTS.max }).toBeGreaterThan(0)
      expect(endpointErrors).toEqual([])
    } finally {
      authenticatedPage.off("request", onRequest)
      authenticatedPage.off("response", onResponse)
      await cleanupAutomationTranscript(authenticatedPage.request, handles)
    }
  })
})
