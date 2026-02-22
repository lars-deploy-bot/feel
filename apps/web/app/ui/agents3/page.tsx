"use client"

/**
 * Agents V3 — Mission Control + Output Value
 *
 * Core idea: "my army is working for me". Each row shows WHAT the agent produced,
 * not just that it ran. Impact counters, last output snippets, cost efficiency.
 */

import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  DollarSign,
  Flame,
  Globe,
  Mail,
  MessageSquare,
  Newspaper,
  Plus,
  RotateCw,
  ScrollText,
  Server,
  Shield,
  TestTube,
  Webhook,
  Zap,
} from "lucide-react"
import { useMemo, useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Agent = {
  id: string
  name: string
  hostname: string
  is_active: boolean
  trigger_type: "cron" | "email" | "webhook" | "one-time"
  cron_schedule: string | null
  last_run_at: string | null
  last_run_status: "success" | "failure" | "running" | null
  next_run_at: string | null

  // Value metrics
  total_runs: number
  success_rate: number
  streak: number
  impact_count: number // total things produced
  impact_unit: string // "emails replied" | "articles published" | etc
  impact_icon: React.ComponentType<{ size?: number; className?: string }>
  total_cost_usd: number
  last_output: string | null // 1-line snippet of what it last did
  level: number // 1-3 based on maturity
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
    last_run_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 14 * 3600000).toISOString(),
    total_runs: 47,
    success_rate: 96,
    streak: 8,
    impact_count: 45,
    impact_unit: "articles published",
    impact_icon: Newspaper,
    total_cost_usd: 1.92,
    last_output: 'Published: "AI News Roundup — Feb 22: GPT-5 turbo, React 20"',
    level: 2,
  },
  {
    id: "2",
    name: "Customer Email Responder",
    hostname: "shop.alive.best",
    is_active: true,
    trigger_type: "email",
    cron_schedule: null,
    last_run_at: new Date(Date.now() - 15 * 60000).toISOString(),
    last_run_status: "success",
    next_run_at: null,
    total_runs: 312,
    success_rate: 99,
    streak: 54,
    impact_count: 309,
    impact_unit: "emails replied",
    impact_icon: MessageSquare,
    total_cost_usd: 4.21,
    last_output: 'Replied to anna@example.com: "Your order #4821 ships tomorrow"',
    level: 3,
  },
  {
    id: "3",
    name: "Weekly Analytics Report",
    hostname: "dashboard.alive.best",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 8 * * 1",
    last_run_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    total_runs: 12,
    success_rate: 92,
    streak: 3,
    impact_count: 11,
    impact_unit: "reports generated",
    impact_icon: ScrollText,
    total_cost_usd: 0.58,
    last_output: "Report published — 14.2k pageviews (+18%), 842 unique visitors",
    level: 1,
  },
  {
    id: "4",
    name: "Deployment Smoke Tests",
    hostname: "api.alive.best",
    is_active: true,
    trigger_type: "webhook",
    cron_schedule: null,
    last_run_at: new Date(Date.now() - 45 * 60000).toISOString(),
    last_run_status: "failure",
    next_run_at: null,
    total_runs: 89,
    success_rate: 85,
    streak: 0,
    impact_count: 76,
    impact_unit: "deploys verified",
    impact_icon: TestTube,
    total_cost_usd: 2.84,
    last_output: "FAILED: /api/health returned 503 — staging unreachable",
    level: 2,
  },
  {
    id: "5",
    name: "Content Calendar Sync",
    hostname: "blog.alive.best",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 6 * * *",
    last_run_at: new Date(Date.now() - 90000).toISOString(),
    last_run_status: "running",
    next_run_at: new Date(Date.now() + 6 * 3600000).toISOString(),
    total_runs: 156,
    success_rate: 98,
    streak: 22,
    impact_count: 153,
    impact_unit: "pages synced",
    impact_icon: RotateCw,
    total_cost_usd: 2.34,
    last_output: "Syncing 3 posts from Notion... (in progress)",
    level: 3,
  },
  {
    id: "6",
    name: "Nightly Backup Verify",
    hostname: "infra.alive.best",
    is_active: false,
    trigger_type: "cron",
    cron_schedule: "0 3 * * *",
    last_run_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    last_run_status: "success",
    next_run_at: null,
    total_runs: 210,
    success_rate: 100,
    streak: 210,
    impact_count: 210,
    impact_unit: "backups verified",
    impact_icon: Shield,
    total_cost_usd: 1.05,
    last_output: "Backup OK — 2.4 GB, SHA256 verified, replicated to S3",
    level: 3,
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function relTime(d: string | null): string {
  if (!d) return "—"
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function futTime(d: string | null): string {
  if (!d) return ""
  const ms = new Date(d).getTime() - Date.now()
  if (ms < 0) return "overdue"
  const m = Math.floor(ms / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}

function trigLabel(a: Agent): string {
  switch (a.trigger_type) {
    case "email":
      return "On email"
    case "webhook":
      return "On webhook"
    case "one-time":
      return "One-time"
    default: {
      if (!a.cron_schedule) return "—"
      const [, hr, , , wd] = a.cron_schedule.split(" ")
      if (wd === "*") return `Daily ${hr}:00`
      if (wd === "1-5") return `Weekdays ${hr}:00`
      if (wd === "1") return `Mon ${hr}:00`
      return a.cron_schedule
    }
  }
}

function TrigIcon({ type }: { type: Agent["trigger_type"] }) {
  const cls = "shrink-0"
  switch (type) {
    case "email":
      return <Mail size={12} className={cls} />
    case "webhook":
      return <Webhook size={12} className={cls} />
    case "one-time":
      return <Calendar size={12} className={cls} />
    default:
      return <Clock size={12} className={cls} />
  }
}

function costPerUnit(agent: Agent): string {
  if (agent.impact_count === 0) return "—"
  const cpp = agent.total_cost_usd / agent.impact_count
  if (cpp < 0.01) return "<$0.01"
  return `$${cpp.toFixed(2)}`
}

function healthScore(a: Agent): number {
  if (!a.is_active) return 100
  if (a.last_run_status === "failure") return 0
  if (a.last_run_status === "running") return 10
  return 50 + a.success_rate * 0.5
}

// ─── Level Badge ────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: number }) {
  const styles = [
    "", // unused
    "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400",
    "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
    "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
  ]
  const labels = ["", "Lv 1", "Lv 2", "Lv 3"]
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${styles[level]}`}>{labels[level]}</span>
}

// ─── Status Indicator ───────────────────────────────────────────────────────

function StatusIndicator({ agent }: { agent: Agent }) {
  if (!agent.is_active) {
    return <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" title="Paused" />
  }
  if (agent.last_run_status === "running") {
    return (
      <span className="relative flex h-2 w-2" title="Running">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
    )
  }
  if (agent.last_run_status === "failure") {
    return <div className="w-2 h-2 rounded-full bg-red-500" title="Failed" />
  }
  return (
    <span className="relative flex h-2 w-2" title="Healthy">
      <span className="absolute inline-flex h-full w-full animate-[pulse_3s_ease-in-out_infinite] rounded-full bg-emerald-400 opacity-40" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  )
}

// ─── Streak ─────────────────────────────────────────────────────────────────

function Streak({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-zinc-300 dark:text-zinc-700">—</span>
  const hot = count >= 10
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs tabular-nums font-medium ${hot ? "text-orange-500 dark:text-orange-400" : "text-zinc-400 dark:text-zinc-500"}`}
    >
      {hot && <Flame size={11} />}
      {count}
      <Check size={9} className="opacity-50" />
    </span>
  )
}

