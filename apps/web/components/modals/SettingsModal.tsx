"use client"

import { Bot, Eye, EyeOff, Info, Moon, Settings, Sun, User, X, Zap } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import {
  useCredits,
  useCreditsError,
  useCreditsLoading,
  useEmail,
  usePhoneNumber,
  useTokens,
  useUserActions,
} from "@/lib/providers/UserStoreProvider"
import { CLAUDE_MODELS, type ClaudeModel, useLLMStore } from "@/lib/stores/llmStore"
import { DEFAULT_STARTING_CREDITS } from "@/lib/credits"

interface SettingsModalProps {
  onClose: () => void
}

type SettingsTab = "account" | "appearance" | "llm" | "tokens" | "about"

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User size={16} /> },
  { id: "appearance", label: "Appearance", icon: <Sun size={16} /> },
  { id: "llm", label: "LLM", icon: <Bot size={16} /> },
  { id: "tokens", label: "Credits", icon: <Zap size={16} /> },
  { id: "about", label: "About", icon: <Info size={16} /> },
]

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account")

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-in fade-in-0 duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-4xl h-[85vh] sm:h-[600px] flex flex-col sm:flex-row overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 ease-out"
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
              {activeTab === "tokens" && <TokensSettings />}
              {activeTab === "about" && <AboutSettings />}
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

function TokensSettings() {
  const credits = useCredits()
  const tokens = useTokens()
  const loading = useCreditsLoading()
  const error = useCreditsError()
  const { fetchCredits } = useUserActions()

  // Fetch credits when component mounts or workspace changes
  useEffect(() => {
    const workspace = sessionStorage.getItem("workspace")
    if (workspace) {
      fetchCredits(workspace)
    }
  }, [fetchCredits])

  const handleRetry = () => {
    const workspace = sessionStorage.getItem("workspace")
    if (workspace) {
      fetchCredits(workspace)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-black dark:text-white mb-1">Credits Available</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Your available credit balance</p>
      </div>

      {error ? (
        <div className="space-y-3">
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded p-3">
            {error === "Not authenticated"
              ? "Please log in to a workspace to view credits"
              : `Error: ${error}`}
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={loading}
            className="w-full px-3 py-2 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-black/80 dark:hover:bg-white/80 disabled:opacity-50 rounded transition-all"
          >
            {loading ? "Retrying..." : "Retry"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-black dark:text-white">Balance</span>
              <span className="text-lg font-bold text-black dark:text-white">
                {loading ? "Loading..." : credits != null ? `${credits.toFixed(2)} credits` : "N/A"}
              </span>
            </div>
            {credits != null && credits > 0 && (
              <div className="w-full h-3 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-400 dark:to-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min((credits / DEFAULT_STARTING_CREDITS) * 100, 100)}%` }}
                />
              </div>
            )}
            <p className="text-xs text-black/50 dark:text-white/50 mt-2">
              {loading
                ? "Loading balance..."
                : credits != null && credits > 0
                  ? `${credits.toFixed(2)} credits`
                  : "No credits available"}
            </p>
          </div>
        </div>
      )}
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

  useEffect(() => {
    setApiKeyInput(apiKey || "")
  }, [apiKey])

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
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">LLM Configuration</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Configure your AI model and API settings</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
          <label htmlFor="anthropic-api-key" className="block text-sm font-medium text-black dark:text-white mb-2">
            Anthropic API Key
            <span className="ml-2 text-xs text-black/50 dark:text-white/50">(optional)</span>
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-3">
            Use your own API key. Leave blank to use the default server key.
          </p>
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
            {!apiKey && (
              <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">(Credits mode - Haiku only)</span>
            )}
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-3">
            {apiKey
              ? "Choose which Claude model to use for conversations"
              : "Using workspace credits - restricted to Claude 3.5 Haiku for cost management. Add your API key to use other models."}
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
            <option value={CLAUDE_MODELS.OPUS_4}>Claude Opus 4</option>
            <option value={CLAUDE_MODELS.HAIKU_3_5}>Claude 3.5 Haiku</option>
          </select>
          {!apiKey && (
            <div className="mt-2 flex items-start gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded p-2">
              <div className="w-2 h-2 bg-orange-600 dark:bg-orange-400 rounded-full mt-1 flex-shrink-0" />
              <p>
                <strong>Cost savings:</strong> Haiku uses ~0.125 credits per conversation. Your 200 default credits =
                ~1,600 conversations!
              </p>
            </div>
          )}
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
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">Account</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Manage your account information</p>
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

function AboutSettings() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-3">About</h3>
        <p className="text-sm sm:text-base font-semibold text-black dark:text-white leading-relaxed">
          We make AI accessible to anyone wanting to build a company.
        </p>
      </div>
    </div>
  )
}
