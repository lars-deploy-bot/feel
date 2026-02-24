/**
 * CalendarEventDeleteOutput
 *
 * Renders a user-confirmed calendar delete card and executes deletion via REST API.
 */

"use client"

import { useCallback, useState } from "react"
import { CalendarEventDeleteCard } from "./CalendarEventDeleteCard"
import type { CalendarEventDeleteOutputProps, DeleteEventDraft } from "./types"

function parseDeleteDraft(data: unknown): DeleteEventDraft | null {
  if (!data || typeof data !== "object") return null
  const draft = data as Record<string, unknown>

  if (typeof draft.eventId !== "string" || draft.eventId.length === 0) {
    return null
  }

  if (draft.calendarId !== undefined && typeof draft.calendarId !== "string") {
    return null
  }

  return {
    type: draft.type === "delete_event_draft" ? "delete_event_draft" : undefined,
    eventId: draft.eventId,
    calendarId: typeof draft.calendarId === "string" ? draft.calendarId : "primary",
    summary: typeof draft.summary === "string" ? draft.summary : undefined,
    location: typeof draft.location === "string" ? draft.location : undefined,
    start:
      typeof draft.start === "object" && draft.start !== null ? (draft.start as DeleteEventDraft["start"]) : undefined,
    end: typeof draft.end === "object" && draft.end !== null ? (draft.end as DeleteEventDraft["end"]) : undefined,
    htmlLink: typeof draft.htmlLink === "string" ? draft.htmlLink : undefined,
  }
}

export function validateCalendarEventDeleteDraft(data: unknown): boolean {
  return parseDeleteDraft(data) !== null
}

export function CalendarEventDeleteOutput({ data, isError = false, onSubmitAnswer }: CalendarEventDeleteOutputProps) {
  const [draft] = useState<DeleteEventDraft | null>(() => parseDeleteDraft(data))

  const handleDelete = useCallback(
    async (eventData: DeleteEventDraft) => {
      const response = await fetch("/api/google/calendar/delete-event", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calendarId: eventData.calendarId || "primary",
          eventId: eventData.eventId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.reason || "Failed to delete event")
      }

      if (onSubmitAnswer) {
        onSubmitAnswer(`Deleted calendar event "${eventData.summary || eventData.eventId}".`)
      }
    },
    [onSubmitAnswer],
  )

  if (isError) {
    return (
      <div className="border border-red-200 dark:border-red-900 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
        <p className="text-sm text-red-700 dark:text-red-300">
          Error preparing delete action: {typeof data === "string" ? data : "Invalid format"}
        </p>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="border border-red-200 dark:border-red-900 rounded-lg p-4 bg-red-50 dark:bg-red-900/10">
        <p className="text-sm text-red-700 dark:text-red-300">Could not parse delete event payload</p>
      </div>
    )
  }

  return <CalendarEventDeleteCard draft={draft} onDelete={handleDelete} isCalendarConnected={true} />
}
