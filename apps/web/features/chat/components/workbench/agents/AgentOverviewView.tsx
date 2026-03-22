"use client"

import { ClipboardList, Pause, Pencil, Play } from "lucide-react"
import { useState } from "react"
import { ActionButton, DeleteConfirm, ErrorAlert, RunDots, StatsGrid, StatusLine } from "./AgentUI"
import { agentsApi } from "./agents-api"
import type { EnrichedJob } from "./agents-types"

export function AgentOverviewView({
  job,
  onGoToRuns,
  onGoToEdit,
  onChanged,
}: {
  job: EnrichedJob
  onGoToRuns: () => void
  onGoToEdit: () => void
  onChanged: () => void
}) {
  const [toggling, setToggling] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const act = async (fn: () => Promise<void>, set: (v: boolean) => void, delay?: number) => {
    set(true)
    try {
      await fn()
      if (delay) globalThis.setTimeout(onChanged, delay)
      else onChanged()
    } finally {
      set(false)
    }
  }

  return (
    <div className="px-6 py-4 max-w-2xl mx-auto w-full">
      <div className="mb-4">
        <StatusLine job={job} />
      </div>

      <div className="pb-4 mb-5 border-b border-zinc-100 dark:border-white/[0.04]">
        <StatsGrid job={job} />
      </div>

      {job.last_run_error && (
        <div className="mb-5">
          <ErrorAlert message={job.last_run_error} />
        </div>
      )}

      {job.recent_runs.length > 0 && (
        <div className="mb-5">
          <RunDots runs={job.recent_runs} />
        </div>
      )}

      <div className="flex gap-2 mb-5">
        <NavCard onClick={onGoToRuns} icon={<ClipboardList size={14} />} label="Inspect runs" />
        <NavCard onClick={onGoToEdit} icon={<Pencil size={14} />} label="Edit agent" />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-4 border-t border-zinc-100 dark:border-white/[0.04]">
        <ActionButton
          onClick={() => act(() => agentsApi.trigger(job.id), setTriggering, 1500)}
          loading={triggering}
          icon={<Play size={11} />}
        >
          Run now
        </ActionButton>
        <ActionButton
          onClick={() => act(() => agentsApi.setActive(job.id, !job.is_active), setToggling)}
          loading={toggling}
          variant={job.is_active ? "warning" : "success"}
          icon={job.is_active ? <Pause size={11} /> : <Play size={11} />}
        >
          {job.is_active ? "Pause" : "Resume"}
        </ActionButton>
        <div className="flex-1" />
        <DeleteConfirm onDelete={() => act(() => agentsApi.delete(job.id), setDeleting)} deleting={deleting} />
      </div>
    </div>
  )
}

function NavCard({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-zinc-100 dark:border-white/[0.04] transition-colors"
    >
      <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
    </button>
  )
}
