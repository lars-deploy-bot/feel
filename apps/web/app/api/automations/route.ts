/**
 * Automations API
 *
 * List and manage automation jobs for an organization.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser } from "@/features/auth/lib/auth"
import { getSupabaseCredentials } from "@/lib/env/server"
import { ErrorCodes } from "@/lib/error-codes"
import { structuredErrorResponse } from "@/lib/api/responses"
import { computeNextRunAtMs } from "@webalive/automation"

type AutomationJob = {
  id: string
  site_id: string
  name: string
  description: string | null
  trigger_type: "cron" | "webhook" | "one-time"
  cron_schedule: string | null
  action_type: "prompt" | "sync" | "publish"
  is_active: boolean
  last_run_at: string | null
  last_run_status: string | null
  next_run_at: string | null
  created_at: string
  // Joined from domains
  hostname?: string
}

/**
 * GET /api/automations - List automations for user's organizations
 *
 * Query params:
 * - org_id: Filter by organization (optional)
 * - site_id: Filter by site (optional)
 * - limit: Max results (default 50)
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("org_id")
    const siteId = searchParams.get("site_id")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100)

    const { url, key } = getSupabaseCredentials("service")
    const supabase = createClient(url, key, { db: { schema: "app" } })

    // Build query - join with domains to get hostname
    let query = supabase
      .from("automation_jobs")
      .select(
        `
        id,
        site_id,
        name,
        description,
        trigger_type,
        cron_schedule,
        action_type,
        is_active,
        last_run_at,
        last_run_status,
        next_run_at,
        created_at,
        domains:site_id (hostname)
      `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (orgId) {
      query = query.eq("org_id", orgId)
    }

    if (siteId) {
      query = query.eq("site_id", siteId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[Automations API] Query error:", error)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    // Flatten the joined data
    const automations: AutomationJob[] = (data || []).map((row: any) => ({
      id: row.id,
      site_id: row.site_id,
      name: row.name,
      description: row.description,
      trigger_type: row.trigger_type,
      cron_schedule: row.cron_schedule,
      action_type: row.action_type,
      is_active: row.is_active,
      last_run_at: row.last_run_at,
      last_run_status: row.last_run_status,
      next_run_at: row.next_run_at,
      created_at: row.created_at,
      hostname: row.domains?.hostname,
    }))

    return NextResponse.json({ ok: true, automations, total: automations.length })
  } catch (error) {
    console.error("[Automations API] GET error:", error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}

/**
 * POST /api/automations - Create a new automation
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const body = await req.json()

    // Validate required fields
    if (!body.site_id || !body.name || !body.trigger_type || !body.action_type) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "site_id, name, trigger_type, action_type" },
      })
    }

    // Validate trigger-specific fields
    if (body.trigger_type === "cron" && !body.cron_schedule) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "cron_schedule" },
      })
    }

    if (body.trigger_type === "one-time" && !body.run_at) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "run_at" },
      })
    }

    if (body.action_type === "prompt" && !body.action_prompt) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "action_prompt" },
      })
    }

    const { url, key } = getSupabaseCredentials("service")
    const supabase = createClient(url, key, { db: { schema: "app" } })

    // Get org_id from the site
    const { data: domain } = await supabase.from("domains").select("org_id").eq("domain_id", body.site_id).single()

    if (!domain?.org_id) {
      return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, { status: 404 })
    }

    // Compute next_run_at based on schedule
    let nextRunAt: string | null = null
    if (body.trigger_type === "cron" && body.cron_schedule) {
      const nextMs = computeNextRunAtMs({ kind: "cron", expr: body.cron_schedule, tz: body.cron_timezone }, Date.now())
      if (nextMs) {
        nextRunAt = new Date(nextMs).toISOString()
      }
    } else if (body.trigger_type === "one-time" && body.run_at) {
      nextRunAt = body.run_at
    }

    const { data, error } = await supabase
      .from("automation_jobs")
      .insert({
        site_id: body.site_id,
        user_id: user.id,
        org_id: domain.org_id,
        name: body.name,
        description: body.description,
        trigger_type: body.trigger_type,
        cron_schedule: body.cron_schedule,
        cron_timezone: body.cron_timezone,
        run_at: body.run_at,
        action_type: body.action_type,
        action_prompt: body.action_prompt,
        action_source: body.action_source,
        action_target_page: body.action_target_page,
        is_active: body.is_active ?? true,
        next_run_at: nextRunAt,
      })
      .select()
      .single()

    if (error) {
      console.error("[Automations API] Insert error:", error)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return NextResponse.json({ ok: true, automation: data }, { status: 201 })
  } catch (error) {
    console.error("[Automations API] POST error:", error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
