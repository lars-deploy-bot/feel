"use client"

/**
 * Agents V5 — Team mode
 *
 * Agents are reliable. You don't check their work.
 * You give direction, they execute. When they need you,
 * they ask. Otherwise, they just work.
 *
 * The human is a team lead, not a reviewer.
 */

import { ArrowUp, Check, ChevronRight, Loader2, MessageSquare } from "lucide-react"
import { useRef, useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Decision = {
  id: string
  agent: string
  question: string
  context: string
  options: { label: string; description: string }[]
  created_at: string
}

type ActivityItem = {
  id: string
  agent: string
  content: string
  type: "done" | "started" | "decision" | "info"
  timestamp: string
}

type AgentStatus = {
  id: string
  name: string
  status: "working" | "idle" | "waiting"
  current_task: string | null
  last_completed: string | null
  last_completed_at: string | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

const SITE_NAME = "huurmatcher.nl"

const AGENTS: AgentStatus[] = [
  {
    id: "1",
    name: "Analytics",
    status: "idle",
    current_task: null,
    last_completed: "Daily report sent",
    last_completed_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "2",
    name: "Error Monitor",
    status: "working",
    current_task: "Investigating 504 timeouts on /api/matches",
    last_completed: "Filed #35 — SearchFilters TypeError",
    last_completed_at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: "3",
    name: "Issue Resolver",
    status: "working",
    current_task: "Fixing #35 — SearchFilters TypeError",
    last_completed: "Merged fix for #31 — broken image URLs",
    last_completed_at: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "4",
    name: "Deploy Agent",
    status: "waiting",
    current_task: null,
    last_completed: "Deployed v2.4.1 to production",
    last_completed_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: "5",
    name: "Performance",
    status: "idle",
    current_task: null,
    last_completed: "Optimized /zoeken — 240ms → 180ms",
    last_completed_at: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
]

const DECISIONS: Decision[] = [
  {
    id: "d1",
    agent: "Issue Resolver",
    question: "The fix for #35 changes test expectations. How should I handle the 2 failing tests?",
    context:
      "SearchFilters.tsx crashes when `filters` is undefined during loading. My fix adds a guard clause with a loading skeleton. But 2 tests expect the old (broken) behavior.",
    options: [
      { label: "Update tests", description: "Change test expectations to match the new loading skeleton behavior" },
      { label: "Keep tests, different fix", description: "I'll find a fix that preserves the existing test contract" },
      { label: "Skip tests for now", description: "Merge with failing tests, create follow-up issue" },
    ],
    created_at: new Date(Date.now() - 12 * 60000).toISOString(),
  },
  {
    id: "d2",
    agent: "Deploy Agent",
    question: "3 PRs are ready to ship. Deploy together or separately?",
    context:
      "#35 fix (SearchFilters), #36 fix (API timeout pool size), and the /aanbod CTA experiment. All tests pass on their branches.",
    options: [
      { label: "Ship together", description: "One deploy, faster. Rollback is all-or-nothing" },
      { label: "Ship separately", description: "Three deploys, slower. Each can be rolled back independently" },
    ],
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
]

const ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    agent: "Issue Resolver",
    content: "Started working on #35 — SearchFilters TypeError",
    type: "started",
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: "a2",
    agent: "Error Monitor",
    content: "Filed #36 — 504 timeouts on /api/matches (3 occurrences, likely connection pool)",
    type: "done",
    timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
  },
  {
    id: "a3",
    agent: "Error Monitor",
    content: "Filed #35 — SearchFilters TypeError (12 occurrences since last deploy)",
    type: "done",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: "a4",
    agent: "Analytics",
    content: "Conversion on /aanbod dropped 12% since last deploy. Created #34.",
    type: "done",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "a5",
    agent: "Issue Resolver",
    content: "Merged fix for #31 — broken image URLs. PR #42 auto-merged.",
    type: "done",
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "a6",
    agent: "Deploy Agent",
    content: "Deployed v2.4.1 to production. Zero-downtime. All health checks pass.",
    type: "done",
    timestamp: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: "a7",
    agent: "Performance",
    content: "Optimized /zoeken query — avg response 240ms → 180ms. Added DB index on listing_hash.",
    type: "done",
    timestamp: new Date(Date.now() - 18 * 3600000).toISOString(),
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

function StatusDot({ status }: { status: AgentStatus["status"] }) {
  if (status === "working") {
    return (
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-40" />
        <span className="relative w-2 h-2 rounded-full bg-blue-500" />
      </span>
    )
  }
  if (status === "waiting") {
    return <span className="w-2 h-2 rounded-full bg-amber-500" />
  }
  return <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
}

function TeamBar({ agents }: { agents: AgentStatus[] }) {
  const working = agents.filter(a => a.status === "working")
  const waiting = agents.filter(a => a.status === "waiting")

  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/60">
      <div className="flex items-center gap-3">
        {agents.map(a => (
          <div
            key={a.id}
            className="flex items-center gap-1.5 group"
            title={a.current_task ?? a.last_completed ?? "Idle"}
          >
            <StatusDot status={a.status} />
            <span
              className={`text-[12px] font-medium ${
                a.status === "working"
                  ? "text-zinc-700 dark:text-zinc-300"
                  : a.status === "waiting"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {a.name}
            </span>
          </div>
        ))}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3 text-[11px] text-zinc-400 dark:text-zinc-500">
        {working.length > 0 && <span>{working.length} working</span>}
        {waiting.length > 0 && <span className="text-amber-500">{waiting.length} waiting</span>}
      </div>
    </div>
  )
}

function DecisionCard({
  decision,
  onDecide,
}: {
  decision: Decision
  onDecide: (decisionId: string, optionIndex: number) => void
}) {
  return (
    <div className="rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-[12px] font-medium text-amber-600 dark:text-amber-400">{decision.agent}</span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {timeAgo(decision.created_at)}
        </span>
      </div>
      <p className="text-[15px] font-semibold text-zinc-900 dark:text-white leading-snug mb-2">{decision.question}</p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">{decision.context}</p>
      <div className="space-y-2">
        {decision.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onDecide(decision.id, i)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium text-zinc-900 dark:text-white group-hover:text-zinc-900 dark:group-hover:text-white">
                {opt.label}
              </span>
              <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5">{opt.description}</p>
            </div>
            <ChevronRight
              size={14}
              className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400 dark:group-hover:text-zinc-500 shrink-0"
            />
          </button>
        ))}
      </div>
    </div>
  )
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex items-start gap-3 py-2.5 px-1">
          <div className="mt-1.5 shrink-0">
            {item.type === "done" ? (
              <Check size={12} className="text-emerald-500" />
            ) : item.type === "started" ? (
              <Loader2 size={12} className="text-blue-500 animate-spin" />
            ) : (
              <MessageSquare size={12} className="text-amber-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">{item.agent}</span>
              <span className="text-[11px] text-zinc-300 dark:text-zinc-600 tabular-nums">
                {timeAgo(item.timestamp)}
              </span>
            </div>
            <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-0.5 leading-relaxed">{item.content}</p>
          </div>
        </div>
      ))}
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
        placeholder="Give direction to your team..."
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

export default function AgentsV5Page() {
  const [decisions, setDecisions] = useState(DECISIONS)
  const [activity, setActivity] = useState(ACTIVITY)
  const [agents, setAgents] = useState(AGENTS)

  function handleDecide(decisionId: string, optionIndex: number) {
    const decision = decisions.find(d => d.id === decisionId)
    if (!decision) return
    const chosen = decision.options[optionIndex]

    // Remove from decisions
    setDecisions(prev => prev.filter(d => d.id !== decisionId))

    // Add to activity
    setActivity(prev => [
      {
        id: `a-decision-${decisionId}`,
        agent: decision.agent,
        content: `You decided: "${chosen?.label}". Continuing.`,
        type: "started" as const,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ])

    // If deploy agent was waiting, start it
    if (decision.agent === "Deploy Agent") {
      setAgents(prev =>
        prev.map(a =>
          a.id === "4" ? { ...a, status: "working" as const, current_task: `Deploying: ${chosen?.label}` } : a,
        ),
      )
    }
  }

  function handleDirection(msg: string) {
    // Add as activity
    setActivity(prev => [
      {
        id: `a-direction-${Date.now()}`,
        agent: "You",
        content: msg,
        type: "info" as const,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ])
  }

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Team bar */}
      <TeamBar agents={agents} />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{SITE_NAME}</h1>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
              {agents.filter(a => a.status === "working").length} agents working
              {decisions.length > 0 &&
                ` · ${decisions.length} ${decisions.length === 1 ? "decision" : "decisions"} pending`}
            </p>
          </div>

          {/* Decisions */}
          {decisions.length > 0 && (
            <div className="space-y-4 mb-10">
              <h2 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Waiting for you
              </h2>
              {decisions.map(d => (
                <DecisionCard key={d.id} decision={d} onDecide={handleDecide} />
              ))}
            </div>
          )}

          {/* Direction input */}
          <div className="mb-10">
            <DirectionInput onSend={handleDirection} />
          </div>

          {/* Activity */}
          <div>
            <h2 className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
              Activity
            </h2>
            <ActivityFeed items={activity} />
          </div>
        </div>
      </div>
    </div>
  )
}
