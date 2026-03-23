"use client"

import { ClipboardList, Pause, Pencil, Play } from "lucide-react"
import { useState } from "react"
import { ActionButton, DeleteConfirm, ErrorAlert, RunDots, StatusLine, StreakBadge, SuccessRing } from "./AgentUI"
import { agentAvatar } from "./agent-avatars"
import { agentsApi } from "./agents-api"
import { dur, isStreakHot, isStreakWarm, TRIGGER_REFRESH_DELAY } from "./agents-helpers"
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

  const nextRun = job.is_active
    ? job.next_run_at
      ? new Date(job.next_run_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—"
    : "paused"

  const skills = job.skills ?? []

  return (
    <div className="px-6 max-w-2xl mx-auto w-full min-h-full flex flex-col">
      <div className="flex-[3]" />

      {/* Agent hero — avatar + name */}
      <div className="flex flex-col items-center text-center mb-8">
        <img
          src={job.avatar_url ?? agentAvatar(job.id)}
          alt=""
          className="w-40 h-52 object-cover object-top rounded-lg mb-4"
        />
        <h3 className="text-[22px] font-bold text-zinc-900 dark:text-zinc-100 mb-2">{job.name}</h3>
        <StatusLine job={job} />
      </div>

      {/* Hero stats — success ring + key metrics */}
      <div className="flex items-center gap-6 p-5 rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04] mb-6">
        <SuccessRing rate={job.success_rate} size={72} />
        <div className="flex-1 grid grid-cols-2 gap-4">
          <StatBlock label="Next run" value={nextRun} />
          <div className="flex flex-col items-start">
            <div className="flex items-center">
              <span
                className={`text-[20px] font-bold tabular-nums ${isStreakHot(job.streak) ? "text-orange-500" : isStreakWarm(job.streak) ? "text-amber-500" : "text-zinc-900 dark:text-zinc-100"}`}
              >
                {job.streak}
              </span>
              <StreakBadge streak={job.streak} />
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-600">Streak</p>
          </div>
        </div>
      </div>

      {/* Instructions preview — click to edit */}
      {job.action_prompt && (
        <button type="button" onClick={onGoToEdit} className="w-full text-left mb-6 group">
          <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-2">
            Instructions
          </p>
          <div className="px-4 py-3 rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04] group-hover:border-violet-200 dark:group-hover:border-violet-500/20 transition-colors">
            <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-4">
              {job.action_prompt}
            </p>
          </div>
        </button>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-2">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {skills.map(skill => (
              <span
                key={skill}
                className="px-2.5 py-1 text-[12px] font-medium rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {job.last_run_error && (
        <div className="mb-6">
          <ErrorAlert message={job.last_run_error} />
        </div>
      )}

      {/* Recent activity */}
      {job.recent_runs.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-2">
            Recent activity
          </p>
          <RunDots runs={job.recent_runs} />
        </div>
      )}

      {/* Navigation cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <NavCard onClick={onGoToRuns} icon={<ClipboardList size={18} />} label="Inspect runs" color="blue" />
        <NavCard onClick={onGoToEdit} icon={<Pencil size={18} />} label="Edit agent" color="violet" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-5 border-t border-zinc-100 dark:border-white/[0.04]">
        <ActionButton
          onClick={() => act(() => agentsApi.trigger(job.id), setTriggering, TRIGGER_REFRESH_DELAY)}
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

      <div className="flex-[5]" />
    </div>
  )
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[20px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-600">{label}</p>
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
      className={`flex items-center gap-3 px-4 py-4 rounded-2xl border border-b-[3px] active:translate-y-[2px] active:border-b transition-all ${colors[color]}`}
    >
      {icon}
      <span className="text-[14px] font-bold">{label}</span>
    </button>
  )
}
