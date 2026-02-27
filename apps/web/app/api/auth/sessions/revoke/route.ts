import type { NextRequest } from "next/server"
import { AuthenticationError, requireAuthSession } from "@/features/auth/lib/auth"
import { revokeSession } from "@/features/auth/sessions/session-service"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(req: NextRequest) {
  try {
    const { user, payload } = await requireAuthSession()

    const parsed = await handleBody("auth/sessions/revoke", req)
    if (isHandleBodyError(parsed)) return parsed

    const { sid } = parsed

    if (sid === payload.sid) {
      return structuredErrorResponse(ErrorCodes.CANNOT_REVOKE_CURRENT_SESSION, { status: 400 })
    }

    const revoked = await revokeSession(user.id, sid)

    if (!revoked) {
      return structuredErrorResponse(ErrorCodes.SESSION_NOT_FOUND, { status: 404 })
    }

    return alrighty("auth/sessions/revoke", { revoked })
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401 })
    }
    throw err
  }
}
