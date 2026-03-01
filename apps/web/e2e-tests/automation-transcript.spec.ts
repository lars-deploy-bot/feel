import { TAB_DATA_STORAGE_KEY, TAB_VIEW_STORAGE_KEY } from "@/lib/stores/storage-keys"
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
    let transcriptTabId: string | null = null

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

    // Evolving transcript messages for this tab only.
    await authenticatedPage.route("**/api/conversations/messages?*", async route => {
      const requestUrl = new URL(route.request().url())
      const tabId = requestUrl.searchParams.get("tabId")

      if (!tabId) {
        await route.fulfill(buildJsonMockResponse({ messages: [], hasMore: false, nextCursor: null }))
        return
      }

      // Lock to whichever tabId the UI uses first for this run.
      if (!transcriptTabId) {
        transcriptTabId = tabId
      }
      if (tabId !== transcriptTabId) {
        await route.fulfill(buildJsonMockResponse({ messages: [], hasMore: false, nextCursor: null }))
        return
      }

      messageFetchCount++
      const activeTabId = transcriptTabId

      const messages = [
        {
          id: "msg-1",
          tabId: activeTabId,
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
        ...(messageFetchCount >= 3
          ? [
              {
                id: "msg-2",
                tabId: activeTabId,
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
    await authenticatedPage.route(`**/api/automations/${JOB_ID}/runs?*`, async route => {
      await route.fulfill(
        buildJsonMockResponse({
          runs: [{ id: RUN_ID, status: "running" }],
          job: { id: JOB_ID, name: "Test Job" },
          pagination: { limit: 5, offset: 0, total: 1 },
        }),
      )
    })

    // Seed tab stores so automation conversation is the active tab from first render.
    await authenticatedPage.addInitScript(
      ({ workspace, tabId, conversationId, createdAt, tabDataKey, tabViewKey }) => {
        localStorage.setItem(
          tabDataKey,
          JSON.stringify({
            state: {
              tabsByWorkspace: {
                [workspace]: [
                  {
                    id: tabId,
                    tabGroupId: conversationId,
                    name: "Run",
                    tabNumber: 1,
                    createdAt,
                  },
                ],
              },
            },
            version: 1,
          }),
        )

        sessionStorage.setItem(
          tabViewKey,
          JSON.stringify({
            state: {
              activeTabByWorkspace: {
                [workspace]: tabId,
              },
              tabsExpandedByWorkspace: {},
            },
            version: 1,
          }),
        )
      },
      {
        workspace: workerTenant.workspace,
        tabId: TAB_ID,
        conversationId: CONV_ID,
        createdAt: now,
        tabDataKey: TAB_DATA_STORAGE_KEY,
        tabViewKey: TAB_VIEW_STORAGE_KEY,
      },
    )

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

    const activeTabState = await authenticatedPage.evaluate(workspace => {
      const tabDataRaw = localStorage.getItem("claude-tab-data")
      const tabViewRaw = sessionStorage.getItem("claude-tab-view")
      if (!tabDataRaw || !tabViewRaw) return { activeTabId: null, activeTabGroupId: null }

      try {
        const tabData = JSON.parse(tabDataRaw) as {
          state?: { tabsByWorkspace?: Record<string, Array<{ id: string; tabGroupId: string }>> }
        }
        const tabView = JSON.parse(tabViewRaw) as {
          state?: { activeTabByWorkspace?: Record<string, string | undefined> }
        }

        const activeTabId = tabView.state?.activeTabByWorkspace?.[workspace] ?? null
        const tabs = tabData.state?.tabsByWorkspace?.[workspace] ?? []
        const activeTabGroupId = tabs.find(tab => tab.id === activeTabId)?.tabGroupId ?? null
        return { activeTabId, activeTabGroupId }
      } catch {
        return { activeTabId: null, activeTabGroupId: null }
      }
    }, workerTenant.workspace)

    expect(activeTabState.activeTabId).not.toBeNull()
    expect(activeTabState.activeTabGroupId).toBe(CONV_ID)

    await expect.poll(() => messageFetchCount, { timeout: TEST_TIMEOUTS.max }).toBeGreaterThan(0)

    await expect(authenticatedPage.getByText("Starting automation...").first()).toBeVisible({
      timeout: TEST_TIMEOUTS.max,
    })

    await expect(authenticatedPage.getByText("Task completed successfully").first()).toBeVisible({
      timeout: 15_000,
    })

    // Proves active polling (not just a single initial fetch).
    expect(messageFetchCount).toBeGreaterThanOrEqual(3)
  })
})
