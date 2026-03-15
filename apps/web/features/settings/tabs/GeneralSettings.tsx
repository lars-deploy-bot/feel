"use client"

import { ALL_CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, getModelDisplayName, isValidClaudeModel } from "@webalive/shared"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/features/deployment/hooks/useAuth"
import { useLLMStore } from "@/lib/stores/llmStore"
import { select, text } from "../styles"
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

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (isValidClaudeModel(value)) setModel(value)
  }

  const emailPrefix = user?.email?.split("@")[0] ?? ""

  const themes = [
    { id: "light" as const, label: "Light", icon: Sun },
    { id: "dark" as const, label: "Dark", icon: Moon },
    { id: "system" as const, label: "System", icon: Monitor },
  ]

  return (
    <SettingsTabLayout title="General" description="Your preferences">
      {/* Identity — quiet, grounding */}
      <div className="mb-8">
        <div className="flex items-center gap-3.5">
          <div className="size-10 rounded-xl bg-[#4a7c59]/[0.08] dark:bg-[#7cb88a]/[0.08] flex items-center justify-center">
            <span className="text-sm font-semibold text-[#4a7c59] dark:text-[#7cb88a]">
              {(emailPrefix[0] ?? "").toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-[#2c2a26] dark:text-[#e8e4dc]">{emailPrefix || "\u2014"}</p>
            <p className="text-xs text-[#b5afa3] dark:text-[#5c574d]">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="mb-8">
        <p className={`${text.label} mb-3`}>Appearance</p>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#4a7c59]/[0.04] dark:bg-[#7cb88a]/[0.04] border border-[#4a7c59]/[0.06] dark:border-[#7cb88a]/[0.04]">
          {themes.map(({ id, label, icon: Icon }) => {
            const active = theme === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTheme(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-white dark:bg-white/10 text-[#2c2a26] dark:text-[#e8e4dc] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#8a8578] dark:text-[#7a756b] hover:text-[#5c574d] dark:hover:text-[#b5afa3]"
                }`}
              >
                <Icon size={15} strokeWidth={1.5} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Model */}
      <div>
        <label htmlFor="claude-model" className={`block ${text.label} mb-1`}>
          Model
        </label>
        <p className={`${text.muted} mb-3`}>
          {canChooseModel
            ? "Opus is the smartest but slowest. Sonnet balances speed and quality. Haiku is fastest."
            : `Using ${getModelDisplayName(DEFAULT_CLAUDE_MODEL)}. Model access depends on your plan.`}
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
    </SettingsTabLayout>
  )
}
