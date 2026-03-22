/**
 * Shared display helpers for automation/agent UIs.
 *
 * These were duplicated across workbench agents, settings, and prototype pages.
 * Import from here instead of re-implementing.
 */

import { describeCron } from "@/lib/automation/cron-description"

/** Format a past ISO date as a relative time string ("now", "5m ago", "3h ago", "2d ago") */
export function relTime(d: string | null): string {
  if (!d) return "—"
  const ms = Date.now() - new Date(d).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString()
}

/** Format a future ISO date as a relative time string ("in 5m", "in 3h", "overdue") */
export function futTime(d: string | null): string {
  if (!d) return "—"
  const ms = new Date(d).getTime() - Date.now()
  if (ms < 0) return "overdue"
  const m = Math.floor(ms / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}

/** Format a duration in milliseconds as a compact string ("120ms", "4s", "2m 30s") */
export function dur(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(0)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

/** Minimal shape needed by trigLabel */
interface TrigLabelInput {
  trigger_type: string
  cron_schedule: string | null
  email_address?: string | null
}

/**
 * Human-readable trigger label. Converts cron to natural language.
 * Users never see raw cron expressions.
 */
export function trigLabel(a: TrigLabelInput): string {
  if (a.trigger_type === "email") return a.email_address ?? "On email"
  if (a.trigger_type === "webhook") return "Webhook"
  if (a.trigger_type === "one-time") return "One-time"
  if (!a.cron_schedule) return "—"
  return describeCron(a.cron_schedule)
}

/**
 * Timeout in minutes from seconds. Defaults to 5.
 */
export function timeoutMinutes(seconds: number | null | undefined): number {
  if (!seconds) return 5
  return Math.round(seconds / 60)
}

/** Minimal shape needed by healthScore */
interface HealthScoreInput {
  is_active: boolean
  last_run_status: string | null
  status?: string
  success_rate?: number
}

/**
 * Health score for sorting agents (lower = needs attention first).
 * 0 = failure, 10 = running, 50-100 = healthy, 100 = paused
 */
export function healthScore(a: HealthScoreInput): number {
  if (!a.is_active) return 100
  if (a.last_run_status === "failure") return 0
  if (a.last_run_status === "running" || a.status === "running") return 10
  return 50 + (a.success_rate ?? 0) * 0.5
}
