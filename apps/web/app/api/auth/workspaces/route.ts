import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createIamClient } from "@/lib/supabase/iam"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Get optional org filter from query params
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("org_id")

    const user = await getSessionUser()
    if (!user) {
      const res = NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
          workspaces: [],
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
        workspaces: ["test"],
      })
      addCorsHeaders(res, origin)
      return res
    }

    // Get user's org memberships
    const iam = await createIamClient("service")
    const { data: memberships } = await iam.from("org_memberships").select("org_id").eq("user_id", user.id)

    if (!memberships || memberships.length === 0) {
      const res = NextResponse.json({
        ok: true,
        workspaces: [],
      })
      addCorsHeaders(res, origin)
      return res
    }

    let orgIds = memberships.map(m => m.org_id)

    // If org filter provided, validate user has access and filter
    if (orgId) {
      if (!orgIds.includes(orgId)) {
        const res = NextResponse.json(
          {
            ok: false,
            error: "You don't have access to this organization",
            workspaces: [],
          },
          { status: 403 },
        )
        addCorsHeaders(res, origin)
        return res
      }
      orgIds = [orgId]
    }

    // Get all domains for these orgs
    const { createAppClient } = await import("@/lib/supabase/app")
    const app = await createAppClient("service")
    const { data: domains } = await app.from("domains").select("hostname").in("org_id", orgIds)

    const workspaces = domains?.map(d => d.hostname) || []

    const res = NextResponse.json({
      ok: true,
      workspaces,
    })

    addCorsHeaders(res, origin)
    return res
  } catch (_error) {
    const res = NextResponse.json(
      {
        ok: false,
        error: "Failed to get authenticated workspaces",
        workspaces: [],
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
