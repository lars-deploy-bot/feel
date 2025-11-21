import { type NextRequest, NextResponse } from "next/server"
import { COOKIE_NAMES, getClearCookieOptions } from "@/lib/auth/cookies"
import { createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

  const res = createCorsSuccessResponse(origin, { message: "Logged out successfully" })

  // Clear both session cookies
  res.cookies.set(COOKIE_NAMES.SESSION, "", getClearCookieOptions())
  res.cookies.set(COOKIE_NAMES.MANAGER_SESSION, "", getClearCookieOptions())

  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
