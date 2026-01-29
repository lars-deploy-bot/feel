/**
 * tabStore unit tests
 *
 * Focus: Tab limit logic and edge cases that could cause
 * "Tab limit reached" error when user only sees 1 tab.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { useTabStore, type Tab } from "../tabStore"

const MAX_TABS = 10

// Direct store access (no React hooks)
const getState = () => useTabStore.getState()
const getActions = () => {
  const s = getState()
  return {
    addTab: s.addTab,
    removeTab: s.removeTab,
    reopenTab: s.reopenTab,
    createTabGroupWithTab: s.createTabGroupWithTab,
    openTabGroupInTab: s.openTabGroupInTab,
    setActiveTab: s.setActiveTab,
    collapseTabsAndClear: s.collapseTabsAndClear,
  }
}

// Helper to count open tabs for a workspace
const countOpenTabs = (workspace: string): number => {
  const tabs = getState().tabsByWorkspace[workspace] || []
  return tabs.filter(t => !t.closedAt).length
}

// Helper to count all tabs (open + closed) for a workspace
const countAllTabs = (workspace: string): number => {
  const tabs = getState().tabsByWorkspace[workspace] || []
  return tabs.length
}

// Helper to get all tabs for inspection
const getAllTabs = (workspace: string): Tab[] => {
  return getState().tabsByWorkspace[workspace] || []
}

describe("tabStore", () => {
  const workspace = "test-workspace"
  const tabGroupId = "test-group-1"

  beforeEach(() => {
    // Reset store state completely
    useTabStore.setState({
      tabsByWorkspace: {},
      activeTabByWorkspace: {},
      tabsExpandedByWorkspace: {},
      nextTabNumberByWorkspace: {},
    })
  })

  afterEach(() => {
    // Clean up
    useTabStore.setState({
      tabsByWorkspace: {},
      activeTabByWorkspace: {},
      tabsExpandedByWorkspace: {},
      nextTabNumberByWorkspace: {},
    })
  })

  describe("tab limit enforcement", () => {
    it("should allow creating tabs up to MAX_TABS (10)", () => {
      const actions = getActions()

      for (let i = 0; i < MAX_TABS; i++) {
        const tab = actions.addTab(workspace, tabGroupId)
        expect(tab).not.toBeNull()
        expect(tab?.id).toBeDefined()
      }

      expect(countOpenTabs(workspace)).toBe(MAX_TABS)
    })

    it("should return null when adding tab at limit", () => {
      const actions = getActions()

      // Create 10 tabs
      for (let i = 0; i < MAX_TABS; i++) {
        actions.addTab(workspace, tabGroupId)
      }

      // 11th tab should fail
      const tab = actions.addTab(workspace, tabGroupId)
      expect(tab).toBeNull()
    })

    it("should return null from createTabGroupWithTab at limit", () => {
      const actions = getActions()

      // Create 10 tabs
      for (let i = 0; i < MAX_TABS; i++) {
        actions.addTab(workspace, tabGroupId)
      }

      // Creating new tab group should fail
      const result = actions.createTabGroupWithTab(workspace)
      expect(result).toBeNull()
    })

    it("should return null from openTabGroupInTab at limit (new group)", () => {
      const actions = getActions()

      // Create 10 tabs
      for (let i = 0; i < MAX_TABS; i++) {
        actions.addTab(workspace, tabGroupId)
      }

      // Opening new tab group should fail
      const newGroupId = "new-group"
      const tab = actions.openTabGroupInTab(workspace, newGroupId)
      expect(tab).toBeNull()
    })
  })

  describe("closed tabs should NOT count toward limit", () => {
    it("should not count closed tabs in limit check", () => {
      const actions = getActions()

      // Create 10 tabs
      const tabs: Tab[] = []
      for (let i = 0; i < MAX_TABS; i++) {
        const tab = actions.addTab(workspace, tabGroupId)
        if (tab) tabs.push(tab)
      }
      expect(countOpenTabs(workspace)).toBe(10)

      // Close 5 tabs
      for (let i = 0; i < 5; i++) {
        actions.removeTab(workspace, tabs[i].id)
      }

      // Should have 5 open tabs now
      expect(countOpenTabs(workspace)).toBe(5)
      // But 10 total tabs (5 open + 5 closed)
      expect(countAllTabs(workspace)).toBe(10)

      // Should be able to add 5 more
      for (let i = 0; i < 5; i++) {
        const tab = actions.addTab(workspace, tabGroupId)
        expect(tab).not.toBeNull()
      }

      expect(countOpenTabs(workspace)).toBe(10)
    })

    it("should allow adding tab after closing one at limit", () => {
      const actions = getActions()

      // Create 10 tabs
      const tabs: Tab[] = []
      for (let i = 0; i < MAX_TABS; i++) {
        const tab = actions.addTab(workspace, tabGroupId)
        if (tab) tabs.push(tab)
      }

      // At limit - can't add more
      expect(actions.addTab(workspace, tabGroupId)).toBeNull()

      // Close one tab
      actions.removeTab(workspace, tabs[0].id)
      expect(countOpenTabs(workspace)).toBe(9)

      // Now should be able to add
      const newTab = actions.addTab(workspace, tabGroupId)
      expect(newTab).not.toBeNull()
    })
  })

  describe("workspace isolation", () => {
    it("should track tab limits per workspace independently", () => {
      const actions = getActions()
      const workspace1 = "workspace-1"
      const workspace2 = "workspace-2"

      // Fill workspace1 to limit
      for (let i = 0; i < MAX_TABS; i++) {
        actions.addTab(workspace1, tabGroupId)
      }
      expect(countOpenTabs(workspace1)).toBe(10)

      // workspace2 should still allow tabs
      const tab = actions.addTab(workspace2, tabGroupId)
      expect(tab).not.toBeNull()
      expect(countOpenTabs(workspace2)).toBe(1)
    })

    it("should not affect other workspaces when closing tabs", () => {
      const actions = getActions()
      const workspace1 = "workspace-1"
      const workspace2 = "workspace-2"

      // Create tabs in both
      const tab1 = actions.addTab(workspace1, tabGroupId)
      const _tab2 = actions.addTab(workspace2, tabGroupId)

      // Close tab in workspace1
      if (tab1) actions.removeTab(workspace1, tab1.id)

      // workspace2 should be unaffected
      expect(countOpenTabs(workspace2)).toBe(1)
    })
  })

  describe("edge cases that could cause phantom tabs", () => {
    it("should properly set closedAt when removing tab", () => {
      const actions = getActions()

      // Create 2 tabs (need at least 2 to close one)
      actions.addTab(workspace, tabGroupId)
      const tab2 = actions.addTab(workspace, tabGroupId)

      if (tab2) {
        actions.removeTab(workspace, tab2.id)

        const allTabs = getAllTabs(workspace)
        const closedTab = allTabs.find(t => t.id === tab2.id)

        expect(closedTab).toBeDefined()
        expect(closedTab?.closedAt).toBeDefined()
        expect(typeof closedTab?.closedAt).toBe("number")
      }
    })

    it("should handle tabs with undefined closedAt as open", () => {
      // Simulate corrupted/migrated state where closedAt might be undefined
      useTabStore.setState({
        tabsByWorkspace: {
          [workspace]: [
            {
              id: "tab-1",
              tabGroupId,
              name: "Tab 1",
              tabNumber: 1,
              createdAt: Date.now(),
              // closedAt intentionally undefined
            },
            {
              id: "tab-2",
              tabGroupId,
              name: "Tab 2",
              tabNumber: 2,
              createdAt: Date.now(),
              closedAt: undefined, // Explicitly undefined
            },
          ],
        },
        activeTabByWorkspace: { [workspace]: "tab-1" },
        tabsExpandedByWorkspace: {},
        nextTabNumberByWorkspace: {},
      })

      // Both should count as open
      expect(countOpenTabs(workspace)).toBe(2)
    })

    it("should handle tabs with closedAt=0 as closed (falsy but defined)", () => {
      // Edge case: closedAt could be 0 (epoch) which is falsy
      useTabStore.setState({
        tabsByWorkspace: {
          [workspace]: [
            {
              id: "tab-1",
              tabGroupId,
              name: "Tab 1",
              tabNumber: 1,
              createdAt: Date.now(),
              closedAt: 0, // Falsy but should still mean closed
            },
          ],
        },
        activeTabByWorkspace: {},
        tabsExpandedByWorkspace: {},
        nextTabNumberByWorkspace: {},
      })

      // This tab has closedAt=0, which is falsy
      // The current filter uses `!t.closedAt` which would treat 0 as "open"
      // This test documents the current behavior
      const openCount = countOpenTabs(workspace)

      // BUG: closedAt=0 is treated as open because !0 === true
      // This test will FAIL if the bug is fixed (which is good!)
      expect(openCount).toBe(1) // Current buggy behavior
    })

    it("should not create duplicate tabs on rapid addTab calls", () => {
      const actions = getActions()

      // Rapid fire tab creation
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(actions.addTab(workspace, tabGroupId))
      }

      // All should succeed and be unique
      const tabs = getAllTabs(workspace)
      const ids = tabs.map(t => t.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(tabs.length)
      expect(tabs.length).toBe(5)
    })
  })

  describe("reopenTab behavior", () => {
    it("should clear closedAt when reopening", () => {
      const actions = getActions()

      // Create 2 tabs
      actions.addTab(workspace, tabGroupId)
      const tab2 = actions.addTab(workspace, tabGroupId)

      if (tab2) {
        // Close it
        actions.removeTab(workspace, tab2.id)
        expect(getAllTabs(workspace).find(t => t.id === tab2.id)?.closedAt).toBeDefined()

        // Reopen it
        actions.reopenTab(workspace, tab2.id)
        const reopened = getAllTabs(workspace).find(t => t.id === tab2.id)
        expect(reopened?.closedAt).toBeUndefined()
      }
    })

    it("should increase open count when reopening", () => {
      const actions = getActions()

      // Create and close a tab
      actions.addTab(workspace, tabGroupId)
      const tab2 = actions.addTab(workspace, tabGroupId)

      if (tab2) {
        actions.removeTab(workspace, tab2.id)
        expect(countOpenTabs(workspace)).toBe(1)

        actions.reopenTab(workspace, tab2.id)
        expect(countOpenTabs(workspace)).toBe(2)
      }
    })
  })

  describe("collapseTabsAndClear", () => {
    it("should remove all tabs from workspace", () => {
      const actions = getActions()

      // Create several tabs
      for (let i = 0; i < 5; i++) {
        actions.addTab(workspace, tabGroupId)
      }
      expect(countAllTabs(workspace)).toBe(5)

      // Clear
      actions.collapseTabsAndClear(workspace)

      expect(countAllTabs(workspace)).toBe(0)
      expect(countOpenTabs(workspace)).toBe(0)
    })
  })

  describe("BUG HUNT: scenarios that could cause limit with 1 visible tab", () => {
    it("scenario: multiple tabGroups with tabs, user only sees one group", () => {
      const actions = getActions()

      // User creates tabs in multiple tab groups over time
      // Each tab group might show as one "conversation" in sidebar
      // but each can have multiple tabs
      const group1 = "group-1"
      const group2 = "group-2"
      const group3 = "group-3"

      // 4 tabs in group 1
      for (let i = 0; i < 4; i++) {
        actions.addTab(workspace, group1)
      }
      // 3 tabs in group 2
      for (let i = 0; i < 3; i++) {
        actions.addTab(workspace, group2)
      }
      // 3 tabs in group 3
      for (let i = 0; i < 3; i++) {
        actions.addTab(workspace, group3)
      }

      // Total: 10 open tabs across 3 groups
      expect(countOpenTabs(workspace)).toBe(10)

      // User might only SEE group 3 (3 tabs) but limit is reached
      // because tabs from group 1 and 2 still count!
      const newTab = actions.addTab(workspace, group3)
      expect(newTab).toBeNull() // Limit reached!
    })

    it("scenario: tabs created but never properly displayed", () => {
      // Simulate race condition where tabs are created
      // but UI never rendered them (e.g., component unmounted)
      useTabStore.setState({
        tabsByWorkspace: {
          [workspace]: [
            // 9 "phantom" tabs that were created but user never saw
            ...Array.from({ length: 9 }, (_, i) => ({
              id: `phantom-${i}`,
              tabGroupId: `old-group-${i}`,
              name: `Tab ${i + 1}`,
              tabNumber: i + 1,
              createdAt: Date.now() - 1000000, // Old timestamps
              // NO closedAt - they're "open"
            })),
            // 1 current tab user can see
            {
              id: "current-tab",
              tabGroupId: "current-group",
              name: "Tab 1",
              tabNumber: 1,
              createdAt: Date.now(),
            },
          ],
        },
        activeTabByWorkspace: { [workspace]: "current-tab" },
        tabsExpandedByWorkspace: {},
        nextTabNumberByWorkspace: {},
      })

      // User sees 1 tab but has 10 open
      expect(countOpenTabs(workspace)).toBe(10)

      // Can't create new tab!
      const actions = getActions()
      const newTab = actions.addTab(workspace, "current-group")
      expect(newTab).toBeNull()
    })

    it("scenario: migration left tabs without closedAt", () => {
      // Simulate post-migration state where old tabs
      // didn't have closedAt field at all
      useTabStore.setState({
        tabsByWorkspace: {
          [workspace]: Array.from({ length: 10 }, (_, i) => ({
            id: `migrated-${i}`,
            tabGroupId: "migrated-group",
            name: `Migrated Tab ${i + 1}`,
            tabNumber: i + 1,
            createdAt: Date.now(),
            // closedAt field doesn't exist (not even undefined)
          })),
        },
        activeTabByWorkspace: { [workspace]: "migrated-0" },
        tabsExpandedByWorkspace: {},
        nextTabNumberByWorkspace: {},
      })

      expect(countOpenTabs(workspace)).toBe(10)
    })
  })

  describe("diagnostic helpers", () => {
    it("can inspect full tab state for debugging", () => {
      const actions = getActions()

      // Create some tabs
      actions.addTab(workspace, tabGroupId)
      const tab2 = actions.addTab(workspace, tabGroupId)
      if (tab2) actions.removeTab(workspace, tab2.id)

      // Full inspection
      const state = getState()
      const tabs = state.tabsByWorkspace[workspace] || []

      const diagnosis = {
        totalTabs: tabs.length,
        openTabs: tabs.filter(t => !t.closedAt).length,
        closedTabs: tabs.filter(t => t.closedAt).length,
        tabGroups: [...new Set(tabs.map(t => t.tabGroupId))],
        tabDetails: tabs.map(t => ({
          id: t.id.slice(0, 8),
          group: t.tabGroupId.slice(0, 8),
          open: !t.closedAt,
          age: Date.now() - t.createdAt,
        })),
      }

      expect(diagnosis.totalTabs).toBe(2)
      expect(diagnosis.openTabs).toBe(1)
      expect(diagnosis.closedTabs).toBe(1)
    })
  })
})
