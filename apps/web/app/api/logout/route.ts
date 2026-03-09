import * as Sentry from "@sentry/nextjs"
import type { NextRequest } from "next/server"
import { verifySessionToken } from "@/features/auth/lib/jwt"
import { revokeSession } from "@/features/auth/sessions/session-service"
import { createCorsSuccessResponse } from "@/lib/api/responses"
import { clearManagerSessionCookie, clearSessionCookie, COOKIE_NAMES } from "@/lib/auth/cookies"
import { corsOptionsHandler } from "@/lib/cors-utils"

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")

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
  clearSessionCookie(res, req)
  clearManagerSessionCookie(res, req)

  return res
}

export async function OPTIONS(req: NextRequest) {
  return corsOptionsHandler(req)
}
