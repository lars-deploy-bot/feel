import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Get authenticated user
    const user = await getSessionUser()
    if (!user) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
          organizations: [],
        },
        { status: 401 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Test mode
    if (process.env.BRIDGE_ENV === "local" && user.id === "test-user") {
      const res = NextResponse.json({
        ok: true,
        organizations: [
          {
            org_id: "test-org-1",
            name: "Test Organization",
            credits: 1000,
            workspace_count: 2,
          },
        ],
      })
      addCorsHeaders(res, origin)
      return res
    }

    // Get user's org memberships
    const iam = await createIamClient("service")
    const { data: memberships, error: membershipError } = await iam
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id)

    if (membershipError) {
      console.error("[Organizations API] Error fetching memberships:", membershipError)
      const res = NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch organizations",
          organizations: [],
        },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    if (!memberships || memberships.length === 0) {
      const res = NextResponse.json({
        ok: true,
        organizations: [],
      })
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        {
          ok: false,
          error: "Failed to fetch organizations",
          organizations: [],
        },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
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

    // Combine org data with workspace counts
    const organizations = (orgs || []).map(org => ({
      org_id: org.org_id,
      name: org.name,
      credits: org.credits,
      workspace_count: workspaceCounts.get(org.org_id) || 0,
    }))

    const res = NextResponse.json({
      ok: true,
      organizations,
    })

    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Organizations API] Unexpected error:", error)
    const res = NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
        organizations: [],
      },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
  }
}

export async function PATCH(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Get authenticated user
    const user = await getSessionUser()
    if (!user) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        { status: 401 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Parse request body
    const body = await req.json()
    const { org_id, name } = body

    if (!org_id || !name) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: org_id and name",
        },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Validate name
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Organization name cannot be empty",
        },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    if (trimmedName.length > 100) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Organization name cannot exceed 100 characters",
        },
        { status: 400 },
      )
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        {
          ok: false,
          error: "You are not a member of this organization",
        },
        { status: 403 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    // Only owners and admins can update org name
    if (membership.role !== "owner" && membership.role !== "admin") {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Only organization owners and admins can update the organization name",
        },
        { status: 403 },
      )
      addCorsHeaders(res, origin)
      return res
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
      const res = NextResponse.json(
        {
          ok: false,
          error: "Failed to update organization",
        },
        { status: 500 },
      )
      addCorsHeaders(res, origin)
      return res
    }

    const res = NextResponse.json({
      ok: true,
      organization: updatedOrg,
    })

    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Organizations API] Unexpected error in PATCH:", error)
    const res = NextResponse.json(
      {
        ok: false,
        error: "Internal server error",
      },
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
