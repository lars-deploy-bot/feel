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
  LogOut,
  Menu,
  Monitor,
  Settings,
  Shield,
  X,
  Zap,
} from "lucide-react"
import { useQueryState } from "nuqs"
import { lazy, Suspense, useEffect, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { trackSettingsTabChanged } from "@/lib/analytics/events"
import { clientLogger } from "@/lib/client-error-logger"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { resetPostHogIdentity } from "@/lib/posthog"
import { useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"
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

type SettingsTab = (typeof SETTINGS_TABS)[number]

interface TabDefinition {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  superadminOnly?: boolean
  /** Rendered at sidebar bottom as org card instead of in the nav list */
  pinned?: boolean
}

const allTabs: TabDefinition[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "sessions", label: "Sessions", icon: Monitor },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "skills", label: "Skills", icon: ClipboardList },
  { id: "websites", label: "Websites", icon: Globe },
  { id: "automations", label: "Agents", icon: Zap },
  { id: "integrations", label: "Integrations", icon: Link },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "organization", label: "Organization", icon: Settings, pinned: true },
  { id: "flags", label: "Flags", icon: Flag, superadminOnly: true },
  { id: "admin", label: "Admin", icon: Shield, superadminOnly: true },
]

interface SettingsPageClientProps {
  onClose: () => void
  initialTab?: SettingsTab
}

export function SettingsPageClient({ onClose, initialTab }: SettingsPageClientProps) {
  const { user, loading } = useAuth()
  const { setCurrentWorkspace } = useWorkspaceActions()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const handleLogout = () => {
    resetPostHogIdentity()
    setCurrentWorkspace(null)
    const parts = window.location.hostname.split(".")
    const logoutUrl = parts.length > 2 ? `https://${parts.slice(1).join(".")}` : "/"
    const logoutFired = navigator.sendBeacon("/api/logout")
    if (!logoutFired) {
      fetch("/api/logout", { method: "POST", credentials: "include" }).catch((error: unknown) => {
        clientLogger.api("Logout API call failed", { error })
      })
    }
    window.location.href = logoutUrl
  }

  useEffect(() => {
    setHydrated(true)
  }, [])

  // All tabs visible to this user (org is in here — the tab system is complete)
  const tabs = hydrated && !loading ? allTabs.filter(tab => !tab.superadminOnly || !!user?.isSuperadmin) : allTabs
  // Split for render: nav list vs. pinned bottom card
  const navTabs = tabs.filter(t => !t.pinned)

  const [activeTab, setActiveTab] = useQueryState(QUERY_KEYS.settingsTab, {
    defaultValue: initialTab || "general",
    parse: (value: string) => {
      const parsed = value as SettingsTab
      if (SETTINGS_TABS.includes(parsed)) return parsed
      return initialTab || "general"
    },
    serialize: (value: string) => value,
  })

  const handleTabChange = (tabId: SettingsTab) => {
    trackSettingsTabChanged(tabId)
    void setActiveTab(tabId)
    setSidebarOpen(false)
  }

  // effectiveTab works on the full `tabs` list — org is in there, no special cases
  const effectiveTab = tabs.find(t => t.id === activeTab) || tabs[0]
  const currentTab = effectiveTab || { id: "general" as const, label: "General", icon: Settings }
  const isWideTab = currentTab.id === "automations"

  // Sync URL if user can't access the tab (e.g. admin-only)
  useEffect(() => {
    if (hydrated && !loading && effectiveTab && effectiveTab.id !== activeTab) {
      void setActiveTab(effectiveTab.id)
    }
  }, [hydrated, loading, effectiveTab, activeTab, setActiveTab])

  return (
    <div className="h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex-shrink-0 flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700"
            aria-label="Toggle menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => setSidebarOpen(true)} className="text-left">
            <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              {currentTab.label}
              <ChevronDown className="w-3 h-3" />
            </p>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 -mr-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close settings"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <button
        type="button"
        className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        onKeyDown={e => e.key === "Escape" && setSidebarOpen(false)}
        tabIndex={sidebarOpen ? 0 : -1}
        aria-label="Close menu"
      />

      {/* Left Sidebar */}
      <aside
        className={`
          fixed md:relative top-0 left-0 bottom-0 z-50
          w-64 md:w-[280px] h-full md:h-auto
          border-r border-zinc-200 dark:border-zinc-800
          bg-white dark:bg-zinc-900
          flex-shrink-0 flex flex-col
          transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Desktop header */}
        <div className="hidden md:flex p-4 border-b border-zinc-200 dark:border-zinc-800 items-center">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-zinc-400" />
            Settings
          </h1>
        </div>

        {/* Mobile close button area */}
        <div className="md:hidden p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</h1>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav tabs */}
        <nav className="p-2 space-y-1 overflow-y-auto flex-1">
          {navTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 md:py-2 rounded-lg md:rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 active:bg-zinc-100 dark:active:bg-zinc-800"
                }`}
              >
                <Icon className="w-5 h-5 md:w-4 md:h-4 flex-shrink-0" />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Organization + Logout — pinned to bottom */}
        <div className="flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
          <OrgCard isActive={activeTab === "organization"} onSelect={() => handleTabChange("organization")} />
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/5 transition-colors"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={
          isWideTab
            ? "flex-1 min-h-0 overflow-hidden px-4 md:px-8 py-2 md:py-0"
            : "flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 md:px-8 py-2 md:py-0"
        }
      >
        <div className={isWideTab ? "w-full h-full" : "max-w-3xl"}>
          <Suspense
            fallback={<div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">Loading...</div>}
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
      </main>
    </div>
  )
}

/** Org identity card — reads its own data from stores */
function OrgCard({ isActive, onSelect }: { isActive: boolean; onSelect: () => void }) {
  const { organizations } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const name = organizations.find(o => o.org_id === selectedOrgId)?.name ?? null

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
        isActive ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{(name || "O")[0].toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{name || "Organization"}</p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Manage</p>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
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
