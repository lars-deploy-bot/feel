"use client"

/**
 * Agents V6 — Self-orchestrating teams
 *
 * Agents form teams. Teams own goals. Agents within a team
 * delegate to each other, spin up sub-agents, and resolve
 * dependencies without human intervention.
 *
 * The human sets goals and watches progress.
 * They intervene only when a team is stuck or wants approval
 * for something irreversible.
 */

import { ArrowUp, Check, ChevronDown, ChevronRight, Circle, Loader2, Lock, Users } from "lucide-react"
import { useRef, useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentNode = {
  name: string
  status: "working" | "done" | "idle" | "blocked"
  task: string | null
}

type GoalStatus = "active" | "done" | "blocked"

type Approval = {
  id: string
  label: string
  detail: string
  risk: "low" | "high"
}

type TeamEvent = {
  agent: string
  content: string
  timestamp: string
}

type Goal = {
  id: string
  title: string
  status: GoalStatus
  team: string
  agents: AgentNode[]
  progress: string
  approval: Approval | null
  events: TeamEvent[]
  started_at: string
  finished_at: string | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

const SITE_NAME = "huurmatcher.nl"

const GOALS: Goal[] = [
  {
    id: "g1",
    title: "Fix SearchFilters crash and deploy",
    status: "blocked",
    team: "Bug Squad",
    agents: [
      { name: "Error Monitor", status: "done", task: null },
      { name: "Issue Resolver", status: "done", task: null },
      { name: "Test Runner", status: "done", task: null },
      { name: "Deploy Agent", status: "blocked", task: "Waiting for deploy approval" },
    ],
    progress: "Fix ready, tests pass. Awaiting deploy approval.",
    approval: {
      id: "a1",
      label: "Deploy fix for #35 to production",
      detail: "Branch fix/search-filters-type-error. 1 file changed, 2 tests updated. All CI green.",
      risk: "low",
    },
    events: [
      {
        agent: "Error Monitor",
        content: "Detected TypeError in SearchFilters.tsx — 12 occurrences since last deploy. Filed #35.",
        timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
      },
      {
        agent: "Error Monitor",
        content: "Delegated #35 to Issue Resolver.",
        timestamp: new Date(Date.now() - 88 * 60000).toISOString(),
      },
      {
        agent: "Issue Resolver",
        content: "Root cause: `filters` is undefined during loading. Fix: guard clause + loading skeleton.",
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      },
      {
        agent: "Issue Resolver",
        content: "2 tests fail with old expectations. Updating tests to match new loading behavior.",
        timestamp: new Date(Date.now() - 55 * 60000).toISOString(),
      },
      {
        agent: "Issue Resolver",
        content: "Fix complete. Handing off to Test Runner.",
        timestamp: new Date(Date.now() - 50 * 60000).toISOString(),
      },
      {
        agent: "Test Runner",
        content: "Full suite: 142 passed, 0 failed. Handing off to Deploy Agent.",
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      },
      {
        agent: "Deploy Agent",
        content: "Ready to deploy. Requesting approval — this is a production deploy.",
        timestamp: new Date(Date.now() - 44 * 60000).toISOString(),
      },
    ],
    started_at: new Date(Date.now() - 90 * 60000).toISOString(),
    finished_at: null,
  },
  {
    id: "g2",
    title: "Investigate /aanbod conversion drop",
    status: "active",
    team: "Growth",
    agents: [
      { name: "Analytics", status: "done", task: null },
      { name: "Experiment Agent", status: "working", task: "Running A/B test on CTA placement" },
    ],
    progress: "CTA drop identified. A/B test running — 2h remaining.",
    approval: null,
    events: [
      {
        agent: "Analytics",
        content:
          "Conversion on /aanbod down 12% since deploy 2 days ago. Funnel analysis: drop between page view → CTA click.",
        timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
      },
      {
        agent: "Analytics",
        content:
          "Likely cause: CTA position shifted below fold on mobile after CSS refactor. Delegating to Experiment Agent.",
        timestamp: new Date(Date.now() - 3 * 3600000 + 60000).toISOString(),
      },
      {
        agent: "Experiment Agent",
        content:
          "Created A/B test: original CTA position vs current. Splitting 50/50. Need ~4h of traffic for significance.",
        timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
    ],
    started_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    finished_at: null,
  },
  {
    id: "g3",
    title: "Resolve 504 timeouts on /api/matches",
    status: "active",
    team: "Infra",
    agents: [
      { name: "Error Monitor", status: "done", task: null },
      { name: "Perf Agent", status: "working", task: "Profiling DB connection pool under load" },
      { name: "Issue Resolver", status: "idle", task: null },
    ],
    progress: "Profiling in progress. Connection pool may be undersized.",
    approval: null,
    events: [
      {
        agent: "Error Monitor",
        content: "3 x 504 Gateway Timeout on /api/matches during peak hours. Filed #36.",
        timestamp: new Date(Date.now() - 80 * 60000).toISOString(),
      },
      {
        agent: "Perf Agent",
        content: "Picked up #36. Running load test to reproduce. Checking DB connection pool config.",
        timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
      },
      {
        agent: "Perf Agent",
        content: "Pool size is 10, peak concurrent queries hit 14. Likely cause confirmed. Preparing fix.",
        timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
      },
    ],
    started_at: new Date(Date.now() - 80 * 60000).toISOString(),
    finished_at: null,
  },
  {
    id: "g4",
    title: "Weekly performance report",
    status: "done",
    team: "Ops",
    agents: [
      { name: "Analytics", status: "done", task: null },
      { name: "Report Agent", status: "done", task: null },
    ],
    progress: "Report compiled and sent to team.",
    approval: null,
    events: [
      {
        agent: "Analytics",
        content: "Pulled weekly aggregates from PostHog + error counts.",
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
      {
        agent: "Report Agent",
        content: "Week 8 report sent to lars@, team@, dev@huurmatcher.nl.",
        timestamp: new Date(Date.now() - 3 * 86400000 + 60000).toISOString(),
      },
    ],
    started_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    finished_at: new Date(Date.now() - 3 * 86400000 + 60000).toISOString(),
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Components ─────────────────────────────────────────────────────────────

function AgentChip({ agent }: { agent: AgentNode }) {
  return (
    <div className="flex items-center gap-1.5" title={agent.task ?? undefined}>
      {agent.status === "working" ? (
        <Loader2 size={10} className="text-blue-500 animate-spin" />
      ) : agent.status === "done" ? (
        <Check size={10} className="text-emerald-500" />
      ) : agent.status === "blocked" ? (
        <Lock size={10} className="text-amber-500" />
      ) : (
        <Circle size={10} className="text-zinc-300 dark:text-zinc-600" />
      )}
      <span
        className={`text-[11px] font-medium ${
          agent.status === "working"
            ? "text-blue-600 dark:text-blue-400"
            : agent.status === "blocked"
              ? "text-amber-600 dark:text-amber-400"
              : agent.status === "done"
                ? "text-zinc-400 dark:text-zinc-500"
                : "text-zinc-400 dark:text-zinc-500"
        }`}
      >
        {agent.name}
      </span>
    </div>
  )
}

function GoalCard({
  goal,
  onApprove,
  onDismiss,
}: {
  goal: Goal
  onApprove: (goalId: string) => void
  onDismiss: (goalId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`rounded-xl border transition-colors ${
        goal.status === "blocked"
          ? "border-amber-200/70 dark:border-amber-800/40 bg-amber-50/20 dark:bg-amber-950/5"
          : goal.status === "done"
            ? "border-zinc-100 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-zinc-900/20 opacity-60"
            : "border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/30"
      }`}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {goal.status === "done" ? (
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Check size={11} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            ) : goal.status === "blocked" ? (
              <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock size={11} className="text-amber-600 dark:text-amber-400" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Loader2 size={11} className="text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-snug">{goal.title}</h3>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">{goal.progress}</p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500">
              <Users size={11} />
              <span>{goal.team}</span>
            </div>
            <span className="text-[11px] text-zinc-300 dark:text-zinc-600 tabular-nums">
              {timeAgo(goal.started_at)}
            </span>
          </div>
        </div>

        {/* Agent chips */}
        <div className="flex items-center gap-3 mt-3 ml-8">
          {goal.agents.map(a => (
            <AgentChip key={a.name} agent={a} />
          ))}
        </div>
      </div>

      {/* Approval block */}
      {goal.approval && (
        <div className="mx-5 mb-3 px-4 py-3 rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <Lock size={13} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-zinc-900 dark:text-white">{goal.approval.label}</p>
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-0.5">{goal.approval.detail}</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onApprove(goal.id)}
                  className="h-7 px-3 rounded-lg text-[12px] font-medium bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(goal.id)}
                  className="h-7 px-3 rounded-lg text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-5 py-2.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 border-t border-zinc-100 dark:border-zinc-800/40 transition-colors"
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {goal.events.length} events
      </button>

      {/* Event log */}
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {goal.events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-px h-full" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{ev.agent}</span>
                  <span className="text-[10px] text-zinc-300 dark:text-zinc-600 tabular-nums">
                    {timeAgo(ev.timestamp)}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{ev.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DirectionInput({ onSend }: { onSend: (msg: string) => void }) {
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue("")
  }

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Set a new goal..."
        rows={1}
        className="w-full resize-none rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 pr-12 text-[14px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-300 dark:focus:border-zinc-600"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center disabled:opacity-30 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
      >
        <ArrowUp size={14} className="text-white dark:text-zinc-900" />
      </button>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AgentsV6Page() {
  const [goals, setGoals] = useState(GOALS)

  const blocked = goals.filter(g => g.status === "blocked")
  const active = goals.filter(g => g.status === "active")
  const done = goals.filter(g => g.status === "done")

  const allAgents = goals.flatMap(g => g.agents)
  const workingCount = allAgents.filter(a => a.status === "working").length
  const totalAgents = new Set(allAgents.map(a => a.name)).size

  function handleApprove(goalId: string) {
    setGoals(prev =>
      prev.map(g => {
        if (g.id !== goalId) return g
        return {
          ...g,
          status: "active" as const,
          approval: null,
          progress: "Deploying...",
          agents: g.agents.map(a =>
            a.status === "blocked" ? { ...a, status: "working" as const, task: "Deploying to production" } : a,
          ),
          events: [
            ...g.events,
            { agent: "You", content: "Approved deploy.", timestamp: new Date().toISOString() },
            { agent: "Deploy Agent", content: "Starting production deploy...", timestamp: new Date().toISOString() },
          ],
        }
      }),
    )
  }

  function handleDismiss(goalId: string) {
    setGoals(prev =>
      prev.map(g => {
        if (g.id !== goalId) return g
        return {
          ...g,
          approval: null,
          agents: g.agents.map(a => (a.status === "blocked" ? { ...a, status: "idle" as const, task: null } : a)),
          events: [...g.events, { agent: "You", content: "Deferred deploy.", timestamp: new Date().toISOString() }],
        }
      }),
    )
  }

  function handleNewGoal(text: string) {
    const newGoal: Goal = {
      id: `g-${Date.now()}`,
      title: text,
      status: "active",
      team: "Auto",
      agents: [{ name: "Coordinator", status: "working", task: "Analyzing goal and assembling team" }],
      progress: "Assembling team...",
      approval: null,
      events: [
        { agent: "You", content: `New goal: "${text}"`, timestamp: new Date().toISOString() },
        {
          agent: "Coordinator",
          content: "Analyzing goal and determining required agents.",
          timestamp: new Date().toISOString(),
        },
      ],
      started_at: new Date().toISOString(),
      finished_at: null,
    }
    setGoals(prev => [newGoal, ...prev])
  }

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-zinc-900 dark:text-white">{SITE_NAME}</h1>
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500">
            {workingCount} agents working across {active.length + blocked.length} goals
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-zinc-400 dark:text-zinc-500">
          <span>{totalAgents} agents</span>
          <span>{goals.length} goals</span>
          {blocked.length > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Lock size={10} />
              {blocked.length} needs you
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* New goal input */}
          <div className="mb-10">
            <DirectionInput onSend={handleNewGoal} />
          </div>

          {/* Blocked goals first */}
          {blocked.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-3">Needs you</h2>
              <div className="space-y-3">
                {blocked.map(g => (
                  <GoalCard key={g.id} goal={g} onApprove={handleApprove} onDismiss={handleDismiss} />
                ))}
              </div>
            </div>
          )}

          {/* Active goals */}
          {active.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                In progress
              </h2>
              <div className="space-y-3">
                {active.map(g => (
                  <GoalCard key={g.id} goal={g} onApprove={handleApprove} onDismiss={handleDismiss} />
                ))}
              </div>
            </div>
          )}

          {/* Done goals */}
          {done.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                Completed
              </h2>
              <div className="space-y-3">
                {done.map(g => (
                  <GoalCard key={g.id} goal={g} onApprove={handleApprove} onDismiss={handleDismiss} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
