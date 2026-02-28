"use client"

import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Flag,
  Globe,
  Key,
  Link,
  Monitor,
  Settings,
  Shield,
  Zap,
} from "lucide-react"
import { useQueryState } from "nuqs"
import { createContext, lazy, Suspense, useContext, useEffect, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { trackSettingsTabChanged } from "@/lib/analytics/events"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useSelectedOrgId } from "@/lib/stores/workspaceStore"
import { QUERY_KEYS } from "@/lib/url/queryState"
import { SettingsTabLayout } from "./tabs/SettingsTabLayout"

// Lazy load tab components
const GeneralSettings = lazy(() =>
  import("@/components/settings/tabs/GeneralSettings").then(m => ({ default: m.GeneralSettings })),
)
const SkillsSettings = lazy(() =>
  import("@/components/settings/tabs/SkillsSettings").then(m => ({ default: m.SkillsSettings })),
)
const WorkspaceSettings = lazy(() =>
  import("@/components/settings/tabs/WorkspaceSettings").then(m => ({ default: m.WorkspaceSettings })),
)
const WebsitesSettings = lazy(() =>
  import("@/components/settings/tabs/WebsitesSettings").then(m => ({ default: m.WebsitesSettings })),
)
const FlagsSettings = lazy(() =>
  import("@/components/settings/tabs/FlagsSettings").then(m => ({ default: m.FlagsSettings })),
)
const AdminSettings = lazy(() =>
  import("@/components/settings/tabs/AdminSettings").then(m => ({ default: m.AdminSettings })),
)
const IntegrationsList = lazy(() =>
  import("@/components/settings/integrations-list").then(m => ({ default: m.IntegrationsList })),
)
const UserEnvKeysSettings = lazy(() =>
  import("@/components/settings/user-env-keys").then(m => ({ default: m.UserEnvKeysSettings })),
)
const AutomationsSettings = lazy(() =>
  import("@/components/settings/tabs/AutomationsSettings").then(m => ({ default: m.AutomationsSettings })),
)
const BillingSettings = lazy(() =>
  import("@/components/settings/tabs/BillingSettings").then(m => ({ default: m.BillingSettings })),
)
const SessionsSettings = lazy(() =>
  import("@/components/settings/tabs/SessionsSettings").then(m => ({ default: m.SessionsSettings })),
)

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const SETTINGS_TABS = [
  "general",
  "sessions",
  "billing",
  "skills",
  "organization",
  "websites",
  "automations",
  "integrations",
  "keys",
  "flags",
  "admin",
] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

interface TabDefinition {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  superadminOnly?: boolean
  /** Rendered at sidebar bottom as org card instead of in the nav list */
  pinned?: boolean
  /** Grouped under collapsible "Advanced" section in sidebar */
  advanced?: boolean
}

const allTabs: TabDefinition[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "websites", label: "Websites", icon: Globe },
  { id: "skills", label: "Skills", icon: ClipboardList },
  { id: "automations", label: "Agents", icon: Zap },
  { id: "billing", label: "Billing", icon: CreditCard, advanced: true },
  { id: "sessions", label: "Sessions", icon: Monitor, advanced: true },
  { id: "integrations", label: "Integrations", icon: Link, advanced: true },
  { id: "keys", label: "API Keys", icon: Key, advanced: true },
  { id: "organization", label: "Organization", icon: Settings, pinned: true },
  { id: "flags", label: "Flags", icon: Flag, superadminOnly: true },
  { id: "admin", label: "Admin", icon: Shield, superadminOnly: true },
]

function isSettingsTab(value: string): value is SettingsTab {
  return SETTINGS_TABS.some(tab => tab === value)
}

// ---------------------------------------------------------------------------
// Settings tab context — single source of truth for active tab state
// ---------------------------------------------------------------------------

interface SettingsTabState {
  tabs: TabDefinition[]
  activeTab: SettingsTab
  handleTabChange: (tabId: SettingsTab) => void
}

const SettingsTabContext = createContext<SettingsTabState | null>(null)

