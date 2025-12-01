"use client"

import {
  Bot,
  Building2,
  ChevronDown,
  ClipboardList,
  Eye,
  EyeOff,
  Globe,
  Link,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  UserMinus,
  X,
} from "lucide-react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { AddWorkspaceModal } from "@/components/modals/AddWorkspaceModal"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { PromptEditorModal } from "@/components/modals/PromptEditorModal"
import { IntegrationsList } from "@/components/settings/integrations-list"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import type { Organization } from "@/lib/api/types"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { canRemoveMember } from "@/lib/permissions/org-permissions"
import { useUserPrompts, useUserPromptsActions } from "@/lib/providers/UserPromptsStoreProvider"
import { useCredits, useCreditsError, useCreditsLoading, useUserActions } from "@/lib/providers/UserStoreProvider"
import { getModelDisplayName } from "@/lib/models/claude-models"
import { CLAUDE_MODELS, type ClaudeModel, DEFAULT_MODEL, useLLMStore } from "@/lib/stores/llmStore"
import { useCurrentWorkspace, useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"

type SettingsTab = "account" | "llm" | "prompts" | "organization" | "websites" | "integrations"

interface SettingsModalProps {
  onClose: () => void
  initialTab?: SettingsTab // Defaults to "account", use "organization" for error states
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Profile", icon: <User size={16} /> },
  { id: "llm", label: "AI", icon: <Bot size={16} /> },
  { id: "prompts", label: "Prompts", icon: <ClipboardList size={16} /> },
  { id: "organization", label: "Workspace", icon: <Building2 size={16} /> },
  { id: "websites", label: "Websites", icon: <Globe size={16} /> },
  { id: "integrations", label: "Integrations", icon: <Link size={16} /> },
]

export function SettingsModal({ onClose, initialTab }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || "account")
  // Default to true on SSR to avoid hydration mismatch causing wrong animation
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 640)
    checkDesktop()
    window.addEventListener("resize", checkDesktop)
    return () => window.removeEventListener("resize", checkDesktop)
  }, [])

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
              {activeTab === "prompts" && <UserPromptsSettings onClose={onClose} />}
              {activeTab === "organization" && <WorkspaceSettings onClose={onClose} />}
              {activeTab === "websites" && <WebsitesSettings onClose={onClose} />}
              {activeTab === "integrations" && <IntegrationsListWithHeader onClose={onClose} />}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Reusable layout wrapper for all settings tabs
