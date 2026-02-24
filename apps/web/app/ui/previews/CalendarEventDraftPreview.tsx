/**
 * Calendar Event Draft Preview
 *
 * Preview for CalendarEventDraftCard component (compose_calendar_event tool).
 */

"use client"

import { RotateCcw } from "lucide-react"
import { useState } from "react"
import { CalendarEventDraftCard } from "@/components/calendar/CalendarEventDraftCard"
import type { EventDraft } from "@/components/calendar/types"

const SAMPLE_DRAFT: EventDraft = {
  summary: "Team standup",
  description: "Weekly sync to discuss progress and blockers.",
  start: { dateTime: "2026-02-25T10:00:00+01:00", timeZone: "Europe/Amsterdam" },
  end: { dateTime: "2026-02-25T10:30:00+01:00", timeZone: "Europe/Amsterdam" },
  location: "Google Meet",
  attendees: [{ email: "alice@example.com" }, { email: "bob@example.com", optional: true }],
  calendarId: "primary",
}

export function CalendarEventDraftPreview() {
  const [created, setCreated] = useState(false)
  const [key, setKey] = useState(0)

  const handleCreate = async () => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    setCreated(true)
  }

  const reset = () => {
    setCreated(false)
    setKey(k => k + 1)
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">CalendarEventDraftCard</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Editable event card from compose_calendar_event. User clicks Create Event to confirm.
        </p>
      </div>

      <div className="flex flex-col-reverse md:flex-row gap-6 md:gap-8">
        <div className="flex-1 md:max-w-xl">
          {created ? (
            <div className="border border-green-200 dark:border-green-900 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Event created (simulated)</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">"{SAMPLE_DRAFT.summary}" was added.</p>
            </div>
          ) : (
            <CalendarEventDraftCard key={key} draft={SAMPLE_DRAFT} onCreate={handleCreate} isCalendarConnected={true} />
          )}
        </div>

        <div className="w-full md:w-56 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Tool</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">compose_calendar_event</p>
          </div>

          <button
            type="button"
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
