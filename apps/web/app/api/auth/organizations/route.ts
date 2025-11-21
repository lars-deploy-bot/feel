import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { COOKIE_NAMES, getClearCookieOptions } from "@/lib/auth/cookies"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Get authenticated user
    const user = await getSessionUser()
    if (!user) {
      // Clear stale/invalid session cookie to prevent infinite 401 loops
      const res = createCorsResponse(
        origin,
        {
          ok: false,
          error: "Unauthorized",
          organizations: [],
        },
        401,
      )

      // Clear invalid session cookie (auto-cleanup for stuck mobile sessions)
      res.cookies.set(COOKIE_NAMES.SESSION, "", getClearCookieOptions())

      return res
    }

    // Test mode
    if (process.env.BRIDGE_ENV === "local" && user.id === "test-user") {
      return createCorsSuccessResponse(origin, {
        organizations: [
          {
            org_id: "test-org-1",
            name: "Test Organization",
            credits: 1000,
            workspace_count: 2,
            role: "owner",
          },
        ],
        current_user_id: user.id,
      })
    }

    // Get user's org memberships with roles
    const iam = await createIamClient("service")
    const { data: memberships, error: membershipError } = await iam
      .from("org_memberships")
      .select("org_id, role")
      .eq("user_id", user.id)

    if (membershipError) {
      console.error("[Organizations API] Error fetching memberships:", membershipError)
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Failed to fetch organizations",
          organizations: [],
        },
        500,
      )
    }

    if (!memberships || memberships.length === 0) {
      return createCorsSuccessResponse(origin, {
        organizations: [],
      })
    }

    const orgIds = memberships.map(m => m.org_id)

    // Get org details
    const { data: orgs, error: orgsError } = await iam
      .from("orgs")
      .select("org_id, name, credits")
      .in("org_id", orgIds)
      .order("name")

    if (orgsError) {
      console.error("[Organizations API] Error fetching orgs:", orgsError)
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Failed to fetch organizations",
          organizations: [],
        },
        500,
      )
    }

    // Get workspace counts for each org
    const app = await createAppClient("service")
    const { data: domains, error: domainsError } = await app.from("domains").select("org_id").in("org_id", orgIds)

    if (domainsError) {
      console.error("[Organizations API] Error fetching domains:", domainsError)
      // Continue without workspace counts
    }

    // Calculate workspace counts
    const workspaceCounts = new Map<string, number>()
    if (domains) {
      for (const domain of domains) {
        if (domain.org_id) {
          workspaceCounts.set(domain.org_id, (workspaceCounts.get(domain.org_id) || 0) + 1)
        }
      }
    }

    // Create role map
    const roleMap = new Map<string, string>()
    for (const membership of memberships) {
      roleMap.set(membership.org_id, membership.role)
    }

    // Combine org data with workspace counts and user roles
    const organizations = (orgs || []).map(org => ({
      org_id: org.org_id,
      name: org.name,
      credits: org.credits,
      workspace_count: workspaceCounts.get(org.org_id) || 0,
      role: roleMap.get(org.org_id) || "member",
    }))

    return createCorsSuccessResponse(origin, {
      organizations,
      current_user_id: user.id, // Include current user ID for permission checks
    })
  } catch (error) {
    console.error("[Organizations API] Unexpected error:", error)
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: "Internal server error",
        organizations: [],
      },
      500,
    )
  }
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Get authenticated user
    const user = await getSessionUser()
    if (!user) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Unauthorized",
        },
        401,
      )
    }

    // Parse request body
    const body = await req.json()
    const { org_id, name } = body

    if (!org_id || !name) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Missing required fields: org_id and name",
        },
        400,
      )
    }

    // Validate name
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Organization name cannot be empty",
        },
        400,
      )
    }

    if (trimmedName.length > 100) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Organization name cannot exceed 100 characters",
        },
        400,
      )
    }

    // Check if user has permission to update this org
    const iam = await createIamClient("service")
    const { data: membership, error: membershipError } = await iam
      .from("org_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", org_id)
      .single()

    if (membershipError || !membership) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "You are not a member of this organization",
        },
        403,
      )
    }

    // Only owners and admins can update org name
    if (membership.role !== "owner" && membership.role !== "admin") {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Only organization owners and admins can update the organization name",
        },
        403,
      )
    }

    // Update organization name
    const { data: updatedOrg, error: updateError } = await iam
      .from("orgs")
      .update({ name: trimmedName })
      .eq("org_id", org_id)
      .select("org_id, name, credits")
      .single()

    if (updateError) {
      console.error("[Organizations API] Error updating org:", updateError)
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Failed to update organization",
        },
        500,
      )
    }

    return createCorsSuccessResponse(origin, {
      organization: updatedOrg,
    })
  } catch (error) {
    console.error("[Organizations API] Unexpected error in PATCH:", error)
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: "Internal server error",
      },
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
