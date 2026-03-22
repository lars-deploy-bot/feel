"use client"

import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
  Mail,
  Plus,
  RotateCw,
  Trash2,
  Webhook,
  XCircle,
} from "lucide-react"
import { useMemo, useState } from "react"
import { dur, relTime, statusLabel, successRateColor, trigLabel } from "./agents-helpers"
import type { AgentDetailTab, EnrichedJob, RecentRun } from "./agents-types"

// ── Shared constants ──

export const INPUT =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-100 bg-transparent placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-400 dark:focus:border-zinc-500 outline-none transition-colors duration-100"

// ── Atoms ──

export function StatusDot({ job }: { job: EnrichedJob }) {
  if (!job.is_active)
    return <div className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" title="Paused" />
  if (job.status === "running")
    return (
      <div className="relative size-2 shrink-0" title="Running">
        <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
        <span className="relative block size-2 rounded-full bg-blue-500" />
      </div>
    )
  if (job.last_run_status === "failure")
    return <div className="size-2 rounded-full bg-red-500 shrink-0" title="Failed" />
  return <div className="size-2 rounded-full bg-emerald-500 shrink-0" title="Healthy" />
}

export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null
  const hot = streak >= 10
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums font-medium ${hot ? "text-orange-500 dark:text-orange-400" : "text-zinc-400 dark:text-zinc-600"}`}
    >
      {hot && <Flame size={10} className="text-orange-400" />}
      {streak}
      <Check size={9} />
    </span>
  )
}

export function RunDots({ runs }: { runs: RecentRun[] }) {
  const dots = useMemo(
    () => [...runs].reverse().map(r => (r.status === "success" ? ("s" as const) : ("f" as const))),
    [runs],
  )
  if (dots.length === 0) return null
  return (
    <div className="flex items-center gap-[3px]">
      {dots.map((d, i) => (
        <div
          key={i}
          className={`w-[7px] h-[20px] rounded-[3px] ${d === "s" ? "bg-emerald-400/60 dark:bg-emerald-500/40" : "bg-red-400/60 dark:bg-red-500/40"}`}
        />
      ))}
    </div>
  )
}

export function TrigIcon({ type, size = 11 }: { type: string; size?: number }) {
  const cls = "shrink-0"
  switch (type) {
    case "email":
      return <Mail size={size} className={cls} />
    case "webhook":
      return <Webhook size={size} className={cls} />
    case "one-time":
      return <Calendar size={size} className={cls} />
    default:
      return <RotateCw size={size} className={cls} />
  }
}

export function ActionButton({
  onClick,
  loading,
  icon,
  variant,
  children,
}: {
  onClick: () => void
  loading?: boolean
  icon?: React.ReactNode
  variant?: "default" | "warning" | "success" | "danger"
  children: React.ReactNode
}) {
  const v = variant ?? "default"
  const styles = {
    default: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700",
    warning:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/15",
    success:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15",
    danger: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium transition-colors active:scale-[0.97] disabled:opacity-40 ${styles[v]}`}
    >
      {loading ? <Loader2 size={11} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
      <p className="text-[11px] text-red-600 dark:text-red-400">{message}</p>
    </div>
  )
}

export function Dot() {
  return <span className="text-zinc-200 dark:text-zinc-800">·</span>
}

export function StatusLine({ job }: { job: EnrichedJob }) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot job={job} />
      <span className="text-[13px] font-medium text-zinc-600 dark:text-zinc-400">{statusLabel(job)}</span>
      <Dot />
      <span className="inline-flex items-center gap-1 text-[12px] text-zinc-400 dark:text-zinc-500">
        <TrigIcon type={job.trigger_type} />
        {trigLabel(job)}
      </span>
    </div>
  )
}

export function DeleteConfirm({ onDelete, deleting }: { onDelete: () => void; deleting: boolean }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <ActionButton onClick={onDelete} loading={deleting} variant="danger">
          Confirm delete
        </ActionButton>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-7 px-2 rounded-lg text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="h-7 px-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
    >
      <Trash2 size={12} />
    </button>
  )
}

