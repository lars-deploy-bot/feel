import { AuthenticationError, getSessionPayloadFromCookie, requireSessionUser } from "@/features/auth/lib/auth"
import { listActiveSessions } from "@/features/auth/sessions/session-service"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"

export async function GET() {
  try {
    const user = await requireSessionUser()
    const payload = await getSessionPayloadFromCookie()

    if (!payload?.sid) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401 })
    }

    const sessions = await listActiveSessions(user.id, payload.sid)

    return alrighty("auth/sessions", {
      sessions,
      currentSid: payload.sid,
    })
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401 })
    }
    throw err
  }
}
