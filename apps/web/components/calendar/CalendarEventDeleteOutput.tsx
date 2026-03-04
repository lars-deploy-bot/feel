/**
 * CalendarEventDeleteOutput
 *
 * Renders a user-confirmed calendar delete card and executes deletion via REST API.
 */

"use client"

import { useCallback, useState } from "react"
import { z } from "zod"
import { delly } from "@/lib/api/api-client"
import { validateRequest } from "@/lib/api/schemas"
import { CalendarEventDeleteCard } from "./CalendarEventDeleteCard"
import type { CalendarEventDeleteOutputProps, DeleteEventDraft } from "./types"

const TimeSlotSchema = z
  .object({
    dateTime: z.string().optional(),
    date: z.string().optional(),
    timeZone: z.string().optional(),
  })
  .optional()

const DeleteDraftSchema = z.object({
  type: z.literal("delete_event_draft").optional(),
  eventId: z.string().min(1),
  calendarId: z.string().default("primary"),
  summary: z.string().optional(),
  location: z.string().optional(),
  start: TimeSlotSchema,
  end: TimeSlotSchema,
  htmlLink: z.string().optional(),
})

function parseDeleteDraft(data: unknown): DeleteEventDraft | null {
  const result = DeleteDraftSchema.safeParse(data)
  return result.success ? result.data : null
}

export function validateCalendarEventDeleteDraft(data: unknown): boolean {
  return parseDeleteDraft(data) !== null
}

export function CalendarEventDeleteOutput({ data, isError = false, onSubmitAnswer }: CalendarEventDeleteOutputProps) {
  const [draft] = useState<DeleteEventDraft | null>(() => parseDeleteDraft(data))

  const handleDelete = useCallback(
    async (eventData: DeleteEventDraft) => {
      const validated = validateRequest("google/calendar/delete-event", {
        calendarId: eventData.calendarId || "primary",
        eventId: eventData.eventId,
      })
      await delly("google/calendar/delete-event", validated)

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
