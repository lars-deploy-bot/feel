/**
 * Re-export shared display helpers for automation/agent UIs.
 * All implementations live in features/automations/display-helpers.ts.
 */
export { dur, healthScore, relTime, timeoutMinutes, trigLabel } from "@/features/automations/display-helpers"

import type { EnrichedJob } from "./agents-types"

/** Human-readable status label for an agent */
export function statusLabel(job: EnrichedJob): string {
  if (!job.is_active) return "Paused"
  if (job.status === "running") return "Running"
  if (job.last_run_status === "failure") return "Failed"
  return "Healthy"
}

/** Tailwind color classes for a success rate percentage */
export function successRateColor(rate: number): string {
  if (rate >= 95) return "text-emerald-600 dark:text-emerald-400"
  if (rate >= 80) return "text-amber-600 dark:text-amber-400"
  return "text-red-600 dark:text-red-400"
}
