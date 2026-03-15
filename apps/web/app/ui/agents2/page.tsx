"use client"

/**
 * Agents V2 — Mission Control style
 *
 * Inspired by: GitHub Actions timeline, Datadog service list, SpaceX telemetry.
 * Core idea: health-first. Healthy = quiet. Problems = loud. Click to expand inline.
 *
 * Wired to real API: GET /api/manager/automations (enriched jobs with runs/stats)
 */

import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Flame,
  Globe,
  Loader2,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAdminUser } from "@/hooks/use-superadmin"

// ─── Types (matches manager API response) ───────────────────────────────────

type Run = {
  id: string
  status: string
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  error: string | null
  triggered_by: string | null
}

type Agent = {
  id: string
  name: string
  description: string | null
  hostname: string
  is_active: boolean
  status: string
  trigger_type: "cron" | "email" | "webhook" | "one-time"
  cron_schedule: string | null
  cron_timezone: string | null
  email_address: string | null
  last_run_at: string | null
  last_run_status: string | null
  last_run_error: string | null
  next_run_at: string | null
  consecutive_failures: number | null
  action_prompt: string | null
  action_model: string | null
  action_target_page: string | null
  skills: string[] | null
  runs_30d: number
  success_runs_30d: number
  failure_runs_30d: number
  avg_duration_ms: number | null
  estimated_weekly_cost_usd: number
  recent_runs: Run[]
  // Computed client-side
  success_rate: number
  streak: number
}

type OrgSummary = {
  org_id: string
  org_name: string
  jobs: Agent[]
  total_jobs: number
  active_jobs: number
}

// ─── API ────────────────────────────────────────────────────────────────────

async function fetchAgents(): Promise<Agent[]> {
  const res = await fetch("/api/automations/enriched", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch")
  const json = await res.json()
  const jobs: Agent[] = (json.jobs ?? []).map((job: Agent) => {
    const successRate = job.runs_30d > 0 ? Math.round((job.success_runs_30d / job.runs_30d) * 100) : 0
    let streak = 0
    for (const run of job.recent_runs) {
      if (run.status === "success") streak++
      else break
    }
    return { ...job, success_rate: successRate, streak }
  })
  return jobs
}

async function apiToggleActive(id: string, isActive: boolean): Promise<void> {
  const res = await fetch(`/api/manager/automations/${id}/active`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  })
  if (!res.ok) throw new Error("Failed to toggle")
}

async function apiTrigger(id: string): Promise<void> {
  const res = await fetch(`/api/automations/${id}/trigger`, {
    method: "POST",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to trigger")
}

async function apiDelete(id: string): Promise<void> {
  const res = await fetch(`/api/manager/automations/${id}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to delete")
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function relTime(d: string | null): string {
  if (!d) return "—"
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function futTime(d: string | null): string {
  if (!d) return "—"
  const ms = new Date(d).getTime() - Date.now()
  if (ms < 0) return "overdue"
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function dur(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m${Math.floor(s % 60)}s`
}

function trigLabel(a: Agent): string {
  switch (a.trigger_type) {
    case "email":
      return "email"
    case "webhook":
      return "webhook"
    case "one-time":
      return "one-time"
    default: {
      if (!a.cron_schedule) return "—"
      const [, hr, , , wd] = a.cron_schedule.split(" ")
      if (wd === "*") return `daily ${hr}:00`
      if (wd === "1-5") return `weekdays ${hr}:00`
      if (wd === "1") return `mon ${hr}:00`
      return a.cron_schedule
    }
  }
}

function TrigIcon({ type }: { type: Agent["trigger_type"] }) {
  const cls = "text-zinc-400 dark:text-zinc-500"
  switch (type) {
    case "email":
      return <Mail size={13} className={cls} />
    case "webhook":
      return <Webhook size={13} className={cls} />
    case "one-time":
      return <Calendar size={13} className={cls} />
    default:
      return <RotateCw size={13} className={cls} />
  }
}

// ─── Sortable / health score ────────────────────────────────────────────────

function healthScore(a: Agent): number {
  if (!a.is_active) return 100
  if (a.last_run_status === "failure") return 0
  if (a.status === "running") return 10
  return 50 + a.success_rate * 0.5
}

// ─── Status indicator ───────────────────────────────────────────────────────

function StatusPill({ agent }: { agent: Agent }) {
  if (!agent.is_active) {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
        Paused
      </span>
    )
  }
  if (agent.status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
        </span>
        Running
      </span>
    )
  }
  if (agent.last_run_status === "failure") {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
        Failed
      </span>
    )
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      Healthy
    </span>
  )
}