function useSettingsTabContext(): SettingsTabState {
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
  // initialTab only changes when settings close (→ undefined) or reopen (→ tab),
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

// ---------------------------------------------------------------------------
// CollapsibleSection — reusable collapsible nav group
// ---------------------------------------------------------------------------

function CollapsibleSection({
  label,
  tabs: sectionTabs,
  activeTab,
  onSelect,
}: {
  label: string
  tabs: TabDefinition[]
  activeTab: SettingsTab
  onSelect: (id: SettingsTab) => void
}) {
  const hasActiveTab = sectionTabs.some(t => t.id === activeTab)
  const [isOpen, setIsOpen] = useState(hasActiveTab)

  useEffect(() => {
    if (hasActiveTab) setIsOpen(true)
  }, [hasActiveTab])

  if (sectionTabs.length === 0) return null

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-black/30 dark:text-white/30 hover:text-black/50 dark:hover:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
      >
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
        />
        {label}
      </button>
      {isOpen && (
        <div className="ml-2 space-y-0.5 mt-0.5">
          {sectionTabs.map(tab => (
            <NavTab key={tab.id} tab={tab} isActive={activeTab === tab.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsNav — rendered inside ConversationSidebar when in settings mode
// ---------------------------------------------------------------------------

interface SettingsNavProps {
  onClose: () => void
}

export function SettingsNav({ onClose }: SettingsNavProps) {
  const { tabs, activeTab, handleTabChange } = useSettingsTabContext()

  const primaryTabs = tabs.filter(t => !t.pinned && !t.advanced && !t.superadminOnly)
  const advancedTabs = tabs.filter(t => t.advanced)
  const superadminTabs = tabs.filter(t => t.superadminOnly)

  return (
    <div className="flex flex-col h-full">
      {/* Back to chat button */}
      <button
        type="button"
        onClick={onClose}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 12L6 8L10 4" />
        </svg>
        Back to chat
      </button>

      {/* Tab navigation */}
      <nav className="p-2 space-y-1 overflow-y-auto flex-1">
        {primaryTabs.map(tab => (
          <NavTab key={tab.id} tab={tab} isActive={activeTab === tab.id} onSelect={handleTabChange} />
        ))}
        <CollapsibleSection label="Advanced" tabs={advancedTabs} activeTab={activeTab} onSelect={handleTabChange} />
        <CollapsibleSection label="Superadmin" tabs={superadminTabs} activeTab={activeTab} onSelect={handleTabChange} />
      </nav>

      {/* Org card pinned at bottom */}
      <div className="flex-shrink-0 border-t border-black/[0.06] dark:border-white/[0.06]">
        <OrgCard isActive={activeTab === "organization"} onSelect={() => handleTabChange("organization")} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsContent — the content panel (no sidebar, rendered in main area)
// ---------------------------------------------------------------------------

export function SettingsContent() {
  const { activeTab } = useSettingsTabContext()
  const isWideTab = activeTab === "automations"

  return (
    <div
      className={
        isWideTab
          ? "w-full h-full overflow-hidden px-4 md:px-8 py-2 md:py-6"
          : "overflow-y-auto overscroll-contain px-4 md:px-8 py-2 md:py-6"
      }
    >
      <div className={isWideTab ? "w-full h-full" : "max-w-3xl"}>
        <Suspense
          fallback={<div className="py-12 text-center text-black/30 dark:text-white/30 text-sm">Loading...</div>}
        >
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "sessions" && <SessionsSettings />}
          {activeTab === "billing" && <BillingSettings />}
          {activeTab === "skills" && <SkillsSettings />}
          {activeTab === "organization" && <WorkspaceSettings />}
          {activeTab === "websites" && <WebsitesSettings />}
          {activeTab === "automations" && <AutomationsSettings />}
          {activeTab === "integrations" && <IntegrationsListWithHeader />}
          {activeTab === "keys" && <UserEnvKeysWithHeader />}
          {activeTab === "flags" && <FlagsSettings />}
          {activeTab === "admin" && <AdminSettings />}
        </Suspense>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function NavTab({
  tab,
  isActive,
  onSelect,
}: {
  tab: TabDefinition
  isActive: boolean
  onSelect: (id: SettingsTab) => void
}) {
  const Icon = tab.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-black/[0.06] dark:bg-white/[0.06] text-black dark:text-white font-medium"
          : "text-black/50 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] hover:text-black/70 dark:hover:text-white/70"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {tab.label}
    </button>
  )
}

function OrgCard({ isActive, onSelect }: { isActive: boolean; onSelect: () => void }) {
  const { organizations } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const name = organizations.find(o => o.org_id === selectedOrgId)?.name ?? null

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
        isActive ? "bg-black/[0.04] dark:bg-white/[0.04]" : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-black/60 dark:text-white/60">{(name || "O")[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-black/90 dark:text-white/90 truncate">{name || "Organization"}</p>
        <p className="text-xs text-black/40 dark:text-white/40">Manage</p>
      </div>
      <ChevronRight className="w-4 h-4 text-black/20 dark:text-white/20 flex-shrink-0" />
    </button>
  )
}

function IntegrationsListWithHeader() {
  return (
    <SettingsTabLayout title="Integrations" description="Connect external services to enhance your workspace">
      <IntegrationsList />
    </SettingsTabLayout>
  )
}

function UserEnvKeysWithHeader() {
  return (
    <SettingsTabLayout title="API Keys" description="Store custom API keys for MCP integrations">
      <UserEnvKeysSettings />
    </SettingsTabLayout>
  )
}
