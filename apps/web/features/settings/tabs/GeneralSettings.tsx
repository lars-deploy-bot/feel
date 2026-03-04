"use client"

import { ALL_CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, getModelDisplayName, isValidClaudeModel } from "@webalive/shared"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { useLLMStore } from "@/lib/stores/llmStore"
import { readOnlyField, sectionDivider, select, selectionCardActive, selectionCardInactive, text } from "../styles"
import { SettingsTabLayout } from "./SettingsTabLayout"

export function GeneralSettings() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { model, setModel } = useLLMStore()

  const canSelectAnyModel = user?.canSelectAnyModel ?? false
  const enabledModels = user?.enabledModels ?? []
  const canChooseModel = canSelectAnyModel || enabledModels.length > 0
  const isModelAvailable = (modelId: string): boolean => {
    if (canSelectAnyModel) return true
    if (enabledModels.length > 0) return enabledModels.includes(modelId)
    return modelId === DEFAULT_CLAUDE_MODEL
  }

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => setTheme(newTheme)
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (isValidClaudeModel(value)) setModel(value)
  }

  return (
    <SettingsTabLayout title="General" description="Account, appearance, and model preferences">
      <div className="space-y-4 sm:space-y-6">
        {/* Email */}
        <div className="animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-75">
          <p className={`${text.label} mb-0.5`}>Email Address</p>
          <p className={`${text.muted} mb-2`}>Used for login and notifications.</p>
          <div className={readOnlyField}>{user?.email || "\u2014"}</div>
        </div>

        {/* Theme */}
        <div className={`${sectionDivider} animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-175`}>
          <p className={`${text.label} mb-0.5`}>Theme</p>
          <p className={`${text.muted} mb-3`}>System follows your device setting.</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={theme === "light" ? selectionCardActive : selectionCardInactive}
            >
              <Sun size={20} strokeWidth={1.5} className="text-black/70 dark:text-white/70" />
              <span className={text.description}>Light</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={theme === "dark" ? selectionCardActive : selectionCardInactive}
            >
              <Moon size={20} strokeWidth={1.5} className="text-black/70 dark:text-white/70" />
              <span className={text.description}>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("system")}
              className={theme === "system" ? selectionCardActive : selectionCardInactive}
            >
              <div className="flex items-center gap-1.5">
                <Sun size={14} strokeWidth={1.5} className="text-black/70 dark:text-white/70" />
                <Moon size={14} strokeWidth={1.5} className="text-black/70 dark:text-white/70" />
              </div>
              <span className={text.description}>System</span>
            </button>
          </div>
        </div>

        {/* Model */}
        <div className={`${sectionDivider} animate-in fade-in-0 slide-in-from-left-2 duration-300 delay-150`}>
          <label htmlFor="claude-model" className={`block ${text.label} mb-0.5`}>
            Model
          </label>
          <p className={`${text.muted} mb-3`}>
            {canChooseModel
              ? "Opus is the smartest but slowest. Sonnet balances speed and quality. Haiku is fastest for simple tasks."
              : `You're using ${getModelDisplayName(DEFAULT_CLAUDE_MODEL)}. Model access is controlled by your plan.`}
          </p>
          <select
            id="claude-model"
            value={model}
            onChange={handleModelChange}
            disabled={!canChooseModel}
            className={select}
            aria-label="Claude Model Selection"
          >
            {(() => {
              const available = ALL_CLAUDE_MODELS.filter(isModelAvailable)
              const options = available.length > 0 ? available : [DEFAULT_CLAUDE_MODEL]
              return options.map(m => (
                <option key={m} value={m}>
                  {getModelDisplayName(m)}
                </option>
              ))
            })()}
          </select>
        </div>
      </div>
    </SettingsTabLayout>
  )
}
