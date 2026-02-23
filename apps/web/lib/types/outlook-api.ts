/**
 * Outlook API Response Types
 *
 * Shared types for Outlook send and draft endpoints.
 * Used by both API routes and frontend components.
 */

/**
 * Successful response from /api/outlook/send
 */
export interface OutlookSendResponse {
  ok: true
  messageId: string
  threadId?: string
}

/**
 * Successful response from /api/outlook/draft
 */
export interface OutlookDraftResponse {
  ok: true
  draftId: string
  messageId?: string
}

/**
 * Error response from Outlook API endpoints
 */
export interface OutlookErrorResponse {
  ok?: false
  success?: false
  message?: string
  reason?: string
}

/**
 * Union type for all Outlook API responses
 */
export type OutlookApiResponse = OutlookSendResponse | OutlookDraftResponse | OutlookErrorResponse

/**
 * Type guard for successful send response
 */
export function isOutlookSendResponse(response: unknown): response is OutlookSendResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    (response as Record<string, unknown>).ok === true &&
    "messageId" in response
  )
}

/**
 * Type guard for successful draft response
 */
export function isOutlookDraftResponse(response: unknown): response is OutlookDraftResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    (response as Record<string, unknown>).ok === true &&
    "draftId" in response
  )
}

/**
 * Type guard for error response
 */
export function isOutlookErrorResponse(response: unknown): response is OutlookErrorResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    ((response as Record<string, unknown>).ok === false ||
      (response as Record<string, unknown>).success === false ||
      "reason" in response ||
      "message" in response)
  )
}
