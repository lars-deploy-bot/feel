"use client"

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
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
import { useMemo, useState } from "react"

// ─── Types & Stub Data ─────────────────────────────────────────────────────

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
  created_at: string
}

type Run = {
  id: string
  status: "success" | "failure" | "running"
  started_at: string
  duration_ms: number
  triggered_by: string
  summary: string | null
  cost_usd: number
  input_tokens: number
  output_tokens: number
  error: string | null
}

const AGENTS: Agent[] = [
  {
    id: "1",
    name: "Daily News Digest",
    hostname: "techblog.test.example",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 9 * * 1-5",
    email_address: null,
    last_run_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 14 * 3600000).toISOString(),
    action_prompt:
      "Scan the top tech news sites and create a curated digest blog post with summaries and analysis. Focus on AI, web development, and startup news.",
    model: "Sonnet 4",
    total_runs: 47,
    success_rate: 96,
    avg_duration_ms: 45000,
    skills: ["web-search", "content-writer"],
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "2",
    name: "Customer Email Responder",
    hostname: "shop.test.example",
    is_active: true,
    trigger_type: "email",
    cron_schedule: null,
    email_address: "support-agent-x7k@in.test.example",
    last_run_at: new Date(Date.now() - 15 * 60000).toISOString(),
    last_run_status: "success",
    next_run_at: null,
    action_prompt:
      "Read the incoming customer email and draft a helpful, friendly response. Check the knowledge base for relevant answers. Escalate if the issue requires human attention.",
    model: "Haiku 4.5",
    total_runs: 312,
    success_rate: 99,
    avg_duration_ms: 8000,
    skills: ["email-responder", "knowledge-base"],
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: "3",
    name: "Weekly Analytics Report",
    hostname: "dashboard.test.example",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 8 * * 1",
    email_address: null,
    last_run_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    action_prompt:
      "Pull analytics data from the past week, generate charts and insights, and publish the weekly report page.",
    model: "Sonnet 4",
    total_runs: 12,
    success_rate: 92,
    avg_duration_ms: 120000,
    skills: ["analytics", "chart-generator"],
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "4",
    name: "Deployment Smoke Tests",
    hostname: "api.test.example",
    is_active: false,
    trigger_type: "webhook",
    cron_schedule: null,
    email_address: null,
    last_run_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    last_run_status: "failure",
    next_run_at: null,
    action_prompt:
      "On deployment webhook, run smoke tests against staging and report results to the team Slack channel.",
    model: "Haiku 4.5",
    total_runs: 89,
    success_rate: 85,
    avg_duration_ms: 32000,
    skills: ["testing", "slack-notify"],
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: "5",
    name: "Content Calendar Sync",
    hostname: "blog.test.example",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 6 * * *",
    email_address: null,
    last_run_at: new Date(Date.now() - 18 * 3600000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 6 * 3600000).toISOString(),
    action_prompt: "Sync the content calendar from Notion, check for any posts due today, and prepare draft pages.",
    model: "Sonnet 4",
    total_runs: 156,
    success_rate: 98,
    avg_duration_ms: 15000,
    skills: ["notion-sync"],
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: "6",
    name: "Nightly DB Backup Check",
    hostname: "infra.test.example",
    is_active: true,
    trigger_type: "cron",
    cron_schedule: "0 3 * * *",
    email_address: null,
    last_run_at: new Date(Date.now() - 9 * 3600000).toISOString(),
    last_run_status: "success",
    next_run_at: new Date(Date.now() + 15 * 3600000).toISOString(),
    action_prompt:
      "Verify that the nightly database backup completed. Check file size and integrity. Alert on Slack if anything is off.",
    model: "Haiku 4.5",
    total_runs: 210,
    success_rate: 100,
    avg_duration_ms: 5000,
    skills: ["db-check", "slack-notify"],
    created_at: new Date(Date.now() - 120 * 86400000).toISOString(),
  },
]

