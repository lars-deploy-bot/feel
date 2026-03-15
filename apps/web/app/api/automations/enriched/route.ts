/**
 * GET /api/automations/enriched
 *
 * Server-to-server proxy to apps/api for enriched automation data
 * (includes recent_runs, run stats, cost estimates).
 * Superadmin-only.
 */

import { protectedRoute } from "@/features/auth/lib/protectedRoute"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleQuery, isHandleBodyError } from "@/lib/api/server"
import { apiClient } from "@/lib/api-client"
import { ErrorCodes } from "@/lib/error-codes"

interface ApiOrgSummary {
  jobs: Record<string, unknown>[]
}

interface ApiResponse {
  ok: boolean
  data: ApiOrgSummary[]
}

export const GET = protectedRoute(async ({ user, req }) => {
  if (!user.isSuperadmin) {
    return structuredErrorResponse(ErrorCodes.FORBIDDEN, { status: 403 })
  }

  const parsedQuery = await handleQuery("automations/enriched", req)
  if (isHandleBodyError(parsedQuery)) return parsedQuery

  const { workspace } = parsedQuery

  const data = await apiClient.get<ApiResponse>("/manager/automations")
  const summaries = data.data ?? []

  // Flatten and optionally filter by workspace
  const jobs: Record<string, unknown>[] = []
  for (const summary of summaries) {
    for (const job of summary.jobs) {
      const hostname = job.hostname
      if (workspace && hostname !== workspace) continue
      jobs.push(job)
    }
  }

  // alrighty validates the response shape against the schema (injects ok: true)
  return alrighty("automations/enriched", { jobs })
})
