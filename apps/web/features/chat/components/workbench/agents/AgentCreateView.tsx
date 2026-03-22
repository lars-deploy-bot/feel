"use client"

import { CLAUDE_MODELS, type ClaudeModel, isValidClaudeModel } from "@webalive/shared"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { AutomationConfigData, AutomationConfigResult } from "@/components/ai/AutomationConfig"
import { ScheduleInput } from "@/components/automations/ScheduleInput"
import { getInitialSiteSelection, SiteCombobox } from "@/components/automations/SiteCombobox"
import { ApiError, postty } from "@/lib/api/api-client"
import { buildCreatePayload, configResultToFormData } from "@/lib/automation/build-payload"
import { DEFAULT_TIMEZONE, MODEL_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/automation/form-options"

// ── Styles ──────────────────────────────────────────────────────────────────────

const LABEL = "text-[13px] font-medium text-zinc-900 dark:text-zinc-100 block mb-1.5"
const INPUT =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-400 dark:focus:border-zinc-500 outline-none transition-colors duration-100"
const SELECT = `${INPUT} cursor-pointer`
const SECTION = "text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mt-6 mb-3"

export function AgentCreateView({
  data,
  onCreated,
  onCancel,
}: {
  data: AutomationConfigData
  onCreated: (message: string) => void
  onCancel: () => void
}) {
  const initialSite = getInitialSiteSelection(data.sites, data.defaultSiteId)
  const [siteId, setSiteId] = useState(initialSite.siteId)
  const [siteSearch, setSiteSearch] = useState(initialSite.siteSearch)

  const [name, setName] = useState(data.defaultName ?? "")
  const [prompt, setPrompt] = useState(data.defaultPrompt ?? "")
  const [model, setModel] = useState<ClaudeModel>(data.defaultModel ?? CLAUDE_MODELS.HAIKU_4_5)
  const [isOneTime, setIsOneTime] = useState(false)
  const [scheduleText, setScheduleText] = useState("every day at 9am")
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split("T")[0]
  })
  const [scheduleTime, setScheduleTime] = useState("09:00")
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE)

  const [status, setStatus] = useState<"idle" | "submitting">("idle")
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const resolvedSite = data.sites.find(s => s.id === siteId) ?? (data.sites.length === 1 ? data.sites[0] : undefined)

  const canSubmit =
    name.trim().length >= 3 &&
    prompt.trim().length >= 10 &&
    !!resolvedSite &&
    (isOneTime ? scheduleDate && scheduleTime : scheduleText.trim().length > 0)

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || status === "submitting" || !resolvedSite) return

    setError(null)
    setStatus("submitting")

    const result: AutomationConfigResult = {
      siteId: resolvedSite.id,
      siteName: resolvedSite.hostname,
      name,
      prompt,
      model,
      scheduleType: isOneTime ? "once" : "custom",
      scheduleText: isOneTime ? "" : scheduleText,
      scheduleTime,
      scheduleDate: isOneTime ? scheduleDate : undefined,
      timezone,
    }

    try {
      const request = buildCreatePayload(configResultToFormData(result))
      await postty("automations/create", request)

      const schedule = isOneTime
        ? `Once on ${scheduleDate} at ${scheduleTime}`
        : `${scheduleText} (${timezone.split("/")[1] ?? timezone})`

      onCreated(`Automation "${name}" created for ${resolvedSite.hostname}. Schedule: ${schedule}`)
    } catch (e) {
      setStatus("idle")
      if (e instanceof ApiError) {
        setError(e.message)
        return
      }
      setError(e instanceof Error ? e.message : "Failed to create automation")
    }
  }, [
    canSubmit,
    status,
    resolvedSite,
    name,
    prompt,
    model,
    isOneTime,
    scheduleText,
    scheduleTime,
    scheduleDate,
    timezone,
    onCreated,
  ])

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="px-5 py-5">
          {/* Title */}
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">New agent</h3>

          {error && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
              <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Task */}
          <p className={SECTION}>Task</p>

          <div className="space-y-4">
            <div>
              <label htmlFor="agent-name" className={LABEL}>
                Name
              </label>
              <input
                ref={nameRef}
                id="agent-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Daily summary"
                maxLength={100}
                className={INPUT}
              />
            </div>

            <div>
              <label htmlFor="agent-prompt" className={LABEL}>
                Prompt
              </label>
              <textarea
                id="agent-prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="What should this agent do?"
                rows={4}
                maxLength={5000}
                className={`${INPUT} resize-none`}
              />
            </div>

            {data.sites.length > 1 && (
              <div>
                <label htmlFor="agent-site" className={LABEL}>
                  Website
                </label>
                <SiteCombobox
                  id="agent-site"
                  sites={data.sites}
                  selectedId={siteId}
                  searchValue={siteSearch}
                  onSelect={(id, hostname) => {
                    setSiteId(id)
                    setSiteSearch(hostname)
                  }}
                  onSearchChange={setSiteSearch}
                  className={INPUT}
                />
              </div>
            )}

            <div>
              <label htmlFor="agent-model" className={LABEL}>
                Model
              </label>
              <select
                id="agent-model"
                value={model}
                onChange={e => {
                  if (isValidClaudeModel(e.target.value)) setModel(e.target.value)
                }}
                className={SELECT}
              >
                {MODEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule */}
          <p className={SECTION}>Schedule</p>

          <div className="space-y-4">
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

            <div>
              <label htmlFor="agent-timezone" className={LABEL}>
                Timezone
              </label>
              <select
                id="agent-timezone"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className={SELECT}
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
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-4 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || status === "submitting"}
          className="h-8 px-4 rounded-lg text-[13px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors duration-100"
        >
          {status === "submitting" ? <Loader2 size={14} className="animate-spin" /> : "Create"}
        </button>
      </div>
    </div>
  )
}
