import { RotateCcw } from "lucide-react"
import { useRetry } from "@/features/chat/lib/retry-context"
import type { StructuredError } from "@/lib/error-codes"
import { getErrorHelp, getErrorMessage, isWorkspaceError } from "@/lib/error-codes"

/**
 * Check if an error is retryable (network issues, server errors, timeouts)
 */
function isRetryableError(errorMessage: string): boolean {
  const retryablePatterns = [
    "Failed to fetch",
    "NetworkError",
    "TypeError: fetch",
    "Connection lost",
    "No response body",
    "closed connection",
    "timeout",
    "HTTP 500",
    "HTTP 502",
    "HTTP 503",
    "HTTP 504",
    "Server error",
    "Service temporarily unavailable",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
  ]

  const lowerMessage = errorMessage.toLowerCase()
  return retryablePatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()))
}

interface ErrorResultMessageProps {
  content: {
    type: "result"
    is_error: true
    result: string
  }
}

export function ErrorResultMessage({ content }: ErrorResultMessageProps) {
  const { retryLastMessage } = useRetry()
  const errorMessage = content.result
  const canRetry = isRetryableError(errorMessage)

  let parsedError: StructuredError | null = null
  try {
    parsedError = JSON.parse(errorMessage)
  } catch {
    // Not structured error, use raw message
  }

  const errorCode = parsedError?.error
  const isWorkspace = errorCode ? isWorkspaceError(errorCode) : false
  const isAuthError = errorCode === "API_AUTH_FAILED"

  // Get friendly message based on error code
  const getFriendlyMessage = (): string => {
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
      return "Your session has expired. Please refresh the page and log in again."
    }
    if (errorMessage.includes("HTTP 403")) {
      return "Access denied. Please check your permissions."
    }
    if (errorMessage.includes("HTTP 500")) {
      return "Server error. Please try again in a moment."
    }
    if (errorMessage.includes("HTTP 503")) {
      return "Service temporarily unavailable. Please try again in a moment."
    }
    if (errorMessage.includes("Connection lost")) {
      return "Connection lost. Please check your internet connection and try again."
    }
    if (errorMessage.includes("No response body")) {
      return "Server did not respond. Please try again."
    }
    if (errorMessage.includes("closed connection without sending")) {
      return "Server closed the connection unexpectedly. Please try again."
    }

    // Fallback for unparseable errors
    return errorMessage
  }

  const getHelpText = () => {
    if (errorCode && parsedError?.details) {
      return getErrorHelp(errorCode, parsedError.details)
    }

    // Specific help for authentication errors
    if (isAuthError) {
      return "Please contact your administrator to restore access."
    }

    // Helpful context for common errors
    if (errorMessage.includes("HTTP 401") || errorMessage.includes("session has expired")) {
      return "You may need to refresh the page to restore your session."
    }
    if (errorMessage.includes("Connection lost") || errorMessage.includes("closed connection")) {
      return "This can happen due to network issues or server maintenance. Your previous messages are safe."
    }

    return null
  }

  const details = parsedError?.details ?? null
  const helpText = getHelpText()
  const friendlyMessage = getFriendlyMessage()

  return (
    <div className="py-3 mb-4">
      <div className="border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/30 p-4 rounded">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg
              className="w-5 h-5 text-red-500 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
              {isAuthError ? "Authentication Error" : isWorkspace ? "Workspace Error" : "Error"}
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">{friendlyMessage}</p>

            {helpText && <p className="text-xs text-red-600 dark:text-red-400 mt-2 leading-relaxed">{helpText}</p>}

            {details && (details.expectedPath || details.fullPath) && (
              <div className="mt-3 p-2 bg-red-100/50 dark:bg-red-900/20 rounded text-xs font-mono text-red-800 dark:text-red-200">
                {details.expectedPath && (
                  <div>
                    <span className="font-semibold">Expected:</span> {details.expectedPath}
                  </div>
                )}
                {details.fullPath && (
                  <div>
                    <span className="font-semibold">Path:</span> {details.fullPath}
                  </div>
                )}
              </div>
            )}

            {errorCode && (
              <div className="mt-2 text-xs text-red-500/70 dark:text-red-400/70 font-mono">Error code: {errorCode}</div>
            )}

            {typeof parsedError?.details === "object" &&
              parsedError.details &&
              "apiRequestId" in parsedError.details &&
              parsedError.details.apiRequestId && (
                <div className="mt-1 text-xs text-red-500/70 dark:text-red-400/70 font-mono">
                  Request ID: {String(parsedError.details.apiRequestId)}
                </div>
              )}

            {canRetry && (
              <button
                type="button"
                onClick={retryLastMessage}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
