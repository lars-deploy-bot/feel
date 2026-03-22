/**
 * ScheduleInput — human-readable schedule input.
 *
 * Users type plain English like "every weekday at 9am".
 * Quick-pick chips for common schedules.
 * Live preview resolves text → cron via API (debounced).
 *
 * The actual text→cron conversion for storage happens server-side
 * at save time — this component only previews.
 */

"use client"

import { AGENT_CONSTRAINTS } from "@webalive/shared"
import { Check, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { inputClass } from "@/components/automations/form-styles"

const PREVIEW_DEBOUNCE_MS = 800

const QUICK_PICKS = [
  { text: "every 5 minutes", cron: "*/5 * * * *", description: "Every 5 minutes" },
  { text: "every hour", cron: "0 * * * *", description: "Every hour" },
  { text: "every day at 9am", cron: "0 9 * * *", description: "Every day at 9:00 AM" },
  { text: "weekdays at 9am", cron: "0 9 * * 1-5", description: "Weekdays at 9:00 AM" },
  { text: "every Sunday at 9am", cron: "0 9 * * 0", description: "Every Sunday at 9:00 AM" },
  { text: "1st of every month at 9am", cron: "0 9 1 * *", description: "1st of every month at 9:00 AM" },
] as const

interface ScheduleInputProps {
  value: string
  onChange: (text: string) => void
  showOneTime?: boolean
  lockOneTimeToggle?: boolean
  isOneTime?: boolean
  onOneTimeChange?: (isOneTime: boolean) => void
  oneTimeDate?: string
  oneTimeTime?: string
  onOneTimeDateChange?: (date: string) => void
  onOneTimeTimeChange?: (time: string) => void
}

interface PreviewState {
  cron: string
  /** What the AI understood — shown to the user as confirmation */
  description: string | null
  timezone: string | null
  loading: boolean
  error: string | null
}

export function ScheduleInput({
  value,
  onChange,
  showOneTime = false,
  lockOneTimeToggle = false,
  isOneTime: isOneTimeProp,
  onOneTimeChange,
  oneTimeDate,
  oneTimeTime,
  onOneTimeDateChange,
  onOneTimeTimeChange,
}: ScheduleInputProps) {
  const [isOneTime, setIsOneTime] = useState(isOneTimeProp ?? false)
  const [preview, setPreview] = useState<PreviewState>({
    cron: "",
    description: null,
    timezone: null,
    loading: false,
    error: null,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = useRef<AbortController>(undefined)

  useEffect(() => {
    if (isOneTimeProp !== undefined) setIsOneTime(isOneTimeProp)
  }, [isOneTimeProp])

  // Check if value matches a quick pick (known cron, no API call needed)
  const matchedPick = QUICK_PICKS.find(p => p.text === value)

  // Resolve preview when value changes
  useEffect(() => {
    if (!value.trim() || isOneTime) {
      setPreview({ cron: "", description: null, timezone: null, loading: false, error: null })
      return
    }

    // Quick picks have known cron — skip API
    if (matchedPick) {
      setPreview({
        cron: matchedPick.cron,
        description: matchedPick.description,
        timezone: null,
        loading: false,
        error: null,
      })
      return
    }

    // Debounce API call for custom text
    setPreview(prev => ({ ...prev, loading: true, error: null }))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch("/api/automations/text-to-cron", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
          signal: controller.signal,
        })

        const data = await res.json()
        if (controller.signal.aborted) return

        if (data.ok) {
          setPreview({
            cron: data.cron,
            description: data.description ?? null,
            timezone: data.timezone,
            loading: false,
            error: null,
          })
        } else {
          setPreview({
            cron: "",
            description: null,
            timezone: null,
            loading: false,
            error: data.message || data.details?.reason || "Could not parse schedule",
          })
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
        setPreview({ cron: "", description: null, timezone: null, loading: false, error: "Failed to check schedule" })
      }
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [value, isOneTime, matchedPick])

  const handleOneTimeToggle = useCallback(
    (enabled: boolean) => {
      setIsOneTime(enabled)
      onOneTimeChange?.(enabled)
    },
    [onOneTimeChange],
  )

  return (
    <div className="space-y-3">
      {/* Recurring / One-time toggle */}
      {showOneTime && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={lockOneTimeToggle}
            onClick={() => handleOneTimeToggle(false)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              !isOneTime
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-black/[0.04] dark:bg-white/[0.06] text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70"
            } ${lockOneTimeToggle ? "cursor-not-allowed opacity-60" : ""}`}
          >
            Recurring
          </button>
          <button
            type="button"
            disabled={lockOneTimeToggle}
            onClick={() => handleOneTimeToggle(true)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              isOneTime
                ? "bg-black dark:bg-white text-white dark:text-black"
                : "bg-black/[0.04] dark:bg-white/[0.06] text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70"
            } ${lockOneTimeToggle ? "cursor-not-allowed opacity-60" : ""}`}
          >
            One-time
          </button>
        </div>
      )}

      {/* One-time: date + time pickers */}
      {isOneTime && showOneTime && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-black/60 dark:text-white/60 block">
              Date
              <input
                type="date"
                value={oneTimeDate || ""}
                onChange={e => onOneTimeDateChange?.(e.target.value)}
                className={`${inputClass} cursor-pointer mt-1`}
              />
            </label>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-black/60 dark:text-white/60 block">
              Time
              <input
                type="time"
                value={oneTimeTime || ""}
                onChange={e => onOneTimeTimeChange?.(e.target.value)}
                className={`${inputClass} cursor-pointer mt-1`}
              />
            </label>
          </div>
        </div>
      )}

      {/* Recurring: text input + quick picks + preview */}
      {!isOneTime && (
        <>
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="e.g. every weekday at 9am"
              maxLength={AGENT_CONSTRAINTS.SCHEDULE_TEXT_MAX}
              className="w-full h-10 px-3 pr-8 rounded-lg text-sm bg-black/[0.04] dark:bg-white/[0.06] text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 border-0 focus:outline-none focus:ring-1 focus:ring-black/[0.12] dark:focus:ring-white/[0.12] transition-all"
            />
            {preview.loading && (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 dark:text-white/30 animate-spin"
              />
            )}
            {!preview.loading && value.trim() && preview.cron && (
              <Check
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 dark:text-green-400"
              />
            )}
          </div>

          {value.trim() && !preview.loading && preview.cron && preview.description && (
            <p className="text-xs text-black/50 dark:text-white/50 px-1 flex items-center gap-1.5">
              <Check size={12} className="text-emerald-500 shrink-0" />
              {preview.description}
            </p>
          )}

          {value.trim() && !preview.loading && preview.error && (
            <p className="text-xs text-red-500 dark:text-red-400 px-1">{preview.error}</p>
          )}
        </>
      )}
    </div>
  )
}
