import type { NextRequest } from "next/server"
import { AuthenticationError, getSessionPayloadFromCookie, requireSessionUser } from "@/features/auth/lib/auth"
import { revokeSession } from "@/features/auth/sessions/session-service"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty, handleBody, isHandleBodyError } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    const payload = await getSessionPayloadFromCookie()

    if (!payload?.sid) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401 })
    }

    const parsed = await handleBody("auth/sessions/revoke", req)
    if (isHandleBodyError(parsed)) return parsed

    const { sid } = parsed

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
