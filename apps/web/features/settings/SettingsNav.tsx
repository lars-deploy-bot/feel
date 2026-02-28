"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { useSelectedOrgId } from "@/lib/stores/workspaceStore"
import type { SettingsTab, TabDefinition } from "./settings-tabs"
import { useSettingsTabContext } from "./SettingsTabProvider"

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
