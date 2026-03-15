/**
 * GET /api/automations/enriched
 *
 * Server-to-server proxy to apps/api for enriched automation data
 * (includes recent_runs, run stats, cost estimates).
 *
 * Query params:
 * - workspace: Filter by hostname (optional)
 */

import { getSessionUser } from "@/features/auth/lib/auth"
import { apiClient } from "@/lib/api-client"

interface EnrichedJob {
  id: string
  name: string
  hostname: string
  is_active: boolean
  status: string
  trigger_type: string
  cron_schedule: string | null
  cron_timezone: string | null
  email_address: string | null
  last_run_at: string | null
  last_run_status: string | null
  last_run_error: string | null
  next_run_at: string | null
  consecutive_failures: number | null
  action_prompt: string | null
  action_model: string | null
  action_target_page: string | null
  skills: string[] | null
  runs_30d: number
  success_runs_30d: number
  failure_runs_30d: number
  avg_duration_ms: number | null
  estimated_weekly_cost_usd: number
  recent_runs: {
    id: string
    status: string
    started_at: string
    completed_at: string | null
    duration_ms: number | null
    error: string | null
    triggered_by: string | null
  }[]
}

interface OrgSummary {
  org_id: string
  org_name: string
  jobs: EnrichedJob[]
}

interface ApiResponse {
  ok: boolean
  data: OrgSummary[]
}

export async function GET(req: Request) {
  const user = await getSessionUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Only superadmins can access enriched automation data
  if (!user.isSuperadmin) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const workspace = searchParams.get("workspace")

  const data = await apiClient.get<ApiResponse>("/manager/automations")
  const summaries = data.data ?? []

  // Flatten and optionally filter by workspace
  const jobs: EnrichedJob[] = []
  for (const summary of summaries) {
    for (const job of summary.jobs) {
      if (workspace && job.hostname !== workspace) continue
      jobs.push(job)
    }
  }

  return Response.json({ jobs })
}
