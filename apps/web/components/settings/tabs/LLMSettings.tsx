"use client"

import { Eye, EyeOff } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { getModelDisplayName } from "@/lib/models/claude-models"
import { useCredits, useCreditsError, useCreditsLoading, useUserActions } from "@/lib/providers/UserStoreProvider"
import { CLAUDE_MODELS, type ClaudeModel, DEFAULT_MODEL, useLLMStore } from "@/lib/stores/llmStore"
import { useCurrentWorkspace } from "@/lib/stores/workspaceStore"
import { SettingsTabLayout, type SettingsTabProps } from "./SettingsTabLayout"

function isValidModel(value: string): value is ClaudeModel {
  return Object.values(CLAUDE_MODELS).includes(value as ClaudeModel)
}

export function LLMSettings({ onClose }: SettingsTabProps) {
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
