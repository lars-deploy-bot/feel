import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedWorkspaces } from "@/features/auth/lib/auth"
import { addCorsHeaders } from "@/lib/cors-utils"

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin")

  try {
    const workspaces = await getAuthenticatedWorkspaces()

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
