/**
 * CalendarEventDraftCard Component
 *
 * Clean calendar event compose UI. Claude drafts events, user creates them.
 * Pattern matches EmailDraftCard but for calendar events.
 */

"use client"

import { AlertTriangle, Check, Loader2, Users, X } from "lucide-react"
import { type KeyboardEvent, useState } from "react"
import { toApiDateTime, toDateTimeLocalValue } from "./dateTime"
import type { EventDraft } from "./types"

interface CalendarEventDraftCardProps {
  draft: EventDraft
  onCreate: (eventData: EventDraft) => Promise<void>
  onDraftChange?: (eventData: EventDraft) => void
  actionsDisabled?: boolean
  isCalendarConnected?: boolean
  tabId?: string
  toolUseId?: string
  onSubmitAnswer?: (message: string) => void
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function AttendeeField({
  attendees,
  onChange,
}: {
  attendees: Array<{ email: string; optional?: boolean }>
  onChange: (attendees: Array<{ email: string; optional?: boolean }>) => void
}) {
  const [inputValue, setInputValue] = useState("")

  const addAttendee = () => {
    const email = inputValue.trim()
    if (!email || !isValidEmail(email) || attendees.some(a => a.email === email)) {
      return false
    }
    onChange([...attendees, { email, optional: false }])
    setInputValue("")
    return true
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addAttendee()
    } else if (e.key === "Backspace" && !inputValue && attendees.length > 0) {
      onChange(attendees.slice(0, -1))
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-black/[0.06] dark:border-white/[0.08]">
      <Users className="w-4 h-4 text-black/30 dark:text-white/30 flex-shrink-0" />
      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        {attendees.map((attendee, idx) => (
          <span
            key={`${attendee.email}-${idx}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-black/[0.04] dark:bg-white/[0.06] text-black/60 dark:text-white/60 rounded-[6px]"
          >
            {attendee.email}
            {attendee.optional && <span className="text-[11px] text-black/40 dark:text-white/40">(optional)</span>}
            <button
              type="button"
              onClick={() => onChange(attendees.filter((_, i) => i !== idx))}
              className="hover:text-black/80 dark:hover:text-white/80 transition-colors duration-100"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="email"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addAttendee()}
          placeholder={attendees.length === 0 ? "Add attendees..." : ""}
          className="flex-1 min-w-[120px] bg-transparent text-[13px] text-black/70 dark:text-white/70 placeholder-black/30 dark:placeholder-white/30 outline-none"
        />
      </div>
    </div>
  )
}

export function CalendarEventDraftCard({
  draft: initialDraft,
  onCreate,
  onDraftChange,
  actionsDisabled = false,
  isCalendarConnected = true,
  tabId: _tabId,
  toolUseId: _toolUseId,
  onSubmitAnswer: _onSubmitAnswer,
}: CalendarEventDraftCardProps) {
  const [draft, setDraft] = useState<EventDraft>(initialDraft)
  const [isCreating, setIsCreating] = useState(false)
  const [createdEventId, setCreatedEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDraftChange = (newDraft: EventDraft) => {
    setDraft(newDraft)
    setError(null)
    onDraftChange?.(newDraft)
  }

  const handleCreate = async () => {
    // Validate
    if (!draft.summary?.trim()) {
      setError("Event title is required")
      return
    }

    const startTime = new Date(draft.start.dateTime).getTime()
    const endTime = new Date(draft.end.dateTime).getTime()

    if (startTime >= endTime) {
      setError("Event start time must be before end time")
      return
    }

    setError(null)
    setIsCreating(true)

    try {
      await onCreate(draft)
      setCreatedEventId(draft.summary)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create event"
      setError(message)
      setIsCreating(false)
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

  if (createdEventId) {
    return (
      <div className="flex items-center gap-2 py-2 text-[13px] text-black/60 dark:text-white/60">
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <span>"{draft.summary}" added to your calendar</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Title */}
        <input
          type="text"
          value={draft.summary}
          onChange={e => handleDraftChange({ ...draft, summary: e.target.value })}
          placeholder="Event title"
          className="w-full bg-transparent text-[13px] font-medium text-black/90 dark:text-white/90 placeholder-black/30 dark:placeholder-white/30 outline-none border-b border-black/[0.06] dark:border-white/[0.08] pb-2"
          disabled={isCreating || actionsDisabled}
        />

        {/* Description */}
        <textarea
          value={draft.description || ""}
          onChange={e => handleDraftChange({ ...draft, description: e.target.value })}
          placeholder="Description"
          className="w-full bg-transparent text-[13px] text-black/60 dark:text-white/60 placeholder-black/30 dark:placeholder-white/30 outline-none border-b border-black/[0.06] dark:border-white/[0.08] pb-2 resize-none"
          rows={2}
          disabled={isCreating || actionsDisabled}
        />

        {/* Date/Time Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-black/40 dark:text-white/40 block mb-1">
              Start
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.start.dateTime)}
                onChange={e =>
                  handleDraftChange({
                    ...draft,
                    start: { ...draft.start, dateTime: toApiDateTime(e.target.value) },
                  })
                }
                className="w-full px-2 py-1.5 text-[13px] border border-black/[0.06] dark:border-white/[0.08] rounded-lg bg-transparent text-black/70 dark:text-white/70 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-black/20 dark:focus:border-white/20 transition-colors duration-100"
                disabled={isCreating || actionsDisabled}
              />
            </label>
          </div>
          <div>
            <label className="text-[11px] text-black/40 dark:text-white/40 block mb-1">
              End
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(draft.end.dateTime)}
                onChange={e =>
                  handleDraftChange({
                    ...draft,
                    end: { ...draft.end, dateTime: toApiDateTime(e.target.value) },
                  })
                }
                className="w-full px-2 py-1.5 text-[13px] border border-black/[0.06] dark:border-white/[0.08] rounded-lg bg-transparent text-black/70 dark:text-white/70 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-black/20 dark:focus:border-white/20 transition-colors duration-100"
                disabled={isCreating || actionsDisabled}
              />
            </label>
          </div>
        </div>

        {/* Location */}
        <input
          type="text"
          value={draft.location || ""}
          onChange={e => handleDraftChange({ ...draft, location: e.target.value })}
          placeholder="Location"
          className="w-full px-2 py-1.5 text-[13px] border border-black/[0.06] dark:border-white/[0.08] rounded-lg bg-transparent text-black/70 dark:text-white/70 placeholder-black/30 dark:placeholder-white/30 focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 focus:border-black/20 dark:focus:border-white/20 transition-colors duration-100"
          disabled={isCreating || actionsDisabled}
        />

        {/* Attendees */}
        {draft.attendees && draft.attendees.length > 0 && (
          <AttendeeField
            attendees={draft.attendees}
            onChange={attendees => handleDraftChange({ ...draft, attendees })}
          />
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 text-[12px] text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.08]">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating || actionsDisabled || !isCalendarConnected}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-40 transition-colors duration-100"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Event"
          )}
        </button>
      </div>
    </div>
  )
}
