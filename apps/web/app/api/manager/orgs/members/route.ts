import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { org_id, user_id, role } = body

    if (!org_id || !user_id || !role) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "org_id, user_id, and role are required", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Validate role
    if (!["owner", "admin", "member"].includes(role)) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "Invalid role. Must be owner, admin, or member", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
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
        const res = NextResponse.json(
          { ok: false, error: "DATABASE_ERROR", message: "Failed to update org membership", requestId },
          { status: 500 },
        )
        addCorsHeaders(res, origin)
        return res
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
        const res = NextResponse.json(
          { ok: false, error: "DATABASE_ERROR", message: "Failed to create org membership", requestId },
          { status: 500 },
        )
        addCorsHeaders(res, origin)
        return res
      }
    }

    const res = NextResponse.json({ ok: true, requestId })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager Org Members] Unexpected error:", error)
    const res = NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { org_id, user_id } = body

    if (!org_id || !user_id) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "org_id and user_id are required", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        { ok: false, error: "DATABASE_ERROR", message: "Failed to remove org member", requestId },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    const res = NextResponse.json({ ok: true, requestId })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager Org Members] Unexpected error:", error)
    const res = NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
