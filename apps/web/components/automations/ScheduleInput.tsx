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

import { Check, Clock, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { inputClass } from "@/components/automations/form-styles"
import { describeCron } from "@/lib/automation/cron-description"
import { SCHEDULE_TEXT_MAX_LENGTH } from "@/lib/automation/form-options"

const PREVIEW_DEBOUNCE_MS = 800

const QUICK_PICKS = [
  { text: "every 5 minutes", cron: "*/5 * * * *" },
  { text: "every hour", cron: "0 * * * *" },
  { text: "every day at 9am", cron: "0 9 * * *" },
  { text: "weekdays at 9am", cron: "0 9 * * 1-5" },
  { text: "every Sunday at 9am", cron: "0 9 * * 0" },
  { text: "1st of every month at 9am", cron: "0 9 1 * *" },
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
      setPreview({ cron: "", timezone: null, loading: false, error: null })
      return
    }

    // Quick picks have known cron — skip API
    if (matchedPick) {
      setPreview({ cron: matchedPick.cron, timezone: null, loading: false, error: null })
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
          setPreview({ cron: data.cron, timezone: data.timezone, loading: false, error: null })
        } else {
          setPreview({
            cron: "",
            timezone: null,
            loading: false,
            error: data.message || data.details?.reason || "Could not parse schedule",
          })
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return
        setPreview({ cron: "", timezone: null, loading: false, error: "Failed to check schedule" })
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
          {/* Text input */}
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="e.g. every weekday at 9am"
              maxLength={SCHEDULE_TEXT_MAX_LENGTH}
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

          {/* Quick picks */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PICKS.map(pick => (
              <button
                key={pick.text}
                type="button"
                onClick={() => onChange(pick.text)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  value === pick.text
                    ? "bg-black dark:bg-white text-white dark:text-black"
                    : "bg-black/[0.05] dark:bg-white/[0.07] text-black/60 dark:text-white/60 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                }`}
              >
                {pick.text}
              </button>
            ))}
          </div>

          {/* Preview */}
          {value.trim() && !preview.loading && preview.cron && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 dark:border-emerald-500/10">
              <Clock size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-black dark:text-white">{describeCron(preview.cron)}</p>
                <p className="text-[11px] text-black/40 dark:text-white/40 mt-0.5 font-mono">{preview.cron}</p>
                {preview.timezone && (
                  <p className="text-[11px] text-black/50 dark:text-white/50 mt-0.5">{preview.timezone}</p>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {value.trim() && !preview.loading && preview.error && (
            <p className="text-xs text-red-500 dark:text-red-400 px-1">{preview.error}</p>
          )}
        </>
      )}
    </div>
  )
}
