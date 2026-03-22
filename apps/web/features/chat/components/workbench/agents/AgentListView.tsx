"use client"

import { Play, RotateCw } from "lucide-react"
import { useMemo } from "react"
import { Dot, RunDots, StatusDot, StreakBadge, TrigIcon } from "./AgentUI"
import { agentsApi } from "./agents-api"
import { healthScore, relTime, trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

export function AgentListView({
  jobs,
  onSelect,
  onChanged,
  refresh,
}: {
  jobs: EnrichedJob[]
  onSelect: (job: EnrichedJob) => void
  onChanged: () => void
  refresh: () => void
}) {
  const sorted = useMemo(() => [...jobs].sort((a, b) => healthScore(a) - healthScore(b)), [jobs])
  const active = jobs.filter(j => j.is_active).length
  const failing = jobs.filter(j => j.is_active && j.last_run_status === "failure").length
  const running = jobs.filter(j => j.status === "running").length

  return (
    <div className="max-w-2xl mx-auto w-full px-4">
      {/* Summary bar */}
      <div className="px-2 py-2.5 flex items-center justify-between text-[11px] tabular-nums">
        <span className="text-zinc-500 dark:text-zinc-400 font-medium">
          {jobs.length} agent{jobs.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{active} active</span>
          {running > 0 && (
            <>
              <Dot />
              <span className="text-blue-500 font-medium">{running} running</span>
            </>
          )}
          {failing > 0 && (
            <>
              <Dot />
              <span className="text-red-500 font-medium">{failing} failing</span>
            </>
          )}
          <button
            type="button"
            onClick={refresh}
            className="ml-1 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RotateCw size={12} />
          </button>
        </div>
      </div>

      {/* Agent cards */}
      <div className="flex flex-col gap-2 pb-4">
        {sorted.map(job => (
          <AgentCard key={job.id} job={job} onSelect={onSelect} onChanged={onChanged} />
        ))}
      </div>
    </div>
  )
}

function AgentCard({
  job,
  onSelect,
  onChanged,
}: {
  job: EnrichedJob
  onSelect: (job: EnrichedJob) => void
  onChanged: () => void
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains nested button (Run), can't use <button> wrapper
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={e => {
        if (e.key === "Enter") onSelect(job)
      }}
      className="w-full text-left rounded-2xl border border-zinc-100 dark:border-white/[0.04] bg-white dark:bg-white/[0.02] hover:border-zinc-200 dark:hover:border-white/[0.08] hover:shadow-sm transition-all p-4 cursor-pointer"
    >
      {/* Top row: name + streak */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <StatusDot job={job} />
          <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 truncate">{job.name}</span>
        </div>
        <StreakBadge streak={job.streak} />
      </div>

      {/* Middle row: trigger + last run */}
      <div className="flex items-center gap-2 text-[12px] text-zinc-400 dark:text-zinc-500 mb-3">
        <span className="inline-flex items-center gap-1">
          <TrigIcon type={job.trigger_type} />
          {trigLabel(job)}
        </span>
        <Dot />
        <span className="tabular-nums">{relTime(job.last_run_at)}</span>
      </div>

      {/* Bottom row: run dots + quick action */}
      <div className="flex items-center justify-between">
        <RunDots runs={job.recent_runs} />
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            agentsApi.trigger(job.id).then(() => globalThis.setTimeout(onChanged, 1500))
          }}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border-b-2 border-emerald-200 dark:border-emerald-600/30 active:translate-y-[1px] active:border-b-0 transition-all"
        >
          <Play size={10} />
          Run
        </button>
      </div>
    </div>
  )
}
