"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

/**
 * Tab Store - Manages conversation tabs per workspace
 *
 * Tabs allow users to work on multiple conversations simultaneously.
 * Each tab references a conversation ID and has an editable name.
 * Tabs are workspace-scoped and persisted to localStorage.
 */

export interface Tab {
  id: string
  conversationId: string
  name: string
  createdAt: number
}

interface TabStoreState {
  tabsByWorkspace: Record<string, Tab[]>
  activeTabByWorkspace: Record<string, string | undefined>
  tabsExpandedByWorkspace: Record<string, boolean>
}

interface TabStoreActions {
  addTab: (workspace: string, conversationId: string, name?: string) => Tab
  removeTab: (workspace: string, tabId: string) => void
  setActiveTab: (workspace: string, tabId: string) => void
  renameTab: (workspace: string, tabId: string, name: string) => void
  updateTabConversation: (workspace: string, tabId: string, conversationId: string) => void
  toggleTabsExpanded: (workspace: string) => void
}

type TabStore = TabStoreState & TabStoreActions

const MAX_TABS_PER_WORKSPACE = 10
const DEFAULT_TAB_NAME = "current"

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const useTabStore = create<TabStore>()(
  persist(
    set => ({
      tabsByWorkspace: {},
      activeTabByWorkspace: {},
      tabsExpandedByWorkspace: {},

      addTab: (workspace, conversationId, name) => {
        const newTab: Tab = {
          id: generateId("tab"),
          conversationId,
          name: name || DEFAULT_TAB_NAME,
          createdAt: Date.now(),
        }

        set(state => {
          const currentTabs = state.tabsByWorkspace[workspace] || []
          if (currentTabs.length >= MAX_TABS_PER_WORKSPACE) {
            console.warn(`[tabStore] Max tabs (${MAX_TABS_PER_WORKSPACE}) reached`)
            return state
          }

          return {
            tabsByWorkspace: { ...state.tabsByWorkspace, [workspace]: [...currentTabs, newTab] },
            activeTabByWorkspace: { ...state.activeTabByWorkspace, [workspace]: newTab.id },
          }
        })

        return newTab
      },

      removeTab: (workspace, tabId) => {
        set(state => {
          const currentTabs = state.tabsByWorkspace[workspace] || []
          const tabIndex = currentTabs.findIndex(t => t.id === tabId)
          if (tabIndex === -1) return state

          const newTabs = currentTabs.filter(t => t.id !== tabId)
          const currentActiveId = state.activeTabByWorkspace[workspace]

          // If removing active tab, switch to adjacent
          let newActiveId: string | undefined = currentActiveId
          if (currentActiveId === tabId) {
            const nextIndex = Math.min(tabIndex, newTabs.length - 1)
            newActiveId = newTabs[nextIndex]?.id
          }

          return {
            tabsByWorkspace: { ...state.tabsByWorkspace, [workspace]: newTabs },
            activeTabByWorkspace: { ...state.activeTabByWorkspace, [workspace]: newActiveId },
          }
        })
      },

      setActiveTab: (workspace, tabId) => {
        set(state => ({
          activeTabByWorkspace: { ...state.activeTabByWorkspace, [workspace]: tabId },
        }))
      },

      renameTab: (workspace, tabId, name) => {
        set(state => {
          const tabs = state.tabsByWorkspace[workspace] || []
          return {
            tabsByWorkspace: {
              ...state.tabsByWorkspace,
              [workspace]: tabs.map(t => (t.id === tabId ? { ...t, name: name.trim() || "Untitled" } : t)),
            },
          }
        })
      },

      updateTabConversation: (workspace, tabId, conversationId) => {
        set(state => {
          const tabs = state.tabsByWorkspace[workspace] || []
          return {
            tabsByWorkspace: {
              ...state.tabsByWorkspace,
              [workspace]: tabs.map(t => (t.id === tabId ? { ...t, conversationId } : t)),
            },
          }
        })
      },

      toggleTabsExpanded: workspace => {
        set(state => ({
          tabsExpandedByWorkspace: {
            ...state.tabsExpandedByWorkspace,
            [workspace]: !state.tabsExpandedByWorkspace[workspace],
          },
        }))
      },
    }),
    {
      name: "claude-tab-storage",
      version: 1,
      partialize: state => ({
        tabsByWorkspace: state.tabsByWorkspace,
        activeTabByWorkspace: state.activeTabByWorkspace,
        tabsExpandedByWorkspace: state.tabsExpandedByWorkspace,
      }),
    },
  ),
)

// Atomic selectors
export const useTabs = (workspace: string | null) =>
  useTabStore(state => (workspace ? state.tabsByWorkspace[workspace] || [] : []))

export const useActiveTab = (workspace: string | null) =>
  useTabStore(state => {
    if (!workspace) return null
    const tabs = state.tabsByWorkspace[workspace] || []
    const activeId = state.activeTabByWorkspace[workspace]
    return tabs.find(t => t.id === activeId) || null
  })

export const useTabsExpanded = (workspace: string | null) =>
  useTabStore(state => (workspace ? (state.tabsExpandedByWorkspace[workspace] ?? false) : false))

export const useTabActions = () =>
  useTabStore(state => ({
    addTab: state.addTab,
    removeTab: state.removeTab,
    setActiveTab: state.setActiveTab,
    renameTab: state.renameTab,
    updateTabConversation: state.updateTabConversation,
    toggleTabsExpanded: state.toggleTabsExpanded,
  }))
