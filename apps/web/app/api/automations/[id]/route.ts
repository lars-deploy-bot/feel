/**
 * Automation by ID API
 *
 * Get, update, or delete a specific automation job.
 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser } from "@/features/auth/lib/auth"
import { getSupabaseCredentials } from "@/lib/env/server"
import { ErrorCodes } from "@/lib/error-codes"
import { structuredErrorResponse } from "@/lib/api/responses"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/automations/[id] - Get a specific automation
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const { id } = await context.params
    const { url, key } = getSupabaseCredentials("service")
    const supabase = createClient(url, key, { db: { schema: "app" } })

    const { data, error } = await supabase
      .from("automation_jobs")
      .select(
        `
        *,
        domains:site_id (hostname)
      `,
      )
      .eq("id", id)
      .single()

    if (error || !data) {
      return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, { status: 404 })
    }

    // Verify ownership
    if ((data as any).user_id !== user.id) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 403 })
    }

    return NextResponse.json({
      automation: {
        ...data,
        hostname: (data as any).domains?.hostname,
      },
    })
  } catch (error) {
    console.error("[Automations API] GET by ID error:", error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}

/**
 * PATCH /api/automations/[id] - Update an automation
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const { id } = await context.params
    const body = await req.json()
    const { url, key } = getSupabaseCredentials("service")
    const supabase = createClient(url, key, { db: { schema: "app" } })

    // Check ownership first
    const { data: existing } = await supabase.from("automation_jobs").select("user_id").eq("id", id).single()

    if (!existing) {
      return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, { status: 404 })
    }

    if ((existing as any).user_id !== user.id) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 403 })
    }

    // Build update object with only allowed fields
    const updates: Record<string, unknown> = {}
    const allowedFields = [
      "name",
      "description",
      "cron_schedule",
      "cron_timezone",
      "run_at",
      "action_prompt",
      "action_source",
      "action_target_page",
      "is_active",
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "update fields" },
      })
    }

    const { data, error } = await supabase.from("automation_jobs").update(updates).eq("id", id).select().single()

    if (error) {
      console.error("[Automations API] Update error:", error)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return NextResponse.json({ automation: data })
  } catch (error) {
    console.error("[Automations API] PATCH error:", error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}

/**
 * DELETE /api/automations/[id] - Delete an automation
 */
export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 401 })
    }

    const { id } = await context.params
    const { url, key } = getSupabaseCredentials("service")
    const supabase = createClient(url, key, { db: { schema: "app" } })

    // Check ownership first
    const { data: existing } = await supabase.from("automation_jobs").select("user_id").eq("id", id).single()

    if (!existing) {
      return structuredErrorResponse(ErrorCodes.SITE_NOT_FOUND, { status: 404 })
    }

    if ((existing as any).user_id !== user.id) {
      return structuredErrorResponse(ErrorCodes.UNAUTHORIZED, { status: 403 })
    }

    const { error } = await supabase.from("automation_jobs").delete().eq("id", id)

    if (error) {
      console.error("[Automations API] Delete error:", error)
      return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Automations API] DELETE error:", error)
    return structuredErrorResponse(ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
