/**
 * Tab Group Actions - Add Tab vs New Tab Group
 *
 * Verifies:
 * - Adding a tab does NOT create a new tab group.
 * - Creating a new tab group switches active tab to the new group.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useTabStore } from "@/lib/stores/tabStore"

const WS = "test.example.com"

function resetStore() {
  useTabStore.setState({
    tabsByWorkspace: {},
    activeTabByWorkspace: {},
    tabsExpandedByWorkspace: {},
    nextTabNumberByWorkspace: {},
  })
}

function getOpenTabs(workspace: string) {
  return (useTabStore.getState().tabsByWorkspace[workspace] ?? []).filter(t => !t.closedAt)
}

function getGroupIds(workspace: string) {
  return new Set(getOpenTabs(workspace).map(t => t.tabGroupId))
}

describe("Tab group actions", () => {
  beforeEach(resetStore)
  afterEach(resetStore)

  it("addTab does not create a new tab group and makes the new tab active", () => {
    const { createTabGroupWithTab, addTab } = useTabStore.getState()

    const created = createTabGroupWithTab(WS, "conv-A")!
    expect(getGroupIds(WS).size).toBe(1)

    const tabB = addTab(WS, created.tabGroupId, "conv-B")!
    expect(getGroupIds(WS).size).toBe(1)

    const groupTabs = getOpenTabs(WS).filter(t => t.tabGroupId === created.tabGroupId)
    expect(groupTabs).toHaveLength(2)
    expect(useTabStore.getState().activeTabByWorkspace[WS]).toBe(tabB.id)
  })

  it("createTabGroupWithTab creates a new group and switches active tab to it", () => {
    const { createTabGroupWithTab } = useTabStore.getState()

    createTabGroupWithTab(WS, "conv-A")
    const created = createTabGroupWithTab(WS, "conv-B")!

    expect(getGroupIds(WS).size).toBe(2)

    const activeTabId = useTabStore.getState().activeTabByWorkspace[WS]
    const activeTab = getOpenTabs(WS).find(t => t.id === activeTabId)

    expect(activeTab?.tabGroupId).toBe(created.tabGroupId)
    expect(activeTab?.sessionId).toBe("conv-B")
  })
})
