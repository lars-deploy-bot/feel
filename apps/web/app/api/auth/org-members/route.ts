import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("orgId")

    if (!orgId) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "orgId is required", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        { ok: false, error: "DATABASE_ERROR", message: "Failed to fetch members", requestId },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
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

    const res = NextResponse.json({
      ok: true,
      members: formattedMembers,
      requestId,
    })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Org Members] Unexpected error:", error)
    const res = NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  const userId = user.id

  try {
    const body = await req.json()
    const { orgId, targetUserId } = body

    if (!orgId || !targetUserId) {
      const res = NextResponse.json(
        { ok: false, error: "INVALID_REQUEST", message: "orgId and targetUserId are required", requestId },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "You are not a member of this organization", requestId },
        { status: 403 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Get target user's role
    const { data: targetMembership, error: targetError } = await iam
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", targetUserId)
      .single()

    if (targetError || !targetMembership) {
      const res = NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "Target user is not a member of this organization", requestId },
        { status: 404 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Permission check
    const currentRole = currentUserMembership.role
    const targetRole = targetMembership.role
    const isLeavingOrg = userId === targetUserId

    // Owner can remove anyone
    // Admin can remove members (but not other admins or owner)
    // Members cannot remove anyone, but can leave themselves
    if (currentRole === "member" && !isLeavingOrg) {
      const res = NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Members cannot remove other members", requestId },
        { status: 403 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    if (currentRole === "admin" && !isLeavingOrg && (targetRole === "admin" || targetRole === "owner")) {
      const res = NextResponse.json(
        { ok: false, error: "FORBIDDEN", message: "Admins cannot remove other admins or the owner", requestId },
        { status: 403 },
      )
      addCorsHeaders(res, origin)
      return res
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
        const res = NextResponse.json(
          { ok: false, error: "DATABASE_ERROR", message: "Failed to process request", requestId },
          { status: 500 },
        )
        addCorsHeaders(res, origin)
        return res
      }

      if (!otherOwners || otherOwners.length === 0) {
        const res = NextResponse.json(
          {
            ok: false,
            error: "FORBIDDEN",
            message: "You cannot leave the organization while being the only owner",
            requestId,
          },
          { status: 403 },
        )
        addCorsHeaders(res, origin)
        return res
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
      const res = NextResponse.json(
        { ok: false, error: "DATABASE_ERROR", message: "Failed to remove member", requestId },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    console.log(`[Org Members] User ${userId} removed ${targetUserId} from org ${orgId}`)

    const res = NextResponse.json({
      ok: true,
      message: "Member removed successfully",
      requestId,
    })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Org Members] Unexpected error:", error)
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
