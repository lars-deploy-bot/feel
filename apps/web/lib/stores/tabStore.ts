"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"
import type { TabId, TabGroupId } from "@/lib/types/ids"

// ============================================================================
// Constants
// ============================================================================

/** Maximum tabs allowed per conversation (TabGroup). No global limit. */
export const MAX_TABS_PER_GROUP = 5

/** How long to keep closed tabs before cleanup (7 days) */
const CLOSED_TAB_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Store version for migrations */
const STORE_VERSION = 8

// ============================================================================
// Types
// ============================================================================

export interface Tab {
  /** Unique tab identifier - ALSO the Claude conversation key */
  id: TabId
  /** Grouping id shown in left panel (sidebar item) */
  tabGroupId: TabGroupId
  name: string
  /** Sequential number within group, never reused */
  tabNumber: number
  createdAt: number
  /** Persisted draft message for this tab */
  inputDraft?: string
  /** Timestamp when tab was soft-deleted. Undefined = open tab. */
  closedAt?: number
}

interface TabStoreState {
  tabsByWorkspace: Record<string, Tab[]>
  activeTabByWorkspace: Record<string, TabId | undefined>
  tabsExpandedByWorkspace: Record<string, boolean>
  /** @deprecated Kept for migration compatibility only */
  nextTabNumberByWorkspace: Record<string, number>
}

interface TabStoreActions {
  /** Add a tab to a group. Returns null if group is at MAX_TABS_PER_GROUP limit. */
  addTab: (workspace: string, tabGroupId: TabGroupId, name?: string) => Tab | null
  /** Soft-delete a tab (sets closedAt). Won't close the last tab in a group. */
  removeTab: (workspace: string, tabId: TabId) => void
  /** Reopen a closed tab */
  reopenTab: (workspace: string, tabId: TabId) => void
  /** Remove all tabs in a group (hard delete) */
  removeTabGroup: (workspace: string, tabGroupId: TabGroupId) => void
  /** Set the active tab for a workspace */
  setActiveTab: (workspace: string, tabId: TabId) => void
  /** Rename a tab */
  renameTab: (workspace: string, tabId: TabId, name: string) => void
  /** Toggle tabs expanded state */
  toggleTabsExpanded: (workspace: string) => void
  /** Collapse tabs and clear all tabs for workspace */
  collapseTabsAndClear: (workspace: string) => void
  /** Open a tab group - returns existing open tab or creates new one. Always succeeds. */
  openTabGroupInTab: (workspace: string, tabGroupId: TabGroupId, name?: string) => Tab
  /** Save input draft for a tab */
  setTabInputDraft: (workspace: string, tabId: TabId, draft: string) => void
  /** Create a new tab group with its first tab. Always succeeds. */
  createTabGroupWithTab: (workspace: string) => { tabGroupId: TabGroupId; tabId: TabId }
  /** Remove old closed tabs to free up storage. Returns count of removed tabs. */
  cleanupOldTabs: (workspace: string) => number
}

type TabStore = TabStoreState & TabStoreActions

// ============================================================================
// Helpers (pure functions, no store access)
// ============================================================================

const genTabId = (): TabId => crypto.randomUUID()
const genTabGroupId = (): TabGroupId => crypto.randomUUID()

/** Check if a tab is open (not soft-deleted) */
const isOpen = (tab: Tab): boolean => tab.closedAt === undefined

/** Check if a tab is closed (soft-deleted) */
const isClosed = (tab: Tab): boolean => tab.closedAt !== undefined

/** Filter tabs by group and open status */
const getOpenTabsInGroup = (tabs: Tab[], tabGroupId: TabGroupId): Tab[] =>
  tabs.filter(t => t.tabGroupId === tabGroupId && isOpen(t))

/** Get next tab number for a group (counts all tabs including closed) */
const getNextTabNumber = (tabs: Tab[], tabGroupId: TabGroupId): number => {
  const groupTabs = tabs.filter(t => t.tabGroupId === tabGroupId)
  if (groupTabs.length === 0) return 1
  return Math.max(...groupTabs.map(t => t.tabNumber)) + 1
}

/** Create a new tab object */
const createTabObject = (tabs: Tab[], tabGroupId: TabGroupId, name?: string): Tab => {
  const num = getNextTabNumber(tabs, tabGroupId)
  return {
    id: genTabId(),
    tabGroupId,
    name: name ?? `Tab ${num}`,
    tabNumber: num,
    createdAt: Date.now(),
  }
}

