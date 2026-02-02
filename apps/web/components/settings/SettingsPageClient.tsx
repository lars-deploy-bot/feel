"use client"

import {
  Bot,
  Building2,
  ChevronDown,
  ClipboardList,
  Flag,
  Globe,
  Key,
  Link,
  Loader2,
  Menu,
  Settings,
  Shield,
  Target,
  User,
  X,
  Zap,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { lazy, Suspense, useEffect, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"

// Lazy load tab components - same as SettingsModal
const AccountSettings = lazy(() =>
  import("@/components/settings/tabs/AccountSettings").then(m => ({ default: m.AccountSettings })),
)
const LLMSettings = lazy(() => import("@/components/settings/tabs/LLMSettings").then(m => ({ default: m.LLMSettings })))
const GoalSettings = lazy(() =>
  import("@/components/settings/tabs/GoalSettings").then(m => ({ default: m.GoalSettings })),
)
const UserPromptsSettings = lazy(() =>
  import("@/components/settings/tabs/UserPromptsSettings").then(m => ({ default: m.UserPromptsSettings })),
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
const SettingsTabLayout = lazy(() =>
  import("@/components/settings/tabs/SettingsTabLayout").then(m => ({ default: m.SettingsTabLayout })),
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

type SettingsTab =
  | "account"
  | "llm"
  | "goal"
  | "prompts"
  | "organization"
  | "websites"
  | "automations"
  | "integrations"
  | "keys"
  | "flags"
  | "admin"

interface TabDefinition {
  id: SettingsTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const allTabs: TabDefinition[] = [
  { id: "account", label: "Profile", icon: User },
  { id: "llm", label: "AI", icon: Bot },
  { id: "goal", label: "Project", icon: Target },
  { id: "prompts", label: "Prompts", icon: ClipboardList },
  { id: "organization", label: "Workspace", icon: Building2 },
  { id: "websites", label: "Websites", icon: Globe },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "integrations", label: "Integrations", icon: Link },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "flags", label: "Flags", icon: Flag, adminOnly: true },
  { id: "admin", label: "Admin", icon: Shield, adminOnly: true },
]

export function SettingsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Get initial tab from URL or default to "account"
  const tabParam = searchParams.get("tab") as SettingsTab | null
  const [activeTab, setActiveTab] = useState<SettingsTab>(tabParam || "account")

  // Filter tabs based on admin status
  const tabs = allTabs.filter(tab => !tab.adminOnly || user?.isAdmin)

  // Validate tab param is valid
  useEffect(() => {
    if (tabParam && !tabs.some(t => t.id === tabParam)) {
      setActiveTab("account")
    } else if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam, tabs])

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" })
        if (!res.ok) {
          router.push("/")
          return
        }

        const data = await res.json()
        if (!data.ok || !data.user) {
          router.push("/")
          return
        }

        setAuthorized(true)
      } catch {
        router.push("/")
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [router])

  const handleTabChange = (tabId: SettingsTab) => {
    setActiveTab(tabId)
    setSidebarOpen(false)
    // Update URL without navigation
    const url = new URL(window.location.href)
    url.searchParams.set("tab", tabId)
    window.history.replaceState({}, "", url.toString())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!authorized) {
    return null
  }

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 relative z-30">
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
          w-64 md:w-52 h-full md:h-auto
          border-r border-zinc-200 dark:border-zinc-800
          bg-white dark:bg-zinc-900
          flex-shrink-0 flex flex-col
          transition-transform duration-200 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Desktop header */}
        <div className="hidden md:block p-4 border-b border-zinc-200 dark:border-zinc-800">
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
            onClick={() => setSidebarOpen(false)}
            className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto flex-1">
          {tabs.map(tab => {
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto px-4 md:px-8 py-2 md:py-0">
          <div className="max-w-3xl">
            <Suspense
              fallback={<div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-sm">Loading...</div>}
            >
              {activeTab === "account" && <AccountSettings />}
              {activeTab === "llm" && <LLMSettings />}
              {activeTab === "goal" && <GoalSettings />}
              {activeTab === "prompts" && <UserPromptsSettings />}
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
    </div>
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
