"use client"

import {
  type AgentFieldErrors,
  CLAUDE_MODELS,
  type ClaudeModel,
  isValidClaudeModel,
  validateAgentCreate,
  validateAgentField,
} from "@webalive/shared"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { AutomationConfigData, AutomationConfigResult } from "@/components/ai/AutomationConfig"
import { ApiError, postty } from "@/lib/api/api-client"
import { buildCreatePayload, configResultToFormData } from "@/lib/automation/build-payload"
import { MODEL_OPTIONS } from "@/lib/automation/form-options"
import { ErrorAlert, INPUT, TrigIcon } from "./AgentUI"
import { agentsApi } from "./agents-api"
import { timeoutMinutes, trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

interface AgentEditViewProps {
  job: EnrichedJob | null
  createData?: AutomationConfigData | null
  onDone: (message?: string) => void
  onChanged?: () => void
}

export function AgentEditView({ job, createData, onDone, onChanged }: AgentEditViewProps) {
  const isCreate = !job

  const [name, setName] = useState(job?.name ?? createData?.defaultName ?? "")
  const [prompt, setPrompt] = useState(job?.action_prompt ?? createData?.defaultPrompt ?? "")
  const [model, setModel] = useState<ClaudeModel | "">(
    job && isValidClaudeModel(job.action_model)
      ? job.action_model
      : (createData?.defaultModel ?? CLAUDE_MODELS.HAIKU_4_5),
  )
  const [schedule, setSchedule] = useState(job ? trigLabel(job) : "every day at 9am")
  const [timeoutMin, setTimeoutMin] = useState(String(timeoutMinutes(job?.action_timeout_seconds)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<AgentFieldErrors>({})

  const promptRef = useRef<HTMLDivElement>(null)

  // Re-sync when job changes
  useEffect(() => {
    if (job) {
      setName(job.name)
      setPrompt(job.action_prompt ?? "")
      setModel(isValidClaudeModel(job.action_model) ? job.action_model : "")
      setSchedule(trigLabel(job))
      setTimeoutMin(String(timeoutMinutes(job.action_timeout_seconds)))
    }
    setError(null)
    setFieldErrors({})
  }, [job?.id])

  // Sync contentEditable with prompt state when job changes
  useEffect(() => {
    if (promptRef.current && promptRef.current.textContent !== prompt) {
      promptRef.current.textContent = prompt
    }
  }, [job?.id])

  // ── Change detection ──
  const origModel = job && isValidClaudeModel(job.action_model) ? job.action_model : ""
  const origTimeoutMin = String(timeoutMinutes(job?.action_timeout_seconds))
  const origSchedule = job ? trigLabel(job) : ""

  const hasChanges = isCreate
    ? true
    : name !== job.name ||
      prompt !== (job.action_prompt ?? "") ||
      model !== origModel ||
      schedule !== origSchedule ||
      timeoutMin !== origTimeoutMin

  // ── Save ──
  const timeoutSeconds = timeoutMin ? String(Number(timeoutMin) * 60) : ""

  const handleSave = useCallback(async () => {
    if (isCreate) {
      const errors = validateAgentCreate({ name, prompt, schedule, timeout: timeoutSeconds })
      if (errors) {
        setFieldErrors(errors)
        return
      }
    } else {
      const errors: AgentFieldErrors = {}
      if (name !== job.name) {
        const e = validateAgentField("name", name)
        if (e) errors.name = e
      }
      if (prompt !== (job.action_prompt ?? "")) {
        const e = validateAgentField("prompt", prompt)
        if (e) errors.prompt = e
      }
      if (timeoutMin !== origTimeoutMin) {
        const e = validateAgentField("timeout", timeoutSeconds)
        if (e) errors.timeout = e
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        return
      }
    }

    setFieldErrors({})
    setSaving(true)
    setError(null)
    try {
      if (isCreate) {
        const site = createData?.sites?.[0]
        if (!site) throw new Error("No site available")

        const result: AutomationConfigResult = {
          siteId: site.id,
          siteName: site.hostname,
          name,
          prompt,
          model: (model || CLAUDE_MODELS.HAIKU_4_5) as ClaudeModel,
          scheduleType: "custom",
          scheduleText: schedule,
          scheduleTime: "09:00",
        }
        const request = buildCreatePayload(configResultToFormData(result))
        await postty("automations/create", request)
        onDone(`Agent "${name}" created. Schedule: ${schedule}`)
      } else {
        const fields: Record<string, unknown> = {}
        if (name !== job.name) fields.name = name
        if (prompt !== (job.action_prompt ?? "")) fields.action_prompt = prompt || null
        if (model !== origModel) fields.action_model = model || null
        if (schedule !== origSchedule) fields.schedule_text = schedule || null
        if (timeoutMin !== origTimeoutMin) fields.action_timeout_seconds = timeoutMin ? Number(timeoutMin) * 60 : null

        await agentsApi.update(job.id, fields)
        onChanged?.()
        onDone()
      }
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message)
      } else {
        setError(e instanceof Error ? e.message : "Failed to save")
      }
    } finally {
      setSaving(false)
    }
  }, [
    isCreate,
    createData,
    job,
    name,
    prompt,
    model,
    schedule,
    timeoutMin,
    timeoutSeconds,
    origModel,
    origSchedule,
    origTimeoutMin,
    onDone,
    onChanged,
  ])

  const triggerType = job?.trigger_type ?? "cron"

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex">
        {/* Left column — settings */}
        <div className="w-[300px] shrink-0 border-r border-zinc-100 dark:border-white/[0.04] overflow-auto px-5 py-5">
          <FieldGroup label="Agent's name" color="emerald">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Agent name"
              className={`${INPUT} ${fieldErrors.name ? "border-red-300 dark:border-red-700" : ""}`}
            />
            {fieldErrors.name && <p className="text-[11px] text-red-500 mt-1.5">{fieldErrors.name}</p>}
          </FieldGroup>

          <FieldGroup label="Schedule" color="blue" icon={<TrigIcon type={triggerType} size={13} />}>
            {triggerType === "cron" && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                  placeholder="every day at 9am"
                  className={INPUT}
                />
                <div>
                  <label
                    htmlFor="edit-timeout"
                    className="text-[12px] font-medium text-zinc-400 dark:text-zinc-600 block mb-2"
                  >
                    Timeout: <span className="font-bold text-zinc-900 dark:text-zinc-100">{timeoutMin} min</span>
                  </label>
                  <input
                    id="edit-timeout"
                    type="range"
                    min={1}
                    max={60}
                    value={timeoutMin}
                    onChange={e => setTimeoutMin(e.target.value)}
                    className="w-full h-2 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-300 dark:text-zinc-700 mt-1 tabular-nums">
                    <span>1m</span>
                    <span>60m</span>
                  </div>
                </div>
              </div>
            )}
            {triggerType === "email" && job?.email_address && (
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 font-mono">{job.email_address}</p>
            )}
            {triggerType === "webhook" && <p className="text-[12px] text-zinc-400">Triggered via webhook.</p>}
            {triggerType === "one-time" && <p className="text-[12px] text-zinc-400">Runs once.</p>}
          </FieldGroup>

          <FieldGroup label="Model" color="violet">
            <div className="flex flex-wrap gap-2">
              {MODEL_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModel(model === opt.value ? "" : (opt.value as ClaudeModel))}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all ${
                    model === opt.value
                      ? "bg-violet-500 text-white border-b-[3px] border-violet-600 active:translate-y-[2px] active:border-b-0"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-b-[3px] border-zinc-200 dark:border-zinc-700 hover:brightness-95 dark:hover:brightness-110 active:translate-y-[2px] active:border-b-0"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FieldGroup>

          {error && <ErrorAlert message={error} />}
        </div>

        {/* Right column — prompt */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="shrink-0 px-5 h-11 flex items-center justify-between border-b border-zinc-100 dark:border-white/[0.04]">
            <span className="text-[12px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Prompt
            </span>
            <span className="text-[11px] font-medium text-zinc-300 dark:text-zinc-700 tabular-nums">
              {prompt.length.toLocaleString()} chars
            </span>
          </div>
          {fieldErrors.prompt && (
            <div className="px-5 pt-2">
              <p className="text-[11px] text-red-500">{fieldErrors.prompt}</p>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto">
            <div
              ref={promptRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => setPrompt(e.currentTarget.textContent ?? "")}
              className="px-5 py-4 text-[15px] text-zinc-900 dark:text-zinc-100 leading-[1.7] outline-none min-h-full whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-300 dark:empty:before:text-zinc-700"
              data-placeholder="Describe what this agent should do..."
            >
              {prompt}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 py-3 px-5 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => onDone()}
          className="h-9 px-5 rounded-xl text-[13px] font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {isCreate ? "Cancel" : "Back"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="h-9 px-5 rounded-xl text-[13px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 border-b-[3px] border-emerald-600 active:translate-y-[2px] active:border-b-0 disabled:opacity-40 transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : isCreate ? "Create" : "Save"}
        </button>
      </div>
    </div>
  )
}

function FieldGroup({
  label,
  icon,
  color,
  children,
}: {
  label: string
  icon?: React.ReactNode
  color: "emerald" | "blue" | "violet"
  children: React.ReactNode
}) {
  const colors = {
    emerald: "text-emerald-500 dark:text-emerald-400",
    blue: "text-blue-500 dark:text-blue-400",
    violet: "text-violet-500 dark:text-violet-400",
  }
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-2 ${colors[color]}`}>
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  )
}
