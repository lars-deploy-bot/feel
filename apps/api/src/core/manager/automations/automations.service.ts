import type { TriggerType } from "@webalive/database"
import { domainsRepo, orgsRepo } from "../../../db/repos"
import * as automationsRepo from "../../../db/repos/automations.repo"
import type { ManagerAutomationJob, ManagerAutomationRun, ManagerOrgAutomationSummary } from "./automations.types"

export async function toggleJobActive(jobId: string, isActive: boolean): Promise<void> {
  await automationsRepo.setJobActive(jobId, isActive)
}

export async function deleteJob(jobId: string): Promise<void> {
  await automationsRepo.deleteJob(jobId)
}

// Rough cost per run by model (USD). Based on typical automation run token usage.
// These are estimates — a typical run uses ~20k input + ~4k output tokens.
const COST_PER_RUN: Record<string, number> = {
  "claude-opus-4-6": 0.6,
  "claude-sonnet-4-6": 0.12,
}
const DEFAULT_COST_PER_RUN = 0.12 // default model = sonnet
const MAX_RECENT_RUNS = 10

function estimateRunsPerMonth(cronSchedule: string | null, triggerType: TriggerType): number {
  if (triggerType !== "cron" || !cronSchedule) return 0

  const parts = cronSchedule.trim().split(/\s+/)
  if (parts.length < 5) return 0

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Every minute
  if (minute === "*" && hour === "*") return 43200 // 60*24*30

  // Every N minutes
  const everyNMin = minute.match(/^\*\/(\d+)$/)
  if (everyNMin && hour === "*") return (60 / Number(everyNMin[1])) * 24 * 30

  // Every N hours
  const everyNHour = hour.match(/^\*\/(\d+)$/)
  if (everyNHour) return (24 / Number(everyNHour[1])) * 30

  // Specific minute, every hour
  if (/^\d+$/.test(minute) && hour === "*") return 24 * 30

  // Specific minute and hour range
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    // Daily at specific time
    if (dayOfMonth === "*" && month === "*") {
      if (dayOfWeek === "*") return 30
      // Specific days of week
      const days = dayOfWeek.split(",").length
      return days * 4.3 // ~4.3 weeks per month
    }
  }

  // Fallback: assume daily
  return 30
}

export async function listAutomations(): Promise<ManagerOrgAutomationSummary[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [jobs, orgs, domains] = await Promise.all([
    automationsRepo.findAllJobs(),
    orgsRepo.findAll(),
    domainsRepo.findAll(),
  ])

  const jobIds = jobs.map(j => j.id)
  const runs = await automationsRepo.findRunsByJobIds(jobIds, thirtyDaysAgo)

  // Index lookups
  const orgMap = new Map(orgs.map(o => [o.org_id, o]))
  const domainMap = new Map(domains.map(d => [d.domain_id, d]))

  // Group runs per job (already sorted by started_at desc from DB)
  const runsByJob = new Map<string, typeof runs>()
  for (const run of runs) {
    const existing = runsByJob.get(run.job_id)
    if (existing) {
      existing.push(run)
    } else {
      runsByJob.set(run.job_id, [run])
    }
  }

  // Build per-job data grouped by org
  const orgGroups = new Map<string, ManagerAutomationJob[]>()
  for (const job of jobs) {
    const org = orgMap.get(job.org_id)
    const domain = domainMap.get(job.site_id)
    const jobRuns = runsByJob.get(job.id) ?? []

    // Aggregate
    let total = 0
    let success = 0
    let failure = 0
    let totalDurationMs = 0
    let withDuration = 0
    for (const run of jobRuns) {
      total++
      if (run.status === "success") success++
      if (run.status === "failure") failure++
      if (run.duration_ms !== null) {
        totalDurationMs += run.duration_ms
        withDuration++
      }
    }

    const runsPerMonth = job.is_active ? estimateRunsPerMonth(job.cron_schedule, job.trigger_type) : 0
    const costPerRun = COST_PER_RUN[job.action_model ?? ""] ?? DEFAULT_COST_PER_RUN
    const weeklyCost = Math.round(((runsPerMonth * costPerRun) / 30) * 7 * 100) / 100

    const recentRuns: ManagerAutomationRun[] = jobRuns.slice(0, MAX_RECENT_RUNS).map(r => ({
      id: r.id,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_ms: r.duration_ms,
      error: r.error,
      triggered_by: r.triggered_by,
    }))

    const enriched: ManagerAutomationJob = {
      id: job.id,
      name: job.name,
      description: job.description,
      is_active: job.is_active,
      status: job.status,
      trigger_type: job.trigger_type,
      action_model: job.action_model,
      action_prompt: job.action_prompt,
      action_target_page: job.action_target_page,
      cron_schedule: job.cron_schedule,
      cron_timezone: job.cron_timezone,
      skills: job.skills,
      email_address: job.email_address,
      last_run_status: job.last_run_status,
      last_run_at: job.last_run_at,
      last_run_error: job.last_run_error,
      next_run_at: job.next_run_at,
      consecutive_failures: job.consecutive_failures,
      created_at: job.created_at,
      hostname: domain?.hostname ?? "unknown",
      org_id: job.org_id,
      org_name: org?.name ?? "Unknown",
      runs_30d: total,
      success_runs_30d: success,
      failure_runs_30d: failure,
      avg_duration_ms: withDuration > 0 ? Math.round(totalDurationMs / withDuration) : null,
      estimated_weekly_cost_usd: weeklyCost,
      recent_runs: recentRuns,
    }

    const existing = orgGroups.get(job.org_id)
    if (existing) {
      existing.push(enriched)
    } else {
      orgGroups.set(job.org_id, [enriched])
    }
  }

  // Build summaries
  const summaries: ManagerOrgAutomationSummary[] = []
  for (const [orgId, orgJobs] of orgGroups) {
    const org = orgMap.get(orgId)
    const totalRuns = orgJobs.reduce((s, j) => s + j.runs_30d, 0)
    const successRuns = orgJobs.reduce((s, j) => s + j.success_runs_30d, 0)
    const failureRuns = orgJobs.reduce((s, j) => s + j.failure_runs_30d, 0)

    // Estimate monthly cost from active cron jobs
    let monthlyCost = 0
    for (const job of orgJobs) {
      if (!job.is_active) continue
      const runsPerMonth = estimateRunsPerMonth(job.cron_schedule, job.trigger_type)
      const costPerRun = COST_PER_RUN[job.action_model ?? ""] ?? DEFAULT_COST_PER_RUN
      monthlyCost += runsPerMonth * costPerRun
    }

    summaries.push({
      org_id: orgId,
      org_name: org?.name ?? "Unknown",
      jobs: orgJobs,
      total_jobs: orgJobs.length,
      active_jobs: orgJobs.filter(j => j.is_active).length,
      total_runs_30d: totalRuns,
      success_runs_30d: successRuns,
      failure_runs_30d: failureRuns,
      estimated_monthly_cost_usd: Math.round(monthlyCost * 100) / 100,
    })
  }

  // Sort by cost descending
  summaries.sort((a, b) => b.estimated_monthly_cost_usd - a.estimated_monthly_cost_usd)

  return summaries
}