const RUNS: Run[] = [
  {
    id: "r1",
    status: "success",
    started_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    duration_ms: 43200,
    triggered_by: "cron",
    summary: "Published digest with 8 articles. Top story: OpenAI releases GPT-5 turbo.",
    cost_usd: 0.042,
    input_tokens: 12400,
    output_tokens: 3200,
    error: null,
  },
  {
    id: "r2",
    status: "success",
    started_at: new Date(Date.now() - 26 * 3600000).toISOString(),
    duration_ms: 38700,
    triggered_by: "cron",
    summary: "Published digest with 6 articles. Featured: React 20 announcement.",
    cost_usd: 0.038,
    input_tokens: 11200,
    output_tokens: 2800,
    error: null,
  },
  {
    id: "r3",
    status: "failure",
    started_at: new Date(Date.now() - 50 * 3600000).toISOString(),
    duration_ms: 12300,
    triggered_by: "cron",
    summary: null,
    cost_usd: 0.012,
    input_tokens: 4200,
    output_tokens: 800,
    error: "Failed to fetch RSS feed: Connection timeout after 10s",
  },
  {
    id: "r4",
    status: "success",
    started_at: new Date(Date.now() - 74 * 3600000).toISOString(),
    duration_ms: 51200,
    triggered_by: "manual",
    summary: "Published digest with 10 articles covering Bun 2.0 release.",
    cost_usd: 0.048,
    input_tokens: 14100,
    output_tokens: 3600,
    error: null,
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function futureTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff < 0) return "Overdue"
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d`
}

function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

function triggerLabel(a: Agent): string {
  switch (a.trigger_type) {
    case "email":
      return "On email received"
    case "webhook":
      return "On webhook"
    case "one-time":
      return "One-time"
    default: {
      if (!a.cron_schedule) return "No schedule"
      const [, hour, , , weekday] = a.cron_schedule.split(" ")
      if (weekday === "*") return `Daily at ${hour}:00`
      if (weekday === "1-5") return `Weekdays at ${hour}:00`
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      if (weekday === "1") return `Mondays at ${hour}:00`
      return `${days[Number(weekday)] ?? weekday} at ${hour}:00`
    }
  }
}

function TriggerIcon({ type, size = 14 }: { type: Agent["trigger_type"]; size?: number }) {
  switch (type) {
    case "email":
      return <Mail size={size} />
    case "webhook":
      return <Webhook size={size} />
    case "one-time":
      return <Calendar size={size} />
    default:
      return <RotateCw size={size} />
  }
}

function StatusDot({
  status,
  active,
  size = "sm",
}: {
  status: Agent["last_run_status"]
  active: boolean
  size?: "sm" | "md"
}) {
  const px = size === "md" ? "w-3 h-3" : "w-2 h-2"
  if (!active) return <div className={`${px} rounded-full bg-zinc-300 dark:bg-zinc-600`} />
  if (status === "running") {
    return (
      <span className={`relative inline-flex ${px}`}>
        <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50" />
        <span className={`relative inline-flex rounded-full ${px} bg-blue-500`} />
      </span>
    )
  }
  if (status === "failure") return <div className={`${px} rounded-full bg-red-500`} />
  return (
    <span className={`relative inline-flex ${px}`}>
      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-[pulse_2s_ease-in-out_infinite] opacity-40" />
      <span className={`relative inline-flex rounded-full ${px} bg-emerald-500`} />
    </span>
  )
}

function successColor(rate: number): string {
  if (rate >= 95) return "text-emerald-600 dark:text-emerald-400"
  if (rate >= 80) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

// ─── Grid Card ──────────────────────────────────────────────────────────────

function AgentGridCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group w-full text-left rounded-2xl border transition-all duration-200 overflow-hidden
        ${
          agent.is_active
            ? "bg-white dark:bg-white/[0.02] border-zinc-200/70 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.12] hover:shadow-lg hover:shadow-zinc-200/40 dark:hover:shadow-black/20 hover:-translate-y-0.5"
            : "bg-zinc-50/50 dark:bg-white/[0.01] border-zinc-200/40 dark:border-white/[0.04] opacity-55 hover:opacity-75 hover:shadow-md"
        }
      `}
    >
      {/* Top accent bar */}
      <div
        className={`h-1 w-full ${
          !agent.is_active
            ? "bg-zinc-200 dark:bg-zinc-700"
            : agent.last_run_status === "failure"
              ? "bg-red-400"
              : agent.last_run_status === "running"
                ? "bg-blue-400"
                : "bg-emerald-400"
        }`}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusDot status={agent.last_run_status} active={agent.is_active} size="md" />
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white truncate leading-tight">
              {agent.name}
            </h3>
          </div>
          <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-400 dark:text-zinc-500 group-hover:bg-zinc-200 dark:group-hover:bg-white/[0.1] transition-colors">
            <TriggerIcon type={agent.trigger_type} size={16} />
          </div>
        </div>

        {/* Site + trigger */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Globe size={12} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
            <span className="truncate">{agent.hostname}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Clock size={12} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
            <span>{triggerLabel(agent)}</span>
          </div>
        </div>

        {/* Prompt preview */}
        <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed mb-4">
          {agent.action_prompt}
        </p>

        {/* Stats footer */}
        <div className="flex items-center justify-between pt-3.5 border-t border-zinc-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">{agent.total_runs} runs</span>
            <span className={`text-xs tabular-nums font-medium ${successColor(agent.success_rate)}`}>
              {agent.success_rate}%
            </span>
          </div>
          {agent.last_run_at && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
              {relativeTime(agent.last_run_at)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Detail View ────────────────────────────────────────────────────────────

function AgentDetail({ agent, onBack }: { agent: Agent; onBack: () => void }) {
  const [tab, setTab] = useState<"overview" | "runs" | "edit">("overview")

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/[0.1] hover:text-zinc-700 dark:hover:text-zinc-200 transition-all active:scale-95"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <StatusDot status={agent.last_run_status} active={agent.is_active} size="md" />
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white truncate">{agent.name}</h2>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 ml-[22px]">
            <Globe size={12} className="text-zinc-400" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">{agent.hostname}</span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          type="button"
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${
            agent.is_active
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15"
          }`}
        >
          {agent.is_active ? (
            <>
              <Pause size={14} /> Pause Agent
            </>
          ) : (
            <>
              <Play size={14} /> Resume Agent
            </>
          )}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-all active:scale-[0.97]"
        >
          <Play size={14} /> Run Now
        </button>
        <button
          type="button"
          onClick={() => setTab("edit")}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-white/[0.1] transition-all active:scale-[0.97]"
        >
          <Pencil size={14} /> Edit
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-all active:scale-[0.97]"
        >
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-200/70 dark:border-white/[0.06]">
        {(["overview", "runs", "edit"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white"
                : "border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            {t === "runs" ? `Runs (${agent.total_runs})` : t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && <OverviewTab agent={agent} />}
      {tab === "runs" && <RunsTab />}
      {tab === "edit" && <EditTab agent={agent} />}
    </div>
  )
}

function OverviewTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Total runs" value={String(agent.total_runs)} />
        <MiniStat label="Success rate" value={`${agent.success_rate}%`} color={successColor(agent.success_rate)} />
        <MiniStat label="Avg duration" value={duration(agent.avg_duration_ms)} />
        <MiniStat label="Last run" value={relativeTime(agent.last_run_at)} />
      </div>

      {/* Schedule section */}
      <DetailSection title="Trigger">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04]">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-white/[0.06] border border-zinc-200/50 dark:border-white/[0.06] shadow-sm">
            <TriggerIcon type={agent.trigger_type} size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">{triggerLabel(agent)}</p>
            {agent.next_run_at && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Next run {futureTime(agent.next_run_at)}
              </p>
            )}
            {agent.email_address && (
              <div className="flex items-center gap-2 mt-1.5">
                <code className="text-xs font-mono text-zinc-500 bg-zinc-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-md">
                  {agent.email_address}
                </code>
                <button type="button" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                  <Copy size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </DetailSection>

      {/* Prompt */}
      <DetailSection title="Prompt">
        <div className="p-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04]">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {agent.action_prompt}
          </p>
        </div>
      </DetailSection>

      {/* Config */}
      <DetailSection title="Configuration">
        <div className="rounded-xl border border-zinc-100 dark:border-white/[0.04] divide-y divide-zinc-100 dark:divide-white/[0.04] overflow-hidden">
          <ConfigItem label="Model" value={agent.model} />
          <ConfigItem label="Timeout" value={duration(agent.avg_duration_ms * 2)} />
          <ConfigItem
            label="Created"
            value={new Date(agent.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          {agent.skills.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-transparent">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Skills</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {agent.skills.map(s => (
                  <span
                    key={s}
                    className="text-xs px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DetailSection>
    </div>
  )
}

function RunsTab() {
  return (
    <div className="space-y-1 animate-in fade-in duration-200">
      {RUNS.map((run, i) => (
        <RunRow key={run.id} run={run} isLast={i === RUNS.length - 1} />
      ))}
    </div>
  )
}

function RunRow({ run, isLast }: { run: Run; isLast: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-start gap-4 py-3.5 px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors"
      >
        {/* Timeline */}
        <div className="flex flex-col items-center shrink-0 pt-0.5">
          <RunStatusIcon status={run.status} />
          {!isLast && <div className="w-px flex-1 bg-zinc-200 dark:bg-zinc-800 mt-1.5 min-h-[20px]" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-white capitalize">{run.status}</span>
              <span className="text-xs text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.04]">
                {run.triggered_by}
              </span>
            </div>
            <span className="text-xs text-zinc-400 tabular-nums">{relativeTime(run.started_at)}</span>
          </div>

          {run.summary && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{run.summary}</p>}
          {run.error && !open && (
            <p className="text-sm text-red-500 dark:text-red-400 mt-1 line-clamp-1">{run.error}</p>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-zinc-400 tabular-nums">{duration(run.duration_ms)}</span>
            <span className="text-xs text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-xs text-zinc-400 tabular-nums">${run.cost_usd.toFixed(3)}</span>
            <span className="text-xs text-zinc-300 dark:text-zinc-700">·</span>
            <span className="text-xs text-zinc-400 tabular-nums">
              {run.input_tokens.toLocaleString()}↓ {run.output_tokens.toLocaleString()}↑
            </span>
          </div>
        </div>
      </button>

      {open && run.error && (
        <div className="ml-10 mb-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-800/20">
          <p className="text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">{run.error}</p>
        </div>
      )}
    </div>
  )
}

function EditTab({ agent }: { agent: Agent }) {
  const [title, setTitle] = useState(agent.name)
  const [prompt, setPrompt] = useState(agent.action_prompt)

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-200">
      <FormField label="Name">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full h-10 px-4 rounded-xl text-sm bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-300 dark:focus:border-white/[0.12] transition-all"
        />
      </FormField>

      <FormField label="Website">
        <div className="flex items-center gap-2 h-10 px-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/50 dark:border-white/[0.04] text-sm text-zinc-500">
          <Globe size={14} />
          {agent.hostname}
        </div>
      </FormField>

      <FormField label="Prompt" description="The instructions your agent receives when it runs.">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={6}
          className="w-full px-4 py-3 rounded-xl text-sm leading-relaxed bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-300 dark:focus:border-white/[0.12] transition-all"
          maxLength={10000}
        />
        <div className="flex justify-end mt-1.5">
          <span className="text-xs text-zinc-400 tabular-nums">{prompt.length.toLocaleString()} / 10,000</span>
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Model">
          <select className="w-full h-10 px-4 rounded-xl text-sm bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all">
            <option>Sonnet 4</option>
            <option>Haiku 4.5</option>
            <option>Opus 4</option>
          </select>
        </FormField>

        <FormField label="Timeout (seconds)">
          <input
            type="number"
            defaultValue={300}
            className="w-full h-10 px-4 rounded-xl text-sm bg-white dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 transition-all"
          />
        </FormField>
      </div>

      <FormField label="Skills">
        <div className="flex flex-wrap gap-2">
          {agent.skills.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 font-medium"
            >
              {s}
              <button type="button" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={14} />
              </button>
            </span>
          ))}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
          >
            <Plus size={14} /> Add skill
          </button>
        </div>
      </FormField>

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200/70 dark:border-white/[0.06]">
        <button
          type="button"
          className="h-10 px-5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          className="h-10 px-6 rounded-xl text-sm font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.97] transition-all shadow-sm"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ─── Small Components ───────────────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="py-3.5 px-4 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04]">
      <p className={`text-lg font-semibold tabular-nums leading-none ${color ?? "text-zinc-900 dark:text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">{label}</p>
    </div>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-3">{title}</h4>
      {children}
    </div>
  )
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-transparent">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-white">{value}</span>
    </div>
  )
}

function FormField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-")
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-zinc-900 dark:text-white">
        {label}
      </label>
      {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-2">{description}</p>}
      {!description && <div className="mt-1.5" />}
      {children}
    </div>
  )
}

function RunStatusIcon({ status }: { status: Run["status"] }) {
  if (status === "success") return <CheckCircle2 size={18} className="text-emerald-500" />
  if (status === "failure") return <XCircle size={18} className="text-red-500" />
  return <RotateCw size={18} className="text-blue-500 animate-spin" />
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center max-w-md px-4">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 rotate-6" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 -rotate-6" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <Zap size={28} className="text-violet-500" />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">No agents yet</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-8">
          Agents run tasks on a schedule, respond to emails, or fire on webhooks. Set one up to automate your workflow.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.97] transition-all shadow-sm"
        >
          <Plus size={16} />
          Create your first agent
        </button>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AgentsPreviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showEmpty, setShowEmpty] = useState(false)
  const agents = showEmpty ? [] : AGENTS

  const selected = useMemo(() => agents.find(a => a.id === selectedId) ?? null, [agents, selectedId])

  const activeCount = agents.filter(a => a.is_active).length

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Agents</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              {agents.length > 0 ? `${activeCount} active across your sites` : "Automated tasks for your sites"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowEmpty(!showEmpty)
                setSelectedId(null)
              }}
              className="h-9 px-3 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              {showEmpty ? "Show agents" : "Show empty"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.97] transition-all shadow-sm"
            >
              <Plus size={15} />
              New Agent
            </button>
          </div>
        </div>

        {/* Content — grid or detail */}
        {agents.length === 0 ? (
          <EmptyState onCreate={() => setShowEmpty(false)} />
        ) : selected ? (
          <AgentDetail agent={selected} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-200">
            {agents.map(agent => (
              <AgentGridCard key={agent.id} agent={agent} onClick={() => setSelectedId(agent.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
