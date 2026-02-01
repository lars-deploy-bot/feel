/**
 * @webalive/automation - Cron scheduler for automation jobs
 *
 * Uses croner for cron expression parsing (same as OpenClaw).
 * Provides functions for computing next run times and managing job schedules.
 */

import { Cron } from "croner"
import type { AutomationJob, AutomationSchedule } from "./types.js"

// ============================================
// Schedule Computation
// ============================================

/**
 * Compute the next run time for a given schedule
 *
 * @param schedule - The schedule configuration
 * @param nowMs - Current timestamp in milliseconds
 * @returns Next run timestamp in milliseconds, or undefined if no future run
 */
export function computeNextRunAtMs(schedule: AutomationSchedule, nowMs: number): number | undefined {
  if (schedule.kind === "at") {
    // One-time: only run if still in the future
    return schedule.atMs > nowMs ? schedule.atMs : undefined
  }

  if (schedule.kind === "every") {
    // Interval: compute next occurrence from anchor
    const everyMs = Math.max(1, Math.floor(schedule.everyMs))
    const anchor = Math.max(0, Math.floor(schedule.anchorMs ?? nowMs))

    if (nowMs < anchor) {
      return anchor
    }

    const elapsed = nowMs - anchor
    const steps = Math.max(1, Math.floor((elapsed + everyMs - 1) / everyMs))
    return anchor + steps * everyMs
  }

  // Cron expression
  const expr = schedule.expr.trim()
  if (!expr) {
    return undefined
  }

  try {
    const cron = new Cron(expr, {
      timezone: schedule.tz?.trim() || undefined,
      catch: false,
    })
    const next = cron.nextRun(new Date(nowMs))
    return next ? next.getTime() : undefined
  } catch {
    // Invalid cron expression
    return undefined
  }
}

/**
 * Compute the next run time for a job considering its state
 */
export function computeJobNextRunAtMs(job: AutomationJob, nowMs: number): number | undefined {
  if (!job.isActive) {
    return undefined
  }

  if (job.schedule.kind === "at") {
    // One-shot jobs stay due until they successfully finish
    if (job.state.lastStatus === "success" && job.state.lastRunAtMs) {
      return undefined
    }
    return job.schedule.atMs
  }

  return computeNextRunAtMs(job.schedule, nowMs)
}

/**
 * Check if a job is due for execution
 */
export function isJobDue(job: AutomationJob, nowMs: number, opts: { forced?: boolean } = {}): boolean {
  if (opts.forced) {
    return true
  }

  if (!job.isActive) {
    return false
  }

  // Skip if already running
  if (typeof job.state.runningAtMs === "number") {
    return false
  }

  const next = job.state.nextRunAtMs
  return typeof next === "number" && nowMs >= next
}

/**
 * Find the next wake time across all jobs
 */
export function nextWakeAtMs(jobs: AutomationJob[]): number | undefined {
  const enabled = jobs.filter(j => j.isActive && typeof j.state.nextRunAtMs === "number")

  if (enabled.length === 0) {
    return undefined
  }

  return enabled.reduce(
    (min, j) => Math.min(min, j.state.nextRunAtMs as number),
    enabled[0].state.nextRunAtMs as number,
  )
}

// ============================================
// State Management
// ============================================

/** Threshold for detecting stuck jobs (2 hours) */
const STUCK_RUN_MS = 2 * 60 * 60 * 1000

/**
 * Recompute next run times for all jobs
 * Also clears stuck running markers
 */
export function recomputeNextRuns(jobs: AutomationJob[], nowMs: number): void {
  for (const job of jobs) {
    if (!job.state) {
      job.state = {}
    }

    if (!job.isActive) {
      job.state.nextRunAtMs = undefined
      job.state.runningAtMs = undefined
      continue
    }

    // Clear stuck running marker
    const runningAt = job.state.runningAtMs
    if (typeof runningAt === "number" && nowMs - runningAt > STUCK_RUN_MS) {
      console.warn(`Clearing stuck running marker for job ${job.id}`)
      job.state.runningAtMs = undefined
    }

    job.state.nextRunAtMs = computeJobNextRunAtMs(job, nowMs)
  }
}

/**
 * Mark a job as started
 */
export function markJobStarted(job: AutomationJob, nowMs: number): void {
  job.state.runningAtMs = nowMs
  job.state.lastError = undefined
}

/**
 * Mark a job as finished
 */
