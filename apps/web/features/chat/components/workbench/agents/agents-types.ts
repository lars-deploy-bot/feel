import type { JobStatus, RunStatus, TriggerType } from "@webalive/database"

export interface AutomationRun {
  id: string
  status: RunStatus
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  error: string | null
  triggered_by: string | null
}

export interface AutomationJob {
  id: string
  name: string
  description: string | null
  is_active: boolean
  status: JobStatus
  trigger_type: TriggerType
  action_model: string | null
  action_prompt: string | null
  action_target_page: string | null
  cron_schedule: string | null
  cron_timezone: string | null
  skills: string[] | null
  email_address: string | null
  last_run_status: RunStatus | null
  last_run_at: string | null
  last_run_error: string | null
  next_run_at: string | null
  consecutive_failures: number | null
  created_at: string
  hostname: string
}

export interface RecentRun {
  id: string
  status: string
  started_at: string
  duration_ms: number | null
  error: string | null
  triggered_by: string | null
}

/** Raw API response shape from /api/automations/enriched */
export interface EnrichedJobRaw extends AutomationJob {
  runs_30d: number
  success_runs_30d: number
  failure_runs_30d: number
  avg_duration_ms: number | null
  recent_runs: RecentRun[]
}

/** Client-side enriched job with computed fields */
export interface EnrichedJob extends EnrichedJobRaw {
  success_rate: number
  streak: number
}

export type AgentView =
  | { kind: "list" }
  | { kind: "detail"; jobId: string }
  | { kind: "edit"; jobId: string }
