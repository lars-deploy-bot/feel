"use client"

import {
  ArrowLeft,
  Calendar,
  Check,
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
import {
  dur,
  isStreakHot,
  isStreakWarm,
  RATE_EXCELLENT,
  RATE_GOOD,
  relTime,
  statusLabel,
  trigLabel,
} from "./agents-helpers"
import type { AgentDetailTab, EnrichedJob, RecentRun } from "./agents-types"

// ── Shared constants ──

export const INPUT =
  "w-full border border-zinc-200 dark:border-zinc-700 rounded-2xl px-3.5 py-2.5 text-[13px] text-zinc-900 dark:text-zinc-100 bg-transparent placeholder:text-zinc-300 dark:placeholder:text-zinc-700 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none transition-all duration-150"

// ── Atoms ──

export function StatusDot({ job }: { job: EnrichedJob }) {
  if (!job.is_active)
    return <div className="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" title="Paused" />
  if (job.status === "running")
    return (
      <div className="relative size-2.5 shrink-0" title="Running">
        <span className="absolute inset-[-3px] rounded-full bg-blue-400/30 animate-ping" />
        <span className="relative block size-2.5 rounded-full bg-blue-500" />
      </div>
    )
  if (job.last_run_status === "failure")
    return <div className="size-2.5 rounded-full bg-red-500 shrink-0" title="Failed" />
  return (
    <div className="relative size-2.5 shrink-0" title="Healthy">
      <span className="absolute inset-[-2px] rounded-full bg-emerald-400/20 dark:bg-emerald-400/10" />
      <span className="relative block size-2.5 rounded-full bg-emerald-500" />
    </div>
  )
}

export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums font-bold text-zinc-300 dark:text-zinc-700 ml-2">
        <Flame size={13} />
        {streak}
      </span>
    )

  const hot = isStreakHot(streak)
  const warm = isStreakWarm(streak)
  return (
    <span
      className={`inline-flex items-center gap-1 text-[12px] tabular-nums font-bold ml-2 ${
        hot
          ? "text-orange-500 dark:text-orange-400"
          : warm
            ? "text-amber-500 dark:text-amber-400"
            : "text-zinc-400 dark:text-zinc-500"
      }`}
    >
      <Flame
        size={14}
        className={
          hot
            ? "text-orange-500 drop-shadow-[0_0_4px_rgba(251,146,60,0.5)]"
            : warm
              ? "text-amber-400"
              : "text-zinc-300 dark:text-zinc-600"
        }
      />
      {streak}
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
    <div className="flex items-end gap-[3px]">
      {dots.map((d, i) => (
        <div
          key={i}
          className={`w-[6px] rounded-full transition-all ${
            d === "s" ? "bg-emerald-400 dark:bg-emerald-500/60 h-[18px]" : "bg-red-400 dark:bg-red-500/50 h-[12px]"
          }`}
        />
      ))}
    </div>
  )
}

export function SuccessRing({ rate, size = 48 }: { rate: number; size?: number }) {
  const stroke = size >= 64 ? 5 : 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference
  const color = rate >= RATE_EXCELLENT ? "#10b981" : rate >= RATE_GOOD ? "#f59e0b" : "#ef4444"

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-zinc-100 dark:stroke-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold tabular-nums text-zinc-900 dark:text-zinc-100 ${size >= 64 ? "text-[16px]" : "text-[13px]"}`}
      >
        {rate}%
      </span>
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
    default:
      "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-b-[3px] border-zinc-200 dark:border-zinc-700 hover:brightness-95 dark:hover:brightness-110",
    warning:
      "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-b-[3px] border-amber-200 dark:border-amber-600/30 hover:brightness-95 dark:hover:brightness-110",
    success:
      "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-b-[3px] border-emerald-200 dark:border-emerald-600/30 hover:brightness-95 dark:hover:brightness-110",
    danger:
      "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-b-[3px] border-red-200 dark:border-red-600/30 hover:brightness-95 dark:hover:brightness-110",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold transition-all active:translate-y-[2px] active:border-b-0 disabled:opacity-40 ${styles[v]}`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10">
      <p className="text-[12px] text-red-600 dark:text-red-400">{message}</p>
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
      <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400">{statusLabel(job)}</span>
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
          className="h-8 px-2.5 rounded-xl text-[12px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
      className="h-8 px-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
    >
      <Trash2 size={13} />
    </button>
  )
}

