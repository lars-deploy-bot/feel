import { expect, test } from "./fixtures"
import { TEST_TIMEOUTS } from "./fixtures/test-data"
import { gotoChatFast, waitForChatReady } from "./helpers/assertions"
import { buildJsonMockResponse } from "./lib/strict-api-guard"

test.describe("Automation Transcript Polling", () => {
  test("new messages appear in real-time when viewing automation run", async ({ authenticatedPage, workerTenant }) => {
    const JOB_ID = "test-job-e2e"
    const RUN_ID = "test-run-e2e"
    const TAB_ID = "test-auto-tab"
    const CONV_ID = "test-auto-conv"
    const now = Date.now()

    let messageFetchCount = 0
    let messageFetchCountAfterReady = 0
    let runStatusCheckCount = 0
    let allowTranscriptGrowth = false

    // One automation conversation in sidebar.
    await authenticatedPage.route("**/api/conversations?*", async route => {
      await route.fulfill(
        buildJsonMockResponse({
          own: [
            {
              id: CONV_ID,
              workspace: workerTenant.workspace,
              orgId: workerTenant.orgId,
              creatorId: workerTenant.userId,
              title: "[Auto] Test Job",
              visibility: "private",
              messageCount: 1,
              lastMessageAt: now,
              firstUserMessageId: null,
              autoTitleSet: true,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              archivedAt: null,
              source: "automation_run",
              sourceMetadata: {
                job_id: JOB_ID,
                claim_run_id: RUN_ID,
                triggered_by: "manual",
              },
              tabs: [
                {
                  id: TAB_ID,
                  conversationId: CONV_ID,
                  name: "Run",
                  position: 0,
                  messageCount: 1,
                  lastMessageAt: now,
                  createdAt: now,
                  closedAt: null,
                },
              ],
            },
          ],
          shared: [],
        }),
      )
    })

    // Evolving transcript messages for the automation tab only.
    await authenticatedPage.route("**/api/conversations/messages?*", async route => {
      const requestUrl = new URL(route.request().url())
      const tabId = requestUrl.searchParams.get("tabId")

      if (tabId !== TAB_ID) {
        await route.fulfill(buildJsonMockResponse({ messages: [], hasMore: false, nextCursor: null }))
        return
      }

      messageFetchCount++
      if (allowTranscriptGrowth) {
        messageFetchCountAfterReady++
      }

      const messages = [
        {
          id: "msg-1",
          tabId: TAB_ID,
          type: "sdk_message",
          content: {
            kind: "sdk_message",
            data: {
              type: "assistant",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "Starting automation..." }],
              },
            },
          },
          version: 1,
          status: "complete",
          seq: 1,
          abortedAt: null,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
        },
        ...(allowTranscriptGrowth && messageFetchCountAfterReady >= 2
          ? [
              {
                id: "msg-2",
                tabId: TAB_ID,
                type: "sdk_message",
                content: {
                  kind: "sdk_message",
                  data: {
                    type: "assistant",
                    message: {
                      role: "assistant",
                      content: [{ type: "text", text: "Task completed successfully" }],
                    },
                  },
                },
                version: 1,
                status: "complete",
                seq: 2,
                abortedAt: null,
                errorCode: null,
                createdAt: now + 5_000,
                updatedAt: now + 5_000,
              },
            ]
          : []),
      ]

      await route.fulfill(buildJsonMockResponse({ messages, hasMore: false, nextCursor: null }))
    })

    // Run status API used by polling hook (checked every ~10s).
    await authenticatedPage.route(`**/api/automations/${JOB_ID}/runs/${RUN_ID}*`, async route => {
      runStatusCheckCount++
      await route.fulfill(
        buildJsonMockResponse({
          run: {
            id: RUN_ID,
            job_id: JOB_ID,
            started_at: new Date(now).toISOString(),
            completed_at: null,
            duration_ms: null,
            status: "running",
            error: null,
            result: null,
            triggered_by: "manual",
            changes_made: [],
            messages: [],
          },
        }),
      )
    })

    await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)
    await waitForChatReady(authenticatedPage)

    // Sidebar defaults closed in E2E app state.
    const openSidebarButton = authenticatedPage.locator('button[aria-label="Open sidebar"]')
    await expect(openSidebarButton).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
    await openSidebarButton.click()

    const desktopSidebar = authenticatedPage.locator('aside[aria-label="Conversation history"]').first()
    const autoConversation = desktopSidebar.getByText("[Auto] Test Job")
    await expect(autoConversation.first()).toBeVisible({ timeout: TEST_TIMEOUTS.max })
    await autoConversation.first().click()

    // Trigger explicit tab-select path to force per-tab lazy message load.
    const selectedTab = authenticatedPage.locator('[data-testid="tab-bar"] [role="tab"][aria-selected="true"]').first()
    await expect(selectedTab).toBeVisible({ timeout: TEST_TIMEOUTS.medium })
    await selectedTab.click()

    await expect.poll(() => messageFetchCount, { timeout: TEST_TIMEOUTS.max }).toBeGreaterThan(0)

    await expect(authenticatedPage.getByText("Starting automation...").first()).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    // From here on, no further user actions. Additional fetches should come from polling.
    allowTranscriptGrowth = true

    await expect.poll(() => messageFetchCountAfterReady, { timeout: TEST_TIMEOUTS.max }).toBeGreaterThanOrEqual(2)

    await expect(authenticatedPage.getByText("Task completed successfully").first()).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    // Validate both polling dimensions: message polling and run status checks.
    expect(messageFetchCountAfterReady).toBeGreaterThanOrEqual(2)
    await expect.poll(() => runStatusCheckCount, { timeout: TEST_TIMEOUTS.max }).toBeGreaterThan(0)
  })
})
