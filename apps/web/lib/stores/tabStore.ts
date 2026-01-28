"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"
import type { TabId, TabGroupId } from "@/lib/types/ids"

/**
 * Tab Store - Manages conversation tabs per workspace
 *
 * Each tab = one conversation. Tabs are workspace-scoped and persisted.
 * Tab names are "Tab 1", "Tab 2", etc. Numbers are never reused to avoid
 * confusion with archived conversations in the sidebar.
 */

export interface Tab {
  /** Unique tab identifier - ALSO the Claude conversation key */
  id: TabId
  /** Grouping id shown in left panel (sidebar item) */
  tabGroupId: TabGroupId
  name: string
  tabNumber: number // Sequential number, never reused
  createdAt: number
  inputDraft?: string // Persisted draft message for this tab
  /** Timestamp when tab was soft-deleted. Undefined = open tab. */
  closedAt?: number
}

interface TabStoreState {
  tabsByWorkspace: Record<string, Tab[]>
  activeTabByWorkspace: Record<string, string | undefined>
  tabsExpandedByWorkspace: Record<string, boolean>
  /** @deprecated Kept for migration compatibility. Tab numbers are now computed per-tabgroup. */
  nextTabNumberByWorkspace: Record<string, number>
}

interface TabStoreActions {
  addTab: (workspace: string, tabGroupId: TabGroupId, name?: string) => Tab | null
  removeTab: (workspace: string, tabId: TabId) => void
  reopenTab: (workspace: string, tabId: TabId) => void
  removeTabGroup: (workspace: string, tabGroupId: TabGroupId) => void
  setActiveTab: (workspace: string, tabId: TabId) => void
  renameTab: (workspace: string, tabId: TabId, name: string) => void
  toggleTabsExpanded: (workspace: string) => void
  collapseTabsAndClear: (workspace: string) => void
  openTabGroupInTab: (workspace: string, tabGroupId: TabGroupId, name?: string) => Tab | null
  setTabInputDraft: (workspace: string, tabId: TabId, draft: string) => void
  /** Creates a new tabgroup with Tab 1 inside it. Returns ids or null if max tabs reached. */
  createTabGroupWithTab: (workspace: string) => { tabGroupId: TabGroupId; tabId: TabId } | null
}

type TabStore = TabStoreState & TabStoreActions

const MAX_TABS = 10
const STORE_VERSION = 6 // Bump: Tab.id is now the conversation key (removed sessionId)

/** Generate a tab ID - this IS the Claude conversation key */
const genTabId = (): TabId => crypto.randomUUID()
const genTabGroupId = (): TabGroupId => crypto.randomUUID()