// ─── Streak Badge ───────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null
  const hot = streak >= 10
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums font-medium ${hot ? "text-orange-500 dark:text-orange-400" : "text-zinc-400 dark:text-zinc-500"}`}
    >
      {hot && <Flame size={11} className="text-orange-400" />}
      {streak}
      <Check size={10} />
    </span>
  )
}

// ─── Run dots (from real recent_runs) ───────────────────────────────────────

function RunDots({ agent }: { agent: Agent }) {
  const dots = useMemo(() => {
    // Use actual recent_runs, reversed so most recent is on the right
    return [...agent.recent_runs].reverse().map(r => r.status === "success" ? "success" as const : "failure" as const)
  }, [agent.recent_runs])

  if (dots.length === 0) return <span className="text-[11px] text-zinc-300 dark:text-zinc-700">—</span>

  return (
    <div className="flex items-center gap-[3px]">
      {dots.map((d, i) => (
        <div
          key={i}
          className={`w-[6px] h-3 rounded-[2px] transition-colors ${
            d === "success" ? "bg-emerald-400/70 dark:bg-emerald-500/50" : "bg-red-400/70 dark:bg-red-500/50"
          }`}
        />
      ))}
    </div>
  )
}

// ─── Agent Row ──────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  isExpanded,
  onToggle,
  onChanged,
}: {
  agent: Agent
  isExpanded: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const [toggling, setToggling] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try {
      await apiToggleActive(agent.id, !agent.is_active)
      onChanged()
    } finally {
      setToggling(false)
    }
  }

  async function handleTrigger() {
    setTriggering(true)
    try {
      await apiTrigger(agent.id)
      setTimeout(onChanged, 1500)
    } finally {
      setTriggering(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      await apiDelete(agent.id)
      onChanged()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className={`border-b border-zinc-100 dark:border-zinc-800/50 transition-colors ${isExpanded ? "bg-zinc-50/50 dark:bg-white/[0.01]" : ""}`}
    >
      {/* Main row — clickable */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left grid grid-cols-[1fr_100px_100px_80px_140px_80px_28px] items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group"
      >
        {/* Name + site */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill agent={agent} />
            <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{agent.name}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 ml-0.5">
            <Globe size={11} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{agent.hostname}</span>
          </div>
        </div>

        {/* Trigger */}
        <div className="flex items-center gap-1.5">
          <TrigIcon type={agent.trigger_type} />
          <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{trigLabel(agent)}</span>
        </div>

        {/* Next run */}
        <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
          {agent.is_active && agent.next_run_at ? futTime(agent.next_run_at) : "—"}
        </div>

        {/* Last */}
        <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{relTime(agent.last_run_at)}</div>

        {/* Run dots */}
        <RunDots agent={agent} />

        {/* Streak */}
        <div className="text-right">
          <StreakBadge streak={agent.streak} />
        </div>

        {/* Chevron */}
        <ChevronDown
          size={14}
          className={`text-zinc-300 dark:text-zinc-600 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="ml-0 grid grid-cols-[1fr_320px] gap-6">
            {/* Left — info + actions */}
            <div className="space-y-5">
              {/* Quick actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={toggling}
                  onClick={handleToggle}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all active:scale-[0.97] disabled:opacity-40 ${
                    agent.is_active
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/15"
                      : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15"
                  }`}
                >
                  {toggling ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : agent.is_active ? (
                    <Pause size={12} />
                  ) : (
                    <Play size={12} />
                  )}
                  {agent.is_active ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  disabled={triggering}
                  onClick={handleTrigger}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-[0.97] disabled:opacity-40"
                >
                  {triggering ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                  Run now
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-[0.97]"
                >
                  <Pencil size={12} /> Edit
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/15 transition-colors active:scale-[0.97] disabled:opacity-40"
                    >
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="h-8 px-3 rounded-lg text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.97] ml-auto"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>

              {/* Prompt */}
              {agent.action_prompt && (
                <div>
                  <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                    Prompt
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{agent.action_prompt}</p>
                </div>
              )}

              {/* Config grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="py-2.5 px-3 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Model</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white mt-0.5">{agent.action_model ?? "default"}</p>
                </div>
                <div className="py-2.5 px-3 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Avg time</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white mt-0.5">
                    {dur(agent.avg_duration_ms)}
                  </p>
                </div>
                <div className="py-2.5 px-3 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Success</p>
                  <p
                    className={`text-sm font-medium mt-0.5 ${agent.success_rate >= 95 ? "text-emerald-600 dark:text-emerald-400" : agent.success_rate >= 80 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {agent.success_rate}%
                  </p>
                </div>
              </div>

              {/* Skills */}
              {agent.skills && agent.skills.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mr-1">Skills</span>
                  {agent.skills.map(s => (
                    <span
                      key={s}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Email address if applicable */}
              {agent.email_address && (
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                    {agent.email_address}
                  </code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(agent.email_address ?? "")}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}

              {/* Last error */}
              {agent.last_run_error && (
                <div>
                  <div className="text-[11px] font-medium text-red-400 uppercase tracking-wider mb-1">Last error</div>
                  <p className="text-xs text-red-500 dark:text-red-400">{agent.last_run_error}</p>
                </div>
              )}
            </div>

            {/* Right — recent runs timeline */}
            <div className="border-l border-zinc-100 dark:border-zinc-800 pl-5">
              <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                Recent runs
              </div>
              {agent.recent_runs.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-600">No runs yet</p>
              ) : (
                <div className="space-y-0">
                  {agent.recent_runs.map(run => (
                    <div key={run.id} className="flex items-start gap-2.5 py-2 group/run">
                      <div className="mt-0.5 shrink-0">
                        {run.status === "success" ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : run.status === "failure" ? (
                          <XCircle size={14} className="text-red-500" />
                        ) : (
                          <RotateCw size={14} className="text-blue-500 animate-spin" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-400 tabular-nums">{relTime(run.started_at)} ago</span>
                          <span className="text-[10px] text-zinc-300 dark:text-zinc-600 tabular-nums">
                            {dur(run.duration_ms)}
                          </span>
                        </div>
                        {run.triggered_by && (
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{run.triggered_by}</p>
                        )}
                        {run.error && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate">{run.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="relative w-16 h-16 mx-auto mb-5">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 rotate-6" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 -rotate-6" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <Zap size={24} className="text-violet-500" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1.5">No agents</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-6">
        Create an agent to automate tasks across your sites.
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.97] transition-all"
      >
        <Plus size={15} /> Create agent
      </button>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AgentsV2Page() {
  const { loading: authLoading, isSuperadmin } = useAdminUser()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAgents()
      setAgents(data)
      setError(null)
    } catch {
      setError("Failed to load agents")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isSuperadmin) {
      refresh()
    } else if (!authLoading && !isSuperadmin) {
      setLoading(false)
    }
  }, [authLoading, isSuperadmin, refresh])

  // Sort: problems first, then running, then healthy, then paused
  const sorted = useMemo(() => [...agents].sort((a, b) => healthScore(a) - healthScore(b)), [agents])

  const activeCount = agents.filter(a => a.is_active).length
  const failCount = agents.filter(a => a.is_active && a.last_run_status === "failure").length
  const runningCount = agents.filter(a => a.status === "running").length

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Not authorized</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Agents</h1>
            {agents.length > 0 && (
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{agents.length} total</span>
                <span className="text-zinc-200 dark:text-zinc-700">·</span>
                <span className="text-sm text-emerald-600 dark:text-emerald-400">{activeCount} active</span>
                {runningCount > 0 && (
                  <>
                    <span className="text-zinc-200 dark:text-zinc-700">·</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">{runningCount} running</span>
                  </>
                )}
                {failCount > 0 && (
                  <>
                    <span className="text-zinc-200 dark:text-zinc-700">·</span>
                    <span className="text-sm text-red-600 dark:text-red-400">{failCount} failing</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="h-8 px-3 rounded-lg text-xs font-medium text-zinc-500 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCw size={12} />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.97] transition-all"
            >
              <Plus size={14} /> New Agent
            </button>
          </div>
        </div>

        {agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="border border-zinc-200/70 dark:border-zinc-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_80px_140px_80px_28px] items-center gap-3 px-5 py-2 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200/70 dark:border-zinc-800">
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Agent
              </span>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Trigger
              </span>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Next
              </span>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Last
              </span>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                History
              </span>
              <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider text-right">
                Streak
              </span>
              <span />
            </div>

            {/* Rows */}
            {sorted.map(agent => (
              <AgentRow
                key={agent.id}
                agent={agent}
                isExpanded={expandedId === agent.id}
                onToggle={() => setExpandedId(prev => (prev === agent.id ? null : agent.id))}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
