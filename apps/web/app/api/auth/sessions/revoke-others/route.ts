import { AuthenticationError, requireAuthSession } from "@/features/auth/lib/auth"
import { revokeOtherSessions } from "@/features/auth/sessions/session-service"
import { structuredErrorResponse } from "@/lib/api/responses"
import { alrighty } from "@/lib/api/server"
import { ErrorCodes } from "@/lib/error-codes"

export async function POST() {
  try {
    const { user, payload } = await requireAuthSession()

    const revokedCount = await revokeOtherSessions(user.id, payload.sid)

    return alrighty("auth/sessions/revoke-others", { revokedCount })
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401 })
    }
    throw err
  }
}
