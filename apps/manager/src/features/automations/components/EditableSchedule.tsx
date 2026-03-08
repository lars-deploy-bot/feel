import { useState } from "react"
import { automationsApi } from "../automations.api"
import { formatCron } from "./format-cron"

interface EditableScheduleProps {
  jobId: string
  cronSchedule: string | null
  cronTimezone: string | null
  onSaved: () => void
}

export function EditableSchedule({ jobId, cronSchedule, cronTimezone, onSaved }: EditableScheduleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ cron: string; timezone: string | null } | null>(null)

  function startEditing() {
    setDraft("")
    setError(null)
    setPreview(null)
    setEditing(true)
  }

  async function save() {
    if (!draft.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Convert text to cron via Groq
      const result = await automationsApi.textToCron(draft.trim())
      setPreview(result)

      // Save to DB
      await automationsApi.update(jobId, {
        cron_schedule: result.cron,
        cron_timezone: result.timezone,
      })
      setEditing(false)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to convert")
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setEditing(false)
    setError(null)
    setPreview(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      save()
    }
    if (e.key === "Escape") {
      cancel()
    }
  }

  const display = formatCron(cronSchedule, cronTimezone)

  if (!editing) {
    return (
      <div className="flex gap-4 py-1.5">
        <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0">Schedule</span>
        <button
          type="button"
          onClick={startEditing}
          className="text-[12px] text-text-primary min-w-0 text-left hover:text-accent transition-colors duration-100 cursor-pointer"
        >
          {display}
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4 py-1.5">
      <span className="text-[12px] text-text-tertiary w-20 flex-shrink-0 pt-1.5">Schedule</span>
      <div className="flex-1 min-w-0">
        <input
          type="text"
          className="w-full text-[12px] text-text-primary border border-border rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-text-primary/10 focus:border-text-primary/30 outline-none transition-all duration-100"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          placeholder="e.g. every weekday at 9am amsterdam time"
        />
        {preview && (
          <p className="text-[11px] text-text-secondary mt-1">
            {formatCron(preview.cron, preview.timezone)} ({preview.cron})
          </p>
        )}
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[11px] text-text-secondary hover:text-text-primary transition-colors duration-100 cursor-pointer disabled:opacity-40"
          >
            {saving ? "Converting..." : "Save"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors duration-100 cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
        <p className="text-[11px] text-text-tertiary mt-1">
          Current: {display}
          {cronSchedule ? ` (${cronSchedule})` : ""}
        </p>
      </div>
    </div>
  )
}
