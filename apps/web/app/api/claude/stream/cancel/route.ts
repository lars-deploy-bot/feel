import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, requireSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { sessionKey } from "@/features/auth/lib/sessionStore"
import { ErrorCodes } from "@/lib/error-codes"
import { cancelStream, cancelStreamByConversationKey } from "@/lib/stream/cancellation-registry"

/**
 * Cancel Stream Endpoint
 *
 * Allows explicit cancellation of active streams via separate HTTP request.
 * This is the production-safe way to handle cancellation when proxy layers
 * (Cloudflare, Caddy) prevent req.signal from working correctly.
 *
 * Flow:
 * 1. Client sends POST with requestId (primary) OR conversationId + workspace (fallback)
 * 2. Verify user owns the stream (security)
 * 3. Trigger cancellation via registry
 * 4. Stream breaks immediately, releases lock, cleans up child process
 *
 * Fallback (super-early Stop):
 * When user clicks Stop before receiving X-Request-Id header, client sends
 * conversationId instead. We build conversationKey and search registry by that.
 *
 * Security:
 * - Requires authenticated session
 * - User can only cancel their own streams
 */

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const user = await requireSessionUser()

    // Parse request body
    const body = await req.json()
    const { requestId, conversationId } = body

    // Validate: must have either requestId OR (conversationId + workspace)
    if (requestId && typeof requestId === "string") {
      // Primary path: Cancel by requestId
      console.log(`[Cancel Stream] User ${user.id} cancelling request: ${requestId}`)

      try {
        const cancelled = cancelStream(requestId, user.id)

        if (cancelled) {
          console.log(`[Cancel Stream] Successfully cancelled: ${requestId}`)
          return NextResponse.json({ ok: true, status: "cancelled", requestId })
        } else {
          // Not found - likely already completed
          console.log(`[Cancel Stream] Request not found (already complete): ${requestId}`)
          return NextResponse.json({ ok: true, status: "already_complete", requestId })
        }
      } catch (error) {
        // Authorization error (trying to cancel another user's stream)
        if (error instanceof Error && error.message.includes("Unauthorized")) {
          console.warn(`[Cancel Stream] Unauthorized attempt by ${user.id} for request: ${requestId}`)
          return createErrorResponse(ErrorCodes.UNAUTHORIZED, 403)
        }

        throw error
      }
    } else if (conversationId && typeof conversationId === "string") {
      // Fallback path: Cancel by conversationId (super-early Stop case)

      // Security: Verify workspace authorization before using it
      const verifiedWorkspace = await verifyWorkspaceAccess(user, body, "[Cancel Stream]")
      if (!verifiedWorkspace) {
        console.warn(`[Cancel Stream] User ${user.id} not authenticated for workspace`)
        return createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401)
      }

      const convKey = sessionKey({
        userId: user.id,
        workspace: verifiedWorkspace,
        conversationId,
      })
      console.log(`[Cancel Stream] User ${user.id} cancelling by conversationKey (super-early Stop): ${convKey}`)

      try {
        const cancelled = cancelStreamByConversationKey(convKey, user.id)

        if (cancelled) {
          console.log(`[Cancel Stream] Successfully cancelled by conversationKey: ${convKey}`)
          return NextResponse.json({ ok: true, status: "cancelled", conversationId })
        } else {
          // Not found - likely already completed or never started
          console.log(`[Cancel Stream] Conversation not found (already complete): ${convKey}`)
          return NextResponse.json({ ok: true, status: "already_complete", conversationId })
        }
      } catch (error) {
        // Authorization error (trying to cancel another user's stream)
        if (error instanceof Error && error.message.includes("Unauthorized")) {
          console.warn(`[Cancel Stream] Unauthorized attempt by ${user.id} for conversation: ${convKey}`)
          return createErrorResponse(ErrorCodes.UNAUTHORIZED, 403)
        }

        throw error
      }
    } else {
      // Invalid request - missing required parameters
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, {
        message: "Either requestId or conversationId is required",
      })
    }
  } catch (error) {
    console.error("[Cancel Stream] Error processing cancellation:", error)
    return createErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, 500, {
      message: "Failed to process cancellation request",
      details: { error: error instanceof Error ? error.message : "Unknown error" },
    })
  }
}
