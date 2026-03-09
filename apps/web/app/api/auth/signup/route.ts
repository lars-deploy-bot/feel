import * as Sentry from "@sentry/nextjs"
import { CONTACT_EMAIL } from "@webalive/shared"
import type { NextRequest } from "next/server"
import { createSessionToken } from "@/features/auth/lib/jwt"
import { trackAuthSession } from "@/features/auth/sessions/session-service"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { handleBody, isHandleBodyError } from "@/lib/api/server"
import { setSessionCookie } from "@/lib/auth/cookies"
import { addCorsHeaders, corsOptionsHandler } from "@/lib/cors-utils"
import { getUserDefaultOrgId } from "@/lib/deployment/org-resolver"
import { env } from "@/lib/env"
import { ErrorCodes } from "@/lib/error-codes"
import { getRequestId } from "@/lib/request-id"
import { createIamClient } from "@/lib/supabase/iam"
import { hashPassword } from "@/types/guards/api"

/**
 * POST /api/auth/signup
 *
 * Create a new user account. Requires a valid access code.
 */
export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const origin = req.headers.get("origin")

  const parsed = await handleBody("signup", req)
  if (isHandleBodyError(parsed)) {
    addCorsHeaders(parsed, origin)
    return parsed
  }

  const { email, password, name, accessCode } = parsed
  const normalizedEmail = email.toLowerCase().trim()
  const displayName = name?.trim() || null

  if (accessCode !== env.SIGNUP_ACCESS_CODE) {
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.INVALID_ACCESS_CODE,
        message: `Invalid access code. Contact ${CONTACT_EMAIL} for access.`,
        requestId,
      },
      403,
    )
  }

  try {
    const iam = await createIamClient("service")

    // Check if email already exists
    const { data: existingUser, error: checkError } = await iam
      .from("users")
      .select("user_id")
      .eq("email", normalizedEmail)
      .single()

    if (existingUser) {
      return createCorsResponse(
        origin,
        {
          ok: false,
          error: ErrorCodes.EMAIL_ALREADY_REGISTERED,
          message: "An account with this email already exists. Please sign in instead.",
          requestId,
        },
        409,
      )
    }

    // PGRST116 means no rows found - that's expected for new email
    if (checkError && checkError.code !== "PGRST116") {
      console.error("[Signup] Error checking email:", checkError)
      throw new Error("Failed to check email availability")
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const { data: newUser, error: createError } = await iam
      .from("users")
      .insert({
        email: normalizedEmail,
        password_hash: passwordHash,
        display_name: displayName,
        status: "active",
        is_test_env: false,
        metadata: {},
        email_verified: true,
      })
      .select("user_id")
      .single()

    if (createError || !newUser) {
      // Handle race condition where email was taken between check and insert
      if (createError?.code === "23505") {
        return createCorsResponse(
          origin,
          {
            ok: false,
            error: ErrorCodes.EMAIL_ALREADY_REGISTERED,
            message: "An account with this email already exists. Please sign in instead.",
            requestId,
          },
          409,
        )
      }
      console.error("[Signup] Error creating user:", createError)
      throw new Error("Failed to create account")
    }

    // Create default organization for user
    const orgId = await getUserDefaultOrgId(newUser.user_id, normalizedEmail)

    // Create JWT session token with scoped org access claims
    const sid = crypto.randomUUID()
    const sessionToken = await createSessionToken({
      userId: newUser.user_id,
      email: normalizedEmail,
      name: displayName,
      sid,
      orgIds: [orgId],
      orgRoles: { [orgId]: "owner" },
    })

    console.log(`[Signup] Created account for ${normalizedEmail} (org: ${orgId})`)

    // Non-blocking: don't fail signup if session tracking fails
    trackAuthSession(req, { sid, userId: newUser.user_id })

    const res = createCorsSuccessResponse(origin, {
      userId: newUser.user_id,
      email: normalizedEmail,
      message: "Account created successfully",
    })
    setSessionCookie(res, sessionToken, req)
    return res
  } catch (error) {
    console.error("[Signup] Unexpected error:", error)
    Sentry.captureException(error)
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: ErrorCodes.INTERNAL_ERROR,
        message: "Failed to create account. Please try again.",
        requestId,
      },
      500,
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  return corsOptionsHandler(req)
}
