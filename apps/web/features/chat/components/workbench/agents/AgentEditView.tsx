"use client"

import { Save } from "lucide-react"
import { useState } from "react"
import { agentsApi } from "./agents-api"
import { trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"
import { ActionButton } from "./AgentUI"

function EditField({ label, value, onChange, multiline, placeholder, mono }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string; mono?: boolean
}) {
  const inputCls = `w-full text-[12px] text-zinc-900 dark:text-zinc-100 bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-400 dark:focus:border-zinc-500 outline-none transition-all duration-100 ${mono ? "font-mono" : ""}`
  return (
    <div className="mb-3">
      <label className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1 block">{label}</label>
      {multiline ? (
        <textarea className={`${inputCls} resize-none`} rows={4} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type="text" className={inputCls} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}

export function AgentEditView({ job, onBack, onChanged }: {
  job: EnrichedJob; onBack: () => void; onChanged: () => void
}) {
  const [name, setName] = useState(job.name)
  const [prompt, setPrompt] = useState(job.action_prompt ?? "")
  const [model, setModel] = useState(job.action_model ?? "")
  const [schedule, setSchedule] = useState(job.cron_schedule ?? "")
  const [target, setTarget] = useState(job.action_target_page ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = name !== job.name
    || prompt !== (job.action_prompt ?? "")
    || model !== (job.action_model ?? "")
    || schedule !== (job.cron_schedule ?? "")
    || target !== (job.action_target_page ?? "")

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const fields: Record<string, unknown> = {}
      if (name !== job.name) fields.name = name
      if (prompt !== (job.action_prompt ?? "")) fields.action_prompt = prompt || null
      if (model !== (job.action_model ?? "")) fields.action_model = model || null
      if (schedule !== (job.cron_schedule ?? "")) fields.cron_schedule = schedule || null
      if (target !== (job.action_target_page ?? "")) fields.action_target_page = target || null

      await agentsApi.update(job.id, fields)
      onChanged()
      onBack()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 truncate">{job.name}</h3>
        <ActionButton onClick={handleSave} loading={saving} icon={<Save size={11} />} variant={hasChanges ? "success" : "default"}>
          Save
        </ActionButton>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
          <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <EditField label="Name" value={name} onChange={setName} placeholder="Agent name" />
      <EditField label="Prompt" value={prompt} onChange={setPrompt} multiline placeholder="What should this agent do?" />
      <EditField label="Model" value={model} onChange={setModel} placeholder="default" />
      {job.trigger_type === "cron" && (
        <EditField label="Schedule" value={schedule} onChange={setSchedule} placeholder="0 9 * * *" mono />
      )}
      <EditField label="Target page" value={target} onChange={setTarget} placeholder="/path" />

      {job.trigger_type === "cron" && job.cron_schedule && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 -mt-1 mb-3">
          Currently: {trigLabel(job)}{job.cron_timezone ? ` (${job.cron_timezone.replace(/^.*\//, "")})` : ""}
        </p>
      )}
    </div>
  )
}
