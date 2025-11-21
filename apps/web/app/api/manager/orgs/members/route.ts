import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"

/**
 * POST /api/manager/orgs/members - Add or update org member
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      401,
    )
  }

  try {
    const body = await req.json()
    const { org_id, user_id, role } = body

    if (!org_id || !user_id || !role) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "org_id, user_id, and role are required", requestId },
        400,
      )
    }

    // Validate role
    if (!["owner", "admin", "member"].includes(role)) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "Invalid role. Must be owner, admin, or member", requestId },
        400,
      )
    }

    const iam = await createIamClient("service")

    // Check if membership already exists
    const { data: existing } = await iam
      .from("org_memberships")
      .select("*")
      .eq("org_id", org_id)
      .eq("user_id", user_id)
      .single()

    if (existing) {
      // Update existing membership
      const { error: updateError } = await iam
        .from("org_memberships")
        .update({ role })
        .eq("org_id", org_id)
        .eq("user_id", user_id)

      if (updateError) {
        console.error("[Manager Org Members] Failed to update membership:", updateError)
        return createCorsResponse(
          origin,
          { ok: false, error: "DATABASE_ERROR", message: "Failed to update org membership", requestId },
          500,
        )
      }
    } else {
      // Create new membership
      const { error: insertError } = await iam.from("org_memberships").insert({
        org_id,
        user_id,
        role,
      })

      if (insertError) {
        console.error("[Manager Org Members] Failed to create membership:", insertError)
        return createCorsResponse(
          origin,
          { ok: false, error: "DATABASE_ERROR", message: "Failed to create org membership", requestId },
          500,
        )
      }
    }

    return createCorsSuccessResponse(origin, { requestId })
  } catch (error) {
    console.error("[Manager Org Members] Unexpected error:", error)
    return createCorsResponse(
      origin,
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      500,
    )
  }
}

/**
 * DELETE /api/manager/orgs/members - Remove org member
 */
export async function DELETE(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      401,
    )
  }

  try {
    const body = await req.json()
    const { org_id, user_id } = body

    if (!org_id || !user_id) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "org_id and user_id are required", requestId },
        400,
      )
    }

    const iam = await createIamClient("service")

    // Delete the membership
    const { error: deleteError } = await iam
      .from("org_memberships")
      .delete()
      .eq("org_id", org_id)
      .eq("user_id", user_id)

    if (deleteError) {
      console.error("[Manager Org Members] Failed to delete membership:", deleteError)
      return createCorsResponse(
        origin,
        { ok: false, error: "DATABASE_ERROR", message: "Failed to remove org member", requestId },
        500,
      )
    }

    return createCorsSuccessResponse(origin, { requestId })
  } catch (error) {
    console.error("[Manager Org Members] Unexpected error:", error)
    return createCorsResponse(
      origin,
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      500,
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
