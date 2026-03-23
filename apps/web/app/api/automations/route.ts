/**
 * Automations API
 *
 * List and manage automation jobs for an organization.
 */

import * as Sentry from "@sentry/nextjs"
import { computeNextRunAtMs } from "@webalive/automation"
import { isAliveWorkspace, isValidClaudeModel } from "@webalive/shared"
import { protectedRoute } from "@/features/auth/lib/protectedRoute"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, handleQuery, isHandleBodyError } from "@/lib/api/server"
import { pokeCronService } from "@/lib/automation/cron-service"
import { ErrorCodes } from "@/lib/error-codes"
import { createRLSAppClient } from "@/lib/supabase/server-rls"
import { createServiceAppClient } from "@/lib/supabase/service"

type AutomationListRow = {
  id: string
  site_id: string
  name: string
  description: string | null
  trigger_type: string
  cron_schedule: string | null
  cron_timezone: string | null
  run_at: string | null
  action_type: string
  action_prompt: string | null
  action_source: unknown
  action_target_page: string | null
  action_model: string | null
  action_timeout_seconds: number | null
  skills: string[] | null
  email_address: string | null
  is_active: boolean
  status: string
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  created_at: string
  domains?: { hostname: string; org_id: string } | null
}

/**
 * GET /api/automations - List automations for user's organizations
 *
 * Query params:
 * - org_id: Filter by organization (optional)
 * - site_id: Filter by site (optional)
 * - limit: Max results (default 50)
 */
export const GET = protectedRoute(async ({ user, req }) => {
  const parsedQuery = await handleQuery("automations", req)
  if (isHandleBodyError(parsedQuery)) return parsedQuery

  const { org_id: orgId, site_id: siteId, limit } = parsedQuery

  const supabase = await createRLSAppClient()

  // Build query - join with domains to get hostname and org_id
  let jobsQuery = supabase
    .from("automation_jobs")
    .select(
      `
        id,
        site_id,
        name,
        description,
        trigger_type,
        cron_schedule,
        cron_timezone,
        run_at,
        action_type,
        action_prompt,
        action_source,
        action_target_page,
        action_model,
        action_timeout_seconds,
        skills,
        email_address,
        is_active,
        status,
        last_run_at,
        last_run_status,
        next_run_at,
        created_at,
        domains:site_id (hostname, org_id)
      `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (orgId) {
    jobsQuery = jobsQuery.eq("domains.org_id", orgId)
  }

  if (siteId) {
    jobsQuery = jobsQuery.eq("site_id", siteId)
  }

  const { data, error } = await jobsQuery.returns<AutomationListRow[]>()

  if (error) {
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.QUERY_FAILED, { status: 500 })
  }

  if (!data) {
    Sentry.captureMessage("[Automations API] Query returned null data without error")
    return structuredErrorResponse(ErrorCodes.QUERY_FAILED, { status: 500 })
  }

  // Flatten the joined data
  const automations = data.map(row => ({
    id: row.id,
    site_id: row.site_id,
    name: row.name,
    description: row.description,
    trigger_type: row.trigger_type,
    cron_schedule: row.cron_schedule,
    cron_timezone: row.cron_timezone,
    run_at: row.run_at,
    action_type: row.action_type,
    action_prompt: row.action_prompt,
    action_source: typeof row.action_source === "string" ? row.action_source : null,
    action_target_page: row.action_target_page,
    action_model: isValidClaudeModel(row.action_model) ? row.action_model : null,
    action_timeout_seconds: row.action_timeout_seconds,
    skills: row.skills,
    email_address: row.email_address,
    is_active: row.is_active,
    status: row.status,
    last_run_at: row.last_run_at,
    last_run_status: row.last_run_status,
    next_run_at: row.next_run_at,
    created_at: row.created_at,
    hostname: row.domains?.hostname,
  }))

  return alrighty("automations", { automations, total: automations.length })
})

/**
 * POST /api/automations - Create a new automation
 */
