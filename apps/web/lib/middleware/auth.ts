import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { requireSessionUser } from "@/features/auth/lib/auth"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { ErrorCodes } from "@/lib/error-codes"

export interface AuthSuccess {
  authorized: true
  userId: string
}

export interface AuthFailure {
  authorized: false
  response: NextResponse
}

export type AuthResult = AuthSuccess | AuthFailure

export async function checkAuth(): Promise<AuthResult> {
  const jar = await cookies()

  if (!hasSessionCookie(jar.get("session"))) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: "Authentication required - no session cookie found",
        },
        { status: 401 },
      ),
    }
  }

  const user = await requireSessionUser()

  return {
    authorized: true,
    userId: user.id,
  }
}
