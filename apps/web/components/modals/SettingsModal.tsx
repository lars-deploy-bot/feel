"use client"

import { Bot, Eye, EyeOff, Info, Moon, Settings, Sun, X, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { CLAUDE_MODELS, type ClaudeModel, useLLMStore } from "@/lib/stores/llmStore"

interface SettingsModalProps {
  onClose: () => void
}

type SettingsTab = "general" | "appearance" | "llm" | "advanced" | "about"

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <Settings size={16} /> },
  { id: "appearance", label: "Appearance", icon: <Sun size={16} /> },
  { id: "llm", label: "LLM", icon: <Bot size={16} /> },
  { id: "advanced", label: "Advanced", icon: <Zap size={16} /> },
  { id: "about", label: "About", icon: <Info size={16} /> },
]

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")

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
            <div key={activeTab} className="animate-in fade-in-0 slide-in-from-bottom-3 duration-400">
              {activeTab === "general" && <GeneralSettings />}
              {activeTab === "appearance" && <AppearanceSettings />}
              {activeTab === "llm" && <LLMSettings />}
              {activeTab === "advanced" && <AdvancedSettings />}
              {activeTab === "about" && <AboutSettings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-300">
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">General Settings</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Manage your general preferences</p>
      </div>

      <div className="space-y-2 sm:space-y-4">
        <div className="flex items-center justify-between gap-4 py-2 sm:py-3 border-b border-black/5 dark:border-white/5 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">Auto-save conversations</p>
            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">Automatically save your chat history</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-black/20 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 peer-checked:bg-black dark:peer-checked:bg-white transition-colors" />
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 py-2 sm:py-3 border-b border-black/5 dark:border-white/5 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-100 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">Show thinking process</p>
            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">Display AI reasoning steps</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
            <input type="checkbox" className="sr-only peer" defaultChecked />
            <div className="w-11 h-6 bg-black/20 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 peer-checked:bg-black dark:peer-checked:bg-white transition-colors" />
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 py-2 sm:py-3 animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">Keyboard shortcuts</p>
            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">Enable keyboard navigation</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-black/20 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 peer-checked:bg-black dark:peer-checked:bg-white transition-colors" />
          </label>
        </div>
      </div>
    </div>
  )
}

