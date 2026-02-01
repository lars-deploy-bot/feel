/**
 * @webalive/automation - Type definitions for scheduled automation
 *
 * Following patterns from OpenClaw's cron system:
 * - Schedule types (at, every, cron)
 * - Job state tracking
 * - Payload flexibility
 */

// ============================================
// Schedule Types
// ============================================

/**
 * One-time execution at a specific timestamp
 */
export type ScheduleAt = {
  kind: "at"
  /** Unix timestamp in milliseconds when the job should run */
  atMs: number
}

/**
 * Recurring execution at fixed intervals
 */
export type ScheduleEvery = {
  kind: "every"
  /** Interval in milliseconds between runs */
  everyMs: number
  /** Optional anchor timestamp to align intervals */
  anchorMs?: number
}

/**
 * Cron expression-based scheduling
 */
export type ScheduleCron = {
  kind: "cron"
  /** Cron expression (e.g., "0 6 * * *" for 6am daily) */
  expr: string
  /** Timezone for cron evaluation (e.g., "Europe/Amsterdam") */
  tz?: string
}

/**
 * Union of all schedule types
 */
export type AutomationSchedule = ScheduleAt | ScheduleEvery | ScheduleCron

// ============================================
// Action Types
// ============================================

/**
 * Types of actions an automation can perform
 */
export type AutomationActionType = "prompt" | "sync" | "publish"

/**
 * External data source configuration for sync actions
 */
export type ExternalDataSource = {
  /** Type of external source */
  type: "google-calendar" | "google-sheets" | "instagram" | "rss" | "webhook"
  /** Reference to stored OAuth connection */
  connectionId?: string
  /** Source-specific configuration */
  config: Record<string, unknown>
}

/**
 * Action payload - what the automation does when triggered
 */
export type AutomationAction =
  | {
      type: "prompt"
      /** Instruction for Claude to execute */
      prompt: string
      /** Optional model override */
      model?: string
      /** Timeout in seconds (default: 300) */
      timeoutSeconds?: number
    }
  | {
      type: "sync"
      /** External data source to sync from */
      source: ExternalDataSource
      /** Target page path to update (e.g., "/events") */
      targetPage: string
      /** Optional custom prompt for how to format the data */
      formatPrompt?: string
    }
  | {
      type: "publish"
      /** Page or content to publish */
      targetPage: string
    }

// ============================================
// Job State
// ============================================

/**
 * Execution status of a job run
 */
export type AutomationRunStatus = "pending" | "running" | "success" | "failure" | "skipped"

/**
 * Runtime state of an automation job
 */
export type AutomationJobState = {
  /** Next scheduled run time (ms timestamp) */
  nextRunAtMs?: number
  /** If currently running, when it started (ms timestamp) */
  runningAtMs?: number
  /** When the job last ran (ms timestamp) */
  lastRunAtMs?: number
  /** Status of the last run */
  lastStatus?: AutomationRunStatus
  /** Error message from last run (if failed) */
  lastError?: string
  /** Duration of last run in milliseconds */
  lastDurationMs?: number
}

// ============================================
// Automation Job
// ============================================

/**
 * Trigger type for the automation
 */
export type AutomationTriggerType = "cron" | "webhook" | "one-time"

/**
 * Complete automation job definition
 */
export type AutomationJob = {
  /** Unique job ID */
  id: string
  /** Site/domain this automation belongs to */
  siteId: string
  /** User who created the automation */
  userId: string
  /** Organization ID */
  orgId: string

  /** Human-readable name */
  name: string
  /** Optional description */
  description?: string

  /** How the job is triggered */
  triggerType: AutomationTriggerType
  /** Schedule configuration */
  schedule: AutomationSchedule
  /** Secret for webhook triggers */
  webhookSecret?: string

  /** What to do when triggered */
  action: AutomationAction

  /** Whether the job is active */
  isActive: boolean
  /** Delete after successful run (for one-time jobs) */
  deleteAfterRun?: boolean

  /** Creation timestamp (ms) */
  createdAtMs: number
  /** Last update timestamp (ms) */
  updatedAtMs: number

  /** Runtime state */
  state: AutomationJobState
}

/**
 * Input for creating a new automation job
 */
export type AutomationJobCreate = Omit<
  AutomationJob,
  "id" | "createdAtMs" | "updatedAtMs" | "state" | "webhookSecret"
> & {
  state?: Partial<AutomationJobState>
}

/**
 * Input for updating an existing automation job
 */
export type AutomationJobPatch = Partial<
  Omit<AutomationJob, "id" | "createdAtMs" | "siteId" | "userId" | "orgId" | "state">
> & {
  state?: Partial<AutomationJobState>
}

// ============================================
// Execution Records
// ============================================

