"use client"

import { RunDots, RunRow } from "./AgentUI"
import type { EnrichedJob } from "./agents-types"

export function AgentRunsView({
  job,
  onOpenConversation,
}: {
  job: EnrichedJob
  onOpenConversation: ((conversationId: string) => void) | null
}) {
  if (job.recent_runs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No runs yet</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto w-full">
      <div className="mb-4">
        <RunDots runs={job.recent_runs} />
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-white/[0.03]">
        {job.recent_runs.map(run => (
          <RunRow key={run.id} run={run} onOpenConversation={onOpenConversation} />
        ))}
      </div>
    </div>
  )
}
