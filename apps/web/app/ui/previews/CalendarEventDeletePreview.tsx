/**
 * Calendar Event Delete Preview
 *
 * Preview for CalendarEventDeleteCard component (compose_delete_event tool).
 */

"use client"

import { RotateCcw } from "lucide-react"
import { useState } from "react"
import { CalendarEventDeleteCard } from "@/components/calendar/CalendarEventDeleteCard"
import type { DeleteEventDraft } from "@/components/calendar/types"

const SAMPLE_DELETE_DRAFT: DeleteEventDraft = {
  type: "delete_event_draft",
  eventId: "abc123def456",
  calendarId: "primary",
  summary: "Cancelled meeting with client",
  location: "Amsterdam HQ",
  start: { dateTime: "2026-02-25T14:00:00+01:00" },
  end: { dateTime: "2026-02-25T15:00:00+01:00" },
  htmlLink: "https://calendar.google.com/calendar/event?eid=abc123",
}

export function CalendarEventDeletePreview() {
  const [simulateConnected, setSimulateConnected] = useState(true)
  const [key, setKey] = useState(0)

  const handleDelete = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  const reset = () => {
    setKey(k => k + 1)
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">CalendarEventDeleteCard</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Delete confirmation card from compose_delete_event. User clicks Delete Event to confirm.
        </p>
      </div>

      <div className="flex flex-col-reverse md:flex-row gap-6 md:gap-8">
        <div className="flex-1 md:max-w-xl">
          <CalendarEventDeleteCard
            key={key}
            draft={SAMPLE_DELETE_DRAFT}
            onDelete={handleDelete}
            isCalendarConnected={simulateConnected}
          />
        </div>

        <div className="w-full md:w-56 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Tool</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">compose_delete_event</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
              Calendar Connected
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Simulate:</span>
              <button
                type="button"
                onClick={() => {
                  setSimulateConnected(!simulateConnected)
                  setKey(k => k + 1)
                }}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  simulateConnected ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    simulateConnected ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
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
