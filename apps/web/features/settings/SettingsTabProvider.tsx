"use client"

import { useQueryState } from "nuqs"
import { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { trackSettingsTabChanged } from "@/lib/analytics/events"
import { QUERY_KEYS } from "@/lib/url/queryState"
import { type SettingsTab, type TabDefinition, allTabs, isSettingsTab } from "./settings-tabs"

// ---------------------------------------------------------------------------
// Settings tab context — single source of truth for active tab state
// ---------------------------------------------------------------------------

interface SettingsTabState {
  tabs: TabDefinition[]
  activeTab: SettingsTab
  handleTabChange: (tabId: SettingsTab) => void
}

const SettingsTabContext = createContext<SettingsTabState | null>(null)

export function useSettingsTabContext(): SettingsTabState {
  const ctx = useContext(SettingsTabContext)
  if (!ctx) throw new Error("useSettingsTabContext must be used within SettingsTabProvider")
  return ctx
}

interface SettingsTabProviderProps {
  initialTab?: SettingsTab
  children: React.ReactNode
}

export function SettingsTabProvider({ initialTab, children }: SettingsTabProviderProps) {
  const { user, loading } = useAuth()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const tabs = hydrated && !loading ? allTabs.filter(tab => !tab.superadminOnly || !!user?.isSuperadmin) : allTabs

  const [activeTab, setActiveTab] = useQueryState(QUERY_KEYS.settingsTab, {
    defaultValue: initialTab || "general",
    parse: (value: string): SettingsTab => {
      if (isSettingsTab(value)) return value
      return initialTab || "general"
    },
    serialize: (value: string) => value,
  })

  const handleTabChange = (tabId: SettingsTab) => {
    trackSettingsTabChanged(tabId)
    void setActiveTab(tabId)
  }

  // When settings open with a specific tab (e.g. "websites"), navigate to it.
  // initialTab only changes when settings close (-> undefined) or reopen (-> tab),
  // so this won't fight with the user clicking tabs during a session.
  useEffect(() => {
    if (initialTab) {
      void setActiveTab(initialTab)
    }
  }, [initialTab, setActiveTab])

  // Sync URL if user can't access the tab (e.g. admin-only)
  const effectiveTab = tabs.find(t => t.id === activeTab) || tabs[0]
  useEffect(() => {
    if (hydrated && !loading && effectiveTab && effectiveTab.id !== activeTab) {
      void setActiveTab(effectiveTab.id)
    }
  }, [hydrated, loading, effectiveTab, activeTab, setActiveTab])

  return (
    <SettingsTabContext.Provider value={{ tabs, activeTab, handleTabChange }}>{children}</SettingsTabContext.Provider>
  )
}
