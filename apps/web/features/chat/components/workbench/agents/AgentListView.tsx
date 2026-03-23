"use client"

import { Pause, Play, RotateCw } from "lucide-react"
import { useMemo } from "react"
import { Dot, StatusDot, StreakBadge, TrigIcon } from "./AgentUI"
import { agentAvatar } from "./agent-avatars"
import { agentsApi } from "./agents-api"
import { healthScore, successRateColor, timeUntil, trigLabel } from "./agents-helpers"
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
    <div className="w-full px-4">
      {/* Summary bar */}
      <div className="px-1 py-2.5 flex items-center justify-between text-[12px] tabular-nums">
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

      {/* Agent grid */}
      <div className="grid grid-cols-2 gap-3 pb-4">
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
  const isRunning = job.status === "running"
  const isInactive = !job.is_active

  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains nested button (Run), can't use <button> wrapper
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={e => {
        if (e.key === "Enter") onSelect(job)
      }}
      className={`group text-left rounded-2xl cursor-pointer transition-all duration-200 flex overflow-hidden ${
        isInactive
          ? "bg-zinc-50/80 dark:bg-white/[0.01] ring-1 ring-zinc-100 dark:ring-white/[0.04] opacity-55 hover:opacity-75"
          : isRunning
            ? "bg-gradient-to-r from-blue-50 to-white dark:from-blue-500/5 dark:to-white/[0.02] ring-1 ring-blue-200/60 dark:ring-blue-500/20 shadow-sm"
            : "bg-white dark:bg-white/[0.02] ring-1 ring-zinc-100 dark:ring-white/[0.05] hover:ring-zinc-200 dark:hover:ring-white/[0.1] hover:shadow-md"
      }`}
    >
      {/* Character image — left side */}
      <div className="w-32 shrink-0 p-2.5">
        <img
          src={job.avatar_url ?? agentAvatar(job.id)}
          alt=""
          className={`w-full h-full object-cover object-top rounded-lg transition-transform duration-200 group-hover:scale-[1.03] ${isInactive ? "grayscale" : ""}`}
        />
      </div>

      {/* Content — right side */}
      <div className="flex-1 pr-4 py-3 flex flex-col min-w-0">
        {/* Header: name + status */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-1">
            {job.name}
          </span>
          {isInactive ? (
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800">
              Paused
            </span>
          ) : (
            <StatusDot job={job} />
          )}
        </div>

        {/* Prompt snippet */}
        {job.action_prompt && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed line-clamp-2 mb-2">
            {job.action_prompt}
          </p>
        )}

        {/* Stats + schedule */}
        <div className="flex items-center gap-2 text-[10px] mb-3 mt-auto">
          {job.recent_runs.length > 0 ? (
            <>
              <span className={`text-[13px] font-bold tabular-nums ${successRateColor(job.success_rate)}`}>
                {job.success_rate}%
              </span>
              <StreakBadge streak={job.streak} />
            </>
          ) : (
            <span className="text-[11px] text-zinc-300 dark:text-zinc-600">
              {timeUntil(job.next_run_at) ? `Next run ${timeUntil(job.next_run_at)}` : "Enable to start"}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <TrigIcon type={job.trigger_type} size={9} />
            <span className="truncate">{trigLabel(job)}</span>
          </span>
        </div>

        {/* Toggle active */}
        <button
          type="button"
          onClick={async e => {
            e.stopPropagation()
            agentsApi.setActive(job.id, !job.is_active).then(onChanged)
          }}
          className={`w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-lg text-[11px] font-bold transition-all active:scale-[0.97] ${
            job.is_active
              ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/15"
              : "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15"
          }`}
        >
          {job.is_active ? <Pause size={10} /> : <Play size={10} />}
          {job.is_active ? "Pause" : "Resume"}
        </button>
      </div>
    </div>
  )
}