export function markJobFinished(
  job: AutomationJob,
  nowMs: number,
  result: {
    status: "success" | "failure" | "skipped"
    error?: string
    startedAtMs: number
  },
): void {
  job.state.runningAtMs = undefined
  job.state.lastRunAtMs = result.startedAtMs
  job.state.lastStatus = result.status
  job.state.lastDurationMs = Math.max(0, nowMs - result.startedAtMs)
  job.state.lastError = result.error

  // Handle one-shot jobs
  if (job.schedule.kind === "at" && result.status === "success") {
    if (job.deleteAfterRun) {
      // Caller should delete the job
    } else {
      // Disable it
      job.isActive = false
      job.state.nextRunAtMs = undefined
    }
  } else if (job.isActive) {
    // Compute next run
    job.state.nextRunAtMs = computeJobNextRunAtMs(job, nowMs)
  } else {
    job.state.nextRunAtMs = undefined
  }

  job.updatedAtMs = nowMs
}

// ============================================
// Cron Expression Validation
// ============================================

/**
 * Validate a cron expression
 * @returns Error message if invalid, undefined if valid
 */
export function validateCronExpression(expr: string, tz?: string): string | undefined {
  const trimmed = expr.trim()
  if (!trimmed) {
    return "Cron expression cannot be empty"
  }

  try {
    const cron = new Cron(trimmed, {
      timezone: tz?.trim() || undefined,
      catch: false,
    })
    // Try to get next run to validate
    cron.nextRun()
    return undefined
  } catch (err) {
    return `Invalid cron expression: ${err instanceof Error ? err.message : String(err)}`
  }
}

/**
 * Parse a cron expression and return human-readable description
 */
export function describeCronSchedule(schedule: AutomationSchedule): string {
  if (schedule.kind === "at") {
    const date = new Date(schedule.atMs)
    return `Once at ${date.toLocaleString()}`
  }

  if (schedule.kind === "every") {
    const seconds = schedule.everyMs / 1000
    if (seconds < 60) {
      return `Every ${seconds} seconds`
    }
    const minutes = seconds / 60
    if (minutes < 60) {
      return `Every ${minutes} minute${minutes !== 1 ? "s" : ""}`
    }
    const hours = minutes / 60
    if (hours < 24) {
      return `Every ${hours} hour${hours !== 1 ? "s" : ""}`
    }
    const days = hours / 24
    return `Every ${days} day${days !== 1 ? "s" : ""}`
  }

  // Cron - provide basic descriptions for common patterns
  const { expr, tz } = schedule

  // Common patterns
  if (expr === "0 * * * *") return "Every hour"
  if (expr === "0 0 * * *") return "Daily at midnight"
  if (expr === "0 6 * * *") return "Daily at 6:00 AM"
  if (expr === "0 9 * * 1") return "Every Monday at 9:00 AM"
  if (expr === "0 0 1 * *") return "Monthly on the 1st"

  // Generic description
  const tzNote = tz ? ` (${tz})` : ""
  return `Cron: ${expr}${tzNote}`
}

// ============================================
// Convenience Builders
// ============================================

/**
 * Create a schedule that runs daily at a specific hour
 */
export function dailyAt(hour: number, tz?: string): AutomationSchedule {
  return {
    kind: "cron",
    expr: `0 ${hour} * * *`,
    tz,
  }
}

/**
 * Create a schedule that runs weekly on a specific day and hour
 */
export function weeklyOn(dayOfWeek: number, hour: number, tz?: string): AutomationSchedule {
  return {
    kind: "cron",
    expr: `0 ${hour} * * ${dayOfWeek}`,
    tz,
  }
}

/**
 * Create a schedule that runs monthly on a specific day
 */
export function monthlyOn(dayOfMonth: number, hour: number, tz?: string): AutomationSchedule {
  return {
    kind: "cron",
    expr: `0 ${hour} ${dayOfMonth} * *`,
    tz,
  }
}

/**
 * Create a one-time schedule for a specific date
 */
export function onceAt(date: Date): AutomationSchedule {
  return {
    kind: "at",
    atMs: date.getTime(),
  }
}

/**
 * Create an interval schedule
 */
export function everyMs(intervalMs: number): AutomationSchedule {
  return {
    kind: "every",
    everyMs: intervalMs,
  }
}

export function everyMinutes(minutes: number): AutomationSchedule {
  return everyMs(minutes * 60 * 1000)
}

export function everyHours(hours: number): AutomationSchedule {
  return everyMs(hours * 60 * 60 * 1000)
}
