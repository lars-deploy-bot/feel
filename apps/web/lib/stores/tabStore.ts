"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useShallow } from "zustand/react/shallow"

/**
 * Tab Store - Manages conversation tabs per workspace
 *
 * Each tab = one conversation. Tabs are workspace-scoped and persisted.
 * Tab names are "Tab 1", "Tab 2", etc. Numbers are never reused to avoid
 * confusion with archived conversations in the sidebar.
 */

export interface Tab {
  id: string
  /** Conversation/session id for this tab (Claude session key) */
  conversationId: string
  /** Grouping id shown in left panel (tabgroup) */
  tabGroupId: string
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
  addTab: (workspace: string, tabGroupId: string, conversationId: string, name?: string) => Tab | null
  removeTab: (workspace: string, tabId: string) => void
  reopenTab: (workspace: string, tabId: string) => void
  removeTabGroup: (workspace: string, tabGroupId: string) => void
  setActiveTab: (workspace: string, tabId: string) => void
  renameTab: (workspace: string, tabId: string, name: string) => void
  toggleTabsExpanded: (workspace: string) => void
  collapseTabsAndClear: (workspace: string) => void
  openTabGroupInTab: (workspace: string, tabGroupId: string, name?: string) => Tab | null
  setTabInputDraft: (workspace: string, tabId: string, draft: string) => void
  /** Creates a new tabgroup with Tab 1 inside it. Returns ids or null if max tabs reached. */
  createTabGroupWithTab: (
    workspace: string,
    conversationIdOverride?: string,
  ) => { tabGroupId: string; conversationId: string; tabId: string } | null
}

type TabStore = TabStoreState & TabStoreActions

const MAX_TABS = 10

const genId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const genConversationId = () => crypto.randomUUID()
const genTabGroupId = () => crypto.randomUUID()

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
       * Scoped per-tabgroup (not workspace) so each new chat starts at Tab 1.
       * Counts ALL tabs including closed ones to avoid reusing numbers within a group.
       */
      const getNextGroupNumber = (workspace: string, tabGroupId: string): number => {
        const tabs = getTabs(workspace)
        const groupTabs = tabs.filter(t => t.tabGroupId === tabGroupId)
        if (groupTabs.length === 0) return 1
        return Math.max(...groupTabs.map(t => t.tabNumber)) + 1
      }

      const createTab = (workspace: string, tabGroupId: string, conversationId: string, name?: string): Tab => {
        const num = getNextGroupNumber(workspace, tabGroupId)
        return {
          id: genId(),
          conversationId,
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

        addTab: (workspace, tabGroupId, conversationId, name) => {
          const tabs = getTabs(workspace)
          const openTabs = tabs.filter(t => !t.closedAt)
          if (openTabs.length >= MAX_TABS) return null

          const tab = createTab(workspace, tabGroupId, conversationId, name)
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
          const tab = createTab(workspace, tabGroupId, genConversationId(), name)
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

        createTabGroupWithTab: (workspace, conversationIdOverride) => {
          const tabs = getTabs(workspace)
          const openTabs = tabs.filter(t => !t.closedAt)
          if (openTabs.length >= MAX_TABS) return null

          const tabGroupId = genTabGroupId()
          const conversationId = conversationIdOverride ?? genConversationId()
          const tab = createTab(workspace, tabGroupId, conversationId)
          addTabToWorkspace(workspace, tabs, tab)
          return { tabGroupId, conversationId, tabId: tab.id }
        },
      }
    },
    {
      name: "claude-tab-storage",
      version: 4, // Bump version for migration
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
      migrate: (persisted, version) => {
        const state = persisted as TabStoreState

        if (version === 1) {
          // v1 -> v2: add tabNumber to existing tabs and compute nextTabNumber
          const newTabsByWorkspace: Record<string, Tab[]> = {}
          const nextNumbers: Record<string, number> = {}

          for (const [ws, tabs] of Object.entries(state.tabsByWorkspace || {})) {
            newTabsByWorkspace[ws] = tabs.map((t, i) => ({
              ...t,
              tabNumber: (t as Tab).tabNumber ?? i + 1,
            }))
            nextNumbers[ws] = newTabsByWorkspace[ws].length + 1
          }

          return {
            ...state,
            tabsByWorkspace: newTabsByWorkspace,
            nextTabNumberByWorkspace: nextNumbers,
          }
        }

        if (version === 2) {
          // v2 -> v3: add tabGroupId for grouping (default to conversationId)
          const newTabsByWorkspace: Record<string, Tab[]> = {}

          for (const [ws, tabs] of Object.entries(state.tabsByWorkspace || {})) {
            newTabsByWorkspace[ws] = tabs.map(t => ({
              ...t,
              tabGroupId: (t as Tab).tabGroupId ?? (t as Tab).conversationId,
            }))
          }

          return {
            ...state,
            tabsByWorkspace: newTabsByWorkspace,
          }
        }

        if (version === 3) {
          // v3 -> v4: closedAt field added to Tab (optional, no data migration needed)
          return persisted
        }

        return persisted
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