export const POST = protectedRoute(async ({ user, req }) => {
  const parsed = await handleBody("automations/create", req)
  if (isHandleBodyError(parsed)) return parsed

  // Import async validators (can't be handled by schema alone)
  const { validateActionPrompt, validateCronSchedule, validateTimezone, validateSiteId } = await import(
    "@/lib/automation/validation"
  )

  // Validate action_prompt if prompt type
  const promptCheck = validateActionPrompt(parsed.action_type, parsed.action_prompt ?? null)
  if (!promptCheck.valid) {
    return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
      status: 400,
      details: { field: "action_prompt", message: promptCheck.error },
    })
  }

  // Validate timezone if provided
  if (parsed.cron_timezone) {
    const tzCheck = validateTimezone(parsed.cron_timezone)
    if (!tzCheck.valid) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "cron_timezone", message: tzCheck.error },
      })
    }
  }

  // Validate site exists and get hostname
  const siteCheck = await validateSiteId(parsed.site_id)
  if (!siteCheck.valid) {
    return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, {
      status: 404,
      details: { field: "site_id", message: siteCheck.error },
    })
  }

  // Alive workspace is superadmin-only
  if (siteCheck.hostname && isAliveWorkspace(siteCheck.hostname) && !user.isSuperadmin) {
    return structuredErrorResponse(ErrorCodes.FORBIDDEN, {
      status: 403,
      details: { message: "Only superadmins can create alive workspace automations" },
    })
  }

  const supabase = createServiceAppClient()

  // Resolve schedule_text → cron if provided (text always takes priority over raw cron)
  let resolvedCron = parsed.cron_schedule ?? null
  let resolvedTimezone = parsed.cron_timezone ?? null

  if (parsed.trigger_type === "cron" && parsed.schedule_text) {
    try {
      const { resolveScheduleText } = await import("@/lib/automation/text-to-cron")
      const result = await resolveScheduleText(parsed.schedule_text, parsed.cron_timezone ?? null, user.id)
      resolvedCron = result.cron
      if (result.timezone) {
        resolvedTimezone = result.timezone
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse schedule text"
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "schedule_text", message },
      })
    }
  }

  // Validate and compute cron schedule if present
  let nextRunAt: string | null = null
  if (parsed.trigger_type === "cron" && resolvedCron) {
    const cronCheck = validateCronSchedule(resolvedCron, resolvedTimezone)
    if (!cronCheck.valid) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "cron_schedule", message: cronCheck.error },
      })
    }

    const nextMs = computeNextRunAtMs(
      { kind: "cron", expr: resolvedCron, tz: resolvedTimezone ?? undefined },
      Date.now(),
    )
    if (nextMs) {
      nextRunAt = new Date(nextMs).toISOString()
    }
  } else if (parsed.trigger_type === "one-time" && parsed.run_at) {
    nextRunAt = parsed.run_at
  }

  const { data, error } = await supabase
    .from("automation_jobs")
    .insert([
      {
        site_id: parsed.site_id,
        user_id: user.id,
        name: parsed.name,
        description: parsed.description ?? null,
        trigger_type: parsed.trigger_type,
        cron_schedule: resolvedCron,
        cron_timezone: resolvedTimezone,
        run_at: parsed.run_at ?? null,
        action_type: parsed.action_type,
        action_prompt: parsed.action_prompt ?? null,
        action_source: parsed.action_source ?? null,
        action_target_page: parsed.action_target_page ?? null,
        skills: parsed.skills.length > 0 ? parsed.skills : [],
        action_model: parsed.action_model ?? null,
        email_address: parsed.trigger_type === "email" ? (parsed.email_address ?? null) : null,
        is_active: parsed.is_active,
        next_run_at: nextRunAt,
      },
    ])
    .select()
    .single()

  if (error) {
    Sentry.captureException(error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }

  // Poke CronService so it picks up the new job immediately
  pokeCronService()

  return alrighty("automations/create", { automation: data }, { status: 201 })
})
