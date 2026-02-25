/**
 * CalendarEventDeleteCard Component
 *
 * Shows a user-confirmed delete action for a calendar event.
 */

"use client"

import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import type { DeleteEventDraft } from "./types"

interface CalendarEventDeleteCardProps {
  draft: DeleteEventDraft
  onDelete: (eventData: DeleteEventDraft) => Promise<void>
  actionsDisabled?: boolean
  isCalendarConnected?: boolean
}

function formatEventTime(value?: { dateTime?: string; date?: string }): string {
  if (!value) return "Unknown time"

  if (value.dateTime) {
    const parsed = new Date(value.dateTime)
    if (Number.isNaN(parsed.getTime())) return value.dateTime
    return parsed.toLocaleString()
  }

  if (value.date) {
    return value.date
  }

  return "Unknown time"
}

export function CalendarEventDeleteCard({
  draft,
  onDelete,
  actionsDisabled = false,
  isCalendarConnected = true,
}: CalendarEventDeleteCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const summary = draft.summary || "Untitled event"
  const calendarId = draft.calendarId || "primary"

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)
    try {
      await onDelete(draft)
      setDeleted(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete event"
      setError(message)
      setIsDeleting(false)
    }
  }

  if (!isCalendarConnected) {
    return (
      <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] p-4 space-y-2">
        <div className="flex items-center gap-2 text-[12px] text-black/50 dark:text-white/50">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Google Calendar not connected.</span>
          <a
            href="/chat?settings=integrations"
            className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 underline"
          >
            Connect
          </a>
        </div>
      </div>
    )
  }

  if (deleted) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] text-black/60 dark:text-white/60">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span>"{summary}" removed from your calendar</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
      <div className="px-4 py-3 space-y-2">
        <p className="text-[13px] font-medium text-black/80 dark:text-white/80">{summary}</p>
        <div className="text-[11px] text-black/40 dark:text-white/40 space-y-0.5">
          <p>Calendar: {calendarId}</p>
          <p>
            {formatEventTime(draft.start)} — {formatEventTime(draft.end)}
          </p>
          {draft.location && <p>{draft.location}</p>}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08]">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting || actionsDisabled || !isCalendarConnected}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-colors duration-100"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-3 h-3" />
              Delete Event
            </>
          )}
        </button>
      </div>
    </div>
  )
}
