import type { RunStatus } from "@webalive/database"

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
  status: string
  trigger_type: string
  action_model: string | null
  action_prompt: string | null
  action_target_page: string | null
  cron_schedule: string | null
  cron_timezone: string | null
  skills: string[] | null
  email_address: string | null
  last_run_status: string | null
  last_run_at: string | null
  last_run_error: string | null
  next_run_at: string | null
  consecutive_failures: number | null
  created_at: string
  hostname: string
  org_id: string
  org_name: string
  runs_30d: number
  success_runs_30d: number
  failure_runs_30d: number
  avg_duration_ms: number | null
  estimated_weekly_cost_usd: number
  recent_runs: AutomationRun[]
}

export interface OrgAutomationSummary {
  org_id: string
  org_name: string
  jobs: AutomationJob[]
  total_jobs: number
  active_jobs: number
  total_runs_30d: number
  success_runs_30d: number
  failure_runs_30d: number
  estimated_monthly_cost_usd: number
}
