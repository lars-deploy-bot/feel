import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { addWorkspaceToToken, createSessionToken } from "@/features/auth/lib/jwt"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { generateRequestId } from "@/lib/utils"
import { isDomainPasswordValid, LoginSchema } from "@/types/guards/api"

// Session expires in 30 days
const SESSION_MAX_AGE = 30 * 24 * 60 * 60

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

  const { passcode, workspace } = result.data
  const jar = await cookies()

  if (process.env.BRIDGE_ENV === "local" && workspace === "test" && passcode === "test") {
    const res = NextResponse.json({ ok: true })
    res.cookies.set("session", "test-user", {
      httpOnly: true,
      secure: false, // Allow non-HTTPS for localhost
      sameSite: "lax", // Lax for localhost compatibility
      path: "/",
      maxAge: SESSION_MAX_AGE,
    })
    addCorsHeaders(res, origin)
    return res
  }

  if (workspace === "manager") {
    if (passcode !== "wachtwoord") {
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
  } else if (workspace) {
    if (!passcode || !(await isDomainPasswordValid(workspace, passcode))) {
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
  } else {
    const res = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.WORKSPACE_MISSING,
        message: getErrorMessage(ErrorCodes.WORKSPACE_MISSING),
        requestId,
      },
      { status: 400 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  const res = NextResponse.json({ ok: true })

  if (workspace === "manager") {
    res.cookies.set("manager_session", "1", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: ".terminal.goalive.nl",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    })
  } else {
    // Get existing session token (JWT)
    const existingSession = jar.get("session")
    let sessionToken: string

    if (existingSession?.value && existingSession.value !== "1") {
      // Add workspace to existing token (creates new signed token)
      sessionToken = addWorkspaceToToken(existingSession.value, workspace)
    } else {
      // Create new token for first workspace
      sessionToken = createSessionToken([workspace])
    }

    // Store signed JWT token with domain for preview subdomains
    res.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: ".terminal.goalive.nl",
      path: "/",
      maxAge: SESSION_MAX_AGE,
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
