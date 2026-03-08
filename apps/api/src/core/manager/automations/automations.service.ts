import type { TriggerType } from "@webalive/database"
import { domainsRepo, orgsRepo } from "../../../db/repos"
import * as automationsRepo from "../../../db/repos/automations.repo"
import type { ManagerAutomationJob, ManagerOrgAutomationSummary } from "./automations.types"

export async function toggleJobActive(jobId: string, isActive: boolean): Promise<void> {
  await automationsRepo.setJobActive(jobId, isActive)
}

// Rough cost per run by model (USD). Based on typical automation run token usage.
// These are estimates — a typical run uses ~20k input + ~4k output tokens.
const COST_PER_RUN: Record<string, number> = {
  "claude-opus-4-6": 0.6,
  "claude-sonnet-4-6": 0.12,
}
const DEFAULT_COST_PER_RUN = 0.12 // default model = sonnet

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

  // Aggregate runs per job
  const runsByJob = new Map<
    string,
    { total: number; success: number; failure: number; totalDurationMs: number; withDuration: number }
  >()
  for (const run of runs) {
    let agg = runsByJob.get(run.job_id)
    if (!agg) {
      agg = { total: 0, success: 0, failure: 0, totalDurationMs: 0, withDuration: 0 }
      runsByJob.set(run.job_id, agg)
    }
    agg.total++
    if (run.status === "success") agg.success++
    if (run.status === "failure") agg.failure++
    if (run.duration_ms !== null) {
      agg.totalDurationMs += run.duration_ms
      agg.withDuration++
    }
  }

  // Build per-job data grouped by org
  const orgGroups = new Map<string, ManagerAutomationJob[]>()
  for (const job of jobs) {
    const org = orgMap.get(job.org_id)
    const domain = domainMap.get(job.site_id)
    const agg = runsByJob.get(job.id)

    const runsPerMonth = job.is_active ? estimateRunsPerMonth(job.cron_schedule, job.trigger_type) : 0
    const costPerRun = COST_PER_RUN[job.action_model ?? ""] ?? DEFAULT_COST_PER_RUN
    const weeklyCost = Math.round(((runsPerMonth * costPerRun) / 30) * 7 * 100) / 100

    const enriched: ManagerAutomationJob = {
      id: job.id,
      name: job.name,
      is_active: job.is_active,
      status: job.status,
      trigger_type: job.trigger_type,
      action_model: job.action_model,
      cron_schedule: job.cron_schedule,
      last_run_status: job.last_run_status,
      last_run_at: job.last_run_at,
      next_run_at: job.next_run_at,
      consecutive_failures: job.consecutive_failures,
      created_at: job.created_at,
      hostname: domain?.hostname ?? "unknown",
      org_id: job.org_id,
      org_name: org?.name ?? "Unknown",
      runs_30d: agg?.total ?? 0,
      success_runs_30d: agg?.success ?? 0,
      failure_runs_30d: agg?.failure ?? 0,
      avg_duration_ms: agg && agg.withDuration > 0 ? Math.round(agg.totalDurationMs / agg.withDuration) : null,
      estimated_weekly_cost_usd: weeklyCost,
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
