import type { JobStatus, RunStatus, TriggerType } from "@webalive/database"
import { InternalError } from "../../infra/errors"
import { app } from "../clients"

export interface AutomationJobRow {
  id: string
  name: string
  is_active: boolean
  status: JobStatus
  trigger_type: TriggerType
  action_model: string | null
  cron_schedule: string | null
  last_run_status: RunStatus | null
  last_run_at: string | null
  next_run_at: string | null
  consecutive_failures: number | null
  created_at: string
  site_id: string
  org_id: string
}

export interface AutomationRunRow {
  id: string
  job_id: string
  status: RunStatus
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

export async function findAllJobs(): Promise<AutomationJobRow[]> {
  const { data, error } = await app
    .from("automation_jobs")
    .select(
      "id, name, is_active, status, trigger_type, action_model, cron_schedule, last_run_status, last_run_at, next_run_at, consecutive_failures, created_at, site_id, org_id",
    )
    .order("name")

  if (error) {
    throw new InternalError(`Failed to fetch automation jobs: ${error.message}`)
  }
  return data ?? []
}

export async function findRunsByJobIds(jobIds: string[], since: Date): Promise<AutomationRunRow[]> {
  if (jobIds.length === 0) return []

  const { data, error } = await app
    .from("automation_runs")
    .select("id, job_id, status, started_at, completed_at, duration_ms")
    .in("job_id", jobIds)
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch automation runs: ${error.message}`)
  }
  return data ?? []
}
