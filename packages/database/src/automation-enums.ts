/**
 * Automation Enum Utilities
 *
 * Runtime types, sets, and type guards derived from the auto-generated
 * database constants. All values flow from the DB — nobody should manually
 * list enum strings outside this file.
 *
 * Regenerate the underlying constants with: bun run gen:types
 */

import type { Database } from "./app.generated"
import { Constants } from "./app.generated"

// =============================================================================
// Type Aliases (from generated DB enum types)
// =============================================================================

export type RunStatus = Database["app"]["Enums"]["automation_run_status"]
export type JobStatus = Database["app"]["Enums"]["automation_job_status"]
export type TriggerType = Database["app"]["Enums"]["automation_trigger_type"]
export type ActionType = Database["app"]["Enums"]["automation_action_type"]

/** Terminal statuses — a run that has finished (not pending/running). */
export type TerminalRunStatus = Exclude<RunStatus, "pending" | "running">

// =============================================================================
// Runtime Sets (derived from generated constants)
// =============================================================================

export const RUN_STATUSES: ReadonlySet<RunStatus> = new Set(Constants.app.Enums.automation_run_status)
export const JOB_STATUSES: ReadonlySet<JobStatus> = new Set(Constants.app.Enums.automation_job_status)
export const TRIGGER_TYPES: ReadonlySet<TriggerType> = new Set(Constants.app.Enums.automation_trigger_type)
export const ACTION_TYPES: ReadonlySet<ActionType> = new Set(Constants.app.Enums.automation_action_type)

// String-typed sets for type guards (avoids `as` casts on the typed sets above)
const RUN_STATUS_STRINGS: ReadonlySet<string> = new Set(Constants.app.Enums.automation_run_status)
const JOB_STATUS_STRINGS: ReadonlySet<string> = new Set(Constants.app.Enums.automation_job_status)
const TRIGGER_TYPE_STRINGS: ReadonlySet<string> = new Set(Constants.app.Enums.automation_trigger_type)
const ACTION_TYPE_STRINGS: ReadonlySet<string> = new Set(Constants.app.Enums.automation_action_type)

// =============================================================================
// Type Guards
// =============================================================================

export function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && RUN_STATUS_STRINGS.has(value)
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && JOB_STATUS_STRINGS.has(value)
}

export function isTriggerType(value: unknown): value is TriggerType {
  return typeof value === "string" && TRIGGER_TYPE_STRINGS.has(value)
}

export function isActionType(value: unknown): value is ActionType {
  return typeof value === "string" && ACTION_TYPE_STRINGS.has(value)
}
