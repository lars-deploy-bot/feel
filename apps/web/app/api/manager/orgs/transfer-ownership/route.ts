import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"

const TransferOwnershipSchema = z.object({
  orgId: z.string().startsWith("org_"),
  newOwnerId: z.string().startsWith("user_"),
})

/**
 * POST /api/manager/orgs/transfer-ownership
 * Transfer organization ownership to another member
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
    const result = TransferOwnershipSchema.safeParse(body)

    if (!result.success) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "INVALID_REQUEST",
          message: "Invalid request body",
          details: result.error.issues,
          requestId,
        },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    const { orgId, newOwnerId } = result.data
    const iam = await createIamClient("service")

    // Verify new owner is a member of the org
    const { data: membership, error: membershipError } = await iam
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", newOwnerId)
      .single()

    if (membershipError || !membership) {
      const res = NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "User is not a member of this organization", requestId },
        { status: 404 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Get current owner
    const { data: currentOwner } = await iam
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .single()

    // Update current owner to admin
    if (currentOwner) {
      const { error: demoteError } = await iam
        .from("org_memberships")
        .update({ role: "admin" })
        .eq("org_id", orgId)
        .eq("user_id", currentOwner.user_id)

      if (demoteError) {
        console.error("[Manager] Failed to demote current owner:", demoteError)
        const res = NextResponse.json(
          { ok: false, error: "DATABASE_ERROR", message: "Failed to update current owner", requestId },
          { status: 500 },
        )
        addCorsHeaders(res, origin)
        return res
      }
    }

    // Update new owner's role
    const { error: promoteError } = await iam
      .from("org_memberships")
      .update({ role: "owner" })
      .eq("org_id", orgId)
      .eq("user_id", newOwnerId)

    if (promoteError) {
      console.error("[Manager] Failed to promote new owner:", promoteError)
      const res = NextResponse.json(
        { ok: false, error: "DATABASE_ERROR", message: "Failed to transfer ownership", requestId },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    console.log(`[Manager] Transferred ownership of org ${orgId} to user ${newOwnerId}`)

    const res = NextResponse.json({ ok: true, requestId })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager] Transfer ownership error:", error)
    const res = NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: "Failed to transfer ownership", requestId },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin)
  return res
}
