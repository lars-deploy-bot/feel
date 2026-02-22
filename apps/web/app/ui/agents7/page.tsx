"use client"

/**
 * 2029.
 *
 * There are no agents. There is no orchestration layer.
 * You open the page and see what's happening. Work that
 * was done is already there. You don't ask — you look.
 *
 * When you want something, you say it. But you never
 * have to say anything to see what happened.
 *
 * It's a newspaper that writes itself.
 */

import {
  ArrowUp,
  Check,
  ExternalLink,
  TrendingDown,
  TrendingUp,
  Minus,
  Zap,
  FlaskConical,
  Wrench,
  BarChart3,
} from "lucide-react"
import { useState } from "react"

// ─── Types ──────────────────────────────────────────────────────────────────

type Metric = {
  label: string
  value: string
  change: string
  trend: "up" | "down" | "flat"
}

type Entry = {
  id: string
  kind: "fix" | "experiment" | "optimization" | "insight" | "you"
  title: string
  body: string
  timestamp: string
  link?: { label: string; href: string }
  live?: boolean // still in progress
}

// ─── Data ───────────────────────────────────────────────────────────────────

const METRICS: Metric[] = [
  { label: "Revenue", value: "€4,280", change: "+11%", trend: "up" },
  { label: "Leads", value: "342", change: "+5%", trend: "up" },
  { label: "Conversion", value: "8.1%", change: "-0.1%", trend: "flat" },
  { label: "P95 latency", value: "180ms", change: "-25%", trend: "up" },
  { label: "Errors", value: "0", change: "−3", trend: "up" },
]

const ENTRIES: Entry[] = [
  {
    id: "e1",
    kind: "experiment",
    title: "CTA A/B test running",
    body: "Testing 3 CTA placements on /aanbod: sticky bottom bar, inline after first listing, side panel. 6 hours in — sticky bar winning by 0.8%, not significant yet. Need ~18 more hours. Will ship automatically if a winner clears 1%.",
    timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    live: true,
  },
  {
    id: "e2",
    kind: "optimization",
    title: "Search 3x faster on mobile",
    body: "Listing images were served at desktop resolution. Added responsive srcset + lazy loading. P95 dropped from 1.2s to 180ms.",
    timestamp: new Date(Date.now() - 55 * 60000).toISOString(),
    link: { label: "Diff", href: "#" },
  },
  {
    id: "e3",
    kind: "fix",
    title: "Rolled back CTA regression",
    body: "CSS refactor on Tuesday shifted the CTA below the fold on mobile. Conversion dropped 12%. Rolled back. Recovered to 8.0% within 90 minutes.",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    link: { label: "Commit", href: "#" },
  },
  {
    id: "e4",
    kind: "fix",
    title: "Fixed SearchFilters crash",
    body: "TypeError in SearchFilters.tsx — 12 occurrences since last deploy. `filters` was undefined during loading. Added guard clause + loading skeleton. Tests updated and passing.",
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    link: { label: "PR #43", href: "#" },
  },
  {
    id: "e5",
    kind: "fix",
    title: "Fixed 504 timeouts on /api/matches",
    body: "Connection pool was sized at 10, peak concurrent queries hit 14 during rush hours. Increased to 25 with idle timeout. No 504s since.",
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    link: { label: "PR #44", href: "#" },
  },
  {
    id: "e6",
    kind: "insight",
    title: "Weekly report sent",
    body: "Week 8: 18.4k sessions (+8%), 240ms avg response, 99.7% uptime, 342 leads (+5%). Sent to team.",
    timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "e7",
    kind: "fix",
    title: "Fixed broken listing images",
    body: "Image URLs used http:// but CDN requires https://. One-line fix.",
    timestamp: new Date(Date.now() - 4 * 86400000).toISOString(),
    link: { label: "PR #42", href: "#" },
  },
  {
    id: "e8",
    kind: "optimization",
    title: "Deduplicated search results",
    body: "Sync job wasn't deduplicating by listing_hash. Added UNIQUE constraint + ON CONFLICT clause. Cleaned up 3 existing dupes.",
    timestamp: new Date(Date.now() - 5 * 86400000).toISOString(),
    link: { label: "PR #38", href: "#" },
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
  const days = Math.floor(h / 24)
  if (days === 1) return "yesterday"
  return `${days}d ago`
}

const ENTRY_ICON = {
  fix: Wrench,
  experiment: FlaskConical,
  optimization: Zap,
  insight: BarChart3,
  you: ArrowUp,
}

const ENTRY_COLOR = {
  fix: "text-emerald-500",
  experiment: "text-violet-500",
  optimization: "text-blue-500",
  insight: "text-zinc-400 dark:text-zinc-500",
  you: "text-zinc-900 dark:text-white",
}

// ─── Components ─────────────────────────────────────────────────────────────

function MetricCard({ metric }: { metric: Metric }) {
  const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : Minus
  const trendColor =
    metric.trend === "up" ? "text-emerald-500" : metric.trend === "down" ? "text-red-500" : "text-zinc-400"

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{metric.label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[18px] font-semibold text-zinc-900 dark:text-white tabular-nums">{metric.value}</span>
        <span className={`text-[11px] font-medium tabular-nums flex items-center gap-0.5 ${trendColor}`}>
          <TrendIcon size={10} />
          {metric.change}
        </span>
      </div>
    </div>
  )
}

function EntryCard({ entry }: { entry: Entry }) {
  const Icon = ENTRY_ICON[entry.kind]
  const color = ENTRY_COLOR[entry.kind]

  return (
    <div className={`flex gap-3.5 ${entry.kind === "you" ? "pl-8" : ""}`}>
      <div className={`mt-1 shrink-0 ${color}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{entry.title}</span>
          {entry.live && (
            <span className="text-[10px] font-medium text-violet-500 bg-violet-50 dark:bg-violet-950/30 px-1.5 py-0.5 rounded">
              live
            </span>
          )}
          <span className="text-[11px] text-zinc-300 dark:text-zinc-600 tabular-nums ml-auto shrink-0">
            {timeAgo(entry.timestamp)}
          </span>
        </div>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-1">{entry.body}</p>
        {entry.link && (
          <a
            href={entry.link.href}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-blue-500 hover:text-blue-600 dark:text-blue-400 mt-1.5"
          >
            {entry.link.label}
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Agents7Page() {
  const [entries, setEntries] = useState(ENTRIES)
  const [input, setInput] = useState("")

  function handleSend() {
    const text = input.trim()
    if (!text) return

    setEntries(prev => [
      {
        id: `e-${Date.now()}`,
        kind: "you",
        title: text,
        body: "On it.",
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ])
    setInput("")
  }

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold text-zinc-900 dark:text-white">FreezeFood</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[12px] text-zinc-400 dark:text-zinc-500">All systems healthy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Metrics — always visible, no asking required */}
          <div className="flex items-start gap-8 mb-10 pb-8 border-b border-zinc-100 dark:border-zinc-800/60">
            {METRICS.map(m => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>

          {/* Direction input */}
          <div className="mb-10 relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleSend()
              }}
              placeholder="What should we work on?"
              className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 pr-11 text-[14px] text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-white/10 focus:border-zinc-300 dark:focus:border-zinc-600"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center disabled:opacity-20 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
            >
              <ArrowUp size={14} className="text-white dark:text-zinc-900" />
            </button>
          </div>

          {/* Feed — work that's been done, just there */}
          <div className="space-y-6">
            {entries.map(entry => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
