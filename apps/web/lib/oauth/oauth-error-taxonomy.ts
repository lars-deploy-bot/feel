import { type ErrorCode, ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import type { OAuthErrorAction } from "@/lib/oauth/popup-constants"

export type OAuthCallbackStatus = "success" | "error"

/**
 * Server-side OAuth callback payload.
 * Maps to OAuthCallbackMessage on the client (popup-constants.ts).
 */
export interface OAuthCallbackPayload {
  integration: string
  status: OAuthCallbackStatus
  error_code?: string
  error_action?: OAuthErrorAction
  message?: string
}

const OAUTH_ERROR_ACTIONS: Partial<Record<ErrorCode, OAuthErrorAction>> = {
  [ErrorCodes.OAUTH_STATE_MISMATCH]: "retry",
  [ErrorCodes.OAUTH_ACCESS_DENIED]: "retry",
  [ErrorCodes.OAUTH_MISSING_REQUIRED_SCOPES]: "reconnect",
  [ErrorCodes.OAUTH_PROVIDER_ERROR]: "retry",
  [ErrorCodes.OAUTH_CONFIG_ERROR]: "contact_admin",
  [ErrorCodes.TOO_MANY_REQUESTS]: "retry",
  [ErrorCodes.FORBIDDEN]: "contact_admin",
  [ErrorCodes.UNAUTHORIZED]: "contact_admin",
  [ErrorCodes.INTEGRATION_ERROR]: "retry",
}

const PROVIDER_ERROR_CODE_MAP: Record<string, ErrorCode> = {
  access_denied: ErrorCodes.OAUTH_ACCESS_DENIED,
}

const KNOWN_ERROR_CODES = new Set<string>(Object.values(ErrorCodes))

function isErrorCode(value: string): value is ErrorCode {
  return KNOWN_ERROR_CODES.has(value)
}

function trimMessage(value: string | null | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized ? normalized : undefined
}

export function getOAuthErrorAction(errorCode?: string | null): OAuthErrorAction | undefined {
  if (!errorCode || !isErrorCode(errorCode)) {
    return undefined
  }
  return OAUTH_ERROR_ACTIONS[errorCode] ?? "retry"
}

export function mapProviderErrorToOAuthCode(providerError: string): ErrorCode {
  return PROVIDER_ERROR_CODE_MAP[providerError.toLowerCase()] ?? ErrorCodes.OAUTH_PROVIDER_ERROR
}

export function getOAuthErrorMessage(params: {
  errorCode?: string | null
  message?: string | null
  provider?: string
}): string {
  const directMessage = trimMessage(params.message)
  if (params.errorCode && isErrorCode(params.errorCode)) {
    return getErrorMessage(params.errorCode, params.provider ? { provider: params.provider } : undefined)
  }
  return directMessage || "Connection failed. Please try again."
}

export function createOAuthSuccessPayload(integration: string): OAuthCallbackPayload {
  return {
    integration,
    status: "success",
  }
}

export function createOAuthErrorPayload(params: {
  integration: string
  errorCode: ErrorCode
  message?: string
  provider?: string
  errorAction?: OAuthErrorAction
}): OAuthCallbackPayload {
  const errorAction = params.errorAction ?? getOAuthErrorAction(params.errorCode)
  const message = getOAuthErrorMessage({
    errorCode: params.errorCode,
    message: params.message,
    provider: params.provider,
  })

  return {
    integration: params.integration,
    status: "error",
    error_code: params.errorCode,
    error_action: errorAction,
    message,
  }
}

export function buildOAuthCallbackRedirectUrl(baseUrl: string, payload: OAuthCallbackPayload): string {
  const callbackUrl = new URL("/oauth/callback", baseUrl)
  callbackUrl.searchParams.set("integration", payload.integration)
  callbackUrl.searchParams.set("status", payload.status)

  if (payload.error_code) {
    callbackUrl.searchParams.set("error_code", payload.error_code)
  }
  if (payload.error_action) {
    callbackUrl.searchParams.set("error_action", payload.error_action)
  }
  if (payload.message) {
    callbackUrl.searchParams.set("message", payload.message)
  }

  return callbackUrl.toString()
}
