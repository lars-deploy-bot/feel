import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { isDomainPasswordValid, LoginSchema } from "@/types/guards/api"

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const body = await req.json().catch(() => ({}))
  const result = LoginSchema.safeParse(body)

  if (!result.success) {
    const res = NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }

  const { passcode, workspace } = result.data

  if (process.env.BRIDGE_ENV === "local" && workspace === "test" && passcode === "test") {
    const res = NextResponse.json({ ok: true })
    res.cookies.set("session", "test-user", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    })
    addCorsHeaders(res, origin)
    return res
  }

  if (workspace === "manager") {
    if (passcode !== "wachtwoord") {
      const res = NextResponse.json({ ok: false, error: "bad_passcode" }, { status: 401 })
      addCorsHeaders(res, origin)
      return res
    }
  } else if (workspace) {
    if (!passcode || !(await isDomainPasswordValid(workspace, passcode))) {
      const res = NextResponse.json({ ok: false, error: "bad_passcode" }, { status: 401 })
      addCorsHeaders(res, origin)
      return res
    }
  } else {
    const res = NextResponse.json({ ok: false, error: "workspace_required" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  }

  const res = NextResponse.json({ ok: true })

  if (workspace === "manager") {
    res.cookies.set("manager_session", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    })
  } else {
    res.cookies.set("session", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    })
  }
  addCorsHeaders(res, origin)
  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
