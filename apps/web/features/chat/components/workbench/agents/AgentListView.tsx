"use client"

import { Play, RotateCw } from "lucide-react"
import { useMemo } from "react"
import { Dot, StatusDot, StreakBadge, TrigIcon } from "./AgentUI"
import { agentsApi } from "./agents-api"
import { healthScore, relTime, successRateColor, TRIGGER_REFRESH_DELAY, trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

/** Deterministic avatar for an agent based on its ID */
const AGENT_AVATARS_MALE = [
  "/images/agent-avatars/m-analyst.png",
  "/images/agent-avatars/m-developer.png",
  "/images/agent-avatars/m-strategist.png",
] as const

const AGENT_AVATARS_FEMALE = [
  "/images/agent-avatars/f-writer.png",
  "/images/agent-avatars/f-designer.png",
  "/images/agent-avatars/f-marketer.png",
] as const

function agentAvatar(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  const abs = Math.abs(hash)
  // Even hash = male, odd = female
  const pool = abs % 2 === 0 ? AGENT_AVATARS_MALE : AGENT_AVATARS_FEMALE
  return pool[abs % pool.length]
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

  return (
    // biome-ignore lint/a11y/useSemanticElements: card contains nested button (Run), can't use <button> wrapper
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={e => {
        if (e.key === "Enter") onSelect(job)
      }}
      className={`group text-left rounded-2xl border border-b-[3px] cursor-pointer transition-all hover:shadow-md active:translate-y-[1px] active:border-b flex overflow-hidden ${
        isRunning
          ? "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20"
          : "bg-white dark:bg-white/[0.02] border-zinc-200 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.1]"
      }`}
    >
      {/* Character image — left side */}
      <div className="w-24 shrink-0 bg-zinc-50 dark:bg-white/[0.02]">
        <img src={agentAvatar(job.id)} alt="" className="w-full h-full object-cover object-top" />
      </div>

      {/* Content — right side */}
      <div className="flex-1 px-4 py-3 flex flex-col min-w-0">
        {/* Header: name + status */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-1">
            {job.name}
          </span>
          <StatusDot job={job} />
        </div>

        {/* Prompt snippet */}
        {job.action_prompt && (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed line-clamp-2 mb-2">
            {job.action_prompt}
          </p>
        )}

        {/* Stats + schedule */}
        <div className="flex items-center gap-2 text-[10px] mb-2 mt-auto">
          <span className={`text-[13px] font-bold tabular-nums ${successRateColor(job.success_rate)}`}>
            {job.success_rate}%
          </span>
          <StreakBadge streak={job.streak} />
          <span className="ml-auto flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
            <TrigIcon type={job.trigger_type} size={9} />
            <span className="truncate">{trigLabel(job)}</span>
          </span>
        </div>

        {/* Run button */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            agentsApi.trigger(job.id).then(() => globalThis.setTimeout(onChanged, TRIGGER_REFRESH_DELAY))
          }}
          className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-xl text-[12px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-b-[3px] border-emerald-200 dark:border-emerald-600/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 active:translate-y-[2px] active:border-b-0 transition-all"
        >
          <Play size={11} />
          Run
        </button>
      </div>
    </div>
  )
}
