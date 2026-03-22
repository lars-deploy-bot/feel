"use client"

import type { AgentFieldErrors, ClaudeModel } from "@webalive/shared"
import { ChevronRight } from "lucide-react"
import { MODEL_OPTIONS } from "@/lib/automation/form-options"
import { TriggerIcon } from "./TriggerSection"

interface OverviewSectionProps {
  name: string
  onNameChange: (v: string) => void
  prompt: string
  model: ClaudeModel | ""
  onModelChange: (v: ClaudeModel | "") => void
  triggerType: string
  triggerLabel: string
  timeout: string
  skills: string[]
  onPromptDrillIn: () => void
  onTriggerDrillIn: () => void
  error: string | null
  fieldErrors: AgentFieldErrors
}

export function OverviewSection({
  name,
  onNameChange,
  prompt,
  model,
  onModelChange,
  triggerType,
  triggerLabel,
  timeout,
  skills,
  onPromptDrillIn,
  onTriggerDrillIn,
  error,
  fieldErrors,
}: OverviewSectionProps) {
  return (
    <div className="px-4 py-4">
      {/* Name — inline editable */}
      <input
        type="text"
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Agent name"
        className={`w-full text-[15px] font-semibold bg-transparent border-0 outline-none caret-zinc-900 dark:caret-zinc-100 ${fieldErrors.name ? "text-red-600 dark:text-red-400 placeholder:text-red-300 dark:placeholder:text-red-700" : "text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700"}`}
      />
      {fieldErrors.name && <p className="text-[12px] text-red-500 dark:text-red-400 mt-1">{fieldErrors.name}</p>}

      {error && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
          <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Prompt card */}
      <button type="button" onClick={onPromptDrillIn} className="w-full mt-4 text-left group">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1.5">
            Prompt
          </p>
          <ChevronRight
            size={12}
            className="text-zinc-300 dark:text-zinc-700 mt-0.5 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors"
          />
        </div>
        <div className="relative">
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-6 whitespace-pre-wrap">
            {prompt || "No prompt set"}
          </p>
          {prompt.length > 200 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-[#0d0d0d] to-transparent pointer-events-none" />
          )}
        </div>
      </button>
      {fieldErrors.prompt && (
        <p className="text-[12px] text-red-500 dark:text-red-400 mt-1 px-0">{fieldErrors.prompt}</p>
      )}

      {/* Trigger card */}
      <button type="button" onClick={onTriggerDrillIn} className="w-full mt-5 text-left group">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider">Trigger</p>
          <ChevronRight
            size={12}
            className="text-zinc-300 dark:text-zinc-700 group-hover:text-zinc-500 dark:group-hover:text-zinc-400 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <TriggerIcon type={triggerType} />
          <span className="text-[13px] text-zinc-600 dark:text-zinc-400">{triggerLabel}</span>
          {timeout && (
            <>
              <span className="text-zinc-200 dark:text-zinc-800">·</span>
              <span className="text-[12px] text-zinc-400 dark:text-zinc-600 tabular-nums">{timeout}s timeout</span>
            </>
          )}
        </div>
      </button>

      {/* Model — inline pill select */}
      <div className="mt-5">
        <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1.5">
          Model
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MODEL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onModelChange(model === opt.value ? "" : (opt.value as ClaudeModel))}
              className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors duration-100 ${
                model === opt.value
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {model === "" && (
            <span className="px-2.5 py-1 text-[12px] text-zinc-400 dark:text-zinc-600">Default (Sonnet)</span>
          )}
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1.5">
            Skills
          </p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map(s => (
              <span
                key={s}
                className="px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