function AppearanceSettings() {
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
              className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 border border-black/20 dark:border-white/20 rounded hover:border-black dark:hover:border-white transition-all duration-200 hover:shadow-sm"
            >
              <Sun
                size={18}
                className="sm:w-5 sm:h-5 text-black dark:text-white transition-transform duration-200 group-hover:rotate-45"
              />
              <span className="text-xs text-black/60 dark:text-white/60">Light</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 border border-black/20 dark:border-white/20 rounded hover:border-black dark:hover:border-white transition-all duration-200 hover:shadow-sm"
            >
              <Moon
                size={18}
                className="sm:w-5 sm:h-5 text-black dark:text-white transition-transform duration-200 group-hover:-rotate-12"
              />
              <span className="text-xs text-black/60 dark:text-white/60">Dark</span>
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 border-2 border-black dark:border-white rounded bg-black/5 dark:bg-white/5 transition-all duration-200 hover:shadow-sm"
            >
              <div className="flex items-center gap-1">
                <Sun size={11} className="sm:w-3 sm:h-3 text-black dark:text-white" />
                <Moon size={11} className="sm:w-3 sm:h-3 text-black dark:text-white" />
              </div>
              <span className="text-xs font-medium text-black dark:text-white">Auto</span>
            </button>
          </div>
        </div>

        <div className="pt-2 sm:pt-4">
          <p className="text-sm font-medium text-black dark:text-white mb-3">Font size</p>
          <div className="flex items-center gap-3 sm:gap-4">
            <input
              type="range"
              min="12"
              max="18"
              defaultValue="14"
              className="flex-1 h-2 bg-black/10 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
            />
            <span className="text-sm text-black/60 dark:text-white/60 w-10 sm:w-12 text-right flex-shrink-0">14px</span>
          </div>
        </div>

        <div className="pt-2 sm:pt-4">
          <p className="text-sm font-medium text-black dark:text-white mb-3">Message density</p>
          <div className="space-y-2">
            {["Compact", "Comfortable", "Spacious"].map(option => (
              <label
                key={option}
                className="flex items-center gap-3 cursor-pointer p-2 -mx-2 rounded hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <input
                  type="radio"
                  name="density"
                  defaultChecked={option === "Comfortable"}
                  className="w-4 h-4 accent-black dark:accent-white flex-shrink-0"
                />
                <span className="text-sm text-black dark:text-white">{option}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdvancedSettings() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">Advanced</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Power user settings and developer options</p>
      </div>

      <div className="space-y-2 sm:space-y-4">
        <div className="flex items-center justify-between gap-4 py-2 sm:py-3 border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">Enable debug mode</p>
            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">Show detailed system information</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-black/20 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 peer-checked:bg-black dark:peer-checked:bg-white transition-colors" />
          </label>
        </div>

        <div className="flex items-center justify-between gap-4 py-2 sm:py-3 border-b border-black/5 dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-black dark:text-white truncate">Experimental features</p>
            <p className="text-xs text-black/50 dark:text-white/50 mt-0.5">Try new features before they're ready</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer group flex-shrink-0">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-black/20 dark:bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-black after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-200 peer-checked:bg-black dark:peer-checked:bg-white transition-colors" />
          </label>
        </div>

        <div className="pt-2 sm:pt-4">
          <p className="text-sm font-medium text-black dark:text-white mb-3">Model selection</p>
          <select className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors">
            <option>Claude Sonnet 4.5</option>
            <option>Claude Opus 4</option>
            <option>Claude Haiku 3.5</option>
          </select>
        </div>

        <div className="pt-2 sm:pt-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
          <button
            type="button"
            className="w-full px-4 py-2.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-all duration-200"
          >
            Clear all conversation data
          </button>
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
          <label className="block text-sm font-medium text-black dark:text-white mb-2">
            Anthropic API Key
            <span className="ml-2 text-xs text-black/50 dark:text-white/50">(optional)</span>
          </label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-3">
            Use your own API key. Leave blank to use the default server key.
          </p>
          <div className="space-y-3">
            <div className="relative">
              <input
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
          <label className="block text-sm font-medium text-black dark:text-white mb-2">Model</label>
          <p className="text-xs text-black/60 dark:text-white/60 mb-3">
            Choose which Claude model to use for conversations
          </p>
          <select
            value={model}
            onChange={handleModelChange}
            className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white dark:bg-[#2a2a2a] border border-black/20 dark:border-white/20 rounded text-sm text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white transition-colors"
            aria-label="Claude Model Selection"
          >
            <option value={CLAUDE_MODELS.SONNET_4_5}>Claude Sonnet 4.5 (Recommended)</option>
            <option value={CLAUDE_MODELS.OPUS_4}>Claude Opus 4</option>
            <option value={CLAUDE_MODELS.HAIKU_3_5}>Claude 3.5 Haiku</option>
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

function AboutSettings() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-medium text-black dark:text-white mb-1">About</h3>
        <p className="text-xs sm:text-sm text-black/60 dark:text-white/60">Information about this application</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <div className="p-4 sm:p-6 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <Settings size={20} className="sm:w-6 sm:h-6 text-white dark:text-black" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm sm:text-base font-medium text-black dark:text-white truncate">Claude Bridge</h4>
              <p className="text-xs text-black/50 dark:text-white/50">Version 1.0.0</p>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-black/60 dark:text-white/60 leading-relaxed">
            A multi-tenant development platform that enables Claude AI to assist with website development through
            controlled file system access.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-black/5 dark:border-white/5">
            <span className="text-sm text-black/60 dark:text-white/60">Next.js</span>
            <span className="text-sm font-medium text-black dark:text-white">16.0.0</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-black/5 dark:border-white/5">
            <span className="text-sm text-black/60 dark:text-white/60">React</span>
            <span className="text-sm font-medium text-black dark:text-white">19.2.0</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-black/60 dark:text-white/60">Claude Agent SDK</span>
            <span className="text-sm font-medium text-black dark:text-white">0.1.25</span>
          </div>
        </div>

        <div className="pt-4">
          <a
            href="https://github.com/anthropics/claude-code"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors underline"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  )
}
