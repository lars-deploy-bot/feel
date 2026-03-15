"use client"

import { Bot, ChevronDown, Play, RotateCw } from "lucide-react"
import { useMemo, useState } from "react"
import { agentsApi } from "./agents-api"
import { dur, futTime, healthScore, relTime, trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"
import { ActionButton, RunDots, StatusDot, StreakBadge, TrigIcon } from "./AgentUI"

export function AgentListView({ jobs, onSelect, onChanged, refresh }: {
  jobs: EnrichedJob[]
  onSelect: (job: EnrichedJob) => void
  onChanged: () => void
  refresh: () => void
}) {
  const [peekId, setPeekId] = useState<string | null>(null)
  const sorted = useMemo(() => [...jobs].sort((a, b) => healthScore(a) - healthScore(b)), [jobs])
  const active = jobs.filter(j => j.is_active).length
  const failing = jobs.filter(j => j.is_active && j.last_run_status === "failure").length
  const running = jobs.filter(j => j.status === "running").length

  return (
    <>
      {/* Stats bar */}
      <div className="px-4 py-2 flex items-center justify-between text-[11px] tabular-nums border-b border-zinc-50 dark:border-white/[0.02]">
        <span className="text-zinc-500 dark:text-zinc-400">{jobs.length} agent{jobs.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 dark:text-emerald-400">{active} active</span>
          {running > 0 && <><span className="text-zinc-200 dark:text-zinc-800">·</span><span className="text-blue-500">{running} running</span></>}
          {failing > 0 && <><span className="text-zinc-200 dark:text-zinc-800">·</span><span className="text-red-500">{failing} failing</span></>}
          <button type="button" onClick={refresh} className="ml-1 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <RotateCw size={11} />
          </button>
        </div>
      </div>

      {/* Rows */}
      {sorted.map(job => {
        const peeking = peekId === job.id
        return (
          <div key={job.id} className={peeking ? "bg-zinc-50/60 dark:bg-white/[0.015]" : ""}>
            <div className="flex items-center px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors">
              <button type="button" onClick={() => setPeekId(peeking ? null : job.id)} className="p-1 -ml-1 mr-1 shrink-0">
                <ChevronDown size={12} className={`text-zinc-300 dark:text-zinc-700 transition-transform duration-200 ${peeking ? "rotate-180" : ""}`} />
              </button>

              <button type="button" onClick={() => onSelect(job)} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
                <StatusDot job={job} />
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 truncate block">{job.name}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-600">
                    <span className="inline-flex items-center gap-1"><TrigIcon type={job.trigger_type} />{trigLabel(job)}</span>
                    <span className="text-zinc-200 dark:text-zinc-800">·</span>
                    <span className="tabular-nums">{relTime(job.last_run_at)}</span>
                  </div>
                </div>
              </button>

              <RunDots runs={job.recent_runs} />
              <StreakBadge streak={job.streak} />
            </div>

            {peeking && (
              <div className="px-4 pb-3 pt-1 border-t border-zinc-100/50 dark:border-white/[0.02]">
                <div className="flex gap-4 py-1.5 mb-2">
                  {[
                    { label: "Success", value: `${job.success_rate}%`, color: job.success_rate >= 95 ? "text-emerald-600 dark:text-emerald-400" : job.success_rate >= 80 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400" },
                    { label: "Avg time", value: dur(job.avg_duration_ms), color: "text-zinc-900 dark:text-zinc-100" },
                    { label: "Next", value: job.is_active ? futTime(job.next_run_at) : "paused", color: "text-zinc-900 dark:text-zinc-100" },
                  ].map(s => (
                    <div key={s.label}>
                      <p className={`text-[14px] font-semibold tabular-nums ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-600">{s.label}</p>
                    </div>
                  ))}
                </div>
                {job.action_prompt && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-2">{job.action_prompt}</p>}
                {job.last_run_error && <p className="text-[11px] text-red-500 line-clamp-1 mb-2">{job.last_run_error}</p>}
                <div className="flex items-center gap-1.5">
                  <ActionButton onClick={() => onSelect(job)} icon={<Bot size={11} />}>Details</ActionButton>
                  <ActionButton
                    onClick={() => agentsApi.trigger(job.id).then(() => setTimeout(onChanged, 1500))}
                    icon={<Play size={11} />}
                  >
                    Run now
                  </ActionButton>
                </div>
              </div>
            )}

            {!peeking && <div className="mx-4 border-b border-zinc-100 dark:border-white/[0.03]" />}
          </div>
        )
      })}
    </>
  )
}