/**
 * Filter tabs to remove stale closed tabs.
 * Keeps: open tabs, recently closed, closed tabs in active groups, and the active tab.
 */
const filterStaleTabs = (tabs: Tab[], activeId: TabId | undefined, now: number): Tab[] => {
  const activeGroupIds = new Set(tabs.filter(isOpen).map(t => t.tabGroupId))

  return tabs.filter(t => {
    // Never remove the active tab
    if (t.id === activeId) return true
    // Keep all open tabs
    if (isOpen(t)) return true
    // Keep recently closed tabs
    if (t.closedAt !== undefined && now - t.closedAt < CLOSED_TAB_TTL_MS) return true
    // Keep closed tabs if their group still has open tabs (for "reopen" feature)
    if (activeGroupIds.has(t.tabGroupId)) return true
    return false
  })
}

/**
 * Find the next active tab after closing one.
 * Returns the tab at the same index, or the last tab if closing the last one.
 */
const findNextActiveTab = (openTabs: Tab[], closingIndex: number): Tab => {
  const remaining = openTabs.filter((_, i) => i !== closingIndex)
  const nextIndex = Math.min(closingIndex, remaining.length - 1)
  return remaining[nextIndex]
}

/**
 * Find the ID of the first open tab.
 * Returns undefined when no open tabs exist (valid state: empty workspace).
 */
const findFirstOpenTabId = (tabs: Tab[]): TabId | undefined => {
  for (const tab of tabs) {
    if (isOpen(tab)) return tab.id
  }
  return undefined
}

/** Empty state for initialization and reset */
const emptyState = (): TabStoreState => ({
  tabsByWorkspace: {},
  activeTabByWorkspace: {},
  tabsExpandedByWorkspace: {},
  nextTabNumberByWorkspace: {},
})