// ─── Run history mini bars ──────────────────────────────────────────────────

function HistoryBars({ agent }: { agent: Agent }) {
  const bars = useMemo(() => {
    const count = Math.min(agent.total_runs, 14)
    const result: boolean[] = []
    for (let i = 0; i < count; i++) {
      result.push(i < agent.streak ? true : Math.random() > 0.3)
    }
    return result.reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id])

  return (
    <div className="flex items-end gap-[2px] h-4">
      {bars.map((ok, i) => (
        <div
          key={i}
          className={`w-[4px] rounded-[1px] ${
            ok ? "bg-emerald-400/60 dark:bg-emerald-500/40" : "bg-red-400/60 dark:bg-red-500/40"
          }`}
          style={{ height: `${40 + Math.random() * 60}%` }}
        />
      ))}
    </div>
  )
}

// ─── Agent Row ──────────────────────────────────────────────────────────────

function AgentRow({ agent }: { agent: Agent }) {
  const ImpactIcon = agent.impact_icon

  return (
    <div
      className={`
        group border-b border-zinc-100 dark:border-zinc-800/50
        hover:bg-zinc-50/80 dark:hover:bg-white/[0.015] transition-colors cursor-pointer
        ${!agent.is_active ? "opacity-50" : ""}
        ${agent.last_run_status === "failure" ? "bg-red-50/40 dark:bg-red-500/[0.02]" : ""}
      `}
    >
      {/* Main row */}
      <div className="px-5 py-3.5">
        {/* Top: identity + timing */}
        <div className="flex items-center gap-3 mb-2">
          <StatusIndicator agent={agent} />
          <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{agent.name}</span>
          <LevelBadge level={agent.level} />
          <span className="text-zinc-200 dark:text-zinc-700 mx-0.5">·</span>
          <Globe size={11} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
          <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{agent.hostname}</span>

          <div className="ml-auto flex items-center gap-4 shrink-0">
            <span className="flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500">
              <TrigIcon type={agent.trigger_type} />
              {trigLabel(agent)}
            </span>
            {agent.next_run_at && agent.is_active && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                {futTime(agent.next_run_at)}
              </span>
            )}
          </div>
        </div>

        {/* Bottom: output snippet + metrics */}
        <div className="flex items-center gap-4 ml-5">
          {/* Last output — the star of the show */}
          <div className="flex-1 min-w-0">
            {agent.last_output ? (
              <p
                className={`text-[13px] truncate ${
                  agent.last_run_status === "failure"
                    ? "text-red-600 dark:text-red-400"
                    : agent.last_run_status === "running"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {agent.last_output}
              </p>
            ) : (
              <p className="text-[13px] text-zinc-300 dark:text-zinc-700">No output yet</p>
            )}
          </div>

          {/* Metrics cluster */}
          <div className="flex items-center gap-5 shrink-0">
            {/* Impact counter */}
            <div className="flex items-center gap-1.5 min-w-[100px]" title={agent.impact_unit}>
              <ImpactIcon size={13} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-white tabular-nums">
                {agent.impact_count.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate hidden sm:inline">
                {agent.impact_unit.split(" ").pop()}
              </span>
            </div>

            {/* Cost per unit */}
            <div
              className="flex items-center gap-1 min-w-[60px]"
              title={`$${agent.total_cost_usd.toFixed(2)} total · ${costPerUnit(agent)} per ${agent.impact_unit.split(" ").pop()}`}
            >
              <DollarSign size={11} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
              <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{costPerUnit(agent)}/ea</span>
            </div>

            {/* History bars */}
            <HistoryBars agent={agent} />

            {/* Streak */}
            <div className="min-w-[40px] text-right">
              <Streak count={agent.streak} />
            </div>

            {/* Last run time */}
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums min-w-[48px] text-right">
              {relTime(agent.last_run_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Site Health Summary ────────────────────────────────────────────────────

function SiteHealthBar({ agents }: { agents: Agent[] }) {
  // Group by hostname
  const sites = useMemo(() => {
    const map = new Map<string, Agent[]>()
    for (const a of agents) {
      const list = map.get(a.hostname) ?? []
      list.push(a)
      map.set(a.hostname, list)
    }
    return Array.from(map.entries()).map(([hostname, list]) => {
      const active = list.filter(a => a.is_active)
      const failing = active.filter(a => a.last_run_status === "failure").length
      const running = active.filter(a => a.last_run_status === "running").length
      const grade = failing > 0 ? "failing" : running > 0 ? "running" : active.length === 0 ? "paused" : "healthy"
      const totalImpact = list.reduce((s, a) => s + a.impact_count, 0)
      const totalCost = list.reduce((s, a) => s + a.total_cost_usd, 0)
      return { hostname, agents: list, grade, totalImpact, totalCost, agentCount: list.length }
    })
  }, [agents])

  if (sites.length <= 1) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {sites.map(site => (
        <div
          key={site.hostname}
          className={`
            inline-flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs transition-colors cursor-default
            ${
              site.grade === "failing"
                ? "bg-red-50/50 dark:bg-red-500/[0.04] border-red-200/50 dark:border-red-800/20"
                : site.grade === "running"
                  ? "bg-blue-50/50 dark:bg-blue-500/[0.04] border-blue-200/50 dark:border-blue-800/20"
                  : site.grade === "paused"
                    ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200/50 dark:border-zinc-800"
                    : "bg-emerald-50/50 dark:bg-emerald-500/[0.04] border-emerald-200/50 dark:border-emerald-800/20"
            }
          `}
        >
          <Globe size={12} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{site.hostname}</span>
          <span className="text-zinc-400 dark:text-zinc-500">
            {site.agentCount} agent{site.agentCount !== 1 ? "s" : ""}
          </span>
          <span
            className={`font-semibold tabular-nums ${
              site.grade === "failing"
                ? "text-red-600 dark:text-red-400"
                : site.grade === "running"
                  ? "text-blue-600 dark:text-blue-400"
                  : site.grade === "paused"
                    ? "text-zinc-400"
                    : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {site.totalImpact.toLocaleString()} outputs
          </span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span className="text-zinc-400 dark:text-zinc-500 tabular-nums">${site.totalCost.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Summary Stats ──────────────────────────────────────────────────────────

function SummaryStats({ agents }: { agents: Agent[] }) {
  const active = agents.filter(a => a.is_active)
  const failing = active.filter(a => a.last_run_status === "failure").length
  const totalImpact = agents.reduce((s, a) => s + a.impact_count, 0)
  const totalCost = agents.reduce((s, a) => s + a.total_cost_usd, 0)
  const avgSuccess = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.success_rate, 0) / agents.length) : 0

  return (
    <div className="flex items-center gap-6 text-sm">
      <div>
        <span className="text-zinc-400 dark:text-zinc-500">Active </span>
        <span className="font-semibold text-zinc-900 dark:text-white">{active.length}</span>
        {failing > 0 && (
          <span className="ml-1.5 text-xs font-medium text-red-600 dark:text-red-400">({failing} failing)</span>
        )}
      </div>
      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
      <div>
        <span className="text-zinc-400 dark:text-zinc-500">Total output </span>
        <span className="font-semibold text-zinc-900 dark:text-white tabular-nums">{totalImpact.toLocaleString()}</span>
      </div>
      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
      <div>
        <span className="text-zinc-400 dark:text-zinc-500">Total cost </span>
        <span className="font-semibold text-zinc-900 dark:text-white tabular-nums">${totalCost.toFixed(2)}</span>
      </div>
      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
      <div>
        <span className="text-zinc-400 dark:text-zinc-500">Reliability </span>
        <span
          className={`font-semibold tabular-nums ${avgSuccess >= 95 ? "text-emerald-600 dark:text-emerald-400" : avgSuccess >= 80 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}
        >
          {avgSuccess}%
        </span>
      </div>
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
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1.5">No agents yet</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-6">
        Create your first agent and let it work for you.
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

export default function AgentsV3Page() {
  const [showEmpty, setShowEmpty] = useState(false)
  const agents = showEmpty ? [] : AGENTS

  const sorted = useMemo(() => [...agents].sort((a, b) => healthScore(a) - healthScore(b)), [agents])

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Agents</h1>
            {agents.length > 0 && <SummaryStats agents={agents} />}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowEmpty(!showEmpty)}
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

        {/* Site health overview */}
        {agents.length > 0 && (
          <div className="mb-5">
            <SiteHealthBar agents={agents} />
          </div>
        )}

        {/* Agent list */}
        {agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="border border-zinc-200/70 dark:border-zinc-800 rounded-xl overflow-hidden">
            {sorted.map(agent => (
              <AgentRow key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
