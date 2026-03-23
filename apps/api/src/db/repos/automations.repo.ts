import type { JobStatus, RunStatus, TriggerType } from "@webalive/database"
import { InternalError, NotFoundError } from "../../infra/errors"
import { app, iam } from "../clients"

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
  avatar_url: string | null
  email_address: string | null
  last_run_status: RunStatus | null
  last_run_at: string | null
  last_run_error: string | null
  next_run_at: string | null
  action_timeout_seconds: number | null
  consecutive_failures: number | null
  created_at: string
  site_id: string
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
  chat_conversation_id: string | null
}

export async function findAllJobs(): Promise<AutomationJobRow[]> {
  const { data, error } = await app
    .from("automation_jobs")
    .select(
      "id, name, description, is_active, status, trigger_type, action_model, action_prompt, action_target_page, action_timeout_seconds, cron_schedule, cron_timezone, skills, avatar_url, email_address, last_run_status, last_run_at, last_run_error, next_run_at, consecutive_failures, created_at, site_id",
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
    .select("id, job_id, status, started_at, completed_at, duration_ms, error, triggered_by, chat_conversation_id")
    .in("job_id", jobIds)
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false })

  if (error) {
    throw new InternalError(`Failed to fetch automation runs: ${error.message}`)
  }
  return data ?? []
}

export async function setJobActive(jobId: string, isActive: boolean): Promise<void> {
  const { error } = await app
    .from("automation_jobs")
    .update({ is_active: isActive })
    .eq("id", jobId)
    .select("id")
    .single()

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError(`Automation job ${jobId} not found`)
    }
    throw new InternalError(`Failed to update automation job: ${error.message}`)
  }
}

export interface UpdateJobFields {
  name?: string
  description?: string | null
  action_prompt?: string | null
  action_model?: string | null
  action_target_page?: string | null
  action_timeout_seconds?: number | null
  cron_schedule?: string | null
  cron_timezone?: string | null
  schedule_text?: string | null
  skills?: string[]
  avatar_url?: string | null
}

export async function updateJob(jobId: string, fields: UpdateJobFields): Promise<void> {
  const { error } = await app.from("automation_jobs").update(fields).eq("id", jobId).select("id").single()
  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError(`Automation job ${jobId} not found`)
    }
    throw new InternalError(`Failed to update automation job: ${error.message}`)
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  const { error } = await app.from("automation_jobs").delete().eq("id", jobId).select("id").single()

  if (error) {
    if (error.code === "PGRST116") {
      throw new NotFoundError(`Automation job ${jobId} not found`)
    }
    throw new InternalError(`Failed to delete automation job: ${error.message}`)
  }
}

// =============================================================================
// Automation Ownership Transfer
// =============================================================================

export interface TransferResult {
  transferred: number
  disabled: number
  jobDetails: Array<{ id: string; name: string; action: "transferred" | "disabled"; newOwnerId?: string }>
}

/**
 * When a user leaves an org, transfer their automations to another org member.
 * If no other members exist, disable the automations.
 *
 * Finds all automation_jobs owned by `userId` on domains belonging to `orgId`,
 * then reassigns to the best available member (prefer owner > admin > member).
 */
export async function reassignOrDisableAutomations(orgId: string, departingUserId: string): Promise<TransferResult> {
  const result: TransferResult = { transferred: 0, disabled: 0, jobDetails: [] }

  // 1. Find all domains belonging to this org
  const { data: domains, error: domainsError } = await app.from("domains").select("domain_id").eq("org_id", orgId)

  if (domainsError) {
    throw new InternalError(`Failed to fetch domains for org ${orgId}: ${domainsError.message}`)
  }

  if (!domains?.length) return result

  const domainIds = domains.map(d => d.domain_id)

  // 2. Find automation jobs owned by the departing user on these domains
  const { data: jobs, error: jobsError } = await app
    .from("automation_jobs")
    .select("id, name")
    .eq("user_id", departingUserId)
    .in("site_id", domainIds)

  if (jobsError) {
    throw new InternalError(`Failed to fetch automations for departing user: ${jobsError.message}`)
  }

  if (!jobs?.length) return result

  // 3. Find remaining org members (excluding departing user), prefer owner > admin > member
  const { data: remainingMembers, error: membersError } = await iam
    .from("org_memberships")
    .select("user_id, role")
    .eq("org_id", orgId)
    .neq("user_id", departingUserId)

  if (membersError) {
    throw new InternalError(`Failed to fetch remaining org members: ${membersError.message}`)
  }

  const newOwner = pickBestMember(remainingMembers ?? [])

  // 4. Transfer or disable
  const jobIds = jobs.map(j => j.id)

  if (newOwner) {
    const { error: updateError } = await app
      .from("automation_jobs")
      .update({ user_id: newOwner.user_id })
      .eq("user_id", departingUserId)
      .in("id", jobIds)

    if (updateError) {
      throw new InternalError(`Failed to transfer automations: ${updateError.message}`)
    }

    result.transferred = jobs.length
    for (const job of jobs) {
      result.jobDetails.push({ id: job.id, name: job.name, action: "transferred", newOwnerId: newOwner.user_id })
    }
  } else {
    // No remaining members — disable all automations
    const { error: disableError } = await app
      .from("automation_jobs")
      .update({ is_active: false, status: "disabled" })
      .eq("user_id", departingUserId)
      .in("id", jobIds)

    if (disableError) {
      throw new InternalError(`Failed to disable automations: ${disableError.message}`)
    }

    result.disabled = jobs.length
    for (const job of jobs) {
      result.jobDetails.push({ id: job.id, name: job.name, action: "disabled" })
    }
  }

  return result
}

const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, member: 2 }

function pickBestMember(members: Array<{ user_id: string; role: string }>): { user_id: string; role: string } | null {
  if (members.length === 0) return null
  return members.sort((a, b) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))[0]
}