// ============================================================================
// Store
// ============================================================================

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => {
      // Internal helpers that access store
      const getTabs = (workspace: string): Tab[] => get().tabsByWorkspace[workspace] ?? []

      const setTabs = (workspace: string, tabs: Tab[], activeId?: TabId): void => {
        set(s => ({
          tabsByWorkspace: { ...s.tabsByWorkspace, [workspace]: tabs },
          ...(activeId !== undefined && {
            activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: activeId },
          }),
        }))
      }

      return {
        ...emptyState(),

        addTab: (workspace, tabGroupId, name) => {
          const tabs = getTabs(workspace)
          if (getOpenTabsInGroup(tabs, tabGroupId).length >= MAX_TABS_PER_GROUP) {
            return null
          }
          const tab = createTabObject(tabs, tabGroupId, name)
          setTabs(workspace, [...tabs, tab], tab.id)
          return tab
        },

        removeTab: (workspace, tabId) => {
          const tabs = getTabs(workspace)
          const closingTab = tabs.find(t => t.id === tabId)
          if (!closingTab || isClosed(closingTab)) return

          const groupOpenTabs = getOpenTabsInGroup(tabs, closingTab.tabGroupId)
          if (groupOpenTabs.length <= 1) return // Don't close the last tab in a group

          const closingIndex = groupOpenTabs.findIndex(t => t.id === tabId)
          const nextTab = findNextActiveTab(groupOpenTabs, closingIndex)

          const newTabs = tabs.map(t => (t.id === tabId ? { ...t, closedAt: Date.now() } : t))
          const activeId = get().activeTabByWorkspace[workspace]
          const newActiveId = activeId === tabId ? nextTab.id : activeId

          setTabs(workspace, newTabs, newActiveId)
        },

        reopenTab: (workspace, tabId) => {
          const tabs = getTabs(workspace)
          const tab = tabs.find(t => t.id === tabId && isClosed(t))
          if (!tab) return

          const newTabs = tabs.map(t => {
            if (t.id !== tabId) return t
            const { closedAt: _, ...rest } = t
            return rest
          })
          setTabs(workspace, newTabs, tabId)
        },

        removeTabGroup: (workspace, tabGroupId) => {
          const tabs = getTabs(workspace)
          const remainingTabs = tabs.filter(t => t.tabGroupId !== tabGroupId)

          const activeId = get().activeTabByWorkspace[workspace]
          const activeTabStillExists = remainingTabs.some(t => t.id === activeId)
          const nextActiveId = activeTabStillExists ? activeId : findFirstOpenTabId(remainingTabs)

          setTabs(workspace, remainingTabs, nextActiveId)
        },

        setActiveTab: (workspace, tabId) => {
          set(s => ({ activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: tabId } }))
        },

        renameTab: (workspace, tabId, name) => {
          const tabs = getTabs(workspace)
          const trimmed = name.trim()
          const newName = trimmed.length > 0 ? trimmed : "Untitled"
          setTabs(
            workspace,
            tabs.map(t => (t.id === tabId ? { ...t, name: newName } : t)),
          )
        },

        toggleTabsExpanded: workspace => {
          set(s => ({
            tabsExpandedByWorkspace: {
              ...s.tabsExpandedByWorkspace,
              [workspace]: !s.tabsExpandedByWorkspace[workspace],
            },
          }))
        },

        collapseTabsAndClear: workspace => {
          set(s => ({
            tabsExpandedByWorkspace: { ...s.tabsExpandedByWorkspace, [workspace]: false },
            tabsByWorkspace: { ...s.tabsByWorkspace, [workspace]: [] },
            activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: undefined },
          }))
        },

        openTabGroupInTab: (workspace, tabGroupId, name) => {
          const tabs = getTabs(workspace)

          // Return existing open tab if one exists
          const existing = tabs.find(t => t.tabGroupId === tabGroupId && isOpen(t))
          if (existing) {
            set(s => ({ activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: existing.id } }))
            return existing
          }

          // Create new tab (no global limit, always succeeds for new groups)
          const tab = createTabObject(tabs, tabGroupId, name)
          setTabs(workspace, [...tabs, tab], tab.id)
          return tab
        },

        setTabInputDraft: (workspace, tabId, draft) => {
          const tabs = getTabs(workspace)
          setTabs(
            workspace,
            tabs.map(t => (t.id === tabId ? { ...t, inputDraft: draft } : t)),
          )
        },

        createTabGroupWithTab: workspace => {
          const tabs = getTabs(workspace)
          const tabGroupId = genTabGroupId()
          const tab = createTabObject(tabs, tabGroupId)
          setTabs(workspace, [...tabs, tab], tab.id)
          return { tabGroupId, tabId: tab.id }
        },

        cleanupOldTabs: workspace => {
          const tabs = getTabs(workspace)
          const activeId = get().activeTabByWorkspace[workspace]
          const cleaned = filterStaleTabs(tabs, activeId, Date.now())
          const removed = tabs.length - cleaned.length
          if (removed > 0) {
            setTabs(workspace, cleaned)
          }
          return removed
        },
      }
    },
    {
      name: "claude-tab-storage",
      version: STORE_VERSION,
      skipHydration: true, // HydrationManager handles coordinated hydration
      partialize: s => ({
        tabsByWorkspace: s.tabsByWorkspace,
        activeTabByWorkspace: s.activeTabByWorkspace,
        tabsExpandedByWorkspace: s.tabsExpandedByWorkspace,
        nextTabNumberByWorkspace: s.nextTabNumberByWorkspace,
      }),
      migrate: (persisted, version) => {
        // Handle completely missing or invalid data
        if (!persisted || typeof persisted !== "object") {
          return emptyState()
        }

        const state = persisted as Record<string, unknown>
        if (!state.tabsByWorkspace || typeof state.tabsByWorkspace !== "object") {
          return emptyState()
        }

        // Legacy migration (versions < 6): sessionId/conversationId -> id
        if (version < 6) {
          return migrateLegacyTabs(state)
        }

        // Current version: just clean up stale tabs on hydration
        return cleanupOnHydration(state as unknown as TabStoreState)
      },
    },
  ),
)

// ============================================================================
// Migration helpers
// ============================================================================

interface LegacyTab {
  id: string
  sessionId?: string
  conversationId?: string
  tabGroupId: string
  name: string
  tabNumber: number
  createdAt: number
  inputDraft?: string
  closedAt?: number
}

