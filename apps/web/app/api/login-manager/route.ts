import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { COOKIE_NAMES, getSessionCookieOptions } from "@/lib/auth/cookies"
import { createSessionToken } from "@/features/auth/lib/jwt"
import { managerLoginRateLimiter } from "@/lib/auth/rate-limiter"
import { timingSafeCompare } from "@/lib/auth/timing-safe"
import { addCorsHeaders } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { generateRequestId } from "@/lib/utils"

const ManagerLoginSchema = z.object({
  passcode: z.string().min(1).max(1000), // Max length to prevent DOS
})

/**
 * Get client identifier for rate limiting
 * Uses IP address or a fallback identifier
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from headers (considering proxies/CDN)
  const forwardedFor = req.headers.get("x-forwarded-for")
  const realIp = req.headers.get("x-real-ip")
  const ip = forwardedFor?.split(",")[0] || realIp || req.headers.get("host") || "unknown"

  return `manager-login:${ip}`
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")
  const clientId = getClientIdentifier(req)

  // Rate limiting check
  if (managerLoginRateLimiter.isRateLimited(clientId)) {
    const blockedTime = managerLoginRateLimiter.getBlockedTimeRemaining(clientId)
    const minutesRemaining = Math.ceil(blockedTime / 1000 / 60)

    console.warn(`[Manager Login] Rate limited: ${clientId}`)

    const res = NextResponse.json(
      {
        ok: false,
        error: "TOO_MANY_REQUESTS",
        message: `Too many failed login attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
        requestId,
      },
      { status: 429 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  // Parse and validate request body
  const body = await req.json().catch(() => ({}))
  const result = ManagerLoginSchema.safeParse(body)

  if (!result.success) {
    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_REQUEST,
        message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
        details: { issues: result.error.issues },
        requestId,
      },
      { status: 400 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  const { passcode } = result.data

  // Local development mode - accept test passcode
  if (env.BRIDGE_ENV === "local" && passcode === "test") {
    console.log("[Manager Login] Test mode authentication")

    // Create JWT session token (same as regular users, but with manager role)
    const sessionToken = await createSessionToken("manager", "manager@system", "Manager", [])

    const res = NextResponse.json({ ok: true, requestId })
    res.cookies.set(COOKIE_NAMES.MANAGER_SESSION, sessionToken, getSessionCookieOptions())
    addCorsHeaders(res, origin)
    return res
  }

  // Verify passcode using timing-safe comparison
  const isValid = env.BRIDGE_PASSCODE && timingSafeCompare(passcode, env.BRIDGE_PASSCODE)

  if (!isValid) {
    console.warn(`[Manager Login] Invalid passcode attempt from ${clientId}`)

    // Record failed attempt for rate limiting
    managerLoginRateLimiter.recordFailedAttempt(clientId)

    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.INVALID_CREDENTIALS,
        message: getErrorMessage(ErrorCodes.INVALID_CREDENTIALS),
        requestId,
      },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  console.log(`[Manager Login] Successfully authenticated: ${clientId}`)

  // Reset rate limiter on successful login
  managerLoginRateLimiter.reset(clientId)

  // Create JWT session token (same as regular users, but with manager role)
  const sessionToken = await createSessionToken("manager", "manager@system", "Manager", [])

  // Set manager session cookie with JWT token
  const res = NextResponse.json({ ok: true, requestId })
  res.cookies.set(COOKIE_NAMES.MANAGER_SESSION, sessionToken, getSessionCookieOptions())

  addCorsHeaders(res, origin)
  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
