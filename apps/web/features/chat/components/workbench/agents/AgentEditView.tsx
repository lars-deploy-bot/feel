"use client"

import { type ClaudeModel, isValidClaudeModel } from "@webalive/shared"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { MODEL_OPTIONS } from "@/lib/automation/form-options"
import { agentsApi } from "./agents-api"
import { trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

const LABEL = "text-[13px] font-medium text-zinc-900 dark:text-zinc-100 block mb-1.5"
const INPUT =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-400 dark:focus:border-zinc-500 outline-none transition-colors duration-100"
const SELECT = `${INPUT} cursor-pointer`

export function AgentEditView({
  job,
  onBack,
  onChanged,
}: {
  job: EnrichedJob
  onBack: () => void
  onChanged: () => void
}) {
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
  }, [job.id])

  const origModel = isValidClaudeModel(job.action_model) ? job.action_model : ""
  const origTimeout = job.action_timeout_seconds ? String(job.action_timeout_seconds) : ""

  const hasChanges =
    name !== job.name ||
    prompt !== (job.action_prompt ?? "") ||
    model !== origModel ||
    schedule !== (job.cron_schedule ?? "") ||
    timeout !== origTimeout

  async function handleSave() {
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
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col overflow-auto">
        <div className="px-5 py-5 flex-1 min-h-0 flex flex-col">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate shrink-0">{job.name}</h3>

          {error && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 shrink-0">
              <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mt-5 flex-1 min-h-0 flex flex-col gap-4">
            <div className="shrink-0">
              <label htmlFor="edit-name" className={LABEL}>
                Name
              </label>
              <input
                id="edit-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Agent name"
                className={INPUT}
              />
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              <label htmlFor="edit-prompt" className={`${LABEL} shrink-0`}>
                Prompt
              </label>
              <textarea
                id="edit-prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="What should this agent do?"
                className={`${INPUT} resize-none flex-1 min-h-[120px]`}
              />
            </div>

            <div className="shrink-0 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-model" className={LABEL}>
                  Model
                </label>
                <select
                  id="edit-model"
                  value={model}
                  onChange={e => {
                    const v = e.target.value
                    setModel(isValidClaudeModel(v) ? v : "")
                  }}
                  className={SELECT}
                >
                  <option value="">Default</option>
                  {MODEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-timeout" className={LABEL}>
                  Timeout (s)
                </label>
                <input
                  id="edit-timeout"
                  type="number"
                  min={10}
                  max={3600}
                  value={timeout}
                  onChange={e => setTimeout(e.target.value)}
                  placeholder="300"
                  className={INPUT}
                />
              </div>
            </div>

            {job.trigger_type === "cron" && (
              <div className="shrink-0">
                <label htmlFor="edit-schedule" className={LABEL}>
                  Schedule
                </label>
                <input
                  id="edit-schedule"
                  type="text"
                  value={schedule}
                  onChange={e => setSchedule(e.target.value)}
                  placeholder="0 9 * * *"
                  className={`${INPUT} font-mono`}
                />
                {job.cron_schedule && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
                    Currently: {trigLabel(job)}
                    {job.cron_timezone ? ` (${job.cron_timezone.replace(/^.*\//, "")})` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
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
