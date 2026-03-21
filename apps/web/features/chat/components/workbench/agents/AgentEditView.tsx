"use client"

import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { agentsApi } from "./agents-api"
import { trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

const LABEL = "text-[13px] font-medium text-zinc-900 dark:text-zinc-100 block mb-1.5"
const INPUT =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 bg-transparent placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-400 dark:focus:border-zinc-500 outline-none transition-colors duration-100"

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
  const [model, setModel] = useState(job.action_model ?? "")
  const [schedule, setSchedule] = useState(job.cron_schedule ?? "")
  const [target, setTarget] = useState(job.action_target_page ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-sync local state when the job identity changes (e.g. navigating to a different agent)
  useEffect(() => {
    setName(job.name)
    setPrompt(job.action_prompt ?? "")
    setModel(job.action_model ?? "")
    setSchedule(job.cron_schedule ?? "")
    setTarget(job.action_target_page ?? "")
    setError(null)
  }, [job.id])

  const hasChanges =
    name !== job.name ||
    prompt !== (job.action_prompt ?? "") ||
    model !== (job.action_model ?? "") ||
    schedule !== (job.cron_schedule ?? "") ||
    target !== (job.action_target_page ?? "")

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
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="px-5 py-5">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">{job.name}</h3>

          {error && (
            <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
              <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div>
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

            <div>
              <label htmlFor="edit-prompt" className={LABEL}>
                Prompt
              </label>
              <textarea
                id="edit-prompt"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="What should this agent do?"
                rows={4}
                className={`${INPUT} resize-none`}
              />
            </div>

            <div>
              <label htmlFor="edit-model" className={LABEL}>
                Model
              </label>
              <input
                id="edit-model"
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="default"
                className={INPUT}
              />
            </div>

            {job.trigger_type === "cron" && (
              <div>
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

            <div>
              <label htmlFor="edit-target" className={LABEL}>
                Target page
              </label>
              <input
                id="edit-target"
                type="text"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="/path"
                className={INPUT}
              />
            </div>
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
