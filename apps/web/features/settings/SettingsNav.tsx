"use client"

import { REFERRAL } from "@webalive/shared"
import { ChevronDown, Heart, LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import { Tooltip } from "@/components/ui/Tooltip"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { resetPostHogIdentity } from "@/lib/posthog"
import { useEmail } from "@/lib/providers/UserStoreProvider"
import { useSelectedOrgId } from "@/lib/stores/workspaceStore"
import { useSettingsTabContext } from "./SettingsTabProvider"
import type { SettingsTab, TabDefinition } from "./settings-tabs"

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
  onInvite?: () => void
}

export function SettingsNav({ onInvite }: SettingsNavProps) {
  const { tabs, activeTab, handleTabChange } = useSettingsTabContext()

  const primaryTabs = tabs.filter(t => !t.advanced && !t.superadminOnly)
  const advancedTabs = tabs.filter(t => t.advanced)
  const superadminTabs = tabs.filter(t => t.superadminOnly)

  return (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <nav className="p-2 space-y-1 overflow-y-auto flex-1">
        {primaryTabs.map(tab => (
          <NavTab key={tab.id} tab={tab} isActive={activeTab === tab.id} onSelect={handleTabChange} />
        ))}
        <CollapsibleSection label="Advanced" tabs={advancedTabs} activeTab={activeTab} onSelect={handleTabChange} />
        <CollapsibleSection label="Superadmin" tabs={superadminTabs} activeTab={activeTab} onSelect={handleTabChange} />
      </nav>

      {/* Footer: invite + user card */}
      <div className="flex-shrink-0 border-t border-black/[0.06] dark:border-white/[0.06]">
        {REFERRAL.ENABLED && onInvite && (
          <button
            type="button"
            onClick={onInvite}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
          >
            <Heart className="w-4 h-4 flex-shrink-0" />
            Share Alive
          </button>
        )}
        <UserCard />
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

function UserCard() {
  const email = useEmail()
  const { organizations, loading } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const [signingOut, setSigningOut] = useState(false)

  const selectedOrg = selectedOrgId ? organizations.find(o => o.org_id === selectedOrgId) : undefined
  // Still loading, or org list empty — don't show stale name
  const orgName = loading ? null : (selectedOrg?.name ?? organizations[0]?.name ?? null)

  const emailPrefix = email ? email.split("@")[0] : ""
  const avatarLetter = (emailPrefix || "U")[0].toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch("/api/logout", { method: "POST" })
      resetPostHogIdentity()
      window.location.href = "/"
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold text-black/60 dark:text-white/60">{avatarLetter}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-black/90 dark:text-white/90 truncate">{emailPrefix}</p>
        {orgName && <p className="text-xs text-black/40 dark:text-white/40 truncate">{orgName}</p>}
      </div>
      <Tooltip content="Sign out">
        <button
          type="button"
          data-testid="logout-button"
          disabled={signingOut}
          onClick={handleSignOut}
          className="flex-shrink-0 p-1.5 rounded-md text-black/30 dark:text-white/30 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </Tooltip>
    </div>
  )
}
