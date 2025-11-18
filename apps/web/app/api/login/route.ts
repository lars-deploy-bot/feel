import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSessionToken } from "@/features/auth/lib/jwt"
import { COOKIE_NAMES, getSessionCookieOptions } from "@/lib/auth/cookies"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { createAppClient } from "@/lib/supabase/app"
import { createIamClient } from "@/lib/supabase/iam"
import { generateRequestId } from "@/lib/utils"
import { verifyPassword } from "@/types/guards/api"

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
    res.cookies.set(COOKIE_NAMES.SESSION, "test-user", getSessionCookieOptions())
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

  // Query user's workspaces (only once at login, embedded in JWT)
  // This eliminates database queries on every subsequent request
  const { data: memberships } = await iam.from("org_memberships").select("org_id").eq("user_id", user.user_id)

  const workspaces: string[] = []
  if (memberships && memberships.length > 0) {
    const orgIds = memberships.map(m => m.org_id)

    // Get all domains for these orgs
    const app = await createAppClient("service")
    const { data: domains } = await app.from("domains").select("hostname").in("org_id", orgIds)

    if (domains) {
      workspaces.push(...domains.map(d => d.hostname))
    }
  }

  // Create JWT session token with embedded user profile + workspaces
  // This eliminates 3 database queries per request (iam.users, org_memberships, domains)
  const sessionToken = await createSessionToken(
    user.user_id,
    user.email || "",
    user.display_name,
    workspaces
  )

  console.log(`[Login] Successfully authenticated: ${user.email} (${workspaces.length} workspaces)`)

  const res = NextResponse.json({ ok: true, userId: user.user_id })
  res.cookies.set(COOKIE_NAMES.SESSION, sessionToken, getSessionCookieOptions())

  addCorsHeaders(res, origin)
  return res
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
