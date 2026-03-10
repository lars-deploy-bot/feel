import * as Sentry from "@sentry/nextjs"
import { isOrgRole } from "@webalive/shared"
import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { createCorsErrorResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"
import { createIamClient } from "@/lib/supabase/iam"
import { createServiceAppClient } from "@/lib/supabase/service"

/**
 * POST /api/manager/orgs/members - Add or update org member
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsErrorResponse(origin, ErrorCodes.UNAUTHORIZED, 401, { requestId })
  }

  try {
    const body = await req.json()
    const { org_id, user_id, role } = body

    if (!org_id || !user_id || !role) {
      return createCorsErrorResponse(origin, ErrorCodes.INVALID_REQUEST, 400, { requestId })
    }

    // Validate role
    if (!isOrgRole(role)) {
      return createCorsErrorResponse(origin, ErrorCodes.INVALID_REQUEST, 400, { requestId })
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
        return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
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
        return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
      }
    }

    return createCorsSuccessResponse(origin, { requestId })
  } catch (error) {
    console.error("[Manager Org Members] Unexpected error:", error)
    Sentry.captureException(error)
    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
  }
}

/**
 * DELETE /api/manager/orgs/members - Remove org member
 */
export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req)
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsErrorResponse(origin, ErrorCodes.UNAUTHORIZED, 401, { requestId })
  }

  try {
    const body = await req.json()
    const { org_id, user_id } = body

    if (!org_id || !user_id) {
      return createCorsErrorResponse(origin, ErrorCodes.INVALID_REQUEST, 400, { requestId })
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
      return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
    }

    // Transfer or disable automations owned by the departing user (best-effort — membership is already removed)
    try {
      await reassignOrDisableAutomations(org_id, user_id, iam)
    } catch (err) {
      console.error("[Manager Org Members] Failed to reassign automations:", err)
      Sentry.withScope(scope => {
        scope.setTag("orgId", org_id)
        scope.setTag("userId", user_id)
        scope.setFingerprint(["automation-reassign-failure"])
        Sentry.captureException(err instanceof Error ? err : new Error(String(err)))
      })
    }

    return createCorsSuccessResponse(origin, { requestId })
  } catch (error) {
    console.error("[Manager Org Members] Unexpected error:", error)
    Sentry.captureException(error)
    return createCorsErrorResponse(origin, ErrorCodes.INTERNAL_ERROR, 500, { requestId })
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}

// =============================================================================
// Automation ownership transfer on member removal
// =============================================================================

const ROLE_PRIORITY: Record<string, number> = { owner: 0, admin: 1, member: 2 }

/**
 * When a user leaves an org, transfer their automations to another org member.
 * If no remaining members, disable the automations.
 */
async function reassignOrDisableAutomations(
  orgId: string,
  departingUserId: string,
  iamClient: Awaited<ReturnType<typeof createIamClient>>,
): Promise<void> {
  const appClient = createServiceAppClient()

  // Find domains belonging to this org
  const { data: domains, error: domainsError } = await appClient.from("domains").select("domain_id").eq("org_id", orgId)

  if (domainsError) {
    throw new Error(`Failed to fetch domains for org ${orgId}: ${domainsError.message}`)
  }

  if (!domains?.length) return

  const domainIds = domains.map(d => d.domain_id)

  // Find automations owned by the departing user on these domains
  const { data: jobs, error: jobsError } = await appClient
    .from("automation_jobs")
    .select("id, name")
    .eq("user_id", departingUserId)
    .in("site_id", domainIds)

  if (jobsError) {
    throw new Error(`Failed to fetch automations for departing user: ${jobsError.message}`)
  }

  if (!jobs?.length) return

  // Find remaining org members (prefer owner > admin > member)
  const { data: remainingMembers, error: membersError } = await iamClient
    .from("org_memberships")
    .select("user_id, role")
    .eq("org_id", orgId)
    .neq("user_id", departingUserId)

  if (membersError) {
    throw new Error(`Failed to fetch remaining org members: ${membersError.message}`)
  }

  const sorted = (remainingMembers ?? []).sort((a, b) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))
  const newOwner = sorted[0] ?? null
  const jobIds = jobs.map(j => j.id)

  if (newOwner) {
    const { error: transferError } = await appClient
      .from("automation_jobs")
      .update({ user_id: newOwner.user_id })
      .eq("user_id", departingUserId)
      .in("id", jobIds)

    if (transferError) {
      throw new Error(`Failed to transfer automations: ${transferError.message}`)
    }

    console.log(
      `[Manager Org Members] Transferred ${jobs.length} automation(s) from ${departingUserId} to ${newOwner.user_id} (role: ${newOwner.role})`,
    )
  } else {
    const { error: disableError } = await appClient
      .from("automation_jobs")
      .update({ is_active: false, status: "disabled" })
      .eq("user_id", departingUserId)
      .in("id", jobIds)

    if (disableError) {
      throw new Error(`Failed to disable automations: ${disableError.message}`)
    }

    console.log(`[Manager Org Members] Disabled ${jobs.length} automation(s) — no remaining members in org ${orgId}`)
  }
}