function SettingsTabLayout({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      {/* Header with title and close button (close button hidden on mobile - use main header) */}
      <div className="flex items-start justify-between gap-4 pt-4 sm:pt-5 pb-3 sm:pb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-0.5 sm:mb-1">{title}</h3>
          {description && (
            <p className="text-xs sm:text-sm text-black/60 dark:text-white/60 leading-relaxed">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hidden sm:flex flex-shrink-0 p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors active:scale-95"
          aria-label="Close settings"
        >
          <X size={18} className="text-black/60 dark:text-white/60" />
        </button>
      </div>

      {/* Content */}
      <div className="pb-6 sm:pb-6">{children}</div>
    </div>
  )
}

function isValidModel(value: string): value is ClaudeModel {
  return Object.values(CLAUDE_MODELS).includes(value as ClaudeModel)
}

function LLMSettings({ onClose }: { onClose: () => void }) {
  const { apiKey, model, setApiKey, setModel, clearApiKey, error } = useLLMStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [isSaved, setIsSaved] = useState(false)

  // Credits state
  const credits = useCredits()
  const creditsLoading = useCreditsLoading()
  const creditsError = useCreditsError()
  const { fetchCredits } = useUserActions()

  // Check if user can select any model (server-side flag based on UNRESTRICTED_MODEL_EMAILS env var)
  const { user: sessionUser } = useAuth()
  const canSelectAnyModel = sessionUser?.canSelectAnyModel ?? false

  // Get current workspace from store
  const workspace = useCurrentWorkspace()

  useEffect(() => {
    setApiKeyInput(apiKey || "")
  }, [apiKey])

  // Fetch credits when component mounts
  useEffect(() => {
    if (workspace && !apiKey) {
      fetchCredits(workspace)
    }
  }, [fetchCredits, apiKey, workspace])

  const handleSaveApiKey = () => {
    const trimmedKey = apiKeyInput.trim()
    setApiKey(trimmedKey || null)
    if (!error) {
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }

  const handleClearApiKey = () => {
    clearApiKey()
    setApiKeyInput("")
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (isValidModel(value)) {
      setModel(value)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyInput(e.target.value)
    if (error) {
      useLLMStore.getState().setError(null)
    }
  }

  const isKeyChanged = apiKeyInput !== (apiKey || "")

  return (
    <SettingsTabLayout title="AI Model" description="Configure your AI settings" onClose={onClose}>
      <div className="space-y-4 sm:space-y-6">
        {/* Credits Display - Only show when using workspace credits */}
        {!apiKey && (
          <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-50">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-black dark:text-white">Credits</h4>
              <span className="text-lg font-semibold text-black dark:text-white">
                {creditsLoading ? "Loading..." : creditsError ? "—" : credits != null ? credits.toFixed(2) : "—"}
              </span>
            </div>
          </div>
        )}

        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
          <label htmlFor="anthropic-api-key" className="block text-sm font-medium text-black dark:text-white mb-2">
            Your API Key
            <span className="ml-2 text-xs text-black/50 dark:text-white/50">(optional)</span>
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-3">Use your own key to unlock all models</p>
          <div className="space-y-3">
            <div className="relative">
              <input
                id="anthropic-api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={handleInputChange}
                placeholder="sk-ant-..."
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 pr-20 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors font-mono"
                aria-label="Anthropic API Key"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveApiKey}
                disabled={!isKeyChanged}
                className="flex-1 px-4 py-3 sm:py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg sm:rounded text-sm font-medium hover:bg-black/80 dark:hover:bg-white/80 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaved ? "Saved!" : "Save API Key"}
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="px-4 py-3 sm:py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-lg sm:rounded text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-[0.98] transition-all duration-200"
                >
                  Clear
                </button>
              )}
            </div>
            {apiKey && !error && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
                API key saved in browser
              </div>
            )}
          </div>
        </div>

        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <label htmlFor="claude-model" className="block text-sm font-medium text-black dark:text-white mb-2">
            Model
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-3">
            {apiKey || canSelectAnyModel
              ? "Choose which Claude model to use"
              : `Currently using ${getModelDisplayName(DEFAULT_MODEL)}`}
          </p>
          <select
            id="claude-model"
            value={model}
            onChange={handleModelChange}
            disabled={!apiKey && !canSelectAnyModel}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Claude Model Selection"
          >
            <option value={CLAUDE_MODELS.OPUS_4_5}>Claude Opus 4.5</option>
            <option value={CLAUDE_MODELS.SONNET_4_5}>Claude Sonnet 4.5 (Recommended)</option>
            <option value={CLAUDE_MODELS.HAIKU_4_5}>Claude Haiku 4.5</option>
          </select>
        </div>

        <div className="p-4 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
          <p className="text-xs text-black/70 dark:text-white/70 leading-relaxed">
            Your API key is stored only in your browser (hidden from view). When you send messages, we use your key to
            call Anthropic&apos;s API—but we never save it on our servers.
          </p>
        </div>
      </div>
    </SettingsTabLayout>
  )
}

