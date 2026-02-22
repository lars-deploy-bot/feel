"use client"

/**
 * Agents V2 — Mission Control style
 *
 * Inspired by: GitHub Actions timeline, Datadog service list, SpaceX telemetry.
 * Core idea: health-first. Healthy = quiet. Problems = loud. Click to expand inline.
 */

import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Flame,
  Globe,
  Mail,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Trash2,
  Webhook,
  X,
  XCircle,
  Zap,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Agent = {
  id: string
  name: string
  hostname: string
  is_active: boolean
  trigger_type: "cron" | "email" | "webhook" | "one-time"
  cron_schedule: string | null
  email_address: string | null
  last_run_at: string | null
  last_run_status: "success" | "failure" | "running" | null
  next_run_at: string | null
  action_prompt: string
  model: string
  total_runs: number
  success_rate: number
  avg_duration_ms: number
  skills: string[]
  streak: number // consecutive successes
}

type Run = {
  id: string
  status: "success" | "failure" | "running"
  started_at: string
  duration_ms: number
  triggered_by: string
  summary: string | null
  cost_usd: number
  error: string | null
}

// ─── Stub Data ──────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  {
    id: "1",
    name: "Daily News Digest",
    hostname: "techblog.alive.best",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 9 * * 1-5",
    email_address: null,
    last_run_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 14 * 3600000).toISOString(),
    action_prompt: "Scan the top tech news sites and create a curated digest blog post with summaries and analysis.",
    model: "Sonnet 4",
    total_runs: 47,
    success_rate: 96,
    avg_duration_ms: 45000,
    skills: ["web-search", "content-writer"],
    streak: 8,
  },
  {
    id: "2",
    name: "Customer Email Responder",
    hostname: "shop.alive.best",
    is_active: true,
    trigger_type: "email",
    cron_schedule: null,
    email_address: "support-x7k@in.alive.best",
    last_run_at: new Date(Date.now() - 15 * 60000).toISOString(),
    last_run_status: "success",
    next_run_at: null,
    action_prompt: "Read incoming customer email, draft a helpful response, check knowledge base.",
    model: "Haiku 4.5",
    total_runs: 312,
    success_rate: 99,
    avg_duration_ms: 8000,
    skills: ["email-responder"],
    streak: 54,
  },
  {
    id: "3",
    name: "Weekly Analytics Report",
    hostname: "dashboard.alive.best",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 8 * * 1",
    email_address: null,
    last_run_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    action_prompt: "Pull analytics data, generate charts and insights, publish the weekly report.",
    model: "Sonnet 4",
    total_runs: 12,
    success_rate: 92,
    avg_duration_ms: 120000,
    skills: ["analytics"],
    streak: 3,
  },
  {
    id: "4",
    name: "Deployment Smoke Tests",
    hostname: "api.alive.best",
    is_active: true,
    trigger_type: "webhook",
    cron_schedule: null,
    email_address: null,
    last_run_at: new Date(Date.now() - 45 * 60000).toISOString(),
    last_run_status: "failure",
    next_run_at: null,
    action_prompt: "Run smoke tests against staging, report results to Slack.",
    model: "Haiku 4.5",
    total_runs: 89,
    success_rate: 85,
    avg_duration_ms: 32000,
    skills: ["testing", "slack-notify"],
    streak: 0,
  },
  {
    id: "5",
    name: "Content Calendar Sync",
    hostname: "blog.alive.best",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 6 * * *",
    email_address: null,
    last_run_at: new Date(Date.now() - 90000).toISOString(),
    last_run_status: "running",
    next_run_at: new Date(Date.now() + 6 * 3600000).toISOString(),
    action_prompt: "Sync content calendar from Notion, prepare drafts for today's posts.",
    model: "Sonnet 4",
    total_runs: 156,
    success_rate: 98,
    avg_duration_ms: 15000,
    skills: ["notion-sync"],
    streak: 22,
  },
  {
    id: "6",
    name: "Nightly DB Backup Check",
    hostname: "infra.alive.best",
    is_active: false,
    trigger_type: "cron",
    cron_schedule: "0 3 * * *",
    email_address: null,
    last_run_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    last_run_status: "success",
    next_run_at: null,
    action_prompt: "Verify nightly database backup completed. Check file size and integrity.",
    model: "Haiku 4.5",
    total_runs: 210,
    success_rate: 100,
    avg_duration_ms: 5000,
    skills: ["db-check"],
    streak: 210,
  },
]

