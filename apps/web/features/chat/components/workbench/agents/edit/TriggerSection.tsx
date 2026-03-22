"use client"

import { ArrowLeft, Calendar, Clock, Mail, RotateCw, Webhook } from "lucide-react"
import { trigLabel } from "../agents-helpers"
import type { EnrichedJob } from "../agents-types"

const INPUT =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 bg-transparent placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-400 dark:focus:border-zinc-500 outline-none transition-colors duration-100"

export function TriggerSection({
  job,
  schedule,
  onScheduleChange,
  timeout,
  onTimeoutChange,
  onBack,
}: {
  job: EnrichedJob | null
  schedule: string
  onScheduleChange: (v: string) => void
  timeout: string
  onTimeoutChange: (v: string) => void
  onBack: () => void
}) {
  const triggerType = job?.trigger_type ?? "cron"
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 h-10 flex items-center gap-2 border-b border-zinc-100 dark:border-white/[0.04]">
        <button
          type="button"
          onClick={onBack}
          className="p-1 -ml-1 rounded-md text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <span className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">Trigger</span>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="flex items-center gap-2 mb-5">
          <TriggerIcon type={triggerType} />
          <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 capitalize">
            {triggerType === "one-time" ? "One-time" : triggerType}
          </span>
        </div>

        {triggerType === "cron" && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="edit-schedule"
                className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider block mb-1.5"
              >
                Schedule
              </label>
              <input
                id="edit-schedule"
                type="text"
                value={schedule}
                onChange={e => onScheduleChange(e.target.value)}
                placeholder="0 9 * * *"
                className={`${INPUT} font-mono`}
              />
              {job?.cron_schedule && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5">
                  {trigLabel(job)}
                  {job?.cron_timezone ? ` (${job?.cron_timezone.replace(/^.*\//, "")})` : ""}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-timeout"
                className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider block mb-1.5"
              >
                Timeout
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-timeout"
                  type="number"
                  min={10}
                  max={3600}
                  value={timeout}
                  onChange={e => onTimeoutChange(e.target.value)}
                  placeholder="300"
                  className={`${INPUT} w-24 tabular-nums`}
                />
                <span className="text-[12px] text-zinc-400 dark:text-zinc-600">seconds</span>
              </div>
            </div>
          </div>
        )}

        {triggerType === "email" && job?.email_address && (
          <div>
            <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1.5">
              Email address
            </p>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-400 font-mono">{job?.email_address}</p>
          </div>
        )}

        {triggerType === "webhook" && (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Triggered via webhook POST request.</p>
        )}

        {triggerType === "one-time" && (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">This agent runs once and is then complete.</p>
        )}
      </div>
    </div>
  )
}

function TriggerIcon({ type }: { type: string }) {
  const cls = "text-zinc-400 dark:text-zinc-600 shrink-0"
  switch (type) {
    case "email":
      return <Mail size={13} className={cls} />
    case "webhook":
      return <Webhook size={13} className={cls} />
    case "one-time":
      return <Clock size={13} className={cls} />
    default:
      return <RotateCw size={13} className={cls} />
  }
}

export { TriggerIcon }
