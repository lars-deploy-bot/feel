"use client"

import { Play, Sparkles } from "lucide-react"
import { useState } from "react"
import { RunDots, RunRow } from "./AgentUI"
import { agentAvatar } from "./agent-avatars"
import { agentsApi } from "./agents-api"
import { TRIGGER_REFRESH_DELAY } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

export function AgentRunsView({
  job,
  onOpenConversation,
  onChanged,
}: {
  job: EnrichedJob
  onOpenConversation: ((conversationId: string) => void) | null
  onChanged: () => void
}) {
  const [triggering, setTriggering] = useState(false)

  if (job.recent_runs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 gap-4">
        <img
          src={job.avatar_url ?? agentAvatar(job.id)}
          alt=""
          className="w-24 h-32 object-cover object-top rounded-lg opacity-60"
        />
        <div className="text-center">
          <p className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 mb-1">No runs yet</p>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500 max-w-[220px]">
            {job.is_active
              ? "This agent is active and will run on schedule."
              : "Resume this agent or trigger a manual run to get started."}
          </p>
        </div>
        <button
          type="button"
          disabled={triggering}
          onClick={async () => {
            setTriggering(true)
            try {
              await agentsApi.trigger(job.id)
              globalThis.setTimeout(onChanged, TRIGGER_REFRESH_DELAY)
            } finally {
              setTriggering(false)
            }
          }}
          className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl text-[13px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-b-[3px] border-emerald-200 dark:border-emerald-600/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/15 active:translate-y-[2px] active:border-b-0 transition-all disabled:opacity-40"
        >
          {triggering ? <Sparkles size={13} className="animate-spin" /> : <Play size={13} />}
          Run now
        </button>
      </div>
    )
  }

  const successes = job.recent_runs.filter(r => r.status === "success").length
  const failures = job.recent_runs.filter(r => r.status === "failure").length

  return (
    <div className="px-5 py-4 max-w-2xl mx-auto w-full">
      {/* Summary strip */}
      <div className="flex items-center gap-3 mb-4">
        <RunDots runs={job.recent_runs} />
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[11px] tabular-nums">
          {successes > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{successes} passed</span>
          )}
          {failures > 0 && <span className="text-red-500 font-bold">{failures} failed</span>}
        </div>
      </div>

      {/* Run cards */}
      <div className="flex flex-col gap-2.5">
        {job.recent_runs.map(run => (
          <RunRow key={run.id} run={run} onOpenConversation={onOpenConversation} />
        ))}
      </div>
    </div>
  )
}
