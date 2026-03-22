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
import { useCallback, useEffect, useState } from "react"
import type { AutomationConfigData, AutomationConfigResult } from "@/components/ai/AutomationConfig"
import { ApiError, postty } from "@/lib/api/api-client"
import { buildCreatePayload, configResultToFormData } from "@/lib/automation/build-payload"
import { agentsApi } from "./agents-api"
import { trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"
import { OverviewSection } from "./edit/OverviewSection"
import { PromptSection } from "./edit/PromptSection"
import { TriggerSection } from "./edit/TriggerSection"

type EditSection = "overview" | "prompt" | "trigger"

/** Shared props for both create and edit modes */
interface AgentEditViewProps {
  /** Existing job to edit. Null = create mode. */
  job: EnrichedJob | null
  /** Create-mode data (sites, defaults from chat). Only used when job is null. */
  createData?: AutomationConfigData | null
  onDone: (message?: string) => void
  onChanged?: () => void
}

export function AgentEditView({ job, createData, onDone, onChanged }: AgentEditViewProps) {
  const isCreate = !job

  const [section, setSection] = useState<EditSection>("overview")
  const [name, setName] = useState(job?.name ?? createData?.defaultName ?? "")
  const [prompt, setPrompt] = useState(job?.action_prompt ?? createData?.defaultPrompt ?? "")
  const [model, setModel] = useState<ClaudeModel | "">(
    job && isValidClaudeModel(job.action_model)
      ? job.action_model
      : (createData?.defaultModel ?? CLAUDE_MODELS.HAIKU_4_5),
  )
  const [schedule, setSchedule] = useState(job?.cron_schedule ?? "every day at 9am")
  const [timeout, setTimeout] = useState(job?.action_timeout_seconds ? String(job.action_timeout_seconds) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<AgentFieldErrors>({})

  // Re-sync when job changes (navigating between agents)
  useEffect(() => {
    if (job) {
      setName(job.name)
      setPrompt(job.action_prompt ?? "")
      setModel(isValidClaudeModel(job.action_model) ? job.action_model : "")
      setSchedule(job.cron_schedule ?? "")
      setTimeout(job.action_timeout_seconds ? String(job.action_timeout_seconds) : "")
    }
    setError(null)
    setFieldErrors({})
    setSection("overview")
  }, [job?.id])

  // ── Change detection (edit mode only) ──
  const origModel = job && isValidClaudeModel(job.action_model) ? job.action_model : ""
  const origTimeout = job?.action_timeout_seconds ? String(job.action_timeout_seconds) : ""

  const hasChanges = isCreate
    ? true // always allow submit attempt in create mode — validation catches issues
    : name !== job.name ||
      prompt !== (job.action_prompt ?? "") ||
      model !== origModel ||
      schedule !== (job.cron_schedule ?? "") ||
      timeout !== origTimeout

  // ── Save ──
  const handleSave = useCallback(async () => {
    // Validate before submit
    if (isCreate) {
      const errors = validateAgentCreate({ name, prompt, schedule, timeout })
      if (errors) {
        setFieldErrors(errors)
        return
      }
    } else {
      // Edit: validate only changed fields
      const errors: AgentFieldErrors = {}
      if (name !== job.name) {
        const e = validateAgentField("name", name)
        if (e) errors.name = e
      }
      if (prompt !== (job.action_prompt ?? "")) {
        const e = validateAgentField("prompt", prompt)
        if (e) errors.prompt = e
      }
      if (timeout !== origTimeout) {
        const e = validateAgentField("timeout", timeout)
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
        // Edit mode
        const fields: Record<string, unknown> = {}
        if (name !== job.name) fields.name = name
        if (prompt !== (job.action_prompt ?? "")) fields.action_prompt = prompt || null
        if (model !== origModel) fields.action_model = model || null
        if (schedule !== (job.cron_schedule ?? "")) fields.cron_schedule = schedule || null
        if (timeout !== origTimeout) fields.action_timeout_seconds = timeout ? Number(timeout) : null

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
  }, [isCreate, createData, job, name, prompt, model, schedule, timeout, origModel, origTimeout, onDone, onChanged])

  // ── Derived values — computed once, passed to children ──
  const triggerType = job?.trigger_type ?? "cron"
  const triggerLabelText = job ? trigLabel(job) : schedule
  const scheduleDescription = job ? trigLabel(job) : ""
  const timezoneShort = job?.cron_timezone ? job.cron_timezone.replace(/^.*\//, "") : ""
  const emailAddress = job?.email_address ?? ""
  const skills = job?.skills ?? []

  // ── Drill-in sections ──
  if (section === "prompt") {
    return <PromptSection prompt={prompt} onChange={setPrompt} onBack={() => setSection("overview")} />
  }

  if (section === "trigger") {
    return (
      <TriggerSection
        triggerType={triggerType}
        schedule={schedule}
        onScheduleChange={setSchedule}
        timeout={timeout}
        onTimeoutChange={setTimeout}
        scheduleDescription={scheduleDescription}
        timezoneShort={timezoneShort}
        emailAddress={emailAddress}
        onBack={() => setSection("overview")}
      />
    )
  }

  // ── Overview with footer ──
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <OverviewSection
          name={name}
          onNameChange={setName}
          prompt={prompt}
          model={model}
          onModelChange={setModel}
          triggerType={triggerType}
          triggerLabel={triggerLabelText}
          timeout={timeout}
          skills={skills}
          onPromptDrillIn={() => setSection("prompt")}
          onTriggerDrillIn={() => setSection("trigger")}
          error={error}
          fieldErrors={fieldErrors}
        />
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between">
        <button
          type="button"
          onClick={() => onDone()}
          className="h-8 px-4 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
        >
          {isCreate ? "Cancel" : "Back"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="h-8 px-4 rounded-lg text-[13px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors duration-100"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : isCreate ? "Create" : "Save"}
        </button>
      </div>
    </div>
  )
}