// ── Composed components ──

interface StatItem {
  label: string
  value: string
  color: string
}

function buildStats(job: EnrichedJob, opts?: { nextLabel?: string }): StatItem[] {
  return [
    { label: "Success", value: `${job.success_rate}%`, color: successRateColor(job.success_rate) },
    { label: "Avg time", value: dur(job.avg_duration_ms), color: "text-zinc-900 dark:text-zinc-100" },
    {
      label: opts?.nextLabel ?? "Next run",
      value: job.is_active ? (job.next_run_at ? relTime(job.next_run_at) : "—") : "paused",
      color: "text-zinc-900 dark:text-zinc-100",
    },
    {
      label: "Streak",
      value: `${job.streak}`,
      color: job.streak >= 10 ? "text-orange-500" : "text-zinc-900 dark:text-zinc-100",
    },
  ]
}

export function StatsGrid({
  job,
  nextLabel,
  fontSize = "text-[16px]",
}: {
  job: EnrichedJob
  nextLabel?: string
  fontSize?: string
}) {
  return (
    <div className="flex gap-5">
      {buildStats(job, { nextLabel }).map(s => (
        <div key={s.label}>
          <p className={`${fontSize} font-semibold tabular-nums ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

export function RunRow({
  run,
  onOpenConversation,
}: {
  run: RecentRun
  onOpenConversation: ((conversationId: string) => void) | null
}) {
  const conversationId = run.chat_conversation_id
  const canOpen = !!conversationId && !!onOpenConversation
  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={() => {
        if (conversationId && onOpenConversation) onOpenConversation(conversationId)
      }}
      className={`flex items-center gap-2.5 py-2.5 w-full text-left ${canOpen ? "hover:bg-zinc-50 dark:hover:bg-white/[0.02] rounded-lg -mx-1 px-1 transition-colors cursor-pointer" : ""}`}
    >
      {run.status === "success" ? (
        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
      ) : run.status === "failure" ? (
        <XCircle size={14} className="text-red-500 shrink-0" />
      ) : (
        <RotateCw size={14} className="text-blue-500 animate-spin shrink-0" />
      )}
      <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">{relTime(run.started_at)}</span>
      <span className="text-[11px] text-zinc-300 dark:text-zinc-700 tabular-nums">{dur(run.duration_ms)}</span>
      {run.triggered_by && <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{run.triggered_by}</span>}
      {run.error && (
        <span className="text-[11px] text-red-500 truncate flex-1" title={run.error}>
          {run.error}
        </span>
      )}
      {canOpen && <ExternalLink size={11} className="text-zinc-300 dark:text-zinc-700 shrink-0 ml-auto" />}
    </button>
  )
}

// ── Layout components ──

export function AgentListHeader({
  onNewAgent,
  newAgentLoading,
}: {
  onNewAgent: () => void
  newAgentLoading?: boolean
}) {
  return (
    <div className="shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">Agents</h2>
      <button
        type="button"
        onClick={onNewAgent}
        disabled={newAgentLoading}
        aria-label={newAgentLoading ? "Creating new agent" : "New agent"}
        className="size-8 flex items-center justify-center rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-all disabled:opacity-40"
        title="New agent"
      >
        {newAgentLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />}
      </button>
    </div>
  )
}

export function AgentDetailNav({
  name,
  activeTab,
  onBack,
  onTabChange,
}: {
  name: string
  activeTab: AgentDetailTab
  onBack: () => void
  onTabChange: (tab: AgentDetailTab) => void
}) {
  const tabs: { key: AgentDetailTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "runs", label: "Runs" },
    { key: "edit", label: "Edit" },
  ]

  return (
    <div className="shrink-0 px-3 pt-4 pb-2">
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onBack}
          className="size-7 flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft size={14} />
        </button>
        <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</h3>
      </div>
      <div className="flex flex-row items-center gap-1 justify-center">
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`rounded-xl py-1.5 px-3.5 text-[13px] font-medium transition-all ${
              activeTab === tab.key
                ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