function AccountSettings({ onClose }: { onClose: () => void }) {
  // Get email from auth session (read-only)
  const { user } = useAuth()
  const router = useRouter()
  const { setCurrentWorkspace } = useWorkspaceActions()

  // Theme state
  const { theme, setTheme } = useTheme()

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      })
      // Clear workspace from store
      setCurrentWorkspace(null)
      // Redirect to login
      router.push("/")
    } catch (error) {
      console.error("Logout failed:", error)
    }
  }

  return (
    <SettingsTabLayout title="Profile" description="Your account information and preferences" onClose={onClose}>
      <div className="space-y-4 sm:space-y-6">
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
          <p className="text-sm font-medium text-black dark:text-white mb-2">Email Address</p>
          <div className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded text-sm text-black dark:text-white">
            {user?.email || "—"}
          </div>
        </div>

        {/* Theme Section */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-175">
          <p className="text-sm font-medium text-black dark:text-white mb-3">Theme</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 border rounded transition-all duration-200 min-h-[80px] sm:min-h-[96px] ${
                theme === "light"
                  ? "border-black dark:border-white bg-black/5 dark:bg-white/5 shadow-sm"
                  : "border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:shadow-sm"
              }`}
            >
              <Sun size={18} className="sm:w-5 sm:h-5 text-black dark:text-white" />
              <span className="text-xs text-black/60 dark:text-white/60 text-center">Light</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 border rounded transition-all duration-200 min-h-[80px] sm:min-h-[96px] ${
                theme === "dark"
                  ? "border-black dark:border-white bg-black/5 dark:bg-white/5 shadow-sm"
                  : "border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:shadow-sm"
              }`}
            >
              <Moon size={18} className="sm:w-5 sm:h-5 text-black dark:text-white" />
              <span className="text-xs text-black/60 dark:text-white/60 text-center">Dark</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("system")}
              className={`flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-3 sm:p-4 border rounded transition-all duration-200 min-h-[80px] sm:min-h-[96px] ${
                theme === "system"
                  ? "border-2 border-black dark:border-white bg-black/5 dark:bg-white/5 shadow-sm"
                  : "border border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-1">
                <Sun size={11} className="sm:w-3 sm:h-3 text-black dark:text-white" />
                <Moon size={11} className="sm:w-3 sm:h-3 text-black dark:text-white" />
              </div>
              <span className="text-xs font-medium text-black dark:text-white text-center">System</span>
            </button>
          </div>
        </div>

        {/* Logout Section */}
        <div className="pt-4 border-t border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-200">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            data-testid="logout-button"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </SettingsTabLayout>
  )
}

interface OrgMember {
  user_id: string
  email: string
  display_name: string | null
  role: "owner" | "admin" | "member"
}

// Hook: Organization name editing
function useOrgEditor(refetch: () => Promise<void>) {
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [editOrgName, setEditOrgName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEdit = (org: Organization) => {
    setEditingOrgId(org.org_id)
    setEditOrgName(org.name)
  }

  const cancelEdit = () => {
    setEditingOrgId(null)
    setEditOrgName("")
    setError(null)
  }

  const saveEdit = async (orgId: string) => {
    if (!editOrgName.trim()) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch("/api/auth/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ org_id: orgId, name: editOrgName.trim() }),
      })

      const data = await res.json()

      if (data.ok) {
        await refetch()
        setEditingOrgId(null)
        setEditOrgName("")
      } else {
        setError(data.error || "Failed to update organization")
      }
    } catch (err) {
      console.error("Failed to update organization:", err)
      setError("Failed to update organization")
    } finally {
      setSaving(false)
    }
  }

  return { editingOrgId, editOrgName, setEditOrgName, saving, error, startEdit, cancelEdit, saveEdit }
}

// Hook: Organization members management
function useOrgMembers() {
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
  const [orgMembers, setOrgMembers] = useState<Record<string, OrgMember[]>>({})
  const [loadingMembers, setLoadingMembers] = useState<Record<string, boolean>>({})
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [memberToRemove, setMemberToRemove] = useState<{ orgId: string; userId: string; email: string } | null>(null)

  const toggleMembers = async (orgId: string) => {
    if (expandedOrgId === orgId) {
      setExpandedOrgId(null)
      return
    }

    setExpandedOrgId(orgId)

    if (!orgMembers[orgId]) {
      try {
        setLoadingMembers(prev => ({ ...prev, [orgId]: true }))
        const res = await fetch(`/api/auth/org-members?orgId=${orgId}`, { credentials: "include" })
        const data = await res.json()
        if (data.ok) {
          setOrgMembers(prev => ({ ...prev, [orgId]: data.members }))
        }
      } catch (err) {
        console.error("Failed to fetch members:", err)
      } finally {
        setLoadingMembers(prev => ({ ...prev, [orgId]: false }))
      }
    }
  }

  const requestRemoveMember = (orgId: string, userId: string, email: string) => {
    setMemberToRemove({ orgId, userId, email })
  }

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return

    const { orgId, userId, email } = memberToRemove

    try {
      setRemovingMember(userId)
      setMemberToRemove(null)

      const res = await fetch("/api/auth/org-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId, targetUserId: userId }),
      })

      const data = await res.json()

      if (data.ok) {
        setOrgMembers(prev => ({ ...prev, [orgId]: prev[orgId].filter(m => m.user_id !== userId) }))
        toast.success(`Removed ${email} from organization`)
      } else {
        toast.error(data.message || "Failed to remove member")
      }
    } catch (err) {
      console.error("Failed to remove member:", err)
      toast.error("Failed to remove member")
    } finally {
      setRemovingMember(null)
    }
  }

  const cancelRemoveMember = () => setMemberToRemove(null)

  return {
    expandedOrgId,
    orgMembers,
    loadingMembers,
    removingMember,
    memberToRemove,
    toggleMembers,
    requestRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,
  }
}

// Hook: Leave organization
function useOrgLeave() {
  const [leavingOrg, setLeavingOrg] = useState<string | null>(null)
  const [orgToLeave, setOrgToLeave] = useState<{ orgId: string; orgName: string } | null>(null)

  const requestLeave = (orgId: string, orgName: string) => {
    setOrgToLeave({ orgId, orgName })
  }

  const confirmLeave = async () => {
    if (!orgToLeave) return

    const { orgId, orgName } = orgToLeave

    try {
      setLeavingOrg(orgId)
      setOrgToLeave(null)

      const res = await fetch("/api/auth/org-members/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      })

      const data = await res.json()

      if (data.ok) {
        toast.success(`Left ${orgName}`)
        window.location.reload()
      } else {
        toast.error(data.message || "Failed to leave organization")
      }
    } catch (err) {
      console.error("Failed to leave org:", err)
      toast.error("Failed to leave organization")
    } finally {
      setLeavingOrg(null)
    }
  }

  const cancelLeave = () => setOrgToLeave(null)

  return { leavingOrg, orgToLeave, requestLeave, confirmLeave, cancelLeave }
}

// Cache for org sites (lives outside component for persistence)
const orgSitesCache = new Map<string, string[]>()

// Custom hook for fetching workspaces with caching
function useOrgWorkspaces(orgId: string) {
  const [workspaces, setWorkspaces] = useState<string[]>(() => orgSitesCache.get(orgId) || [])
  const [loading, setLoading] = useState(!orgSitesCache.has(orgId))
  const [error, setError] = useState<string | null>(null)

  const fetchWorkspaces = useCallback(() => {
    if (!orgSitesCache.has(orgId)) setLoading(true)
    setError(null)

    fetch(`/api/auth/workspaces?org_id=${orgId}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`Failed to load sites (${res.status})`))))
      .then(data => {
        if (data.ok && data.workspaces) {
          setWorkspaces(data.workspaces)
          orgSitesCache.set(orgId, data.workspaces)
          setError(null)
        } else {
          throw new Error(data.error || "Failed to load sites")
        }
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : "Network error"
        setError(errorMessage)
        if (!orgSitesCache.has(orgId)) setWorkspaces([])
      })
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    const cached = orgSitesCache.get(orgId)
    if (cached) {
      setWorkspaces(cached)
      setLoading(false)
    }
    fetchWorkspaces()
  }, [fetchWorkspaces, orgId])

  return { workspaces, loading, error, refetch: fetchWorkspaces }
}

