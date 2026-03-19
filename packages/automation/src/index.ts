/**
 * @webalive/automation
 *
 * Cron scheduling utilities for automation jobs.
 * Uses croner for cron expression parsing (same as OpenClaw).
 *
 * @example
 * ```typescript
 * import { computeNextRunAtMs, type AutomationSchedule } from "@webalive/automation"
 *
 * // Compute next run for a cron schedule
 * const schedule: AutomationSchedule = { kind: "cron", expr: "0 9 * * *", tz: "Europe/Amsterdam" }
 * const nextMs = computeNextRunAtMs(schedule, Date.now())
 * ```
 */

// Re-export scheduler functions
export { computeNextRunAtMs, validateCronExpression } from "./scheduler.js"
export type { TextToCronResult } from "./text-to-cron.js"
// Re-export text-to-cron
export { textToCron } from "./text-to-cron.js"
// Re-export types
export type { AutomationSchedule, ScheduleAt, ScheduleCron, ScheduleEvery } from "./types.js"
