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
    <div className="px-6 py-5 max-w-2xl mx-auto w-full">
      <div className="mb-5">
        <StatusLine job={job} />
      </div>

      {/* Stats with success ring */}
      <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04] mb-5">
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

      {/* Navigation cards */}
      <div className="flex gap-3 mb-5">
        <NavCard onClick={onGoToRuns} icon={<ClipboardList size={16} />} label="Inspect runs" color="blue" />
        <NavCard onClick={onGoToEdit} icon={<Pencil size={16} />} label="Edit agent" color="violet" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-zinc-100 dark:border-white/[0.04]">
        <ActionButton
          onClick={() => act(() => agentsApi.trigger(job.id), setTriggering, 1500)}
          loading={triggering}
          icon={<Play size={12} />}
          variant="success"
        >
          Run now
        </ActionButton>
        <ActionButton
          onClick={() => act(() => agentsApi.setActive(job.id, !job.is_active), setToggling)}
          loading={toggling}
          variant={job.is_active ? "warning" : "success"}
          icon={job.is_active ? <Pause size={12} /> : <Play size={12} />}
        >
          {job.is_active ? "Pause" : "Resume"}
        </ActionButton>
        <div className="flex-1" />
        <DeleteConfirm onDelete={() => act(() => agentsApi.delete(job.id), setDeleting)} deleting={deleting} />
      </div>
    </div>
  )
}

function NavCard({
  onClick,
  icon,
  label,
  color,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  color: "blue" | "violet"
}) {
  const colors = {
    blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-100 dark:border-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/15",
    violet:
      "bg-violet-50 dark:bg-violet-500/10 text-violet-500 dark:text-violet-400 border-violet-100 dark:border-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/15",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border border-b-[3px] active:translate-y-[2px] active:border-b transition-all ${colors[color]}`}
    >
      {icon}
      <span className="text-[13px] font-bold">{label}</span>
    </button>
  )
}