// Custom hook for workspace switching
// Uses the store as the single source of truth
function useWorkspaceSwitch() {
  const currentWorkspace = useCurrentWorkspace()
  const { setCurrentWorkspace } = useWorkspaceActions()
  const [optimisticWorkspace, setOptimisticWorkspace] = useState<string | null>(null)

  const switchWorkspace = useCallback(
    (workspace: string, orgId: string) => {
      // Optimistic update for immediate feedback
      setOptimisticWorkspace(workspace)
      // Update the store (single source of truth)
      setCurrentWorkspace(workspace, orgId)
      // Navigate to chat
      setTimeout(() => {
        window.location.href = "/chat"
      }, 100)
    },
    [setCurrentWorkspace],
  )

  return {
    currentWorkspace: optimisticWorkspace || currentWorkspace,
    switchWorkspace,
  }
}

function _OrgSitesSection({ orgId }: { orgId: string }) {
  const { workspaces, loading, error, refetch } = useOrgWorkspaces(orgId)
  const { currentWorkspace, switchWorkspace } = useWorkspaceSwitch()
  const [showAddModal, setShowAddModal] = useState(false)

  // Wrap switchWorkspace to include orgId
  const handleSwitch = useCallback(
    (workspace: string) => {
      switchWorkspace(workspace, orgId)
    },
    [switchWorkspace, orgId],
  )

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-medium text-black dark:text-white">Spaces</h5>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        >
          + Add Space
        </button>
      </div>

      <WorkspacesGrid
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        loading={loading}
        error={error}
        onSwitch={handleSwitch}
        onRetry={refetch}
      />

      {showAddModal && <AddWorkspaceModal onClose={() => setShowAddModal(false)} onSuccess={refetch} />}
    </div>
  )
}

