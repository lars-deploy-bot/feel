import { randomUUID } from "node:crypto"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { createSessionToken, SESSION_SCOPES } from "@/features/auth/lib/jwt"
import { createCorsErrorResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { getClientIdentifier } from "@/lib/auth/client-identifier"
import { setManagerSessionCookie } from "@/lib/auth/cookies"
import { managerLoginRateLimiter } from "@/lib/auth/rate-limiter"
import { timingSafeCompare } from "@/lib/auth/timing-safe"
import { corsOptionsHandler } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"

const ManagerLoginSchema = z.object({
  passcode: z.string().min(1).max(1000), // Max length to prevent DOS
})

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const origin = req.headers.get("origin")
  const clientId = getClientIdentifier(req, "manager-login")

  // Rate limiting check
  if (managerLoginRateLimiter.isRateLimited(clientId)) {
    const blockedTime = managerLoginRateLimiter.getBlockedTimeRemaining(clientId)
    const minutesRemaining = Math.max(1, Math.ceil(blockedTime / 1000 / 60))

    console.warn(`[Manager Login] Rate limited: ${clientId}`)

    return createCorsErrorResponse(origin, ErrorCodes.TOO_MANY_REQUESTS, 429, {
      requestId,
      details: {
        retryAfter: `${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}`,
      },
    })
  }

  // Parse and validate request body
  let body: unknown = {}
  try {
    body = await req.json()
  } catch (_err) {
    // Expected: malformed request body — fall through to schema validation failure
  }
  const result = ManagerLoginSchema.safeParse(body)

  if (!result.success) {
    return createCorsErrorResponse(origin, ErrorCodes.INVALID_REQUEST, 400, {
      requestId,
      details: { issues: result.error.issues },
    })
  }

  const { passcode } = result.data

  // Local development mode - accept test passcode
  if (env.STREAM_ENV === "local" && passcode === "test") {
    console.log("[Manager Login] Test mode authentication")

    // Create JWT session token (same as regular users, but with manager role)
    const sessionToken = await createSessionToken({
      userId: "manager",
      email: "manager@system",
      name: "Manager",
      sid: randomUUID(),
      scopes: [SESSION_SCOPES.MANAGER_ACCESS],
      orgIds: [],
      orgRoles: {},
    })

    const res = createCorsSuccessResponse(origin, { requestId })
    setManagerSessionCookie(res, sessionToken, req)
    return res
  }

  // Verify passcode using timing-safe comparison
  const isValid = env.ALIVE_PASSCODE && timingSafeCompare(passcode, env.ALIVE_PASSCODE)

  if (!isValid) {
    console.warn(`[Manager Login] Invalid passcode attempt from ${clientId}`)

    // Record failed attempt for rate limiting
    managerLoginRateLimiter.recordFailedAttempt(clientId)

    return createCorsErrorResponse(origin, ErrorCodes.INVALID_CREDENTIALS, 401, { requestId })
  }

  console.log(`[Manager Login] Successfully authenticated: ${clientId}`)

  // Reset rate limiter on successful login
  managerLoginRateLimiter.reset(clientId)

  // Create JWT session token (same as regular users, but with manager role)
  const sessionToken = await createSessionToken({
    userId: "manager",
    email: "manager@system",
    name: "Manager",
    sid: randomUUID(),
    scopes: [SESSION_SCOPES.MANAGER_ACCESS],
    orgIds: [],
    orgRoles: {},
  })

  // Set manager session cookie with JWT token
  const res = createCorsSuccessResponse(origin, { requestId })
  setManagerSessionCookie(res, sessionToken, req)
  return res
}

export async function OPTIONS(req: NextRequest) {
  return corsOptionsHandler(req)
}
