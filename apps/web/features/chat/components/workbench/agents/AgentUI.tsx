"use client"

import { Calendar, Check, Flame, Loader2, Mail, Plus, RotateCw, Webhook } from "lucide-react"
import { useMemo } from "react"
import type { AgentView, EnrichedJob, RecentRun } from "./agents-types"

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
    <div className="flex items-center gap-[2px]">
      {dots.map((d, i) => (
        <div
          key={i}
          className={`w-[5px] h-[14px] rounded-[2px] ${d === "s" ? "bg-emerald-400/60 dark:bg-emerald-500/40" : "bg-red-400/60 dark:bg-red-500/40"}`}
        />
      ))}
    </div>
  )
}

export function TrigIcon({ type }: { type: string }) {
  const cls = "shrink-0"
  switch (type) {
    case "email":
      return <Mail size={11} className={cls} />
    case "webhook":
      return <Webhook size={11} className={cls} />
    case "one-time":
      return <Calendar size={11} className={cls} />
    default:
      return <RotateCw size={11} className={cls} />
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

export function AgentNav({
  view,
  hasSelected,
  onNavigate,
  onNewAgent,
  newAgentLoading,
}: {
  view: AgentView
  hasSelected: boolean
  onNavigate: (kind: AgentView["kind"]) => void
  onNewAgent?: () => void
  newAgentLoading?: boolean
}) {
  const tabs: { kind: AgentView["kind"]; label: string; enabled: boolean }[] = [
    { kind: "list", label: "Overview", enabled: true },
    { kind: "detail", label: "Detail", enabled: hasSelected },
    { kind: "edit", label: "Edit", enabled: hasSelected },
  ]

  return (
    <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-sm px-3 h-10 flex items-center gap-1 border-b border-zinc-100 dark:border-white/[0.04] shrink-0">
      {tabs.map(tab => {
        const active = view.kind === tab.kind
        return (
          <button
            key={tab.kind}
            type="button"
            disabled={!tab.enabled}
            onClick={() => onNavigate(tab.kind)}
            className={`h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
              active
                ? "bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white"
                : tab.enabled
                  ? "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                  : "text-zinc-200 dark:text-zinc-800 cursor-default"
            }`}
          >
            {tab.label}
          </button>
        )
      })}
      {onNewAgent && (
        <button
          type="button"
          onClick={onNewAgent}
          disabled={newAgentLoading}
          className="ml-auto h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40"
          title="New agent"
        >
          {newAgentLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />}
        </button>
      )}
    </div>
  )
}
