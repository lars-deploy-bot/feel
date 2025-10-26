import { NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  const res = NextResponse.json({ ok: true, message: "Logged out successfully" })

  // Clear both session cookies
  res.cookies.set("session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    expires: new Date(0), // Expire immediately
  })

  res.cookies.set("manager_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    expires: new Date(0), // Expire immediately
  })

  addCorsHeaders(res, origin)
  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
