"use client"

import { lazy, Suspense } from "react"
import { GeneralSettings } from "@/features/settings/tabs/GeneralSettings"
import { useSettingsTabContext } from "./SettingsTabProvider"
import { SettingsTabLayout } from "./tabs/SettingsTabLayout"

// Lazy load non-default tab components (General is eager — it's the default tab)
const SkillsSettings = lazy(() =>
  import("@/features/settings/tabs/SkillsSettings").then(m => ({ default: m.SkillsSettings })),
)
const WorkspaceSettings = lazy(() =>
  import("@/features/settings/tabs/WorkspaceSettings").then(m => ({ default: m.WorkspaceSettings })),
)
const WebsitesSettings = lazy(() =>
  import("@/features/settings/tabs/WebsitesSettings").then(m => ({ default: m.WebsitesSettings })),
)
const FlagsSettings = lazy(() =>
  import("@/features/settings/tabs/FlagsSettings").then(m => ({ default: m.FlagsSettings })),
)
const AdminSettings = lazy(() =>
  import("@/features/settings/tabs/AdminSettings").then(m => ({ default: m.AdminSettings })),
)
const IntegrationsList = lazy(() =>
  import("@/features/settings/integrations-list").then(m => ({ default: m.IntegrationsList })),
)
const UserEnvKeysSettings = lazy(() =>
  import("@/features/settings/user-env-keys").then(m => ({ default: m.UserEnvKeysSettings })),
)
const AutomationsSettings = lazy(() =>
  import("@/features/settings/tabs/AutomationsSettings").then(m => ({ default: m.AutomationsSettings })),
)
const BillingSettings = lazy(() =>
  import("@/features/settings/tabs/BillingSettings").then(m => ({ default: m.BillingSettings })),
)
const SessionsSettings = lazy(() =>
  import("@/features/settings/tabs/SessionsSettings").then(m => ({ default: m.SessionsSettings })),
)

// ---------------------------------------------------------------------------
// SettingsContent — the content panel (no sidebar, rendered in main area)
// ---------------------------------------------------------------------------

export function SettingsContent() {
  const { activeTab } = useSettingsTabContext()
  const isFixedTab = activeTab === "automations"
  const isWideTab = activeTab === "websites" || activeTab === "integrations"

  return (
    <div
      className={
        isFixedTab ? "w-full h-full overflow-hidden px-4 md:px-8 pt-4 md:pt-5 pb-2" : "px-4 md:px-8 pt-4 md:pt-5 pb-8"
      }
    >
      <div className={isFixedTab ? "w-full h-full" : isWideTab ? "w-full" : "max-w-3xl"}>
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
// Wrapper components for tabs that need a layout header
// ---------------------------------------------------------------------------

function IntegrationsListWithHeader() {
  return (
    <SettingsTabLayout
      title="Integrations"
      description="Connect your personal accounts. Only you can use your connected integrations."
    >
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
