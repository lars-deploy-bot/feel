import type { JobStatus, RunStatus, TriggerType } from "@webalive/database"
import { InternalError } from "../../infra/errors"
import { app } from "../clients"

export interface AutomationJobRow {
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
  error: string | null
  triggered_by: string | null
}

export async function findAllJobs(): Promise<AutomationJobRow[]> {
  const { data, error } = await app
    .from("automation_jobs")
    .select(
      "id, name, description, is_active, status, trigger_type, action_model, action_prompt, action_target_page, cron_schedule, cron_timezone, skills, email_address, last_run_status, last_run_at, last_run_error, next_run_at, consecutive_failures, created_at, site_id, org_id",
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
    .select("id, job_id, status, started_at, completed_at, duration_ms, error, triggered_by")
    .in("job_id", jobIds)
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch automation runs: ${error.message}`)
  }
  return data ?? []
}

export async function setJobActive(jobId: string, isActive: boolean): Promise<void> {
  const { error } = await app.from("automation_jobs").update({ is_active: isActive }).eq("id", jobId)

  if (error) {
    throw new InternalError(`Failed to update automation job: ${error.message}`)
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  const { error } = await app.from("automation_jobs").delete().eq("id", jobId)

  if (error) {
    throw new InternalError(`Failed to delete automation job: ${error.message}`)
  }
}
