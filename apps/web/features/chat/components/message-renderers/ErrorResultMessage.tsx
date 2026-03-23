import { ExternalLink, RotateCcw, WifiOff } from "lucide-react"
import { useCallback } from "react"
import { useRetry } from "@/features/chat/lib/retry-context"
import { trackMessageRetried } from "@/lib/analytics/events"
import { useDexieMessageStore } from "@/lib/db/dexieMessageStore"
import { toUIMessage } from "@/lib/db/messageAdapters"
import { getMessageDb } from "@/lib/db/messageDb"
import type { ErrorCode, StructuredError } from "@/lib/error-codes"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { useDebugVisible } from "@/lib/stores/debug-store"
import { useCurrentWorkspace } from "@/lib/stores/workspaceStore"

/**
 * Check if an error is a network/offline error
 */
function isNetworkError(errorMessage: string): boolean {
  const networkPatterns = [
    "Failed to fetch",
    "NetworkError",
    "TypeError: fetch",
    "Connection lost",
    "No response body",
    "closed connection",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "network",
    "offline",
  ]

  const lowerMessage = errorMessage.toLowerCase()
  return networkPatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()))
}

/**
 * Check if an error is NOT retryable (auth, session, workspace config issues).
 * Default: all errors are retryable. Only exclude errors where retrying
 * would never help — the user needs to take a different action.
 */
const NON_RETRYABLE_CODES = new Set<ErrorCode>([
  // Auth / session — user needs to re-login, not retry
  ErrorCodes.API_AUTH_FAILED,
  ErrorCodes.NO_SESSION,
  ErrorCodes.AUTH_REQUIRED,
  ErrorCodes.SESSION_CORRUPT,
  ErrorCodes.UNAUTHORIZED,
  ErrorCodes.FORBIDDEN,
  // Credits / billing — retrying won't help
  ErrorCodes.INSUFFICIENT_CREDITS,
  ErrorCodes.INSUFFICIENT_TOKENS,
  ErrorCodes.API_BILLING_ERROR,
  // Workspace config — retrying won't fix a missing workspace
  ErrorCodes.WORKSPACE_NOT_FOUND,
  ErrorCodes.WORKSPACE_INVALID,
  // Rate limit — separate UX
  ErrorCodes.TOO_MANY_REQUESTS,
  // Model errors — user needs to change model
  ErrorCodes.MODEL_NOT_AVAILABLE,
  ErrorCodes.MODEL_INVALID,
])

function isNonRetryableError(errorMessage: string, errorCode?: ErrorCode): boolean {
  if (errorCode && NON_RETRYABLE_CODES.has(errorCode)) return true

  // Fallback: check message for auth-like patterns
  const lowerMessage = errorMessage.toLowerCase()
  if (lowerMessage.includes("session has expired") || lowerMessage.includes("log in")) return true

  return false
}

interface ErrorResultMessageProps {
  content: {
    type: "result"
    is_error: true
    result: string
    error_code?: ErrorCode
  }
}

/**
 * Try to extract a human-readable message from various error formats:
 * - Raw JSON: {"type":"error","error":{"type":"authentication_error","message":"..."}}
 * - API Error prefix: "API Error: 401 {...json...}"
 * - Structured error: {"error":"CODE","message":"...","details":{}}
 */
function extractHumanMessage(raw: string): { message: string; isAuth: boolean } {
  // Try to find embedded JSON in strings like "API Error: 401 {...}"
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : raw

  try {
    const parsed = JSON.parse(jsonStr)

    // Anthropic API format: {"type":"error","error":{"type":"...","message":"..."}}
    if (parsed?.error?.message) {
      const isAuth = parsed.error.type === "authentication_error"
      return { message: parsed.error.message, isAuth }
    }

    // Our structured format: {"error":"CODE","message":"..."}
    if (parsed?.message) {
      const isAuth = parsed.error === "API_AUTH_FAILED"
      return { message: parsed.message, isAuth }
    }

    // Details might have message
    if (parsed?.details?.message) {
      return { message: parsed.details.message, isAuth: false }
    }
  } catch {
    // Not JSON, continue
  }

  // Check for common patterns in the raw string
  if (raw.includes("OAuth token has expired")) {
    return { message: "The Claude OAuth token has expired. Please reconnect.", isAuth: true }
  }
  if (raw.includes("authentication_error")) {
    return { message: "Authentication failed. Please reconnect.", isAuth: true }
  }

  // Return cleaned raw message (strip "API Error: 401" prefix)
  const cleaned = raw.replace(/^API Error:\s*\d+\s*/i, "").trim()
  return { message: cleaned, isAuth: false }
}