// ── Composed components ──

export function StatsGrid({ job, nextLabel, compact }: { job: EnrichedJob; nextLabel?: string; compact?: boolean }) {
  const stats = [
    { label: "Avg time", value: dur(job.avg_duration_ms) },
    {
      label: nextLabel ?? "Next run",
      value: job.is_active ? (job.next_run_at ? relTime(job.next_run_at) : "—") : "paused",
    },
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        {stats.map(s => (
          <div key={s.label}>
            <p className="text-[14px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{s.value}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600">{s.label}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-5">
      <SuccessRing rate={job.success_rate} />
      <div className="flex gap-5">
        {stats.map(s => (
          <div key={s.label}>
            <p className="text-[16px] font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{s.value}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">{s.label}</p>
          </div>
        ))}
        <div>
          <p
            className={`text-[16px] font-bold tabular-nums ${isStreakHot(job.streak) ? "text-orange-500" : isStreakWarm(job.streak) ? "text-amber-500" : "text-zinc-900 dark:text-zinc-100"}`}
          >
            {job.streak}
          </p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-0.5">Streak</p>
        </div>
      </div>
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
      className={`flex items-center gap-3 py-3 w-full text-left ${canOpen ? "hover:bg-zinc-50 dark:hover:bg-white/[0.02] rounded-xl -mx-2 px-2 transition-colors cursor-pointer" : ""}`}
    >
      {run.status === "success" ? (
        <div className="size-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
          <Check size={14} className="text-emerald-500" />
        </div>
      ) : run.status === "failure" ? (
        <div className="size-7 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center shrink-0">
          <XCircle size={14} className="text-red-500" />
        </div>
      ) : (
        <div className="size-7 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
          <RotateCw size={14} className="text-blue-500 animate-spin" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
            {relTime(run.started_at)}
          </span>
          <span className="text-[11px] text-zinc-300 dark:text-zinc-700 tabular-nums">{dur(run.duration_ms)}</span>
          {run.triggered_by && <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{run.triggered_by}</span>}
        </div>
        {run.error && <p className="text-[11px] text-red-500 truncate mt-0.5">{run.error}</p>}
      </div>
      {canOpen && <ExternalLink size={12} className="text-zinc-300 dark:text-zinc-700 shrink-0" />}
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
    <div className="shrink-0 pl-5 pr-16 pt-5 pb-2 flex items-center justify-center relative">
      <h2 className="text-[17px] font-bold text-zinc-900 dark:text-zinc-100">Your Agents</h2>
      <button
        type="button"
        onClick={onNewAgent}
        disabled={newAgentLoading}
        aria-label={newAgentLoading ? "Creating new agent" : "New agent"}
        className="absolute right-5 size-9 flex items-center justify-center rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 border-b-[3px] border-emerald-600 active:translate-y-[2px] active:border-b-0 transition-all disabled:opacity-40"
        title="New agent"
      >
        {newAgentLoading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} strokeWidth={2.5} />}
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
    <div className="shrink-0 px-4 pt-4 pb-2">
      {/* Nav row: back button + centered tabs */}
      <div className="flex items-center justify-center relative mb-3">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 size-8 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-b-2 border-zinc-200 dark:border-zinc-700 active:translate-y-[1px] active:border-b-0 transition-all"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex flex-row items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`rounded-xl py-1.5 px-4 text-[13px] font-bold transition-all ${
                activeTab === tab.key
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {/* Agent name below tabs (only on runs — overview and edit handle their own) */}
      {activeTab === "runs" && (
        <h3 className="text-[16px] font-bold text-zinc-900 dark:text-zinc-100 truncate text-center">{name}</h3>
      )}
    </div>
  )
}