export const useTabStore = create<TabStore>()(
  persist(
    (set, get) => {
      const getTabs = (workspace: string) => get().tabsByWorkspace[workspace] || []

      const setTabs = (workspace: string, tabs: Tab[], activeId?: string) => {
        set(s => ({
          tabsByWorkspace: { ...s.tabsByWorkspace, [workspace]: tabs },
          ...(activeId !== undefined && {
            activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: activeId },
          }),
        }))
      }

      /**
       * Compute next tab number for a tabgroup.
       * Scoped per-tabgroup (not workspace) so each new tab group starts at Tab 1.
       * Counts ALL tabs including closed ones to avoid reusing numbers within a group.
       */
      const getNextGroupNumber = (workspace: string, tabGroupId: string): number => {
        const tabs = getTabs(workspace)
        const groupTabs = tabs.filter(t => t.tabGroupId === tabGroupId)
        if (groupTabs.length === 0) return 1
        return Math.max(...groupTabs.map(t => t.tabNumber)) + 1
      }

      const createTab = (workspace: string, tabGroupId: TabGroupId, name?: string): Tab => {
        const num = getNextGroupNumber(workspace, tabGroupId)
        return {
          id: genTabId(),
          tabGroupId,
          name: name ?? `Tab ${num}`,
          tabNumber: num,
          createdAt: Date.now(),
        }
      }

      const addTabToWorkspace = (workspace: string, tabs: Tab[], tab: Tab) => {
        setTabs(workspace, [...tabs, tab], tab.id)
      }

      return {
        tabsByWorkspace: {},
        activeTabByWorkspace: {},
        tabsExpandedByWorkspace: {},
        nextTabNumberByWorkspace: {}, // deprecated, kept for migration compat

        addTab: (workspace, tabGroupId, name) => {
          const tabs = getTabs(workspace)
          const openTabs = tabs.filter(t => !t.closedAt)
          if (openTabs.length >= MAX_TABS) return null

          const tab = createTab(workspace, tabGroupId, name)
          addTabToWorkspace(workspace, tabs, tab)
          return tab
        },

        removeTab: (workspace, tabId) => {
          const tabs = getTabs(workspace)
          const closingTab = tabs.find(t => t.id === tabId)
          if (!closingTab || closingTab.closedAt) return

          // Only count open tabs in the SAME tabgroup — prevents picking an
          // active tab from a different group which causes the TabBar to
          // briefly show the wrong group's tabs.
          const groupOpenTabs = tabs.filter(t => t.tabGroupId === closingTab.tabGroupId && !t.closedAt)
          if (groupOpenTabs.length <= 1) return // Don't close the last open tab in the group

          const idx = groupOpenTabs.findIndex(t => t.id === tabId)
          const newTabs = tabs.map(t => (t.id === tabId ? { ...t, closedAt: Date.now() } : t))
          const activeId = get().activeTabByWorkspace[workspace]
          const remainingInGroup = groupOpenTabs.filter(t => t.id !== tabId)
          const newActiveId =
            activeId === tabId ? remainingInGroup[Math.min(idx, remainingInGroup.length - 1)]?.id : activeId

          setTabs(workspace, newTabs, newActiveId)
        },

        reopenTab: (workspace, tabId) => {
          const tabs = getTabs(workspace)
          const tab = tabs.find(t => t.id === tabId && t.closedAt)
          if (!tab) return

          const newTabs = tabs.map(t => {
            if (t.id === tabId) {
              const { closedAt: _, ...rest } = t
              return rest
            }
            return t
          })
          setTabs(workspace, newTabs, tabId)
        },

        removeTabGroup: (workspace, tabGroupId) => {
          const tabs = getTabs(workspace)
          const remainingTabs = tabs.filter(t => t.tabGroupId !== tabGroupId)
          const activeId = get().activeTabByWorkspace[workspace]
          const activeStillExists = remainingTabs.some(t => t.id === activeId)
          const nextActiveId = activeStillExists ? activeId : remainingTabs[0]?.id

          setTabs(workspace, remainingTabs, nextActiveId)
        },

        setActiveTab: (workspace, tabId) => {
          set(s => ({ activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: tabId } }))
        },

        renameTab: (workspace, tabId, name) => {
          const tabs = getTabs(workspace)
          setTabs(
            workspace,
            tabs.map(t => (t.id === tabId ? { ...t, name: name.trim() || "Untitled" } : t)),
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
            tabsExpandedByWorkspace: {
              ...s.tabsExpandedByWorkspace,
              [workspace]: false,
            },
            tabsByWorkspace: {
              ...s.tabsByWorkspace,
              [workspace]: [],
            },
            activeTabByWorkspace: {
              ...s.activeTabByWorkspace,
              [workspace]: undefined,
            },
          }))
        },

        openTabGroupInTab: (workspace, tabGroupId, name) => {
          const tabs = getTabs(workspace)

          const existing = tabs.find(t => t.tabGroupId === tabGroupId && !t.closedAt)
          if (existing) {
            set(s => ({ activeTabByWorkspace: { ...s.activeTabByWorkspace, [workspace]: existing.id } }))
            return existing
          }

          const openTabs = tabs.filter(t => !t.closedAt)
          if (openTabs.length >= MAX_TABS) return null
          const tab = createTab(workspace, tabGroupId, name)
          addTabToWorkspace(workspace, tabs, tab)
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
          const openTabs = tabs.filter(t => !t.closedAt)
          if (openTabs.length >= MAX_TABS) return null

          const tabGroupId = genTabGroupId()
          const tab = createTab(workspace, tabGroupId)
          addTabToWorkspace(workspace, tabs, tab)
          return { tabGroupId, tabId: tab.id }
        },
      }
    },
    {
      name: "claude-tab-storage",
      version: STORE_VERSION,
      /**
       * skipHydration: true - Prevents automatic hydration on store creation
       *
       * HydrationManager calls rehydrate() for all persisted stores together,
       * ensuring coordinated hydration and eliminating race conditions.
       *
       * @see HydrationBoundary.tsx
       */
      skipHydration: true,
      partialize: s => ({
        tabsByWorkspace: s.tabsByWorkspace,
        activeTabByWorkspace: s.activeTabByWorkspace,
        tabsExpandedByWorkspace: s.tabsExpandedByWorkspace,
        nextTabNumberByWorkspace: s.nextTabNumberByWorkspace,
      }),
      migrate: (_persisted, version) => {
        // Type for old tab structure (before v6)
        interface LegacyTab {
          id: string
          sessionId?: string // Old: separate Claude session key
          conversationId?: string // Even older: was sessionId before rename
          tabGroupId: string
          name: string
          tabNumber: number
          createdAt: number
          inputDraft?: string
          closedAt?: number
        }

        interface LegacyState {
          tabsByWorkspace: Record<string, LegacyTab[]>
          activeTabByWorkspace: Record<string, string | undefined>
          tabsExpandedByWorkspace: Record<string, boolean>
          nextTabNumberByWorkspace: Record<string, number>
        }

        if (version < STORE_VERSION) {
          const legacy = _persisted as LegacyState | null
          if (!legacy?.tabsByWorkspace) {
            // No valid data to migrate
            return {
              tabsByWorkspace: {},
              activeTabByWorkspace: {},
              tabsExpandedByWorkspace: {},
              nextTabNumberByWorkspace: {},
            }
          }

          // Migrate tabs: sessionId (or conversationId) becomes the new id
          const newTabsByWorkspace: Record<string, Tab[]> = {}
          const idMapping: Record<string, string> = {} // old id -> new id

          for (const [workspace, tabs] of Object.entries(legacy.tabsByWorkspace)) {
            newTabsByWorkspace[workspace] = tabs.map((legacyTab: LegacyTab) => {
              // Use sessionId or conversationId as the new id (it's the Claude session key)
              // Fall back to existing id if neither exists (shouldn't happen but be safe)
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

          // Update activeTabByWorkspace to use new ids
          const newActiveTabByWorkspace: Record<string, string | undefined> = {}
          for (const [workspace, oldActiveId] of Object.entries(legacy.activeTabByWorkspace)) {
            if (oldActiveId && idMapping[oldActiveId]) {
              newActiveTabByWorkspace[workspace] = idMapping[oldActiveId]
            } else {
              // Active tab not found in mapping, clear it (will be set on next render)
              newActiveTabByWorkspace[workspace] = undefined
            }
          }

          return {
            tabsByWorkspace: newTabsByWorkspace,
            activeTabByWorkspace: newActiveTabByWorkspace,
            tabsExpandedByWorkspace: legacy.tabsExpandedByWorkspace || {},
            nextTabNumberByWorkspace: legacy.nextTabNumberByWorkspace || {},
          }
        }

        // Current version: pass through
        return _persisted as TabStoreState
      },
    },
  ),
)

// Selectors — all return only open tabs (closedAt undefined) unless otherwise noted
export const useTabs = (workspace: string | null, tabGroupId?: string | null): Tab[] =>
  useTabStore(s => {
    if (!workspace) return []
    const tabs = s.tabsByWorkspace[workspace] || []
    if (!tabGroupId) return []
    return tabs.filter(t => t.tabGroupId === tabGroupId && !t.closedAt)
  })

/** Get all closed tabs for a workspace (for the "reopen" dropdown), most recently closed first */
export const useClosedTabs = (workspace: string | null): Tab[] =>
  useTabStore(s => {
    if (!workspace) return []
    const tabs = s.tabsByWorkspace[workspace] || []
    return tabs.filter(t => t.closedAt).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
  })

export const useActiveTab = (workspace: string | null): Tab | null =>
  useTabStore(s => {
    if (!workspace) return null
    const tabs = s.tabsByWorkspace[workspace] || []
    const activeId = s.activeTabByWorkspace[workspace]
    return tabs.find(t => t.id === activeId && !t.closedAt) ?? null
  })

export const useTabsExpanded = (workspace: string | null): boolean =>
  useTabStore(s => (workspace ? (s.tabsExpandedByWorkspace[workspace] ?? false) : false))

export const useWorkspaceTabs = (workspace: string | null): Tab[] =>
  useTabStore(s => (workspace ? (s.tabsByWorkspace[workspace] ?? []).filter(t => !t.closedAt) : []))

/** Get all tabs for a specific conversation across all workspaces */
export const useTabsForTabGroup = (tabGroupId: string | null): Tab[] =>
  useTabStore(s => {
    if (!tabGroupId) return []
    const allTabs: Tab[] = []
    for (const tabs of Object.values(s.tabsByWorkspace)) {
      allTabs.push(...tabs.filter(t => t.tabGroupId === tabGroupId && !t.closedAt))
    }
    return allTabs
  })

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
    })),
  )
