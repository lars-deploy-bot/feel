export interface AutomationJob {
  id: string
  name: string
  is_active: boolean
  status: string
  trigger_type: string
  action_model: string | null
  cron_schedule: string | null
  last_run_status: string | null
  last_run_at: string | null
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
