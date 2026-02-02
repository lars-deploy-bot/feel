"use client"

import {
  Bot,
  Building2,
  ClipboardList,
  Flag,
  Globe,
  Key,
  Link,
  Settings,
  Shield,
  Target,
  User,
  X,
  Zap,
} from "lucide-react"
import { lazy, Suspense, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { useIsDesktop } from "@/hooks/useMediaQuery"

// Lazy load tab components - only load on demand to speed up modal opening
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

interface SettingsModalProps {
  onClose: () => void
  initialTab?: SettingsTab // Defaults to "account", use "organization" for error states
}

interface TabDefinition {
  id: SettingsTab
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const allTabs: TabDefinition[] = [
  { id: "account", label: "Profile", icon: <User size={16} /> },
  { id: "llm", label: "AI", icon: <Bot size={16} /> },
  { id: "goal", label: "Project", icon: <Target size={16} /> },
  { id: "prompts", label: "Prompts", icon: <ClipboardList size={16} /> },
  { id: "organization", label: "Workspace", icon: <Building2 size={16} /> },
  { id: "websites", label: "Websites", icon: <Globe size={16} /> },
  { id: "automations", label: "Automations", icon: <Zap size={16} /> },
  { id: "integrations", label: "Integrations", icon: <Link size={16} /> },
  { id: "keys", label: "API Keys", icon: <Key size={16} /> },
  { id: "flags", label: "Flags", icon: <Flag size={16} />, adminOnly: true },
  { id: "admin", label: "Admin", icon: <Shield size={16} />, adminOnly: true },
]

export function SettingsModal({ onClose, initialTab }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || "account")
  const isDesktop = useIsDesktop()
  const { user } = useAuth()

  // Filter tabs based on admin status
  const tabs = allTabs.filter(tab => !tab.adminOnly || user?.isAdmin)

  // Don't render until we know viewport size to prevent animation mismatch
  if (isDesktop === null) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      data-testid="settings-modal"
    >
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-2xl w-full sm:w-[95vw] sm:max-w-5xl h-[92dvh] sm:min-h-[500px] sm:max-h-[680px] flex flex-col sm:flex-row overflow-hidden shadow-2xl border border-black/[0.08] dark:border-white/[0.08] ring-1 ring-black/[0.04] dark:ring-white/[0.04]"
        onClick={e => e.stopPropagation()}
        role="document"
      >
        {/* Mobile pull indicator */}
        <div className="sm:hidden w-full flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 bg-black/15 dark:bg-white/15 rounded-full" />
        </div>

        {/* Mobile: Top Tabs | Desktop: Left Sidebar */}
        <div className="shrink-0 sm:w-52 border-b sm:border-b-0 sm:border-r border-black/[0.06] dark:border-white/[0.06] flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-5 py-3 sm:py-5 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <h2
              id="settings-dialog-title"
              className="text-base font-semibold text-black/90 dark:text-white/90 flex items-center gap-2.5"
            >
              <Settings size={18} strokeWidth={1.75} className="text-black/40 dark:text-white/40" />
              <span>Settings</span>
            </h2>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden inline-flex items-center justify-center size-10 rounded-xl text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70 bg-black/[0.04] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] active:bg-black/[0.12] dark:active:bg-white/[0.12] active:scale-95 transition-all duration-150"
              aria-label="Close settings"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Mobile: Icon grid | Desktop: Vertical list */}
          <nav className="p-2 sm:p-2.5 sm:flex-1">
            {/* Mobile: Compact grid of icon buttons (4 cols = balanced rows for 8 tabs) */}
            <div className="grid grid-cols-4 gap-1.5 sm:hidden">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl transition-all duration-150 active:scale-95 ${
                    activeTab === tab.id
                      ? "bg-black dark:bg-white text-white dark:text-black"
                      : "text-black/50 dark:text-white/50 bg-black/[0.03] dark:bg-white/[0.03] active:bg-black/[0.08] dark:active:bg-white/[0.08]"
                  }`}
                >
                  <span className="[&>svg]:w-5 [&>svg]:h-5 [&>svg]:stroke-[1.5]">{tab.icon}</span>
                  <span className="text-[10px] font-medium leading-none">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Desktop: Vertical list */}
            <div className="hidden sm:flex sm:flex-col gap-0.5">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    activeTab === tab.id
                      ? "bg-black/[0.08] dark:bg-white/[0.10] text-black/90 dark:text-white/90"
                      : "text-black/50 dark:text-white/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-black/70 dark:hover:text-white/70"
                  }`}
                >
                  <span className="[&>svg]:w-4 [&>svg]:h-4 [&>svg]:stroke-[1.75]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-2 sm:py-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-0">
            <div className="animate-in fade-in-0 duration-200">
              <Suspense
                fallback={<div className="py-12 text-center text-black/40 dark:text-white/40 text-sm">Loading...</div>}
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
          </div>
        </div>
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
