"use client"

import { type ClaudeModel, isValidClaudeModel } from "@webalive/shared"
import { Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { agentsApi } from "./agents-api"
import type { EnrichedJob } from "./agents-types"
import { OverviewSection } from "./edit/OverviewSection"
import { PromptSection } from "./edit/PromptSection"
import { TriggerSection } from "./edit/TriggerSection"

type EditSection = "overview" | "prompt" | "trigger"

export function AgentEditView({
  job,
  onBack,
  onChanged,
}: {
  job: EnrichedJob
  onBack: () => void
  onChanged: () => void
}) {
  const [section, setSection] = useState<EditSection>("overview")
  const [name, setName] = useState(job.name)
  const [prompt, setPrompt] = useState(job.action_prompt ?? "")
  const [model, setModel] = useState<ClaudeModel | "">(isValidClaudeModel(job.action_model) ? job.action_model : "")
  const [schedule, setSchedule] = useState(job.cron_schedule ?? "")
  const [timeout, setTimeout] = useState(job.action_timeout_seconds ? String(job.action_timeout_seconds) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(job.name)
    setPrompt(job.action_prompt ?? "")
    setModel(isValidClaudeModel(job.action_model) ? job.action_model : "")
    setSchedule(job.cron_schedule ?? "")
    setTimeout(job.action_timeout_seconds ? String(job.action_timeout_seconds) : "")
    setError(null)
    setSection("overview")
  }, [job.id])

  const origModel = isValidClaudeModel(job.action_model) ? job.action_model : ""
  const origTimeout = job.action_timeout_seconds ? String(job.action_timeout_seconds) : ""

  const hasChanges =
    name !== job.name ||
    prompt !== (job.action_prompt ?? "") ||
    model !== origModel ||
    schedule !== (job.cron_schedule ?? "") ||
    timeout !== origTimeout

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const fields: Record<string, unknown> = {}
      if (name !== job.name) fields.name = name
      if (prompt !== (job.action_prompt ?? "")) fields.action_prompt = prompt || null
      if (model !== origModel) fields.action_model = model || null
      if (schedule !== (job.cron_schedule ?? "")) fields.cron_schedule = schedule || null
      if (timeout !== origTimeout) fields.action_timeout_seconds = timeout ? Number(timeout) : null

      await agentsApi.update(job.id, fields)
      onChanged()
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }, [job, name, prompt, model, schedule, timeout, origModel, origTimeout, onChanged, onBack])

  // ── Drill-in sections ──
  if (section === "prompt") {
    return <PromptSection prompt={prompt} onChange={setPrompt} onBack={() => setSection("overview")} />
  }

  if (section === "trigger") {
    return (
      <TriggerSection
        job={job}
        schedule={schedule}
        onScheduleChange={setSchedule}
        timeout={timeout}
        onTimeoutChange={setTimeout}
        onBack={() => setSection("overview")}
      />
    )
  }

  // ── Overview with footer ──
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <OverviewSection
          job={job}
          name={name}
          onNameChange={setName}
          prompt={prompt}
          model={model}
          onModelChange={setModel}
          timeout={timeout}
          onPromptDrillIn={() => setSection("prompt")}
          onTriggerDrillIn={() => setSection("trigger")}
          error={error}
        />
      </div>

      <div className="shrink-0 px-4 py-3 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="h-8 px-4 rounded-lg text-[13px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-100"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="h-8 px-4 rounded-lg text-[13px] font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 transition-colors duration-100"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
        </button>
      </div>
    </div>
  )
}
