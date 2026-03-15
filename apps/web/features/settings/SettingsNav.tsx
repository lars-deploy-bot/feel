"use client"

import { REFERRAL } from "@webalive/shared"
import { ChevronDown, Heart } from "lucide-react"
import { useEffect, useState } from "react"
import { OrganizationWorkspaceSwitcher } from "@/components/workspace/OrganizationWorkspaceSwitcher"
import { useWorkspace } from "@/features/workspace/hooks/useWorkspace"
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
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#b5afa3] dark:text-[#5c574d] hover:text-[#8a8578] dark:hover:text-[#7a756b] hover:bg-[#4a7c59]/[0.04] dark:hover:bg-[#7cb88a]/[0.04] transition-all duration-150 ease-out"
      >
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ease-out ${isOpen ? "" : "-rotate-90"}`}
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
  const { workspace } = useWorkspace({ allowEmpty: true })

  const primaryTabs = tabs.filter(t => !t.advanced && !t.superadminOnly)
  const advancedTabs = tabs.filter(t => t.advanced)
  const superadminTabs = tabs.filter(t => t.superadminOnly)

  return (
    <div className="flex flex-col h-full">
      {/* Org switcher */}
      <div className="px-3 pt-2 pb-1">
        <OrganizationWorkspaceSwitcher workspace={workspace} compact orgOnly />
      </div>
      {/* Tab navigation */}
      <nav className="p-2 space-y-1 overflow-y-auto flex-1">
        {primaryTabs.map(tab => (
          <NavTab key={tab.id} tab={tab} isActive={activeTab === tab.id} onSelect={handleTabChange} />
        ))}
        <CollapsibleSection label="Advanced" tabs={advancedTabs} activeTab={activeTab} onSelect={handleTabChange} />
        <CollapsibleSection label="Superadmin" tabs={superadminTabs} activeTab={activeTab} onSelect={handleTabChange} />
      </nav>

      {/* Footer: invite */}
      {REFERRAL.ENABLED && onInvite && (
        <div className="flex-shrink-0 border-t border-[#4a7c59]/[0.06] dark:border-[#7cb88a]/[0.04]">
          <button
            type="button"
            onClick={onInvite}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#8a8578] dark:text-[#7a756b] hover:text-[#5c574d] dark:hover:text-[#b5afa3] hover:bg-[#4a7c59]/[0.04] dark:hover:bg-[#7cb88a]/[0.04] transition-all duration-150 ease-out"
          >
            <Heart className="w-4 h-4 flex-shrink-0" />
            Share Alive
          </button>
        </div>
      )}
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
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ease-out ${
        isActive
          ? "bg-[#4a7c59]/[0.08] dark:bg-[#7cb88a]/[0.08] text-[#2c2a26] dark:text-[#e8e4dc] font-medium"
          : "text-[#8a8578] dark:text-[#7a756b] hover:bg-[#4a7c59]/[0.05] dark:hover:bg-[#7cb88a]/[0.05] hover:text-[#5c574d] dark:hover:text-[#b5afa3]"
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {tab.label}
    </button>
  )
}
