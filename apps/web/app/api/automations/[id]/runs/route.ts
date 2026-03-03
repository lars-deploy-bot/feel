/**
 * Automation Runs API
 *
 * List all runs for a specific automation job.
 */

import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleParams, handleQuery, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"
import { createRLSAppClient } from "@/lib/supabase/server-rls"

interface RouteContext {
  params: Promise<{ id: string }>
}

/** Subset returned by ownership-check queries (user_id exists in DB but not yet in generated types) */
interface JobOwnershipRow {
  user_id: string
  name?: string
}

/**
 * GET /api/automations/[id]/runs - List all runs for an automation
 *
 * Query params:
 * - limit: Number of runs to return (default: 20, max: 100)
 * - offset: Number of runs to skip (default: 0)
 * - status: Filter by status (success, failure, pending, running, skipped)
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const parsedParams = await handleParams("automations/runs", { params: context.params })
    if (isHandleBodyError(parsedParams)) return parsedParams
    const { id: jobId } = parsedParams

    const parsedQuery = await handleQuery("automations/runs", req)
    if (isHandleBodyError(parsedQuery)) return parsedQuery
    const { limit, offset, status: statusFilter } = parsedQuery

    const supabase = await createRLSAppClient()

    // Verify job ownership first
    const { data: job } = await supabase.from("automation_jobs").select("user_id, name").eq("id", jobId).single()

    if (!job) {
      return structuredErrorResponse(ErrorCodes.AUTOMATION_JOB_NOT_FOUND, {
        status: 404,
      })
    }

    const jobRow = job as unknown as JobOwnershipRow

    if (jobRow.user_id !== user.id) {
      return structuredErrorResponse(ErrorCodes.FORBIDDEN, { status: 403 })
    }

    // Build query
    let query = supabase
      .from("automation_runs")
      .select(
        "id, job_id, started_at, completed_at, duration_ms, status, error, triggered_by, changes_made, result, chat_conversation_id, chat_tab_id",
      )
      .eq("job_id", jobId)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (statusFilter) {
      query = query.eq("status", statusFilter)
    }

    const { data: runs, error, count } = await query

    if (error) {
      console.error("[Automations API] List runs error:", error)
      Sentry.captureException(error)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return alrighty("automations/runs", {
      runs: runs ?? [],
      job: {
        id: jobId,
        name: jobRow.name ?? "",
      },
      pagination: {
        limit,
        offset,
        total: count ?? runs?.length ?? 0,
      },
    })
  } catch (error) {
    console.error("[Automations API] GET runs error:", error)
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