// Reusable workspaces grid component
function WorkspacesGrid({
  workspaces,
  currentWorkspace,
  loading,
  error,
  onSwitch,
  onRetry,
}: {
  workspaces: string[]
  currentWorkspace: string | null
  loading: boolean
  error: string | null
  onSwitch: (workspace: string) => void
  onRetry?: () => void
}) {
  if (loading) {
    return (
      <div className="px-3 py-4 text-xs text-black/40 dark:text-white/40 text-center rounded-md bg-black/5 dark:bg-white/5">
        Loading websites...
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-3 py-3 text-xs text-center rounded-md bg-red-50 dark:bg-red-950/20 space-y-2">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  if (workspaces.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-black/40 dark:text-white/40 text-center rounded-md bg-black/5 dark:bg-white/5">
        No websites yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {workspaces.map(workspace => {
        const isCurrent = workspace === currentWorkspace
        return (
          <div
            key={workspace}
            className={`px-3 py-3 sm:py-2.5 rounded-lg sm:rounded border transition-all active:scale-[0.98] ${
              isCurrent
                ? "border-black dark:border-white bg-black/5 dark:bg-white/5"
                : "border-black/20 dark:border-white/20 hover:border-black dark:hover:border-white cursor-pointer"
            }`}
            onClick={() => !isCurrent && onSwitch(workspace)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if ((e.key === "Enter" || e.key === " ") && !isCurrent) {
                e.preventDefault()
                onSwitch(workspace)
              }
            }}
          >
            <div className="flex items-center sm:flex-col sm:items-start justify-between sm:justify-start gap-2 sm:gap-1.5">
              <span className="text-sm font-medium text-black dark:text-white truncate flex-1" title={workspace}>
                {workspace}
              </span>
              {isCurrent ? (
                <span className="text-xs px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded flex-shrink-0">
                  Current
                </span>
              ) : (
                <span className="text-xs text-black/50 dark:text-white/50 flex-shrink-0">Tap to switch</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorkspaceSettings({ onClose }: { onClose: () => void }) {
  const { organizations, currentUserId, loading, error, refetch } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const { setSelectedOrg } = useWorkspaceActions()

  // Use extracted hooks for clean state management
  const editor = useOrgEditor(refetch)
  const members = useOrgMembers()
  const leave = useOrgLeave()

  // Invite state (TODO: Wire up invite UI)
  const [inviteEmail, setInviteEmail] = useState("")
  const [_inviting, setInviting] = useState(false)

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrg(orgId)
    editor.cancelEdit()
  }

  const getCurrentUserRole = (orgId: string): "owner" | "admin" | "member" | null => {
    const org = organizations.find(o => o.org_id === orgId)
    return org?.role || null
  }

  const _handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrgId) return

    setInviting(true)
    try {
      // TODO: Implement actual invite API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success(`Invitation sent to ${inviteEmail}`)
      setInviteEmail("")
    } catch (_err) {
      toast.error("Failed to send invitation")
    } finally {
      setInviting(false)
    }
  }

  return (
    <SettingsTabLayout title="Workspace" description="Invite teammates and manage your organization" onClose={onClose}>
      {/* Errors */}
      {error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400" data-testid="org-error-message">
            {error}
          </p>
          <button
            type="button"
            onClick={refetch}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
            data-testid="org-error-retry"
          >
            Retry
          </button>
        </div>
      )}
      {editor.error && (
        <div className="px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg text-sm text-red-600 dark:text-red-400">
          {editor.error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-8 h-8 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
          <p className="text-sm text-black/40 dark:text-white/40">Loading organizations...</p>
        </div>
      ) : organizations.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={48} className="mx-auto mb-4 text-black/20 dark:text-white/20" />
          <p className="text-sm text-black/60 dark:text-white/60 mb-4">No organizations found</p>
          <button
            type="button"
            className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:bg-black/80 dark:hover:bg-white/80 transition-colors"
          >
            Create Organization
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Organization Selector */}
          <div className="flex flex-wrap gap-2">
            {organizations.map(org => (
              <button
                key={org.org_id}
                type="button"
                onClick={() => handleSelectOrg(org.org_id)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  org.org_id === selectedOrgId
                    ? "bg-black dark:bg-white text-white dark:text-black font-medium"
                    : "bg-black/5 dark:bg-white/5 text-black/60 dark:text-white/60 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white"
                }`}
              >
                {org.name}
              </button>
            ))}
          </div>

          {/* Selected Organization Content */}
          {selectedOrgId &&
            (() => {
              const selectedOrg = organizations.find(org => org.org_id === selectedOrgId)
              if (!selectedOrg) return null

              // Auto-fetch members when org is selected
              if (!members.orgMembers[selectedOrg.org_id] && members.expandedOrgId !== selectedOrg.org_id) {
                members.toggleMembers(selectedOrg.org_id)
              }

              return (
                <div className="space-y-5">
                  {/* Quick Summary Bar */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-black/60 dark:text-white/60">
                    <span>
                      <strong className="text-black dark:text-white">{selectedOrg.credits.toFixed(2)}</strong> credits
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      <strong className="text-black dark:text-white">{selectedOrg.workspace_count || 0}</strong>{" "}
                      websites
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span>
                      <strong className="text-black dark:text-white">
                        {members.orgMembers[selectedOrg.org_id]?.length || 0}
                      </strong>{" "}
                      members
                    </span>
                  </div>

                  {/* PRIMARY: Invite Section */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-black dark:text-white">Invite teammates</h4>
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-xs text-black/60 dark:text-white/60">
                        Give access to <strong>{selectedOrg.name}</strong> workspace and shared credits
                      </p>
                      <p className="text-xs text-black/50 dark:text-white/50 mt-1">
                        Contact us to enable team invitations for your organization
                      </p>
                    </div>
                    <div className="flex gap-2 opacity-50">
                      <input
                        type="email"
                        placeholder="email@example.com"
                        disabled
                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                      />
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Invite
                      </button>
                    </div>
                  </div>

                  {/* Members List - Always Visible */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-black dark:text-white">Members</h4>
                    </div>

                    {members.loadingMembers[selectedOrg.org_id] ? (
                      <div className="py-8 text-center">
                        <div className="inline-block w-5 h-5 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
                      </div>
                    ) : members.orgMembers[selectedOrg.org_id] && members.orgMembers[selectedOrg.org_id].length > 0 ? (
                      <div className="space-y-2">
                        {members.orgMembers[selectedOrg.org_id].map(member => {
                          const currentUserRole = getCurrentUserRole(selectedOrg.org_id)
                          const isCurrentUser = member.user_id === currentUserId
                          const canRemove = canRemoveMember(currentUserRole, member.role, isCurrentUser)

                          return (
                            <div
                              key={member.user_id}
                              className="flex items-start sm:items-center justify-between px-3 py-3 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 transition-colors gap-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
                                  <span className="text-sm font-medium text-black dark:text-white truncate max-w-[180px] sm:max-w-none">
                                    {member.display_name || member.email}
                                    {isCurrentUser && (
                                      <span className="ml-1 text-xs font-normal text-black/50 dark:text-white/50">
                                        (you)
                                      </span>
                                    )}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                      member.role === "owner"
                                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                        : member.role === "admin"
                                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                          : "bg-black/5 dark:bg-white/10 text-black/60 dark:text-white/60"
                                    }`}
                                  >
                                    {member.role}
                                  </span>
                                </div>
                                <div className="text-xs text-black/50 dark:text-white/50 truncate">{member.email}</div>
                              </div>

                              {canRemove && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    members.requestRemoveMember(selectedOrg.org_id, member.user_id, member.email)
                                  }
                                  disabled={members.removingMember === member.user_id}
                                  className="flex-shrink-0 p-2 sm:p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg sm:rounded transition-colors disabled:opacity-50"
                                  title="Remove member"
                                >
                                  <UserMinus size={18} className="sm:w-4 sm:h-4" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-black/40 dark:text-white/40">
                        No members yet. Invite someone above!
                      </div>
                    )}
                  </div>

                  {/* Advanced Actions */}
                  <details className="group">
                    <summary className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] cursor-pointer transition-colors">
                      <span className="text-sm font-medium text-black dark:text-white">Advanced</span>
                      <ChevronDown
                        size={16}
                        className="text-black/60 dark:text-white/60 group-open:rotate-180 transition-transform"
                      />
                    </summary>
                    <div className="mt-3 space-y-3 px-1">
                      {/* Rename Organization */}
                      <div>
                        <label
                          htmlFor="org-name-input"
                          className="block text-xs font-medium text-black dark:text-white mb-2"
                        >
                          Organization name
                        </label>
                        {editor.editingOrgId === selectedOrg.org_id ? (
                          <div className="flex gap-2">
                            <input
                              id="org-name-input"
                              type="text"
                              value={editor.editOrgName}
                              onChange={e => editor.setEditOrgName(e.target.value)}
                              className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                            />
                            <button
                              type="button"
                              onClick={() => editor.saveEdit(selectedOrg.org_id)}
                              disabled={!editor.editOrgName.trim() || editor.saving}
                              className="px-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
                            >
                              {editor.saving ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={editor.cancelEdit}
                              className="px-3 py-2 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between px-3 py-2 bg-black/5 dark:bg-white/5 rounded-lg">
                            <span className="text-sm text-black dark:text-white">{selectedOrg.name}</span>
                            <button
                              type="button"
                              onClick={() => editor.startEdit(selectedOrg)}
                              className="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
                            >
                              Rename
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Leave Organization */}
                      <div className="pt-3 border-t border-black/10 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => leave.requestLeave(selectedOrg.org_id, selectedOrg.name)}
                          disabled={leave.leavingOrg === selectedOrg.org_id}
                          className="text-xs text-red-600/70 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {leave.leavingOrg === selectedOrg.org_id ? "Leaving..." : "Leave organization"}
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              )
            })()}
        </div>
      )}

      {/* Delete Member Confirmation Modal */}
      {members.memberToRemove && (
        <DeleteModal
          title="Remove Member"
          message={
            <>
              Are you sure you want to remove <strong>{members.memberToRemove.email}</strong> from this organization?
              <br />
              <br />
              This action cannot be undone.
            </>
          }
          confirmText="Remove"
          onConfirm={members.confirmRemoveMember}
          onCancel={members.cancelRemoveMember}
        />
      )}

      {/* Leave Organization Confirmation Modal */}
      {leave.orgToLeave && (
        <DeleteModal
          title="Leave Organization"
          message={
            <>
              Are you sure you want to leave <strong>{leave.orgToLeave.orgName}</strong>?
              <br />
              <br />
              This action cannot be undone.
            </>
          }
          confirmText="Leave"
          onConfirm={leave.confirmLeave}
          onCancel={leave.cancelLeave}
        />
      )}
    </SettingsTabLayout>
  )
}

