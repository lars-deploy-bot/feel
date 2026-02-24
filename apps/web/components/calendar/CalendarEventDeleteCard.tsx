/**
 * CalendarEventDeleteCard Component
 *
 * Shows a user-confirmed delete action for a calendar event.
 */

"use client"

import { AlertTriangle, CalendarClock, Check, Loader2, MapPin, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
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

function CalendarDisconnectedWarning() {
  return (
    <div className="flex items-center gap-2 p-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>Google Calendar not connected.</span>
      <a href="/chat?settings=integrations" className="underline hover:no-underline">
        Connect
      </a>
    </div>
  )
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
      <div className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 space-y-3 bg-white dark:bg-zinc-900">
        <CalendarDisconnectedWarning />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect your Google Calendar in Settings to delete events.
        </p>
      </div>
    )
  }

  if (deleted) {
    return (
      <div className="border border-green-200 dark:border-green-900 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
          <Check className="w-5 h-5" />
          <span className="font-medium">Event deleted</span>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">"{summary}" was removed from your calendar.</p>
      </div>
    )
  }

  return (
    <div className="border border-red-200 dark:border-red-900/50 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-900/40">
        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
        <h3 className="font-semibold text-sm text-red-800 dark:text-red-300">Delete Event</h3>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{summary}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Calendar: {calendarId}</p>
        </div>

        <div className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <CalendarClock className="w-4 h-4 mt-0.5 text-zinc-500" />
          <div>
            <p>{formatEventTime(draft.start)}</p>
            <p>{formatEventTime(draft.end)}</p>
          </div>
        </div>

        {draft.location ? (
          <div className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <MapPin className="w-4 h-4 mt-0.5 text-zinc-500" />
            <p>{draft.location}</p>
          </div>
        ) : null}

        {error ? (
          <div className="flex items-start gap-2 p-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting || actionsDisabled || !isCalendarConnected}
          className="flex items-center gap-2"
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
        </Button>
      </div>
    </div>
  )
}