function migrateLegacyTabs(state: Record<string, unknown>): TabStoreState {
  const legacy = state as {
    tabsByWorkspace: Record<string, LegacyTab[]>
    activeTabByWorkspace: Record<string, string | undefined>
    tabsExpandedByWorkspace?: Record<string, boolean>
    nextTabNumberByWorkspace?: Record<string, number>
  }

  const newTabsByWorkspace: Record<string, Tab[]> = {}
  const idMapping: Record<string, string> = {}

  for (const [workspace, tabs] of Object.entries(legacy.tabsByWorkspace)) {
    newTabsByWorkspace[workspace] = tabs.map(legacyTab => {
      const newId = legacyTab.sessionId || legacyTab.conversationId || legacyTab.id
      idMapping[legacyTab.id] = newId
      return {
        id: newId,
        tabGroupId: legacyTab.tabGroupId,
        name: legacyTab.name,
        tabNumber: legacyTab.tabNumber,
        createdAt: legacyTab.createdAt,
        inputDraft: legacyTab.inputDraft,
        closedAt: legacyTab.closedAt,
      }
    })
  }

  const newActiveTabByWorkspace: Record<string, string | undefined> = {}
  for (const [workspace, oldActiveId] of Object.entries(legacy.activeTabByWorkspace)) {
    newActiveTabByWorkspace[workspace] = oldActiveId ? idMapping[oldActiveId] : undefined
  }

  return {
    tabsByWorkspace: newTabsByWorkspace,
    activeTabByWorkspace: newActiveTabByWorkspace,
    tabsExpandedByWorkspace: legacy.tabsExpandedByWorkspace ?? {},
    nextTabNumberByWorkspace: legacy.nextTabNumberByWorkspace ?? {},
  }
}

function cleanupOnHydration(state: TabStoreState): TabStoreState {
  const now = Date.now()
  const cleanedTabsByWorkspace: Record<string, Tab[]> = {}

  for (const [workspace, tabs] of Object.entries(state.tabsByWorkspace)) {
    const activeId = state.activeTabByWorkspace[workspace]
    cleanedTabsByWorkspace[workspace] = filterStaleTabs(tabs, activeId, now)
  }

  return {
    ...state,
    tabsByWorkspace: cleanedTabsByWorkspace,
  }
}

// ============================================================================
// Selectors (React hooks)
// ============================================================================

/** Get open tabs in a specific group */
export const useTabs = (workspace: string | null, tabGroupId?: string | null): Tab[] =>
  useTabStore(s => {
    if (!workspace || !tabGroupId) return []
    const tabs = s.tabsByWorkspace[workspace] ?? []
    return tabs.filter(t => t.tabGroupId === tabGroupId && isOpen(t))
  })

/** Get all closed tabs for a workspace, most recently closed first */
export const useClosedTabs = (workspace: string | null): Tab[] =>
  useTabStore(s => {
    if (!workspace) return []
    const tabs = s.tabsByWorkspace[workspace] ?? []
    // isClosed guarantees closedAt is defined, so the cast is safe
    return tabs.filter(isClosed).sort((a, b) => (b.closedAt as number) - (a.closedAt as number))
  })

/** Get the active tab for a workspace. Returns null if no active tab or workspace is null. */
export const useActiveTab = (workspace: string | null): Tab | null =>
  useTabStore(s => {
    if (!workspace) return null
    const activeId = s.activeTabByWorkspace[workspace]
    if (!activeId) return null
    const tabs = s.tabsByWorkspace[workspace] ?? []
    const activeTab = tabs.find(t => t.id === activeId)
    if (!activeTab || isClosed(activeTab)) return null
    return activeTab
  })

/** Check if tabs are expanded for a workspace */
export const useTabsExpanded = (workspace: string | null): boolean =>
  useTabStore(s => (workspace ? (s.tabsExpandedByWorkspace[workspace] ?? false) : false))

/** Get all open tabs for a workspace */
export const useWorkspaceTabs = (workspace: string | null): Tab[] =>
  useTabStore(s => (workspace ? (s.tabsByWorkspace[workspace] ?? []).filter(isOpen) : []))

/** Get all open tabs for a specific tab group across all workspaces */
export const useTabsForTabGroup = (tabGroupId: string | null): Tab[] =>
  useTabStore(s => {
    if (!tabGroupId) return []
    const allTabs: Tab[] = []
    for (const tabs of Object.values(s.tabsByWorkspace)) {
      allTabs.push(...tabs.filter(t => t.tabGroupId === tabGroupId && isOpen(t)))
    }
    return allTabs
  })

/** Get all store actions */
export const useTabActions = (): TabStoreActions =>
  useTabStore(
    useShallow(s => ({
      addTab: s.addTab,
      removeTab: s.removeTab,
      reopenTab: s.reopenTab,
      removeTabGroup: s.removeTabGroup,
      setActiveTab: s.setActiveTab,
      renameTab: s.renameTab,
      toggleTabsExpanded: s.toggleTabsExpanded,
      collapseTabsAndClear: s.collapseTabsAndClear,
      openTabGroupInTab: s.openTabGroupInTab,
      setTabInputDraft: s.setTabInputDraft,
      createTabGroupWithTab: s.createTabGroupWithTab,
      cleanupOldTabs: s.cleanupOldTabs,
    })),
  )