function makeRuns(agent: Agent): Run[] {
  const statuses: Run["status"][] =
    agent.last_run_status === "failure"
      ? ["failure", "success", "success", "failure", "success"]
      : ["success", "success", "success", "failure", "success"]

  return statuses.map((status, i) => ({
    id: `${agent.id}-r${i}`,
    status,
    started_at: new Date(Date.now() - (i + 1) * (agent.trigger_type === "email" ? 3600000 : 86400000)).toISOString(),
    duration_ms: agent.avg_duration_ms + (Math.random() - 0.5) * agent.avg_duration_ms * 0.4,
    triggered_by:
      agent.trigger_type === "email"
        ? "email"
        : agent.trigger_type === "webhook"
          ? "webhook"
          : i === 3
            ? "manual"
            : "cron",
    summary: status === "success" ? "Completed successfully" : null,
    cost_usd: 0.01 + Math.random() * 0.05,
    error: status === "failure" ? "Unexpected error during execution" : null,
  }))
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

function dur(ms: number): string {
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
  // Lower = needs more attention = shown first
  if (!a.is_active) return 100 // paused at the bottom
  if (a.last_run_status === "failure") return 0
  if (a.last_run_status === "running") return 10
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
  if (agent.last_run_status === "running") {
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

// ─── Mini run dots (last 10 runs) ───────────────────────────────────────────

function RunDots({ agent }: { agent: Agent }) {
  // Generate a deterministic pattern from success_rate
  const dots = useMemo(() => {
    const count = Math.min(agent.total_runs, 12)
    const result: ("success" | "failure")[] = []
    // Use streak to determine recent pattern
    for (let i = 0; i < count; i++) {
      if (i < agent.streak) {
        result.push("success")
      } else {
        result.push(Math.random() > 0.3 ? "success" : "failure")
      }
    }
    return result.reverse() // most recent first (left)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id])

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

function AgentRow({ agent, isExpanded, onToggle }: { agent: Agent; isExpanded: boolean; onToggle: () => void }) {
  const runs = useMemo(() => makeRuns(agent), [agent])

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
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all active:scale-[0.97] ${
                    agent.is_active
                      ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/15"
                      : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/15"
                  }`}
                >
                  {agent.is_active ? (
                    <>
                      <Pause size={12} /> Pause
                    </>
                  ) : (
                    <>
                      <Play size={12} /> Resume
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-[0.97]"
                >
                  <Play size={12} /> Run now
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-[0.97]"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors active:scale-[0.97] ml-auto"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Prompt */}
              <div>
                <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                  Prompt
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{agent.action_prompt}</p>
              </div>

              {/* Config grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="py-2.5 px-3 rounded-lg bg-white dark:bg-white/[0.02] border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Model</p>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white mt-0.5">{agent.model}</p>
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
              {agent.skills.length > 0 && (
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
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* Right — recent runs timeline */}
            <div className="border-l border-zinc-100 dark:border-zinc-800 pl-5">
              <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                Recent runs
              </div>
              <div className="space-y-0">
                {runs.map((run, i) => (
                  <div key={run.id} className="flex items-start gap-2.5 py-2 group/run">
                    {/* Status icon */}
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
                      {run.summary && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{run.summary}</p>
                      )}
                      {run.error && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate">{run.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showEmpty, setShowEmpty] = useState(false)

  const agents = showEmpty ? [] : AGENTS

  // Sort: problems first, then running, then healthy, then paused
  const sorted = useMemo(() => [...agents].sort((a, b) => healthScore(a) - healthScore(b)), [agents])

  const activeCount = agents.filter(a => a.is_active).length
  const failCount = agents.filter(a => a.is_active && a.last_run_status === "failure").length
  const runningCount = agents.filter(a => a.last_run_status === "running").length

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
              onClick={() => {
                setShowEmpty(!showEmpty)
                setExpandedId(null)
              }}
              className="h-8 px-3 rounded-lg text-xs font-medium text-zinc-500 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {showEmpty ? "Show agents" : "Show empty"}
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