/**
 * Record of a single automation run
 */
export type AutomationRun = {
  /** Unique run ID */
  id: string
  /** Job that was executed */
  jobId: string
  /** When the run started */
  startedAtMs: number
  /** When the run completed */
  completedAtMs?: number
  /** Execution status */
  status: AutomationRunStatus
  /** Result data (depends on action type) */
  result?: Record<string, unknown>
  /** Error message if failed */
  error?: string
  /** List of files changed during execution */
  changessMade?: string[]
}

// ============================================
// Database Types (matching Supabase schema)
// ============================================

/**
 * Database row type for automation_jobs table
 */
export type AutomationJobRow = {
  id: string
  site_id: string
  user_id: string
  org_id: string
  name: string
  description: string | null
  trigger_type: AutomationTriggerType
  cron_schedule: string | null
  run_at: string | null
  webhook_secret: string | null
  action_type: AutomationActionType
  action_prompt: string | null
  action_source: Record<string, unknown> | null
  action_target_page: string | null
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  last_run_error: string | null
  next_run_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Database row type for automation_runs table
 */
export type AutomationRunRow = {
  id: string
  job_id: string
  started_at: string
  completed_at: string | null
  status: string
  result: Record<string, unknown> | null
  error: string | null
  changes_made: string[] | null
}

// ============================================
// Converters
// ============================================

/**
 * Convert database row to AutomationJob object
 */
export function rowToJob(row: AutomationJobRow): AutomationJob {
  // Build schedule from row
  let schedule: AutomationSchedule
  if (row.trigger_type === "one-time" && row.run_at) {
    schedule = { kind: "at", atMs: new Date(row.run_at).getTime() }
  } else if (row.cron_schedule) {
    schedule = { kind: "cron", expr: row.cron_schedule }
  } else {
    // Default to a disabled schedule
    schedule = { kind: "at", atMs: 0 }
  }

  // Build action from row
  let action: AutomationAction
  if (row.action_type === "sync" && row.action_source) {
    action = {
      type: "sync",
      source: row.action_source as ExternalDataSource,
      targetPage: row.action_target_page || "/",
    }
  } else if (row.action_type === "publish") {
    action = {
      type: "publish",
      targetPage: row.action_target_page || "/",
    }
  } else {
    action = {
      type: "prompt",
      prompt: row.action_prompt || "",
    }
  }

  return {
    id: row.id,
    siteId: row.site_id,
    userId: row.user_id,
    orgId: row.org_id,
    name: row.name,
    description: row.description || undefined,
    triggerType: row.trigger_type,
    schedule,
    webhookSecret: row.webhook_secret || undefined,
    action,
    isActive: row.is_active,
    createdAtMs: new Date(row.created_at).getTime(),
    updatedAtMs: new Date(row.updated_at).getTime(),
    state: {
      lastRunAtMs: row.last_run_at ? new Date(row.last_run_at).getTime() : undefined,
      lastStatus: row.last_run_status as AutomationRunStatus | undefined,
      lastError: row.last_run_error || undefined,
      nextRunAtMs: row.next_run_at ? new Date(row.next_run_at).getTime() : undefined,
    },
  }
}

/**
 * Convert AutomationJob to database insert/update format
 */
export function jobToRow(
  job: AutomationJobCreate & { id?: string },
): Omit<AutomationJobRow, "created_at" | "updated_at"> {
  // Extract schedule info
  let cron_schedule: string | null = null
  let run_at: string | null = null

  if (job.schedule.kind === "cron") {
    cron_schedule = job.schedule.expr
  } else if (job.schedule.kind === "at") {
    run_at = new Date(job.schedule.atMs).toISOString()
  }

  // Extract action info
  let action_prompt: string | null = null
  let action_source: Record<string, unknown> | null = null
  let action_target_page: string | null = null

  if (job.action.type === "prompt") {
    action_prompt = job.action.prompt
  } else if (job.action.type === "sync") {
    action_source = job.action.source as Record<string, unknown>
    action_target_page = job.action.targetPage
  } else if (job.action.type === "publish") {
    action_target_page = job.action.targetPage
  }

  return {
    id: job.id || crypto.randomUUID(),
    site_id: job.siteId,
    user_id: job.userId,
    org_id: job.orgId,
    name: job.name,
    description: job.description || null,
    trigger_type: job.triggerType,
    cron_schedule,
    run_at,
    webhook_secret: null, // Generated server-side
    action_type: job.action.type,
    action_prompt,
    action_source,
    action_target_page,
    is_active: job.isActive,
    last_run_at: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
    last_run_status: job.state?.lastStatus || null,
    last_run_error: job.state?.lastError || null,
    next_run_at: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toISOString() : null,
  }
}
