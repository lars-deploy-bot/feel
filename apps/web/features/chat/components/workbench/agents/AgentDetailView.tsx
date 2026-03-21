"use client"

import { CheckCircle2, Copy, ExternalLink, Mail, Pause, Pencil, Play, RotateCw, Trash2, XCircle } from "lucide-react"
import { useState } from "react"
import { ActionButton, RunDots, StatusDot, TrigIcon } from "./AgentUI"
import { agentsApi } from "./agents-api"
import { dur, futTime, relTime, trigLabel } from "./agents-helpers"
import type { EnrichedJob } from "./agents-types"

export function AgentDetailView({
  job,
  onEdit,
  onChanged,
  onOpenConversation,
}: {
  job: EnrichedJob
  onEdit: () => void
  onChanged: () => void
  onOpenConversation: ((conversationId: string) => void) | null
}) {
  const [toggling, setToggling] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const act = async (fn: () => Promise<void>, set: (v: boolean) => void, delay?: number) => {
    set(true)
    try {
      await fn()
      if (delay) setTimeout(onChanged, delay)
      else onChanged()
    } finally {
      set(false)
    }
  }

  return (
    <div className="px-4 py-4">
      {/* Name */}
      <h3 className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 mb-3">{job.name}</h3>

      {/* Status + trigger */}
      <div className="flex items-center gap-2 mb-4">
        <StatusDot job={job} />
        <span className="text-[12px] font-medium text-zinc-600 dark:text-zinc-400">
          {!job.is_active
            ? "Paused"
            : job.status === "running"
              ? "Running"
              : job.last_run_status === "failure"
                ? "Failed"
                : "Healthy"}
        </span>
        <span className="text-zinc-200 dark:text-zinc-800">·</span>
        <span className="inline-flex items-center gap-1 text-[12px] text-zinc-400 dark:text-zinc-500">
          <TrigIcon type={job.trigger_type} />
          {trigLabel(job)}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-5 pb-4 mb-4 border-b border-zinc-100 dark:border-white/[0.04]">
        {[
          {
            label: "Success",
            value: `${job.success_rate}%`,
            color:
              job.success_rate >= 95
                ? "text-emerald-600 dark:text-emerald-400"
                : job.success_rate >= 80
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400",
          },
          { label: "Avg time", value: dur(job.avg_duration_ms), color: "text-zinc-900 dark:text-zinc-100" },
          {
            label: "Next run",
            value: job.is_active ? futTime(job.next_run_at) : "paused",
            color: "text-zinc-900 dark:text-zinc-100",
          },
          {
            label: "Streak",
            value: `${job.streak}`,
            color: job.streak >= 10 ? "text-orange-500" : "text-zinc-900 dark:text-zinc-100",
          },
        ].map(s => (
          <div key={s.label}>
            <p className={`text-[16px] font-semibold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Prompt */}
      {job.action_prompt && (
        <div className="mb-4">
          <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-1">
            Prompt
          </p>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-white/[0.02] rounded-lg px-3 py-2">
            {job.action_prompt}
          </p>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {job.action_model && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            {job.action_model}
          </span>
        )}
        {job.skills?.map(s => (
          <span
            key={s}
            className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          >
            {s}
          </span>
        ))}
        {job.email_address && (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(job.email_address ?? "")}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <Mail size={9} /> {job.email_address} <Copy size={9} />
          </button>
        )}
      </div>

      {/* Last error */}
      {job.last_run_error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
          <p className="text-[11px] text-red-600 dark:text-red-400">{job.last_run_error}</p>
        </div>
      )}

      {/* Recent runs */}
      {job.recent_runs.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-2">
            Recent runs
          </p>
          <div className="divide-y divide-zinc-100 dark:divide-white/[0.03]">
            {job.recent_runs.map(run => {
              const conversationId = run.chat_conversation_id
              const canOpen = !!conversationId && !!onOpenConversation
              return (
                <button
                  key={run.id}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => {
                    if (conversationId && onOpenConversation) onOpenConversation(conversationId)
                  }}
                  className={`flex items-center gap-2.5 py-2 w-full text-left ${canOpen ? "hover:bg-zinc-50 dark:hover:bg-white/[0.02] rounded-md -mx-1 px-1 transition-colors cursor-pointer" : ""}`}
                >
                  {run.status === "success" ? (
                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  ) : run.status === "failure" ? (
                    <XCircle size={12} className="text-red-500 shrink-0" />
                  ) : (
                    <RotateCw size={12} className="text-blue-500 animate-spin shrink-0" />
                  )}
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {relTime(run.started_at)}
                  </span>
                  <span className="text-[10px] text-zinc-300 dark:text-zinc-700 tabular-nums">
                    {dur(run.duration_ms)}
                  </span>
                  {run.triggered_by && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-600">{run.triggered_by}</span>
                  )}
                  {run.error && (
                    <span className="text-[10px] text-red-500 truncate flex-1" title={run.error}>
                      {run.error}
                    </span>
                  )}
                  {canOpen && <ExternalLink size={10} className="text-zinc-300 dark:text-zinc-700 shrink-0 ml-auto" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Run dots */}
      <div className="mb-4">
        <RunDots runs={job.recent_runs} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-zinc-100 dark:border-white/[0.04]">
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
        <ActionButton onClick={onEdit} icon={<Pencil size={11} />}>
          Edit
        </ActionButton>
        <div className="flex-1" />
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <ActionButton
              onClick={() => act(() => agentsApi.delete(job.id), setDeleting)}
              loading={deleting}
              variant="danger"
            >
              Confirm delete
            </ActionButton>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-7 px-2 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-7 px-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
