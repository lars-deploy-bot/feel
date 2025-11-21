import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"

/**
 * GET /api/auth/org-members?orgId=xxx
 * Fetches all members of an organization with their roles
 */
export async function GET(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check authentication
  const user = await getSessionUser()
  if (!user) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Authentication required", requestId },
      401,
    )
  }

  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("orgId")

    if (!orgId) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "orgId is required", requestId },
        400,
      )
    }

    const iam = await createIamClient("service")

    // Get all members of the organization with user details
    const { data: members, error: membersError } = await iam
      .from("org_memberships")
      .select(
        `
        user_id,
        role,
        users!inner(
          email,
          display_name
        )
      `,
      )
      .eq("org_id", orgId)
      .order("role", { ascending: true })

    if (membersError) {
      console.error("[Org Members] Failed to fetch members:", membersError)
      return createCorsResponse(
        origin,
        { ok: false, error: "DATABASE_ERROR", message: "Failed to fetch members", requestId },
        500,
      )
    }

    // Transform the data to a flatter structure and sort by email
    const formattedMembers = (members || [])
      .map(m => ({
        user_id: m.user_id,
        role: m.role,
        email: m.users?.email || "Unknown",
        display_name: m.users?.display_name || null,
      }))
      .sort((a, b) => a.email.localeCompare(b.email))

    return createCorsSuccessResponse(origin, {
      members: formattedMembers,
      requestId,
    })
  } catch (error) {
    console.error("[Org Members] Unexpected error:", error)
    return createCorsResponse(
      origin,
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      500,
    )
  }
}

/**
 * DELETE /api/auth/org-members
 * Remove a member from an organization (owner/admin only)
 */
export async function DELETE(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check authentication
  const user = await getSessionUser()
  if (!user) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Authentication required", requestId },
      401,
    )
  }

  const userId = user.id

  try {
    const body = await req.json()
    const { orgId, targetUserId } = body

    if (!orgId || !targetUserId) {
      return createCorsResponse(
        origin,
        { ok: false, error: "INVALID_REQUEST", message: "orgId and targetUserId are required", requestId },
        400,
      )
    }

    const iam = await createIamClient("service")

    // Get current user's role in the organization
    const { data: currentUserMembership, error: currentUserError } = await iam
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single()

    if (currentUserError || !currentUserMembership) {
      return createCorsResponse(
        origin,
        { ok: false, error: "FORBIDDEN", message: "You are not a member of this organization", requestId },
        403,
      )
    }

    // Get target user's role
    const { data: targetMembership, error: targetError } = await iam
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .single()

    if (targetError || !targetMembership) {
      return createCorsResponse(
        origin,
        { ok: false, error: "NOT_FOUND", message: "Target user is not a member of this organization", requestId },
        404,
      )
    }

    // Permission check
    const currentRole = currentUserMembership.role
    const targetRole = targetMembership.role
    const isLeavingOrg = userId === targetUserId

    // Owner can remove anyone
    // Admin can remove members (but not other admins or owner)
    // Members cannot remove anyone, but can leave themselves
    if (currentRole === "member" && !isLeavingOrg) {
      return createCorsResponse(
        origin,
        { ok: false, error: "FORBIDDEN", message: "Members cannot remove other members", requestId },
        403,
      )
    }

    if (currentRole === "admin" && !isLeavingOrg && (targetRole === "admin" || targetRole === "owner")) {
      return createCorsResponse(
        origin,
        { ok: false, error: "FORBIDDEN", message: "Admins cannot remove other admins or the owner", requestId },
        403,
      )
    }

    // Allow users to leave (remove themselves), but prevent admins/owners from removing themselves if they're the only one
    if (userId === targetUserId && currentRole === "owner") {
      // Check if there are other owners
      const { data: otherOwners, error: otherOwnersError } = await iam
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "owner")
        .neq("user_id", userId)

      if (otherOwnersError) {
        console.error("[Org Members] Failed to check for other owners:", otherOwnersError)
        return createCorsResponse(
          origin,
          { ok: false, error: "DATABASE_ERROR", message: "Failed to process request", requestId },
          500,
        )
      }

      if (!otherOwners || otherOwners.length === 0) {
        return createCorsResponse(
          origin,
          {
            ok: false,
            error: "FORBIDDEN",
            message: "You cannot leave the organization while being the only owner",
            requestId,
          },
          403,
        )
      }
    }

    // Remove the member
    const { error: deleteError } = await iam
      .from("org_memberships")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)

    if (deleteError) {
      console.error("[Org Members] Failed to remove member:", deleteError)
      return createCorsResponse(
        origin,
        { ok: false, error: "DATABASE_ERROR", message: "Failed to remove member", requestId },
        500,
      )
    }

    console.log(`[Org Members] User ${userId} removed ${targetUserId} from org ${orgId}`)

    return createCorsSuccessResponse(origin, {
      message: "Member removed successfully",
      requestId,
    })
  } catch (error) {
    console.error("[Org Members] Unexpected error:", error)
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
