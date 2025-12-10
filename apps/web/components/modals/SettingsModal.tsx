"use client"

import { Bot, Building2, ClipboardList, Flag, Globe, Key, Link, Settings, Target, User, X } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"
import { useIsDesktop } from "@/hooks/useMediaQuery"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { IntegrationsList } from "@/components/settings/integrations-list"
import { UserEnvKeysSettings } from "@/components/settings/user-env-keys"
import {
  AccountSettings,
  LLMSettings,
  GoalSettings,
  UserPromptsSettings,
  WorkspaceSettings,
  WebsitesSettings,
  FlagsSettings,
  SettingsTabLayout,
} from "@/components/settings/tabs"

type SettingsTab =
  | "account"
  | "llm"
  | "goal"
  | "prompts"
  | "organization"
  | "websites"
  | "integrations"
  | "keys"
  | "flags"

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
  { id: "integrations", label: "Integrations", icon: <Link size={16} /> },
  { id: "keys", label: "API Keys", icon: <Key size={16} /> },
  { id: "flags", label: "Flags", icon: <Flag size={16} />, adminOnly: true },
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
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      data-testid="settings-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="relative bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:w-[95vw] sm:max-w-5xl h-[90vh] sm:min-h-[500px] sm:max-h-[680px] flex flex-col sm:flex-row overflow-hidden shadow-2xl border border-black/10 dark:border-white/10"
        onClick={e => e.stopPropagation()}
        role="document"
        initial={isDesktop ? { clipPath: "inset(50% 50% 50% 50%)" } : { y: "100%" }}
        animate={isDesktop ? { clipPath: "inset(0% 0% 0% 0%)" } : { y: 0 }}
        exit={isDesktop ? { clipPath: "inset(50% 50% 50% 50%)" } : { y: "100%" }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Mobile pull indicator */}
        <div className="sm:hidden w-full flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-black/20 dark:bg-white/20 rounded-full" />
        </div>

        {/* Mobile: Top Tabs | Desktop: Left Sidebar */}
        <div className="sm:w-56 bg-black/[0.02] dark:bg-white/[0.02] border-b sm:border-b-0 sm:border-r border-black/10 dark:border-white/10 flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-6 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
            <h2
              id="settings-dialog-title"
              className="text-base sm:text-lg font-semibold text-black dark:text-white flex items-center gap-2"
            >
              <Settings size={18} />
              <span>Settings</span>
            </h2>
            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-2 -mr-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors active:scale-95"
              aria-label="Close settings"
            >
              <X size={20} className="text-black/60 dark:text-white/60" />
            </button>
          </div>

          {/* Tabs Navigation - Mobile: horizontal scroll with labels, Desktop: vertical sidebar */}
          <div className="relative sm:flex-1">
            {/* Fade indicators for mobile horizontal scroll */}
            <div className="sm:hidden absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white dark:from-zinc-900 to-transparent z-10 pointer-events-none" />
            <div className="sm:hidden absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white dark:from-zinc-900 to-transparent z-10 pointer-events-none" />

            <nav className="flex sm:flex-col sm:flex-1 sm:p-3 px-2 sm:px-0 py-2 sm:py-0 gap-1.5 sm:gap-1 overflow-x-auto sm:overflow-x-visible overflow-y-hidden sm:overflow-y-auto scrollbar-hide">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 sm:flex-shrink flex flex-col sm:flex-row items-center gap-1 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap min-w-[56px] sm:min-w-0 ${
                    activeTab === tab.id
                      ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                      : "text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                  }`}
                >
                  <span className="[&>svg]:w-[18px] [&>svg]:h-[18px] sm:[&>svg]:w-4 sm:[&>svg]:h-4">{tab.icon}</span>
                  <span className="text-[10px] sm:text-sm leading-tight">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6">
            <div className="animate-in fade-in-0 duration-200">
              {activeTab === "account" && <AccountSettings onClose={onClose} />}
              {activeTab === "llm" && <LLMSettings onClose={onClose} />}
              {activeTab === "goal" && <GoalSettings onClose={onClose} />}
              {activeTab === "prompts" && <UserPromptsSettings onClose={onClose} />}
              {activeTab === "organization" && <WorkspaceSettings onClose={onClose} />}
              {activeTab === "websites" && <WebsitesSettings onClose={onClose} />}
              {activeTab === "integrations" && <IntegrationsListWithHeader onClose={onClose} />}
              {activeTab === "keys" && <UserEnvKeysWithHeader onClose={onClose} />}
              {activeTab === "flags" && <FlagsSettings onClose={onClose} />}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function IntegrationsListWithHeader({ onClose }: { onClose: () => void }) {
  return (
    <SettingsTabLayout
      title="Integrations"
      description="Connect external services to enhance your workspace"
      onClose={onClose}
    >
      <IntegrationsList />
    </SettingsTabLayout>
  )
}

function UserEnvKeysWithHeader({ onClose }: { onClose: () => void }) {
  return (
    <SettingsTabLayout title="API Keys" description="Store custom API keys for MCP integrations" onClose={onClose}>
      <UserEnvKeysSettings />
    </SettingsTabLayout>
  )
}