// Hook to fetch workspaces for all organizations
function useAllOrgWorkspaces(organizations: Organization[]) {
  const [allWorkspaces, setAllWorkspaces] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (organizations.length === 0) {
      setLoading(false)
      return
    }

    setLoading(true)
    const results: Record<string, string[]> = {}

    await Promise.all(
      organizations.map(async org => {
        const cached = orgSitesCache.get(org.org_id)
        if (cached) {
          results[org.org_id] = cached
          return
        }

        try {
          const res = await fetch(`/api/auth/workspaces?org_id=${org.org_id}`)
          const data = res.ok ? await res.json() : null
          const workspaces = data?.ok ? data.workspaces : []
          results[org.org_id] = workspaces
          if (workspaces.length) orgSitesCache.set(org.org_id, workspaces)
        } catch {
          results[org.org_id] = []
        }
      }),
    )

    setAllWorkspaces(results)
    setLoading(false)
  }, [organizations])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { allWorkspaces, loading, refetch: fetchAll }
}

// Search input with clear button
function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 sm:left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-9 pr-10 py-3 sm:py-2.5 bg-white dark:bg-zinc-800 border border-black/20 dark:border-white/20 rounded-lg text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}

// Organization group header with workspace grid
function OrgWebsitesGroup({
  org,
  workspaces,
  currentWorkspace,
  onSwitch,
}: {
  org: Organization
  workspaces: string[]
  currentWorkspace: string | null
  onSwitch: (workspace: string, orgId: string) => void
}) {
  // Wrap onSwitch to include orgId
  const handleSwitch = useCallback(
    (workspace: string) => {
      onSwitch(workspace, org.org_id)
    },
    [onSwitch, org.org_id],
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={14} className="text-black/40 dark:text-white/40" />
        <h4 className="text-sm font-medium text-black dark:text-white">{org.name}</h4>
        <span className="text-xs text-black/40 dark:text-white/40">
          ({workspaces.length} website{workspaces.length !== 1 ? "s" : ""})
        </span>
      </div>
      <WorkspacesGrid
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        loading={false}
        error={null}
        onSwitch={handleSwitch}
      />
    </div>
  )
}

