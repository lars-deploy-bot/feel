"use client"

import {
  Bot,
  Building2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  Moon,
  Settings,
  Sun,
  User,
  UserMinus,
  Users,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { AddWorkspaceModal } from "@/components/modals/AddWorkspaceModal"
import { DeleteModal } from "@/components/modals/DeleteModal"
import { PromptEditorModal } from "@/components/modals/PromptEditorModal"
import { MarkdownDisplay } from "@/components/ui/chat/format/MarkdownDisplay"
import type { Organization } from "@/lib/api/types"
import { useOrganizations } from "@/lib/hooks/useOrganizations"
import { canRemoveMember } from "@/lib/permissions/org-permissions"
import { useUserPrompts, useUserPromptsActions } from "@/lib/providers/UserPromptsStoreProvider"
import {
  useCredits,
  useCreditsError,
  useCreditsLoading,
  useEmail,
  usePhoneNumber,
  useUserActions,
} from "@/lib/providers/UserStoreProvider"
import { CLAUDE_MODELS, type ClaudeModel, useLLMStore } from "@/lib/stores/llmStore"
import { useSelectedOrgId, useWorkspaceActions } from "@/lib/stores/workspaceStore"

type SettingsTab = "account" | "appearance" | "llm" | "prompts" | "organization"

interface SettingsModalProps {
  onClose: () => void
  initialTab?: SettingsTab // Defaults to "account", use "organization" for error states
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Profile", icon: <User size={16} /> },
  { id: "appearance", label: "Appearance", icon: <Sun size={16} /> },
  { id: "llm", label: "AI", icon: <Bot size={16} /> },
  { id: "prompts", label: "Prompts", icon: <ClipboardList size={16} /> },
  { id: "organization", label: "Workspace", icon: <Building2 size={16} /> },
]

export function SettingsModal({ onClose, initialTab }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || "account")

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-in fade-in-0 duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      data-testid="settings-modal"
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:w-[95vw] sm:max-w-5xl h-[85vh] sm:h-[92vh] flex flex-col sm:flex-row overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 ease-out"
        onClick={e => e.stopPropagation()}
        role="document"
      >
        {/* Mobile: Top Tabs | Desktop: Left Sidebar */}
        <div className="sm:w-48 bg-black/[0.02] dark:bg-white/[0.02] border-b sm:border-b-0 sm:border-r border-black/10 dark:border-white/10 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 sm:py-6 border-b border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-left-2 duration-300 flex items-center justify-between">
            <h2
              id="settings-dialog-title"
              className="text-lg font-medium text-black dark:text-white flex items-center gap-2"
            >
              <Settings size={18} className="animate-in spin-in-0 duration-500" />
              Settings
            </h2>
            {/* Mobile close button in header */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all duration-200 active:scale-95"
              aria-label="Close settings"
            >
              <X size={18} className="text-black/60 dark:text-white/60" />
            </button>
          </div>

          {/* Mobile: Horizontal scroll tabs | Desktop: Vertical list */}
          <nav className="flex sm:flex-col flex-1 sm:p-3 px-4 sm:px-0 py-3 sm:py-0 gap-2 sm:gap-1 overflow-x-auto sm:overflow-x-visible overflow-y-hidden sm:overflow-y-auto scrollbar-hide">
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 sm:flex-shrink flex items-center gap-2 sm:gap-3 px-3 sm:px-3 py-2 sm:py-2.5 rounded text-sm font-medium transition-all duration-200 whitespace-nowrap animate-in fade-in-0 slide-in-from-left-2 ${
                  activeTab === tab.id
                    ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                    : "text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white"
                }`}
                style={{
                  animationDelay: `${100 + index * 50}ms`,
                }}
              >
                <span className={`transition-transform duration-200 ${activeTab === tab.id ? "scale-110" : ""}`}>
                  {tab.icon}
                </span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Desktop close button */}
          <div className="hidden sm:flex items-center justify-end px-6 py-4 border-b border-black/10 dark:border-white/10 animate-in fade-in-0 slide-in-from-right-2 duration-300">
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all duration-200"
              aria-label="Close settings"
            >
              <X size={18} className="text-black/60 dark:text-white/60" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
              {activeTab === "account" && <AccountSettings />}
              {activeTab === "appearance" && <AppearanceSettings />}
              {activeTab === "llm" && <LLMSettings />}
              {activeTab === "prompts" && <UserPromptsSettings />}
              {activeTab === "organization" && <WorkspaceSettings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppearanceSettings() {
  const { theme, setTheme, systemTheme } = useTheme()

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
  }

  const _currentTheme = theme === "system" ? systemTheme : theme

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">Appearance</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Customize how the interface looks</p>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
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
      </div>
    </div>
  )
}

function isValidModel(value: string): value is ClaudeModel {
  return Object.values(CLAUDE_MODELS).includes(value as ClaudeModel)
}

function LLMSettings() {
  const { apiKey, model, setApiKey, setModel, clearApiKey, error } = useLLMStore()
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [isSaved, setIsSaved] = useState(false)

  // Credits state
  const credits = useCredits()
  const creditsLoading = useCreditsLoading()
  const creditsError = useCreditsError()
  const { fetchCredits } = useUserActions()

  useEffect(() => {
    setApiKeyInput(apiKey || "")
  }, [apiKey])

  // Fetch credits when component mounts
  useEffect(() => {
    const workspace = sessionStorage.getItem("workspace")
    if (workspace && !apiKey) {
      fetchCredits(workspace)
    }
  }, [fetchCredits, apiKey])

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
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">AI Model</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Configure your AI settings</p>
      </div>

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
                className="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded text-sm font-medium hover:bg-black/80 dark:hover:bg-white/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaved ? "Saved!" : "Save API Key"}
              </button>
              {apiKey && (
                <button
                  type="button"
                  onClick={handleClearApiKey}
                  className="px-4 py-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors duration-200"
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
            {apiKey ? "Choose which Claude model to use" : "Currently using Claude Haiku 4.5"}
          </p>
          <select
            id="claude-model"
            value={model}
            onChange={handleModelChange}
            disabled={!apiKey}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Claude Model Selection"
          >
            <option value={CLAUDE_MODELS.SONNET_4_5}>Claude Sonnet 4.5 (Recommended)</option>
            <option value={CLAUDE_MODELS.HAIKU_4_5}>Claude Haiku 4.5</option>
          </select>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/50 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
          <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
            Your API key is stored only in your browser (hidden from view). When you send messages, we use your key to
            call Anthropic&apos;s API—but we never save it on our servers.
          </p>
        </div>
      </div>
    </div>
  )
}

function AccountSettings() {
  const email = useEmail()
  const phoneNumber = usePhoneNumber()
  const { setEmail, setPhoneNumber } = useUserActions()
  const [emailInput, setEmailInput] = useState(email || "")
  const [phoneInput, setPhoneInput] = useState(phoneNumber || "")
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    setEmailInput(email || "")
    setPhoneInput(phoneNumber || "")
  }, [email, phoneNumber])

  const handleSave = () => {
    setEmail(emailInput)
    setPhoneNumber(phoneInput)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const isChanged = emailInput !== (email || "") || phoneInput !== (phoneNumber || "")

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">Profile</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Your account information</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
          <label htmlFor="email-address" className="block text-sm font-medium text-black dark:text-white mb-2">
            Email Address
          </label>
          <input
            id="email-address"
            type="email"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
            aria-label="Email Address"
          />
        </div>

        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100">
          <label htmlFor="phone-number" className="block text-sm font-medium text-black dark:text-white mb-2">
            Phone Number
          </label>
          <input
            id="phone-number"
            type="tel"
            value={phoneInput}
            onChange={e => setPhoneInput(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
            aria-label="Phone Number"
          />
        </div>

        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-125">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isChanged}
            className="w-full px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded text-sm font-medium hover:bg-black/80 dark:hover:bg-white/80 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaved ? "Saved!" : "Save Changes"}
          </button>
        </div>

        {(email || phoneNumber) && (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
            <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full" />
            Account information saved in browser
          </div>
        )}
      </div>
    </div>
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

// Custom hook for optimistic workspace switching
function useWorkspaceSwitch() {
  const actualCurrent = typeof window !== "undefined" ? sessionStorage.getItem("workspace") : null
  const [optimisticCurrent, setOptimisticCurrent] = useState<string | null>(null)

  const switchWorkspace = useCallback((workspace: string) => {
    if (typeof window === "undefined") return

    setOptimisticCurrent(workspace)
    sessionStorage.setItem("workspace", workspace)
    setTimeout(() => {
      window.location.href = "/chat"
    }, 100)
  }, [])

  return {
    currentWorkspace: optimisticCurrent || actualCurrent,
    switchWorkspace,
  }
}

function OrgSitesSection({ orgId }: { orgId: string }) {
  const { workspaces, loading, error, refetch } = useOrgWorkspaces(orgId)
  const { currentWorkspace, switchWorkspace } = useWorkspaceSwitch()
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-sm font-medium text-black dark:text-white">Sites</h5>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="text-xs text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
        >
          + Add Site
        </button>
      </div>

      <WorkspacesGrid
        workspaces={workspaces}
        currentWorkspace={currentWorkspace}
        loading={loading}
        error={error}
        onSwitch={switchWorkspace}
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
        Loading sites...
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
        No sites yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {workspaces.map(workspace => {
        const isCurrent = workspace === currentWorkspace
        return (
          <div
            key={workspace}
            className={`px-3 py-2.5 rounded border transition-all ${
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
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-black dark:text-white truncate" title={workspace}>
                {workspace}
              </span>
              {isCurrent ? (
                <span className="text-xs px-2 py-0.5 bg-black dark:bg-white text-white dark:text-black rounded self-start">
                  Current
                </span>
              ) : (
                <span className="text-xs text-black/50 dark:text-white/50">Click to switch</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WorkspaceSettings() {
  const { organizations, currentUserId, loading, error, refetch } = useOrganizations()
  const selectedOrgId = useSelectedOrgId()
  const { setSelectedOrg } = useWorkspaceActions()

  // Use extracted hooks for clean state management
  const editor = useOrgEditor(refetch)
  const members = useOrgMembers()
  const leave = useOrgLeave()

  const handleSelectOrg = (orgId: string) => {
    setSelectedOrg(orgId)
    editor.cancelEdit()
  }

  const getCurrentUserRole = (orgId: string): "owner" | "admin" | "member" | null => {
    const org = organizations.find(o => o.org_id === orgId)
    return org?.role || null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h3 className="text-lg font-medium text-black dark:text-white mb-1">Workspace</h3>
        <p className="text-sm text-black/60 dark:text-white/60">
          Manage your organizations and switch between workspaces
        </p>
      </div>

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
        <div className="space-y-4">
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

          {/* Selected Organization Details */}
          {selectedOrgId &&
            (() => {
              const selectedOrg = organizations.find(org => org.org_id === selectedOrgId)
              if (!selectedOrg) return null

              const isEditing = editor.editingOrgId === selectedOrgId

              return (
                <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 bg-black/[0.02] dark:bg-white/[0.02]">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editor.editOrgName}
                          onChange={e => editor.setEditOrgName(e.target.value)}
                          className="w-full px-2 py-1 text-base font-semibold bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white"
                        />
                      ) : (
                        <>
                          <h4 className="text-base font-semibold text-black dark:text-white truncate">
                            {selectedOrg.name}
                          </h4>
                          <p className="text-xs text-black/50 dark:text-white/50 mt-0.5 font-mono truncate">
                            {selectedOrg.org_id}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Edit/Save Buttons */}
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => editor.saveEdit(selectedOrg.org_id)}
                          disabled={!editor.editOrgName.trim() || editor.saving}
                          className="px-2 py-1 bg-black dark:bg-white text-white dark:text-black rounded text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          {editor.saving ? "..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={editor.cancelEdit}
                          className="px-2 py-1 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white rounded text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => editor.startEdit(selectedOrg)}
                        className="px-2 py-1 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white rounded text-xs transition-all"
                      >
                        Rename
                      </button>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="px-3 py-2 rounded-md bg-black/5 dark:bg-white/5">
                      <div className="text-xs text-black/50 dark:text-white/50 mb-0.5">Credits</div>
                      <div className="text-sm font-semibold text-black dark:text-white">
                        {selectedOrg.credits.toFixed(2)}
                      </div>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-black/5 dark:bg-white/5">
                      <div className="text-xs text-black/50 dark:text-white/50 mb-0.5">Sites</div>
                      <div className="text-sm font-semibold text-black dark:text-white">
                        {selectedOrg.workspace_count || 0}
                      </div>
                    </div>
                  </div>

                  {/* Sites Section */}
                  <OrgSitesSection orgId={selectedOrg.org_id} />

                  {/* Members Section */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => members.toggleMembers(selectedOrg.org_id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-black/60 dark:text-white/60" />
                        <span className="text-sm font-medium text-black dark:text-white">Members</span>
                        {members.orgMembers[selectedOrg.org_id] && (
                          <span className="text-xs text-black/50 dark:text-white/50">
                            ({members.orgMembers[selectedOrg.org_id].length})
                          </span>
                        )}
                      </div>
                      {members.expandedOrgId === selectedOrg.org_id ? (
                        <ChevronUp size={14} className="text-black/60 dark:text-white/60" />
                      ) : (
                        <ChevronDown size={14} className="text-black/60 dark:text-white/60" />
                      )}
                    </button>

                    {/* Members List */}
                    {members.expandedOrgId === selectedOrg.org_id && (
                      <div className="mt-2 space-y-1">
                        {members.loadingMembers[selectedOrg.org_id] ? (
                          <div className="px-3 py-2 text-xs text-black/40 dark:text-white/40 text-center">
                            Loading members...
                          </div>
                        ) : members.orgMembers[selectedOrg.org_id] &&
                          members.orgMembers[selectedOrg.org_id].length > 0 ? (
                          members.orgMembers[selectedOrg.org_id].map(member => {
                            const currentUserRole = getCurrentUserRole(selectedOrg.org_id)
                            const isCurrentUser = member.user_id === currentUserId
                            const canRemove = canRemoveMember(currentUserRole, member.role, isCurrentUser)

                            return (
                              <div
                                key={member.user_id}
                                className="flex items-center justify-between px-3 py-2 rounded-md bg-black/5 dark:bg-white/5"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-black dark:text-white truncate">
                                      {member.display_name || member.email}
                                    </span>
                                    <span
                                      className={`text-xs px-1.5 py-0.5 rounded-full ${
                                        member.role === "owner"
                                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                          : member.role === "admin"
                                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                            : "bg-gray-100 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400"
                                      }`}
                                    >
                                      {member.role}
                                    </span>
                                  </div>
                                  {member.display_name && (
                                    <div className="text-xs text-black/50 dark:text-white/50 truncate">
                                      {member.email}
                                    </div>
                                  )}
                                </div>

                                {canRemove && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      members.requestRemoveMember(selectedOrg.org_id, member.user_id, member.email)
                                    }
                                    disabled={members.removingMember === member.user_id}
                                    className="ml-2 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                                    title="Remove member"
                                  >
                                    <UserMinus size={14} />
                                  </button>
                                )}
                              </div>
                            )
                          })
                        ) : (
                          <div className="px-3 py-2 text-xs text-black/40 dark:text-white/40 text-center">
                            No members found
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Leave Organization - Subtle footer link */}
                  <div className="pt-3 border-t border-black/5 dark:border-white/5">
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
    </div>
  )
}

function UserPromptsSettings() {
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
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">User Prompts</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">
          Manage your saved prompt templates that appear in the chat toolbar
        </p>
      </div>

      {/* Add New Prompt Button */}
      <button
        type="button"
        onClick={() => handleOpenEditor("add")}
        className="w-full px-4 py-2.5 border-2 border-dashed border-black/20 dark:border-white/20 rounded-lg text-sm font-medium text-black/60 dark:text-white/60 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
      >
        + Add New Prompt
      </button>

      {/* Saved Prompts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
  )
}
