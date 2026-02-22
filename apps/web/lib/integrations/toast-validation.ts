/**
 * Toast Message Validation
 *
 * Validates OAuth callback parameters before displaying in toasts
 * Prevents XSS and misleading notifications
 */

import { getOAuthErrorAction, getOAuthErrorMessage } from "@/lib/oauth/oauth-error-taxonomy"
import type { OAuthErrorAction } from "@/lib/oauth/popup-constants"
import { isOAuthProviderSupported } from "@/lib/oauth/providers"

/**
 * Valid OAuth callback status values
 */
const VALID_STATUSES = ["success", "error"] as const
type OAuthStatus = (typeof VALID_STATUSES)[number]

function sanitizeErrorCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  if (!normalized) return undefined
  if (!/^[A-Z0-9_]+$/.test(normalized)) return undefined
  return normalized
}

function sanitizeErrorAction(value: unknown): OAuthErrorAction | undefined {
  if (typeof value !== "string") return undefined
  switch (value) {
    case "retry":
    case "reconnect":
    case "switch_context":
    case "contact_admin":
      return value
    default:
      return undefined
  }
}

/**
 * Sanitize provider name for display
 * - Validates against known providers
 * - Prevents XSS by escaping HTML entities
 * - Returns safe string or null if invalid
 */
function sanitizeProviderForDisplay(provider: unknown): string | null {
  if (typeof provider !== "string" || provider.length === 0) {
    return null
  }

  const normalized = provider.toLowerCase().trim()

  // Check against known OAuth providers
  if (!isOAuthProviderSupported(normalized)) {
    return null
  }

  // Escape HTML entities (defense in depth - React already escapes, but be explicit)
  const escaped = normalized.replace(/[&<>"']/g, char => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      case "'":
        return "&#39;"
      default:
        return char
    }
  })

  return escaped
}

/**
 * Sanitize message for display
 * - Removes potentially dangerous content
 * - Truncates excessively long messages
 * - Returns safe string or default message
 */
function sanitizeMessageForDisplay(message: unknown, defaultMessage: string): string {
  if (typeof message !== "string" || message.length === 0) {
    return defaultMessage
  }

  // Truncate to reasonable length to prevent toast overflow
  const maxLength = 200
  let sanitized = message.trim()

  if (sanitized.length > maxLength) {
    sanitized = `${sanitized.substring(0, maxLength)}...`
  }

  // Escape HTML entities
  sanitized = sanitized.replace(/[&<>"']/g, char => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      case "'":
        return "&#39;"
      default:
        return char
    }
  })

  return sanitized
}

/**
 * Validate and sanitize OAuth callback parameters
 *
 * @param params - URL search params from OAuth callback
 * @returns Validated parameters or null if invalid
 *
 * @example
 * const validated = validateOAuthToastParams(new URLSearchParams(window.location.search))
 * if (validated) {
 *   if (validated.status === 'success') {
 *     toast.success(validated.successMessage)
 *   } else {
 *     toast.error(validated.errorMessage)
 *   }
 * }
 */
export function validateOAuthToastParams(params: URLSearchParams): {
  status: OAuthStatus
  provider: string
  errorCode?: string
  errorAction?: OAuthErrorAction
  successMessage?: string
  errorMessage?: string
} | null {
  const integration = params.get("integration")
  const status = params.get("status")
  const message = params.get("message")
  const errorCode = sanitizeErrorCode(params.get("error_code"))
  const errorAction = sanitizeErrorAction(params.get("error_action")) ?? getOAuthErrorAction(errorCode)

  // Validate provider
  const sanitizedProvider = sanitizeProviderForDisplay(integration)
  if (!sanitizedProvider) {
    console.warn("[Toast Validation] Invalid provider:", integration)
    return null
  }

  // Validate status
  if (!status || !VALID_STATUSES.includes(status as OAuthStatus)) {
    console.warn("[Toast Validation] Invalid status:", status)
    return null
  }

  const validatedStatus = status as OAuthStatus

  if (validatedStatus === "success") {
    return {
      status: "success",
      provider: sanitizedProvider,
      successMessage: `Successfully connected to ${sanitizedProvider}!`,
    }
  }

  // Error case: sanitize the message
  const fallbackErrorMessage = `Failed to connect to ${sanitizedProvider}`
  const messageFromCode = getOAuthErrorMessage({
    errorCode,
    message,
    provider: sanitizedProvider,
  })
  const sanitizedMessage = sanitizeMessageForDisplay(messageFromCode, fallbackErrorMessage)

  return {
    status: "error",
    provider: sanitizedProvider,
    errorCode,
    errorAction,
    errorMessage: sanitizedMessage,
  }
}