// Empty state component
function EmptyState({ icon: Icon, message }: { icon: typeof Globe; message: string }) {
  return (
    <div className="text-center py-12">
      <Icon size={48} className="mx-auto mb-4 text-black/20 dark:text-white/20" />
      <p className="text-sm text-black/60 dark:text-white/60">{message}</p>
    </div>
  )
}

// Loading spinner
function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-8 h-8 border-2 border-black/20 dark:border-white/20 border-t-black dark:border-t-white rounded-full animate-spin" />
      <p className="text-sm text-black/40 dark:text-white/40">{message}</p>
    </div>
  )
}

function WebsitesSettings({ onClose }: { onClose: () => void }) {
  const { organizations, loading: orgsLoading } = useOrganizations()
  const { allWorkspaces, loading: websitesLoading, refetch } = useAllOrgWorkspaces(organizations)
  const { currentWorkspace, switchWorkspace } = useWorkspaceSwitch()
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const loading = orgsLoading || websitesLoading
  const query = searchQuery.toLowerCase()

  // Filter workspaces by search
  const filteredGroups = organizations
    .map(org => ({
      org,
      workspaces: (allWorkspaces[org.org_id] || []).filter(w => !query || w.toLowerCase().includes(query)),
    }))
    .filter(g => g.workspaces.length > 0 || !query)

  const totalWebsites = Object.values(allWorkspaces).reduce((sum, ws) => sum + ws.length, 0)
  const filteredCount = filteredGroups.reduce((sum, g) => sum + g.workspaces.length, 0)

  const renderContent = () => {
    if (loading) return <LoadingSpinner message="Loading websites..." />
    if (organizations.length === 0) return <EmptyState icon={Globe} message="No organizations found" />
    if (filteredCount === 0 && query) return <EmptyState icon={Search} message={`No websites match "${searchQuery}"`} />

    return (
      <div className="space-y-6">
        {filteredGroups.map(({ org, workspaces }) => (
          <OrgWebsitesGroup
            key={org.org_id}
            org={org}
            workspaces={workspaces}
            currentWorkspace={currentWorkspace}
            onSwitch={switchWorkspace}
          />
        ))}
      </div>
    )
  }

  return (
    <SettingsTabLayout
      title="Websites"
      description={`All your websites across ${organizations.length} organization${organizations.length !== 1 ? "s" : ""}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search websites..." />

        {query && (
          <p className="text-xs text-black/50 dark:text-white/50">
            {filteredCount} of {totalWebsites} websites match &quot;{searchQuery}&quot;
          </p>
        )}

        {renderContent()}

        <div className="flex justify-start pt-2">
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-80 active:scale-[0.98] transition-all"
          >
            + Add Website
          </button>
        </div>

        {showAddModal && <AddWorkspaceModal onClose={() => setShowAddModal(false)} onSuccess={refetch} />}
      </div>
    </SettingsTabLayout>
  )
}

function UserPromptsSettings({ onClose }: { onClose: () => void }) {
  const prompts = useUserPrompts()
  const { addPrompt, updatePrompt, removePrompt } = useUserPromptsActions()
  const [editorState, setEditorState] = useState<{
    mode: "add" | "edit"
    promptId?: string
    displayName: string
    data: string
  } | null>(null)

  const handleOpenEditor = (mode: "add" | "edit", promptId?: string, displayName = "", data = "") => {
    setEditorState({ mode, promptId, displayName, data })
  }

  const handleCloseEditor = () => {
    setEditorState(null)
  }

  const handleSavePrompt = (displayName: string, data: string) => {
    if (!editorState) return

    if (editorState.mode === "add") {
      const promptType = displayName.toLowerCase().replace(/\s+/g, "-")
      addPrompt(promptType, data, displayName)
    } else if (editorState.mode === "edit" && editorState.promptId) {
      updatePrompt(editorState.promptId, data, displayName)
    }

    setEditorState(null)
  }

  return (
    <SettingsTabLayout
      title="User Prompts"
      description="Manage your saved prompt templates that appear in the chat toolbar"
      onClose={onClose}
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Add New Prompt Button */}
        <button
          type="button"
          onClick={() => handleOpenEditor("add")}
          className="w-full px-4 py-3 sm:py-2.5 border-2 border-dashed border-black/20 dark:border-white/20 rounded-lg text-sm font-medium text-black/60 dark:text-white/60 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white active:scale-[0.99] transition-all"
        >
          + Add New Prompt
        </button>

        {/* Saved Prompts List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {prompts.map(prompt => (
            <div
              key={prompt.id}
              className="px-4 py-3 rounded-lg border border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-sm font-semibold text-purple-900 dark:text-purple-100">{prompt.displayName}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEditor("edit", prompt.id, prompt.displayName, prompt.data)}
                    className="px-2 py-1 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removePrompt(prompt.id)}
                    className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="text-xs text-black/70 dark:text-white/70 line-clamp-6 overflow-hidden">
                <MarkdownDisplay content={prompt.data} />
              </div>
            </div>
          ))}
        </div>

        {prompts.length === 0 && (
          <div className="text-center py-8 text-black/40 dark:text-white/40 text-sm">
            No saved prompts yet. Click &quot;Add New Prompt&quot; to create one.
          </div>
        )}

        {/* Prompt Editor Modal */}
        {editorState && (
          <PromptEditorModal
            mode={editorState.mode}
            initialDisplayName={editorState.displayName}
            initialData={editorState.data}
            onSave={handleSavePrompt}
            onCancel={handleCloseEditor}
          />
        )}
      </div>
    </SettingsTabLayout>
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
