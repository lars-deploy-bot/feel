import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/features/auth/lib/auth"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    // Get optional org filter from query params
    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get("org_id")

    const user = await getSessionUser()
    if (!user) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: "Unauthorized",
          workspaces: [],
        },
        401,
      )
    }

    // Test mode
    if (process.env.BRIDGE_ENV === "local" && user.id === "test-user") {
      return createCorsSuccessResponse(origin, {
        workspaces: ["test.bridge.local", "demo.bridge.local"],
      })
    }

    // Get user's org memberships
    const iam = await createIamClient("service")
    const { data: memberships } = await iam.from("org_memberships").select("org_id").eq("user_id", user.id)

    if (!memberships || memberships.length === 0) {
      return createCorsSuccessResponse(origin, {
        workspaces: [],
      })
    }

    let orgIds = memberships.map(m => m.org_id)

    // If org filter provided, validate user has access and filter
    if (orgId) {
      if (!orgIds.includes(orgId)) {
        return createCorsResponse(
          origin,
          {
            ok: false,
            error: "You don't have access to this organization",
            workspaces: [],
          },
          403,
        )
      }
      orgIds = [orgId]
    }

    // Get all domains for these orgs
    const app = await createAppClient("service")
    const { data: domains } = await app.from("domains").select("hostname").in("org_id", orgIds)

    const workspaces = domains?.map(d => d.hostname) || []

    return createCorsSuccessResponse(origin, {
      workspaces,
    })
  } catch (_error) {
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: "Failed to get authenticated workspaces",
        workspaces: [],
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
