import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSessionToken } from "@/features/auth/lib/jwt"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"
import { verifyPassword } from "@/types/guards/api"

// Session expires in 30 days
const SESSION_MAX_AGE = 30 * 24 * 60 * 60

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")
  const body = await req.json().catch(() => ({}))
  const result = LoginSchema.safeParse(body)

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

  const { email, password } = result.data

  // Test mode
  if (process.env.BRIDGE_ENV === "local" && email === "test@bridge.local" && password === "test") {
    const res = NextResponse.json({ ok: true })
    res.cookies.set("session", "test-user", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    })
    addCorsHeaders(res, origin)
    return res
  }

  // Query user from iam.users
  const iam = await createIamClient("service")
  const { data: user, error: userError } = await iam
    .from("users")
    .select("user_id, email, password_hash, display_name")
    .eq("email", email)
    .single()

  if (userError || !user) {
    console.error("[Login] User not found:", email)
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

  // Verify password
  if (!user.password_hash) {
    console.error("[Login] User has no password_hash:", email)
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

  const isValid = await verifyPassword(password, user.password_hash)
  if (!isValid) {
    console.error("[Login] Invalid password for:", email)
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

  // Create JWT session token
  const sessionToken = createSessionToken(user.user_id)

  console.log("[Login] Successfully authenticated:", user.email)

  const res = NextResponse.json({ ok: true, userId: user.user_id })
  res.cookies.set("session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
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
