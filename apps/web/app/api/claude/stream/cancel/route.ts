import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse, requireSessionUser, verifyWorkspaceAccess } from "@/features/auth/lib/auth"
import { tabKey } from "@/features/auth/lib/sessionStore"
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
 * 1. Client sends POST with requestId (primary) OR tabId + workspace (fallback)
 * 2. Verify user owns the stream (security)
 * 3. Trigger cancellation via registry
 * 4. Stream breaks immediately, releases lock, cleans up child process
 *
 * Fallback (super-early Stop):
 * When user clicks Stop before receiving X-Request-Id header, client sends
 * tabId instead. We build tabKey and search registry by that.
 *
 * Security:
 * - Requires authenticated session
 * - User can only cancel their own streams
 */

export async function POST(req: NextRequest) {
  console.log("[Cancel Stream] ===== CANCEL ENDPOINT HIT =====")
  try {
    // Get authenticated user
    const user = await requireSessionUser()
    console.log("[Cancel Stream] User authenticated:", user.id)

    // Parse request body
    const body = await req.json()
    const { requestId, tabId, tabGroupId } = body
    console.log(
      "[Cancel Stream] Request body:",
      JSON.stringify({ requestId, tabId, tabGroupId, workspace: body.workspace }),
    )

    // Validate: must have either requestId OR (tabId + workspace)
    if (requestId && typeof requestId === "string") {
      // Primary path: Cancel by requestId
      console.log(`[Cancel Stream] User ${user.id} cancelling request: ${requestId}`)

      try {
        // Await cancel - Promise resolves when cleanup is complete (lock released)
        const cancelled = await cancelStream(requestId, user.id)

        if (cancelled) {
          console.log(`[Cancel Stream] Successfully cancelled and cleanup complete: ${requestId}`)
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
    } else if (tabId && typeof tabId === "string") {
      // Fallback path: Cancel by tabId (super-early Stop case)

      // Security: Verify workspace authorization before using it
      const verifiedWorkspace = await verifyWorkspaceAccess(user, body, "[Cancel Stream]")
      if (!verifiedWorkspace) {
        console.warn(`[Cancel Stream] User ${user.id} not authenticated for workspace`)
        return createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401)
      }

      const tabKeyValue = tabKey({
        userId: user.id,
        workspace: verifiedWorkspace,
        tabGroupId: tabGroupId as string,
        tabId,
      })
      console.log(
        `[Cancel Stream] Building tabKey with: userId=${user.id}, workspace=${verifiedWorkspace}, tabGroupId=${tabGroupId}, tabId=${tabId}`,
      )
      console.log(`[Cancel Stream] Result tabKey: ${tabKeyValue}`)
      console.log(`[Cancel Stream] User ${user.id} cancelling by tabKey (super-early Stop): ${tabKeyValue}`)

      try {
        // Await cancel - Promise resolves when cleanup is complete (lock released)
        // Note: cancelStreamByConversationKey name is legacy - it now searches by tabKey
        const cancelled = await cancelStreamByConversationKey(tabKeyValue, user.id)

        if (cancelled) {
          console.log(`[Cancel Stream] Successfully cancelled by tabKey and cleanup complete: ${tabKeyValue}`)
          return NextResponse.json({ ok: true, status: "cancelled", tabId })
        } else {
          // Not found - likely already completed or never started
          console.log(`[Cancel Stream] Tab not found (already complete): ${tabKeyValue}`)
          return NextResponse.json({ ok: true, status: "already_complete", tabId })
        }
      } catch (error) {
        // Authorization error (trying to cancel another user's stream)
        if (error instanceof Error && error.message.includes("Unauthorized")) {
          console.warn(`[Cancel Stream] Unauthorized attempt by ${user.id} for tab: ${tabKeyValue}`)
          return createErrorResponse(ErrorCodes.UNAUTHORIZED, 403)
        }

        throw error
      }
    } else {
      // Invalid request - missing required parameters
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, {
        message: "Either requestId or tabId is required",
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