export function ErrorResultMessage({ content }: ErrorResultMessageProps) {
  const { retryLastMessage } = useRetry()
  const errorMessage = content.result
  const isOffline = isNetworkError(errorMessage)
  const workspace = useCurrentWorkspace()

  // Extract human-readable message from potentially ugly JSON
  const { message: extractedMessage, isAuth: isAuthFromExtract } = extractHumanMessage(errorMessage)

  let parsedError: StructuredError | null = null
  try {
    parsedError = JSON.parse(errorMessage)
  } catch {
    // Not structured error, use raw message
  }

  const errorCode = parsedError?.error ?? content.error_code
  const isAuthError = errorCode === ErrorCodes.API_AUTH_FAILED || isAuthFromExtract
  const isSessionCorrupt = errorCode === ErrorCodes.SESSION_CORRUPT
  const canRetry = !isNonRetryableError(errorMessage, errorCode)

  // Continue in new tab: copy messages from current tab to a new tab
  const handleContinueInNewTab = useCallback(async () => {
    if (!workspace) return

    const dexieState = useDexieMessageStore.getState()
    const userId = dexieState.session?.userId
    if (!userId) return

    // Dynamically import tab store to avoid circular deps
    const { useTabActions: getTabActions, useTabViewStore: tabViewStoreHook } = await import("@/lib/stores/tabStore")
    const { useTabDataStore: tabDataStoreHook } = await import("@/lib/stores/tabDataStore")

    const tabActions = getTabActions()
    const tabDataStore = tabDataStoreHook.getState()
    const tabViewStore = tabViewStoreHook.getState()

    // Get active tab from tabStore (single source of truth)
    const currentTabId = tabViewStore.activeTabByWorkspace[workspace]
    if (!currentTabId) return

    const workspaceTabs = tabDataStore.tabsByWorkspace[workspace]
    if (!workspaceTabs) return
    const currentTab = Object.values(workspaceTabs)
      .flat()
      .find(t => t.id === currentTabId)
    if (!currentTab) return

    // Create new tab in the same group
    const newTab = tabActions.addTab(workspace, currentTab.tabGroupId, "Continued conversation")
    if (!newTab) return

    // Copy messages from old tab to new tab
    try {
      const db = getMessageDb(userId)
      const oldMessages = await db.messages.where("tabId").equals(currentTabId).sortBy("seq")

      // Filter out the error message itself
      const messagesToCopy = oldMessages.filter(m => m.status !== "error")

      // Write messages to the new tab with fresh IDs and updated tabId
      const now = Date.now()
      await db.messages.bulkPut(
        messagesToCopy.map((m, i) => ({
          ...m,
          id: `${newTab.id}-migrated-${i}`,
          tabId: newTab.id,
          seq: i + 1,
          createdAt: m.createdAt,
          updatedAt: now,
        })),
      )

      // Build a summary of the conversation for the new tab's first message context
      const uiMessages = messagesToCopy.map(toUIMessage)
      const lastAssistantMsg = [...uiMessages].reverse().find(m => m.type === "sdk_message")
      if (lastAssistantMsg) {
        // Add a system note so the user knows this is continued
        const noteMessage = {
          id: `${newTab.id}-continued-note`,
          tabId: newTab.id,
          type: "system" as const,
          content: { kind: "text" as const, text: "Conversation continued from a previous session." },
          createdAt: now,
          updatedAt: now,
          version: 1,
          status: "complete" as const,
          origin: "local" as const,
          seq: messagesToCopy.length + 1,
        }
        await db.messages.put(noteMessage)
      }
    } catch (e) {
      console.error("[ErrorResultMessage] Failed to copy messages:", e)
    }

    // Switch to the new tab
    tabActions.setActiveTab(workspace, newTab.id)
  }, [workspace])

  // Get friendly message based on error code
  const getFriendlyMessage = (): string => {
    // If we extracted a clean message, use it
    if (extractedMessage && !extractedMessage.includes("{") && extractedMessage !== errorMessage) {
      return extractedMessage
    }

    // For auth errors, show the actual Anthropic error message (cleaned)
    if (isAuthError && parsedError?.details) {
      if (typeof parsedError.details === "object" && "message" in parsedError.details) {
        return String(parsedError.details.message)
      }
      if (typeof parsedError.details === "string") {
        return parsedError.details
      }
    }

    if (errorCode && parsedError?.details) {
      return getErrorMessage(errorCode, parsedError.details)
    }
    if (parsedError?.message) {
      return parsedError.message
    }

    // Better fallback messages for common HTTP errors
    if (errorMessage.includes("HTTP 401")) {
      return "Session expired — refresh to sign back in"
    }
    if (errorMessage.includes("HTTP 403")) {
      return "You don't have access to this"
    }
    if (errorMessage.includes("HTTP 500")) {
      return "Server hit an issue — try again in a moment"
    }
    if (errorMessage.includes("HTTP 502")) {
      return "Server is restarting — give it a moment"
    }
    if (errorMessage.includes("HTTP 503")) {
      return "Server is busy — try again shortly"
    }
    if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
      return "Can't reach the server — check your connection"
    }
    if (errorMessage.includes("Connection lost")) {
      return "Connection dropped — check your network"
    }
    if (errorMessage.includes("No response body")) {
      return "No response — try sending again"
    }
    if (errorMessage.includes("closed connection without sending")) {
      return "Connection closed early — try again"
    }

    // Never show raw JSON to users - if the message contains JSON, show generic error
    if (errorMessage.includes("{") && errorMessage.includes("}")) {
      if (errorMessage.includes("OAuth") || errorMessage.includes("token has expired")) {
        return "Token expired — reconnect to continue"
      }
      if (isAuthError || errorMessage.includes("auth") || errorMessage.includes("token")) {
        return "Couldn't authenticate — try reconnecting"
      }
      return "That didn't work — try again"
    }

    // Fallback for unparseable errors
    return errorMessage
  }

  const friendlyMessage = getFriendlyMessage()
  const showDebug = useDebugVisible()

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        <span className={`size-1.5 rounded-full flex-shrink-0 ${isOffline ? "bg-amber-500" : "bg-red-500"}`} />
        <p className="text-[13px] text-black/40 dark:text-white/40">{friendlyMessage}</p>
        {isOffline && (
          <WifiOff size={13} strokeWidth={1.75} className="text-black/25 dark:text-white/25 flex-shrink-0" />
        )}
      </div>

      {/* Action — inline, minimal */}
      <div className="flex items-center gap-2 mt-1.5 ml-[14px]">
        {isSessionCorrupt && (
          <button
            type="button"
            onClick={handleContinueInNewTab}
            className="inline-flex items-center gap-1 text-[12px] text-black/35 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60 transition-colors"
          >
            <ExternalLink size={12} strokeWidth={1.75} />
            Continue in new tab
          </button>
        )}
        {canRetry && !isSessionCorrupt && (
          <button
            type="button"
            onClick={() => {
              trackMessageRetried()
              retryLastMessage()
            }}
            className="inline-flex items-center gap-1 text-[12px] text-black/35 dark:text-white/35 hover:text-black/60 dark:hover:text-white/60 transition-colors"
          >
            <RotateCcw size={12} strokeWidth={1.75} />
            Retry
          </button>
        )}
      </div>

      {/* Debug info — only with ?debug */}
      {showDebug && errorCode && (
        <div className="mt-1 ml-[14px] text-[10px] font-mono text-black/15 dark:text-white/15">{errorCode}</div>
      )}
    </div>
  )
}
