/**
 * Automation Configuration Component
 *
 * Interactive form for creating a scheduled automation task.
 * Two steps: task details → schedule.
 *
 * Users describe their schedule in plain English (e.g. "every weekday at 9am").
 * Text-to-cron conversion happens server-side at save time.
 */

"use client"

import { CLAUDE_MODELS, type ClaudeModel, getModelDisplayName, isValidClaudeModel } from "@webalive/shared"
import { Check, ChevronRight, Cpu, Globe, Zap } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { ScheduleInput } from "@/components/automations/ScheduleInput"
import { getInitialSiteSelection, SiteCombobox, type SiteOption } from "@/components/automations/SiteCombobox"
import { DEFAULT_TIMEZONE, MODEL_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/automation/form-options"

// =============================================================================
// TYPES
// =============================================================================

export type { SiteOption }

export interface AutomationConfigData {
  sites: SiteOption[]
  defaultSiteId?: string
  context?: string
  defaultName?: string
  defaultPrompt?: string
  defaultModel?: ClaudeModel
  defaultAvatarUrl?: string
}

export interface AutomationConfigResult {
  siteId: string
  siteName: string
  name: string
  prompt: string
  model: ClaudeModel
  scheduleType: "once" | "custom"
  /** Human-readable schedule text, e.g. "every weekday at 9am" */
  scheduleText: string
  scheduleTime: string // HH:MM format
  scheduleDate?: string // YYYY-MM-DD for one-time
  timezone?: string
}

interface AutomationConfigProps {
  data: AutomationConfigData
  onComplete: (result: AutomationConfigResult) => void
  onCancel?: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AutomationConfig({ data, onComplete, onCancel }: AutomationConfigProps) {
  const [step, setStep] = useState<"basics" | "schedule" | "confirm">("basics")
  const initialSiteSelection = getInitialSiteSelection(data.sites, data.defaultSiteId)

  // Basic fields
  const [name, setName] = useState(data.defaultName ?? "")
  const [prompt, setPrompt] = useState(data.defaultPrompt ?? "")
  const [siteId, setSiteId] = useState(initialSiteSelection.siteId)
  const [siteSearch, setSiteSearch] = useState(initialSiteSelection.siteSearch)
  const [model, setModel] = useState<ClaudeModel>(data.defaultModel ?? CLAUDE_MODELS.HAIKU_4_5)

  // Schedule fields
  const [isOneTime, setIsOneTime] = useState(false)
  const [scheduleText, setScheduleText] = useState("every day at 9am")
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split("T")[0]
  })
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE)

  // Validation
  const [nameError, setNameError] = useState<string | null>(null)
  const [promptError, setPromptError] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  // Focus first input on mount
  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  const validateName = useCallback((value: string): string | null => {
    if (!value.trim()) return "Please enter a name"
    if (value.length < 3) return "Name must be at least 3 characters"
    if (value.length > 100) return "Name must be less than 100 characters"
    return null
  }, [])

  const validatePrompt = useCallback((value: string): string | null => {
    if (!value.trim()) return "Please enter a prompt"
    if (value.length < 10) return "Prompt must be at least 10 characters"
    if (value.length > 5000) return "Prompt must be less than 5000 characters"
    return null
  }, [])

  const handleNext = useCallback(() => {
    if (step === "basics") {
      const nameErr = validateName(name)
      const promptErr = validatePrompt(prompt)
      const selectedSite = data.sites.find(site => site.id === siteId)

      if (nameErr) {
        setNameError(nameErr)
        nameInputRef.current?.focus()
        return
      }
      if (promptErr) {
        setPromptError(promptErr)
        promptInputRef.current?.focus()
        return
      }
      if (!selectedSite) {
        if (data.sites.length === 1) {
          const onlySite = data.sites[0]
          if (!onlySite) return
          setSiteId(onlySite.id)
          setSiteSearch(onlySite.hostname)
        } else {
          return
        }
      }
      setStep("schedule")
    } else if (step === "schedule") {
      setStep("confirm")
    }
  }, [step, name, prompt, siteId, validateName, validatePrompt, data.sites])

  const handleBack = useCallback(() => {
    if (step === "schedule") setStep("basics")
    else if (step === "confirm") setStep("schedule")
  }, [step])

  const handleSubmit = useCallback(() => {
    const site = data.sites.find(s => s.id === siteId) ?? (data.sites.length === 1 ? data.sites[0] : undefined)
    if (!site) {
      setStep("basics")
      return
    }

    onComplete({
      siteId: site.id,
      siteName: site.hostname,
      name,
      prompt,
      model,
      scheduleType: isOneTime ? "once" : "custom",
      scheduleText: isOneTime ? "" : scheduleText,
      scheduleTime,
      scheduleDate: isOneTime ? scheduleDate : undefined,
      timezone,
    })
  }, [
    siteId,
    name,
    prompt,
    model,
    isOneTime,
    scheduleText,
    scheduleTime,
    scheduleDate,
    timezone,
    data.sites,
    onComplete,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        if (step === "confirm") {
          handleSubmit()
        } else {
          handleNext()
        }
      }
    },
    [step, handleNext, handleSubmit],
  )

  // Step indicator
  const steps = ["basics", "schedule", "confirm"] as const
  const currentStepIndex = steps.indexOf(step)

  const stepLabels: Record<typeof step, string> = {
    basics: "Task details",
    schedule: "Schedule",
    confirm: "Confirm",
  }

  const selectedSite = data.sites.find(s => s.id === siteId) ?? (data.sites.length === 1 ? data.sites[0] : undefined)
  const hasValidSiteSelection = data.sites.some(site => site.id === siteId) || data.sites.length === 1
  const canProceedBasics = name.trim().length >= 3 && prompt.trim().length >= 10 && hasValidSiteSelection
  const canProceedSchedule = isOneTime ? scheduleDate && scheduleTime : scheduleText.trim().length > 0

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-xl">
      {/* Header with step indicator */}
      <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900 px-3 py-3 gap-1">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-zinc-500 dark:text-zinc-400" />
          <span className="min-w-0 pl-1 font-normal text-zinc-900 dark:text-zinc-100 text-sm">New Automation</span>
          <ChevronRight size={14} className="text-zinc-400 dark:text-zinc-500" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{stepLabels[step]}</span>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {currentStepIndex + 1}/{steps.length}
        </span>
      </div>

      {/* Content */}
      <div className="flex h-full w-full flex-col border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex-1 overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
          {/* Step: Basics */}
          {step === "basics" && (
            <div className="h-full duration-300 animate-in fade-in slide-in-from-right-4">
              <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 outline-none">
                {data.context && <p className="text-sm text-zinc-500 dark:text-zinc-400">{data.context}</p>}

                {/* Name field */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="automation-name" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Task name
                  </label>
                  <input
                    ref={nameInputRef}
                    id="automation-name"
                    type="text"
                    value={name}
                    onChange={e => {
                      setName(e.target.value)
                      if (nameError) setNameError(null)
                    }}
                    onBlur={() => {
                      if (name.trim()) setNameError(validateName(name))
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Automation name"
                    aria-invalid={!!nameError}
                    aria-describedby={nameError ? "name-error" : undefined}
                    className={`w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-colors duration-150 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none text-zinc-900 dark:text-zinc-100 ${
                      nameError
                        ? "border-red-300 dark:border-red-700 focus-visible:border-red-400"
                        : name.length >= 3
                          ? "border-emerald-300 dark:border-emerald-700"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                    maxLength={100}
                  />
                  {nameError && (
                    <p id="name-error" className="text-xs text-red-500 dark:text-red-400" role="alert">
                      {nameError}
                    </p>
                  )}
                </div>

                {/* Prompt field */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="automation-prompt" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    What should Claude do?
                  </label>
                  <textarea
                    ref={promptInputRef}
                    id="automation-prompt"
                    value={prompt}
                    onChange={e => {
                      setPrompt(e.target.value)
                      if (promptError) setPromptError(null)
                    }}
                    onBlur={() => {
                      if (prompt.trim()) setPromptError(validatePrompt(prompt))
                    }}
                    placeholder="Describe what this automation should do..."
                    rows={3}
                    aria-invalid={!!promptError}
                    aria-describedby={promptError ? "prompt-error" : undefined}
                    className={`w-full rounded-lg border bg-transparent px-3 py-2 text-sm transition-colors duration-150 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:outline-none text-zinc-900 dark:text-zinc-100 resize-none ${
                      promptError
                        ? "border-red-300 dark:border-red-700 focus-visible:border-red-400"
                        : prompt.length >= 10
                          ? "border-emerald-300 dark:border-emerald-700"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                    }`}
                    maxLength={5000}
                  />
                  {promptError && (
                    <p id="prompt-error" className="text-xs text-red-500 dark:text-red-400" role="alert">
                      {promptError}
                    </p>
                  )}
                </div>

                {/* Site selector */}
                {data.sites.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="automation-site" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Website
                    </label>
                    <SiteCombobox
                      id="automation-site"
                      sites={data.sites}
                      selectedId={siteId}
                      searchValue={siteSearch}
                      onSelect={(id, hostname) => {
                        setSiteId(id)
                        setSiteSearch(hostname)
                      }}
                      onSearchChange={setSiteSearch}
                    />
                  </div>
                )}

                {/* Single site display */}
                {data.sites.length === 1 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                    <Globe size={14} className="text-zinc-400" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{data.sites[0].hostname}</span>
                  </div>
                )}

                {/* Model selector */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="automation-model" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Model
                  </label>
                  <div className="relative">
                    <Cpu
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none"
                    />
                    <select
                      id="automation-model"
                      value={model}
                      onChange={e => {
                        if (isValidClaudeModel(e.target.value)) setModel(e.target.value)
                      }}
                      className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent pl-9 pr-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus-visible:outline-none hover:border-zinc-300 dark:hover:border-zinc-600 cursor-pointer"
                    >
                      {MODEL_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step: Schedule */}
          {step === "schedule" && (
            <div className="h-full duration-300 animate-in fade-in slide-in-from-right-4">
              <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 outline-none">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-black dark:text-white">When should it run?</h3>
                  <p className="text-xs text-black/50 dark:text-white/50">Describe the schedule in plain English</p>
                </div>

                <ScheduleInput
                  value={scheduleText}
                  onChange={setScheduleText}
                  showOneTime={true}
                  isOneTime={isOneTime}
                  onOneTimeChange={setIsOneTime}
                  oneTimeDate={scheduleDate}
                  oneTimeTime={scheduleTime}
                  onOneTimeDateChange={setScheduleDate}
                  onOneTimeTimeChange={setScheduleTime}
                />

                {/* Timezone */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="schedule-timezone" className="text-xs font-medium text-black/60 dark:text-white/60">
                    Timezone
                  </label>
                  <select
                    id="schedule-timezone"
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all cursor-pointer"
                  >
                    {TIMEZONE_OPTIONS.map(tz => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === "confirm" && (
            <div className="h-full duration-300 animate-in fade-in slide-in-from-right-4">
              <div className="flex h-full flex-col gap-3 overflow-y-auto p-4 outline-none">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Ready to create your automation:</p>
                <div className="space-y-2">
                  <ConfirmRow label="Task" value={name} />
                  <ConfirmRow label="Website" value={selectedSite?.hostname ?? data.sites[0]?.hostname ?? "—"} />
                  <ConfirmRow
                    label="Schedule"
                    value={
                      isOneTime
                        ? `${scheduleDate} at ${scheduleTime}`
                        : `${scheduleText} (${timezone.split("/")[1] ?? timezone})`
                    }
                  />
                  <ConfirmRow label="Model" value={getModelDisplayName(model)} />

                  <div className="flex flex-col gap-0.5 px-2 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                    <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                      Prompt
                    </p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-3">{prompt}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex h-12 items-center justify-between px-3 py-2">
          {/* Left Button */}
          {step === "basics" && onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-md gap-1.5 h-7 px-4 py-2 text-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
          ) : step !== "basics" ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-md gap-1.5 h-7 px-4 py-2 text-zinc-700 dark:text-zinc-300"
            >
              Back
            </button>
          ) : (
            <div className="h-7 w-16" />
          )}

          {/* Progress Indicator */}
          <div
            className="flex items-center gap-1"
            role="progressbar"
            aria-valuenow={currentStepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={steps.length}
          >
            {steps.map((s, index) => {
              const isActive = currentStepIndex === index
              const isCompleted = index < currentStepIndex
              return (
                <div
                  key={s}
                  className={`flex items-center justify-center rounded-full transition-all ${
                    isActive ? "h-4 w-7" : "size-4"
                  }`}
                  title={`Step ${index + 1}${isActive ? " (current)" : isCompleted ? " (completed)" : ""}`}
                >
                  <div
                    className={`rounded-full transition-all ${
                      isActive
                        ? "h-2 w-5 bg-zinc-900 dark:bg-zinc-100"
                        : isCompleted
                          ? "size-2 bg-emerald-500 dark:bg-emerald-400"
                          : "size-2 bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  />
                </div>
              )
            })}
          </div>

          {/* Right Button */}
          {step === "confirm" ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-md gap-1.5 h-7 px-4 py-2"
            >
              <Check size={14} />
              Create
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={(step === "basics" && !canProceedBasics) || (step === "schedule" && !canProceedSchedule)}
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors duration-100 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 rounded-md gap-1.5 h-7 px-4 py-2 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
      <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  )
}
