"use client"

/**
 * Agents V4 — Morning briefing
 *
 * The boss opens this page with coffee. They want to know:
 * 1. Is my site OK?
 * 2. Did anything happen?
 * 3. Do I need to do anything?
 *
 * If the answer to #3 is "no" → they close the tab in 5 seconds.
 * If "yes" → tell them WHAT and WHAT TO DO. No clicking required.
 */

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Flag,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Terminal,
  ThumbsUp,
  XCircle,
  Zap,
} from "lucide-react"
import { useMemo, useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type ToolCall = {
  name: string
  input_summary: string
  output_summary: string
  duration_ms: number
}

type ConversationMessage = {
  role: "assistant" | "tool"
  content: string
  tool_calls?: ToolCall[]
  timestamp: string
}

type Run = {
  id: string
  status: "success" | "failure" | "running"
  started_at: string
  finished_at: string | null
  duration_s: number
  conversation: ConversationMessage[]
  reviewed?: "approved" | "flagged" | null
}

type Agent = {
  id: string
  name: string
  description: string
  is_active: boolean
  trigger_label: string
  is_healthy: boolean
  needs_action: boolean
  action_label?: string
  action_cta?: string
  triggered_by?: string
  last_run: Run | null
  previous_runs: Run[]
}

const SITE_NAME = "huurmatcher.nl"

// ─── Conversations ──────────────────────────────────────────────────────────

const ISSUE_RESOLVER_CONVERSATION: ConversationMessage[] = [
  {
    role: "assistant",
    content: "I'll pick up issue #35: TypeError in SearchFilters.tsx. Let me start by understanding the error.",
    tool_calls: [
      { name: "Read", input_summary: "SearchFilters.tsx", output_summary: "Read 142 lines", duration_ms: 45 },
      {
        name: "Grep",
        input_summary: "\"Cannot read 'filter'\" in logs",
        output_summary: "12 matches in error logs",
        duration_ms: 120,
      },
    ],
    timestamp: new Date(Date.now() - 48 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Found the root cause. On line 42, `filters.filter(...)` is called but `filters` can be `undefined` when the data is still loading. The API returns `{ filters: undefined }` during the loading state.\n\nI'll create a worktree and fix this.",
    tool_calls: [
      {
        name: "Bash",
        input_summary: "git worktree add -b fix/search-filters-type-error",
        output_summary: "Created worktree",
        duration_ms: 890,
      },
    ],
    timestamp: new Date(Date.now() - 47 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Added a guard clause with early return when filters is undefined. The component now shows a loading skeleton instead of crashing.",
    tool_calls: [
      {
        name: "Edit",
        input_summary: "SearchFilters.tsx:38-44 — added null check + loading skeleton",
        output_summary: "File updated",
        duration_ms: 32,
      },
    ],
    timestamp: new Date(Date.now() - 46 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content: "Running the test suite to verify the fix.",
    tool_calls: [
      {
        name: "Bash",
        input_summary: "bun run test SearchFilters",
        output_summary: "2 tests failed, 8 passed",
        duration_ms: 4200,
      },
    ],
    timestamp: new Date(Date.now() - 46 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Two tests failed:\n\n- `SearchFilters › should render active filters` — expected 3 items, got 0. The test passes `undefined` as filters and expects the old (broken) behavior.\n- `SearchFilters › should show filter count badge` — same root cause.\n\nThese tests need to be updated to expect the loading skeleton instead. However, this changes the test contract, so I'm leaving my analysis as a comment on #35 for human review rather than auto-merging.\n\nPR not opened. Branch `fix/search-filters-type-error` is ready with the fix. Tests need updating to match the new loading behavior.",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
  },
]

const ERROR_MONITOR_CONVERSATION: ConversationMessage[] = [
  {
    role: "assistant",
    content: "Starting daily error scan for huurmatcher.nl.",
    tool_calls: [
      {
        name: "SQL",
        input_summary: "SELECT * FROM errors WHERE created_at > now() - interval '24h'",
        output_summary: "22 rows",
        duration_ms: 340,
      },
    ],
    timestamp: new Date(Date.now() - 95 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Found 22 errors in the last 24 hours. Grouping by type:\n\n**Group 1: TypeError in SearchFilters.tsx:42** (12 occurrences)\nStarted after deploy at 14:22. Affects /zoeken page.\n\n**Group 2: 504 Gateway Timeout on /api/matches** (3 occurrences)\nIntermittent, during peak hours. Likely DB connection pool.\n\n**Group 3: Hydration mismatch in ListingCard.tsx** (7 occurrences)\nCosmetic only. Known pattern.",
    timestamp: new Date(Date.now() - 94 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content: "Creating GitHub issues for the two actionable groups. Skipping hydration mismatch (low severity, known).",
    tool_calls: [
      {
        name: "GitHub",
        input_summary: "Create issue: TypeError in SearchFilters.tsx",
        output_summary: "Created #35",
        duration_ms: 1200,
      },
      {
        name: "GitHub",
        input_summary: "Create issue: 504 timeouts on /api/matches",
        output_summary: "Created #36",
        duration_ms: 980,
      },
    ],
    timestamp: new Date(Date.now() - 93 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Done. Created 2 issues:\n- **#35** — SearchFilters TypeError (12 occurrences, high severity)\n- **#36** — API timeout (3 occurrences, medium severity)\n\nSkipped hydration mismatch (7 occurrences, low severity).",
    timestamp: new Date(Date.now() - 92 * 60000).toISOString(),
  },
]

const POSTHOG_CONVERSATION: ConversationMessage[] = [
  {
    role: "assistant",
    content: "Pulling yesterday's analytics from PostHog.",
    tool_calls: [
      {
        name: "PostHog API",
        input_summary: "pageviews, sessions, bounce, conversions",
        output_summary: "4 metrics returned",
        duration_ms: 2100,
      },
    ],
    timestamp: new Date(Date.now() - 125 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Yesterday's numbers:\n\n- **Pageviews**: 2,841 (normal)\n- **Bounce rate**: 31% (improved from 34%)\n- **Conversion on /aanbod**: 7.2% (dropped from 8.2% — **down 12%**)\n\nThe conversion drop is notable. CTA clicks dropped while pageviews stayed stable — suggests a UI issue, not traffic quality.",
    tool_calls: [
      {
        name: "PostHog API",
        input_summary: "/aanbod funnel analysis",
        output_summary: "view→click→submit funnel",
        duration_ms: 1800,
      },
    ],
    timestamp: new Date(Date.now() - 124 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "The funnel confirms it — drop is between page view and CTA click. Started 2 days ago, aligns with last deploy. Creating a GitHub issue.",
    tool_calls: [
      {
        name: "GitHub",
        input_summary: "Create issue: Conversion drop on /aanbod",
        output_summary: "Created #34",
        duration_ms: 1100,
      },
    ],
    timestamp: new Date(Date.now() - 123 * 60000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "Created **#34** — Conversion drop on /aanbod (CTA clicks down 12% since last deploy). No other anomalies.",
    timestamp: new Date(Date.now() - 122 * 60000).toISOString(),
  },
]

const WEEKLY_REPORT_CONVERSATION: ConversationMessage[] = [
  {
    role: "assistant",
    content: "Compiling Week 8 report.",
    tool_calls: [
      { name: "PostHog API", input_summary: "Weekly aggregates", output_summary: "200 OK", duration_ms: 3200 },
      { name: "SQL", input_summary: "Error count last 7 days", output_summary: "23 errors", duration_ms: 180 },
    ],
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    role: "assistant",
    content:
      "**Week 8 — huurmatcher.nl**\n\n**Traffic**: 18.4k sessions (+8% WoW)\n**Performance**: 240ms avg response (improved from 310ms)\n**Uptime**: 99.7% (2h 10m downtime Wednesday)\n**Errors**: 23 (down from 41)\n**Leads**: 342 (+5%)\n\nOverall: improving across the board.",
    tool_calls: [
      {
        name: "Email",
        input_summary: "Send to lars@, team@, dev@huurmatcher.nl",
        output_summary: "Sent to 3 recipients",
        duration_ms: 2400,
      },
    ],
    timestamp: new Date(Date.now() - 3 * 86400000 + 40000).toISOString(),
  },
  {
    role: "assistant",
    content: "Report sent. Overall health: improving. No action items.",
    timestamp: new Date(Date.now() - 3 * 86400000 + 45000).toISOString(),
  },
]

// ─── Agents ─────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  {
    id: "1",
    name: "PostHog Analytics Check",
    description: "Checks PostHog every morning for traffic anomalies, conversion drops, and user behavior changes.",
    is_active: true,
    trigger_label: "Every day at 8:00 AM",
    is_healthy: true,
    needs_action: false,
    last_run: {
      id: "r1",
      status: "success",
      started_at: new Date(Date.now() - 125 * 60000).toISOString(),
      finished_at: new Date(Date.now() - 122 * 60000).toISOString(),
      duration_s: 34,
      conversation: POSTHOG_CONVERSATION,
    },
    previous_runs: [
      {
        id: "r1b",
        status: "success",
        started_at: new Date(Date.now() - 26 * 3600000).toISOString(),
        finished_at: new Date(Date.now() - 26 * 3600000 + 28000).toISOString(),
        duration_s: 28,
        conversation: [
          {
            role: "assistant",
            content: "Pulling yesterday's analytics from PostHog.",
            tool_calls: [
              {
                name: "PostHog API",
                input_summary: "pageviews, sessions, bounce, conversions",
                output_summary: "4 metrics returned",
                duration_ms: 1900,
              },
            ],
            timestamp: new Date(Date.now() - 26 * 3600000).toISOString(),
          },
          {
            role: "assistant",
            content:
              "All metrics within normal ranges. Pageviews: 2,690. Bounce rate: 33%. Conversion: 8.1%. No anomalies detected.",
            timestamp: new Date(Date.now() - 26 * 3600000 + 28000).toISOString(),
          },
        ],
      },
      {
        id: "r1c",
        status: "success",
        started_at: new Date(Date.now() - 50 * 3600000).toISOString(),
        finished_at: new Date(Date.now() - 50 * 3600000 + 41000).toISOString(),
        duration_s: 41,
        conversation: [
          {
            role: "assistant",
            content: "Pulling yesterday's analytics from PostHog.",
            tool_calls: [
              {
                name: "PostHog API",
                input_summary: "pageviews, sessions, bounce, conversions",
                output_summary: "4 metrics returned",
                duration_ms: 2200,
              },
            ],
            timestamp: new Date(Date.now() - 50 * 3600000).toISOString(),
          },
          {
            role: "assistant",
            content:
              "Traffic spike detected: 9,420 pageviews (+340% vs 7-day average). Source: Reddit /r/netherlands post linking to /aanbod. Bounce rate elevated at 52% (expected for viral traffic). Conversion stable at 8.0%. No action needed — organic spike, no infrastructure strain.",
            timestamp: new Date(Date.now() - 50 * 3600000 + 41000).toISOString(),
          },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Error Monitor",
    description: "Scans errors table daily. Groups by type and severity, reports to GitHub.",
    is_active: true,
    trigger_label: "Every day at 8:30 AM",
    is_healthy: false,
    needs_action: false,
    last_run: {
      id: "r2",
      status: "success",
      started_at: new Date(Date.now() - 95 * 60000).toISOString(),
      finished_at: new Date(Date.now() - 92 * 60000).toISOString(),
      duration_s: 12,
      conversation: ERROR_MONITOR_CONVERSATION,
    },
    previous_runs: [
      {
        id: "r2b",
        status: "success",
        started_at: new Date(Date.now() - 25 * 3600000).toISOString(),
        finished_at: new Date(Date.now() - 25 * 3600000 + 8000).toISOString(),
        duration_s: 8,
        conversation: [
          {
            role: "assistant",
            content: "Starting daily error scan for huurmatcher.nl.",
            tool_calls: [
              {
                name: "SQL",
                input_summary: "SELECT * FROM errors WHERE created_at > now() - interval '24h'",
                output_summary: "0 rows",
                duration_ms: 210,
              },
            ],
            timestamp: new Date(Date.now() - 25 * 3600000).toISOString(),
          },
          {
            role: "assistant",
            content: "No new errors in the last 24 hours. All clear.",
            timestamp: new Date(Date.now() - 25 * 3600000 + 8000).toISOString(),
          },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "Issue Resolver",
    description: "Picks up GitHub issues, creates a worktree, analyzes, and opens a PR with a fix.",
    is_active: true,
    trigger_label: "On new GitHub issue",
    is_healthy: false,
    needs_action: true,
    action_label: "Fix ready on branch, but 2 tests need updating. Review the approach or update test expectations.",
    action_cta: "Review on GitHub",
    triggered_by: "Error Monitor",
    last_run: {
      id: "r3",
      status: "failure",
      started_at: new Date(Date.now() - 48 * 60000).toISOString(),
      finished_at: new Date(Date.now() - 45 * 60000).toISOString(),
      duration_s: 187,
      conversation: ISSUE_RESOLVER_CONVERSATION,
    },
    previous_runs: [
      {
        id: "r3b",
        status: "success",
        started_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        finished_at: new Date(Date.now() - 4 * 3600000 + 95000).toISOString(),
        duration_s: 95,
        conversation: [
          {
            role: "assistant",
            content: "Picking up issue #31: Broken image URLs on listing cards.",
            tool_calls: [
              { name: "Read", input_summary: "ListingCard.tsx", output_summary: "Read 89 lines", duration_ms: 35 },
              { name: "Grep", input_summary: '"image_url" in src/', output_summary: "8 matches", duration_ms: 80 },
            ],
            timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
          },
          {
            role: "assistant",
            content: "The image URLs use `http://` but the CDN requires `https://`. Simple protocol fix.",
            tool_calls: [
              {
                name: "Edit",
                input_summary: "ListingCard.tsx:23 — replace http:// with https://",
                output_summary: "File updated",
                duration_ms: 28,
              },
            ],
            timestamp: new Date(Date.now() - 4 * 3600000 + 60000).toISOString(),
          },
          {
            role: "assistant",
            content: "Fix applied. All tests pass. PR #42 opened and auto-merged.",
            tool_calls: [
              {
                name: "Bash",
                input_summary: "bun run test ListingCard",
                output_summary: "5 passed",
                duration_ms: 2800,
              },
            ],
            timestamp: new Date(Date.now() - 4 * 3600000 + 95000).toISOString(),
          },
        ],
      },
      {
        id: "r3c",
        status: "success",
        started_at: new Date(Date.now() - 28 * 3600000).toISOString(),
        finished_at: new Date(Date.now() - 28 * 3600000 + 140000).toISOString(),
        duration_s: 140,
        conversation: [
          {
            role: "assistant",
            content: "Picking up issue #29: Duplicate listings in search results.",
            tool_calls: [
              { name: "Read", input_summary: "SearchResults.tsx", output_summary: "Read 201 lines", duration_ms: 42 },
              {
                name: "SQL",
                input_summary: "SELECT id, COUNT(*) FROM listings GROUP BY listing_hash HAVING COUNT(*) > 1",
                output_summary: "3 duplicates found",
                duration_ms: 350,
              },
            ],
            timestamp: new Date(Date.now() - 28 * 3600000).toISOString(),
          },
          {
            role: "assistant",
            content:
              "Root cause: the sync job doesn't deduplicate by `listing_hash` before insert. Added a UNIQUE constraint and an ON CONFLICT clause.",
            tool_calls: [
              {
                name: "Edit",
                input_summary: "sync.ts:67 — added ON CONFLICT (listing_hash) DO UPDATE",
                output_summary: "File updated",
                duration_ms: 30,
              },
            ],
            timestamp: new Date(Date.now() - 28 * 3600000 + 100000).toISOString(),
          },
          {
            role: "assistant",
            content:
              "Fix applied. Tests pass. PR #38 opened and auto-merged. Existing duplicates cleaned up via migration.",
            timestamp: new Date(Date.now() - 28 * 3600000 + 140000).toISOString(),
          },
        ],
      },
    ],
  },
  {
    id: "4",
    name: "Weekly Performance Report",
    description: "Compiles weekly health summary and emails to team.",
    is_active: true,
    trigger_label: "Every Monday at 9:00 AM",
    is_healthy: true,
    needs_action: false,
    last_run: {
      id: "r4",
      status: "success",
      started_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      finished_at: new Date(Date.now() - 3 * 86400000 + 45000).toISOString(),
      duration_s: 45,
      conversation: WEEKLY_REPORT_CONVERSATION,
    },
    previous_runs: [],
  },
  {
    id: "5",
    name: "Listing Data Sync",
    description: "Syncs rental listings from external API. Updates search index.",
    is_active: false,
    trigger_label: "Every 6 hours",
    is_healthy: true,
    needs_action: false,
    last_run: null,
    previous_runs: [],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function durationStr(s: number): string {
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function agentSortKey(a: Agent): number {
  if (!a.is_active) return 100
  if (!a.last_run) return 50
  if (a.needs_action) return 0
  if (a.last_run.status === "failure") return 5
  if (!a.is_healthy) return 10
  return 50
}

function lastSummary(a: Agent): string {
  if (!a.last_run) return "No runs yet"
  const msgs = a.last_run.conversation.filter(m => m.role === "assistant")
  const last = msgs[msgs.length - 1]
  if (!last) return "No output"
  const firstLine = last.content.split("\n")[0] ?? ""
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}...` : firstLine
}

// ─── Briefing Components ────────────────────────────────────────────────────

function ActionCard({ agent, onSelect }: { agent: Agent; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left px-4 py-3.5 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/15 hover:bg-amber-50 dark:hover:bg-amber-950/25 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-[14px] font-semibold text-zinc-900 dark:text-white">{agent.name}</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
              {agent.last_run ? timeAgo(agent.last_run.started_at) : ""}
            </span>
          </div>
          <p className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{agent.action_label}</p>
        </div>
        {agent.action_cta && (
          <span className="shrink-0 text-[12px] font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg mt-0.5">
            {agent.action_cta}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Conversation Components ────────────────────────────────────────────────

function ToolCallBlock({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false)

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation()
        setOpen(!open)
      }}
      className="w-full text-left"
    >
      <div className="flex items-center gap-2 py-1 px-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
        <Terminal size={11} className="text-zinc-400 shrink-0" />
        <span className="text-[12px] font-mono text-zinc-500 dark:text-zinc-400">{call.name}</span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate flex-1">{call.input_summary}</span>
        <span className="text-[10px] text-zinc-300 dark:text-zinc-600 tabular-nums shrink-0">{call.duration_ms}ms</span>
        <ChevronRight size={10} className={`text-zinc-300 transition-transform ${open ? "rotate-90" : ""}`} />
      </div>
      {open && (
        <div className="mt-1 ml-5 px-2.5 py-1.5 text-[11px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/40 rounded-md">
          → {call.output_summary}
        </div>
      )}
    </button>
  )
}

function ConversationView({ messages }: { messages: ConversationMessage[] }) {
  return (
    <div className="space-y-5">
      {messages
        .filter(m => m.role === "assistant")
        .map((msg, i) => (
          <div key={i} className="space-y-2">
            <div className="text-[13.5px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={j} className="font-semibold text-zinc-900 dark:text-white">
                      {part.slice(2, -2)}
                    </strong>
                  )
                }
                return part.split(/(#\d+)/).map((sub, k) => {
                  if (/^#\d+$/.test(sub)) {
                    return (
                      <button
                        type="button"
                        key={k}
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium"
                      >
                        {sub}
                      </button>
                    )
                  }
                  return sub
                })
              })}
            </div>
            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div className="space-y-1.5">
                {msg.tool_calls.map((call, j) => (
                  <ToolCallBlock key={j} call={call} />
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────────

function runSummary(run: Run): string {
  const msgs = run.conversation.filter(m => m.role === "assistant")
  const last = msgs[msgs.length - 1]
  return last?.content ?? "No output"
}

function AgentDetailPanel({
  agent,
  run,
  runs,
  onSelectRun,
  onReview,
  onBack,
}: {
  agent: Agent
  run: Run | null
  runs: Run[]
  onSelectRun: (runId: string) => void
  onReview: (runId: string, verdict: "approved" | "flagged" | null) => void
  onBack: () => void
}) {
  const [showFull, setShowFull] = useState(false)

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw size={11} /> Re-run
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Edit3 size={11} /> Edit prompt
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {agent.is_active ? <Pause size={11} /> : <Play size={11} />}
              {agent.is_active ? "Pause" : "Resume"}
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{agent.name}</h2>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-lg">{agent.description}</p>
          </div>
          {run && (
            <div
              className={`text-xs px-2 py-1 rounded-md font-medium shrink-0 ${
                run.status === "success"
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : run.status === "failure"
                    ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                    : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              }`}
            >
              {run.status === "success" ? "Completed" : run.status === "failure" ? "Failed" : "Running"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mt-3 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {agent.trigger_label}
          </span>
          {agent.triggered_by && <span className="text-blue-500 dark:text-blue-400">Via {agent.triggered_by}</span>}
          {run && (
            <>
              <span className="tabular-nums">{timeAgo(run.started_at)}</span>
              <span className="tabular-nums">{durationStr(run.duration_s)}</span>
            </>
          )}
        </div>

        {/* Run pills */}
        {runs.length > 1 && (
          <div className="flex items-center gap-1.5 mt-3">
            {runs.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelectRun(r.id)
                  setShowFull(false)
                }}
                className={`h-7 px-3 rounded-lg text-[12px] font-medium tabular-nums transition-colors flex items-center gap-1.5 ${
                  run?.id === r.id
                    ? r.status === "failure"
                      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                      : r.status === "running"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {r.reviewed === "approved" && <Check size={10} />}
                {r.reviewed === "flagged" && <Flag size={10} />}
                {timeAgo(r.started_at)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {!run ? (
          <div className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">
            This agent hasn&apos;t run yet.
          </div>
        ) : showFull ? (
          <>
            <button
              type="button"
              onClick={() => setShowFull(false)}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-4"
            >
              <ArrowLeft size={11} /> Back to summary
            </button>
            <ConversationView messages={run.conversation} />
          </>
        ) : (
          <>
            {/* Review badge */}
            {run.reviewed && (
              <div
                className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-lg mb-4 ${
                  run.reviewed === "approved"
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                }`}
              >
                {run.reviewed === "approved" ? <Check size={12} /> : <Flag size={12} />}
                {run.reviewed === "approved" ? "Approved" : "Flagged"}
              </div>
            )}

            {/* Summary */}
            <div className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {runSummary(run)
                .split(/(\*\*.*?\*\*)/)
                .map((part, j) => {
                  if (part.startsWith("**") && part.endsWith("**")) {
                    return (
                      <strong key={j} className="font-semibold text-zinc-900 dark:text-white">
                        {part.slice(2, -2)}
                      </strong>
                    )
                  }
                  return part.split(/(#\d+)/).map((sub, k) => {
                    if (/^#\d+$/.test(sub)) {
                      return (
                        <button
                          type="button"
                          key={k}
                          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 font-medium"
                        >
                          {sub}
                        </button>
                      )
                    }
                    return sub
                  })
                })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/60">
              <button
                type="button"
                onClick={() => onReview(run.id, run.reviewed === "approved" ? null : "approved")}
                className={`flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
                  run.reviewed === "approved"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
                }`}
              >
                <ThumbsUp size={13} />
                Looks good
              </button>
              <button
                type="button"
                onClick={() => onReview(run.id, run.reviewed === "flagged" ? null : "flagged")}
                className={`flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-medium transition-colors ${
                  run.reviewed === "flagged"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 dark:hover:text-amber-400"
                }`}
              >
                <Flag size={13} />
                Flag
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowFull(true)}
                className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                <MessageSquare size={13} />
                Full conversation
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Agent Row ──────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  isSelected,
  unreviewedCount,
  onSelect,
}: {
  agent: Agent
  isSelected: boolean
  unreviewedCount: number
  onSelect: () => void
}) {
  const run = agent.last_run
  const isFailed = run?.status === "failure"

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800/60
        cursor-pointer px-4 h-[48px]
        ${isSelected ? "bg-zinc-100 dark:bg-zinc-800/40" : isFailed ? "bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50/60 dark:hover:bg-red-950/20" : "hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]"}
        ${!agent.is_active ? "opacity-40" : ""}
      `}
    >
      <div className="shrink-0 w-2">
        {!agent.is_active ? (
          <div className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        ) : isFailed ? (
          <div className="w-2 h-2 rounded-full bg-red-500" />
        ) : run?.status === "running" ? (
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-50" />
            <span className="relative w-2 h-2 rounded-full bg-blue-500" />
          </span>
        ) : !agent.is_healthy ? (
          <div className="w-2 h-2 rounded-full bg-amber-500" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate block">{agent.name}</span>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {unreviewedCount > 0 && (
          <span className="text-[10px] tabular-nums bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 w-4.5 h-4.5 flex items-center justify-center rounded-full">
            {unreviewedCount}
          </span>
        )}
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {run ? timeAgo(run.started_at) : "—"}
        </span>
      </div>
    </button>
  )
}

// ─── Right Panel: Briefing (default) ─────────────────────────────────────────

function BriefingPanel({ agents, onSelectAgent }: { agents: Agent[]; onSelectAgent: (id: string) => void }) {
  const actionItems = agents.filter(a => a.needs_action && a.is_active)
  const active = agents.filter(a => a.is_active)
  const ranToday = active.filter(a => {
    if (!a.last_run) return false
    return Date.now() - new Date(a.last_run.started_at).getTime() < 24 * 3600000
  })
  const allGood = actionItems.length === 0

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-8 pt-10 pb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Good morning</h2>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{SITE_NAME}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {/* Status */}
        <div className="flex items-center gap-3 mb-8">
          {allGood ? (
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
              <Check size={18} className="text-emerald-500" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{actionItems.length}</span>
            </div>
          )}
          <div>
            <p className="text-[15px] font-medium text-zinc-900 dark:text-white">
              {allGood
                ? "Everything looks good"
                : `${actionItems.length} ${actionItems.length === 1 ? "agent needs" : "agents need"} your attention`}
            </p>
            <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
              {ranToday.length} {ranToday.length === 1 ? "agent ran" : "agents ran"} in the last 24 hours
            </p>
          </div>
        </div>

        {/* Action items */}
        {actionItems.length > 0 && (
          <div className="space-y-2.5 mb-8">
            {actionItems.map(a => (
              <ActionCard key={a.id} agent={a} onSelect={() => onSelectAgent(a.id)} />
            ))}
          </div>
        )}

        {/* Recent activity */}
        <div>
          <h3 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
            Recent activity
          </h3>
          <div className="space-y-3">
            {agents
              .filter(a => a.is_active && a.last_run)
              .slice(0, 4)
              .map(agent => {
                const run = agent.last_run
                if (!run) return null
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className="w-full text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 shrink-0">
                        {run.status === "success" ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : run.status === "failure" ? (
                          <XCircle size={14} className="text-red-500" />
                        ) : (
                          <RefreshCw size={14} className="text-blue-500 animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-white">
                            {agent.name}
                          </span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                            {timeAgo(run.started_at)}
                          </span>
                        </div>
                        <p className="text-[12px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                          {lastSummary(agent)}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

function allRuns(agent: Agent): Run[] {
  const runs: Run[] = []
  if (agent.last_run) runs.push(agent.last_run)
  runs.push(...agent.previous_runs)
  return runs
}

export default function AgentsV4Page() {
  const [showEmpty, setShowEmpty] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [reviews, setReviews] = useState<Record<string, "approved" | "flagged" | null>>({})
  const agents = showEmpty ? [] : AGENTS

  const sorted = useMemo(() => [...agents].sort((a, b) => agentSortKey(a) - agentSortKey(b)), [agents])
  const selectedAgent = agents.find(a => a.id === selectedId) ?? null

  // Apply review state to runs
  function withReview(r: Run): Run {
    const verdict = reviews[r.id]
    return verdict !== undefined ? { ...r, reviewed: verdict } : r
  }

  // Resolve which run to show
  const selectedRun = selectedAgent
    ? (() => {
        const r = allRuns(selectedAgent).find(r => r.id === selectedRunId) ?? selectedAgent.last_run
        return r ? withReview(r) : null
      })()
    : null

  const runsWithReview = selectedAgent ? allRuns(selectedAgent).map(withReview) : []

  // Count unreviewed runs across all agents
  const unreviewedCount = agents.reduce((count, a) => {
    return count + allRuns(a).filter(r => !reviews[r.id] && r.status !== "running").length
  }, 0)

  function selectAgent(id: string) {
    if (selectedId === id) {
      setSelectedId(null)
      setSelectedRunId(null)
    } else {
      setSelectedId(id)
      const agent = agents.find(a => a.id === id)
      setSelectedRunId(agent?.last_run?.id ?? null)
    }
  }

  function handleReview(runId: string, verdict: "approved" | "flagged" | null) {
    setReviews(prev => ({ ...prev, [runId]: verdict }))
  }

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 overflow-hidden flex">
      {/* Sidebar — always visible */}
      <div className="w-[300px] shrink-0 flex flex-col border-r border-zinc-100 dark:border-zinc-800/60">
        <div className="shrink-0 px-4 pt-5 pb-2">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Agents</h1>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowEmpty(!showEmpty)}
                className="h-7 px-2 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {showEmpty ? "Show" : "Empty"}
              </button>
              <button
                type="button"
                className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">{SITE_NAME}</p>

          {/* Home tab */}
          <button
            type="button"
            onClick={() => {
              setSelectedId(null)
              setSelectedRunId(null)
            }}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              !selectedAgent
                ? "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-900 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <Zap size={14} />
            Home
            {unreviewedCount > 0 && (
              <span className="ml-auto text-[11px] tabular-nums bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-md">
                {unreviewedCount}
              </span>
            )}
          </button>
        </div>

        {/* Agent list */}
        {agents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
              <Zap size={16} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-white mb-1">No agents yet</p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">Create one to start automating.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {sorted.map(agent => {
              const unreviewed = allRuns(agent).filter(r => !reviews[r.id] && r.status !== "running").length
              return (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedId === agent.id}
                  unreviewedCount={unreviewed}
                  onSelect={() => selectAgent(agent.id)}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Right panel — briefing or agent detail */}
      <div className="flex-1 min-w-0">
        {selectedAgent ? (
          <AgentDetailPanel
            agent={selectedAgent}
            run={selectedRun}
            runs={runsWithReview}
            onSelectRun={runId => setSelectedRunId(runId)}
            onReview={handleReview}
            onBack={() => {
              setSelectedId(null)
              setSelectedRunId(null)
            }}
          />
        ) : (
          <BriefingPanel agents={agents} onSelectAgent={id => selectAgent(id)} />
        )}
      </div>
    </div>
  )
}
