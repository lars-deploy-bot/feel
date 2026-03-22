/**
 * Re-export shared display helpers for automation/agent UIs.
 * All implementations live in features/automations/display-helpers.ts.
 */
export { dur, healthScore, relTime, timeoutMinutes, trigLabel } from "@/features/automations/display-helpers"

import type { EnrichedJob } from "./agents-types"

// ── Agent UI constants ──

/** Delay (ms) before refreshing after triggering a run */
export const TRIGGER_REFRESH_DELAY = 1500

/** Debounce delay (ms) for auto-save in edit mode */
export const AUTO_SAVE_DEBOUNCE = 1500

/** Duration (ms) to show "Saved" badge before fading */
export const SAVED_BADGE_DURATION = 2000

/** Seconds per minute (for timeout conversion) */
export const SECONDS_PER_MINUTE = 60

/** Default schedule text for new agents */
export const DEFAULT_SCHEDULE = "every day at 9am"

/** Default schedule time for create payload */
export const DEFAULT_SCHEDULE_TIME = "09:00"

/** Streak thresholds for visual tiers */
export const STREAK_HOT = 10
export const STREAK_WARM = 5

/** Success rate thresholds for color coding */
export const RATE_EXCELLENT = 95
export const RATE_GOOD = 80

// ── Derived helpers ──

/** Human-readable status label for an agent */
export function statusLabel(job: EnrichedJob): string {
  if (!job.is_active) return "Paused"
  if (job.status === "running") return "Running"
  if (job.last_run_status === "failure") return "Failed"
  return "Healthy"
}

/** Tailwind color classes for a success rate percentage */
export function successRateColor(rate: number): string {
  if (rate >= RATE_EXCELLENT) return "text-emerald-600 dark:text-emerald-400"
  if (rate >= RATE_GOOD) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}

/** Whether a streak count is in the "hot" tier */
export function isStreakHot(streak: number): boolean {
  return streak >= STREAK_HOT
}

/** Whether a streak count is in the "warm" tier */
export function isStreakWarm(streak: number): boolean {
  return streak >= STREAK_WARM
}

/** Convert minutes string to seconds string for validation/API */
export function minutesToSeconds(min: string): string {
  return min ? String(Number(min) * SECONDS_PER_MINUTE) : ""
}

/** Convert minutes string to seconds number for API payload (null if empty) */
export function minutesToSecondsOrNull(min: string): number | null {
  return min ? Number(min) * SECONDS_PER_MINUTE : null
}
