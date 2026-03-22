"use client"

import { Play, RotateCw } from "lucide-react"
import { useMemo } from "react"
import { Dot, StatusDot, StreakBadge, TrigIcon } from "./AgentUI"
import { agentsApi } from "./agents-api"
import { healthScore, relTime, successRateColor, TRIGGER_REFRESH_DELAY, trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

/** Deterministic avatar for an agent based on its ID */
const AGENT_AVATARS = [
  "/images/agent-avatars/agent-1.png",
  "/images/agent-avatars/agent-2.png",
  "/images/agent-avatars/agent-3.png",
  "/images/agent-avatars/agent-4.png",
  "/images/agent-avatars/agent-5.png",
  "/images/agent-avatars/agent-6.png",
] as const

function agentAvatar(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return AGENT_AVATARS[Math.abs(hash) % AGENT_AVATARS.length]
}

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

      {/* Agent grid — 2 columns */}
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

  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains nested button (Run), can't use <button> wrapper
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={e => {
        if (e.key === "Enter") onSelect(job)
      }}
      className={`text-left rounded-2xl border bg-white dark:bg-white/[0.02] hover:shadow-md transition-all cursor-pointer overflow-hidden ${
        isRunning
          ? "border-blue-200 dark:border-blue-500/20"
          : "border-zinc-100 dark:border-white/[0.04] hover:border-zinc-200 dark:hover:border-white/[0.08]"
      }`}
    >
      {/* Avatar + status badge */}
      <div className="relative px-4 pt-4 pb-2 flex justify-center">
        <div className="relative">
          <img src={agentAvatar(job.id)} alt="" className="size-16 rounded-2xl object-cover" />
          {/* Status indicator overlaid on avatar */}
          <div className="absolute -bottom-1 -right-1">
            <StatusDot job={job} />
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="px-4 pb-1 text-center">
        <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 line-clamp-1">{job.name}</span>
      </div>

      {/* Schedule + last seen */}
      <div className="px-4 pb-2 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
        <TrigIcon type={job.trigger_type} size={10} />
        <span className="truncate">{trigLabel(job)}</span>
        <Dot />
        <span className="tabular-nums shrink-0">{relTime(job.last_run_at)}</span>
      </div>

      {/* Prompt snippet */}
      {job.action_prompt && (
        <div className="px-4 pb-3">
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 leading-relaxed line-clamp-2 text-center">
            {job.action_prompt}
          </p>
        </div>
      )}

      {/* Footer: stats + run */}
      <div className="px-4 py-3 border-t border-zinc-50 dark:border-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-[13px] font-bold tabular-nums ${successRateColor(job.success_rate)}`}>
            {job.success_rate}%
          </span>
          <StreakBadge streak={job.streak} />
        </div>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            agentsApi.trigger(job.id).then(() => globalThis.setTimeout(onChanged, TRIGGER_REFRESH_DELAY))
          }}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-xl text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 border-b-2 border-emerald-200 dark:border-emerald-600/30 active:translate-y-[1px] active:border-b-0 transition-all"
        >
          <Play size={10} />
          Run
        </button>
      </div>
    </div>
  )
}
