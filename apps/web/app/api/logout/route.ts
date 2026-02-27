import * as Sentry from "@sentry/nextjs"
import { type NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/features/auth/lib/jwt"
import { revokeSession } from "@/features/auth/sessions/session-service"
import { createCorsSuccessResponse } from "@/lib/api/responses"
import { COOKIE_NAMES, getClearCookieOptions } from "@/lib/auth/cookies"
import { addCorsHeaders } from "@/lib/cors-utils"

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const host = req.headers.get("host") || undefined

  // Revoke the session server-side before clearing cookies
  const sessionCookie = req.cookies.get(COOKIE_NAMES.SESSION)
  if (sessionCookie?.value) {
    try {
      const payload = await verifySessionToken(sessionCookie.value)
      if (payload?.sid) {
        await revokeSession(payload.userId, payload.sid)
      }
    } catch (err) {
      Sentry.captureException(err)
    }
  }

  const res = createCorsSuccessResponse(origin, { message: "Logged out successfully" })

  // Clear both session cookies
  res.cookies.set(COOKIE_NAMES.SESSION, "", getClearCookieOptions(host))
  res.cookies.set(COOKIE_NAMES.MANAGER_SESSION, "", getClearCookieOptions(host))

  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
