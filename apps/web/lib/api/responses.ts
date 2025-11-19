/**
 * API Response Helpers
 *
 * Standardized response builders for API routes.
 * Use these instead of manually creating NextResponse objects.
 */

import { NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"
import { getErrorMessage, type StructuredError, type ErrorCode } from "@/lib/error-codes"
import type { ApiError, OrganizationsResponse, WorkspacesResponse } from "./types"

interface ResponseOptions {
  origin?: string | null
  status?: number
}

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse<T>(data: T, options: ResponseOptions = {}): NextResponse {
  const { origin, status = 200 } = options
  const response = NextResponse.json(data, { status })

  // Add CORS headers if origin provided
  if (origin) {
    addCorsHeaders(response, origin)
  }

  return response
}

/**
 * Create an error response with ErrorCode
 * Automatically generates user-friendly message from error code
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function structuredErrorResponse(
  errorCode: ErrorCode,
  options: ResponseOptions & { status: number; details?: Record<string, any> },
): NextResponse {
  const { details = {} } = options
  const errorData: StructuredError = {
    ok: false,
    error: errorCode,
    message: getErrorMessage(errorCode, details),
    details: Object.keys(details).length > 0 ? details : undefined,
  }
  return jsonResponse(errorData, options)
}

/**
 * Create an error response (legacy - use structuredErrorResponse instead)
 */
export function errorResponse(error: string, options: ResponseOptions & { status: number }): NextResponse {
  const errorData: ApiError = {
    ok: false,
    error,
  }
  return jsonResponse(errorData, options)
}

/**
 * Create an organizations success response
 */
export function organizationsResponse(
  organizations: OrganizationsResponse["organizations"],
  currentUserId: string,
  options: ResponseOptions = {},
): NextResponse {
  const data: OrganizationsResponse = {
    ok: true,
    organizations,
    current_user_id: currentUserId,
  }
  return jsonResponse(data, options)
}

/**
 * Create a workspaces success response
 */
export function workspacesResponse(workspaces: string[], options: ResponseOptions = {}): NextResponse {
  const data: WorkspacesResponse = {
    ok: true,
    workspaces,
  }
  return jsonResponse(data, options)
}

/**
 * Common error responses
 */
export const CommonErrors = {
  unauthorized: (origin?: string | null) => errorResponse("Unauthorized", { origin, status: 401 }),

  forbidden: (message: string, origin?: string | null) => errorResponse(message, { origin, status: 403 }),

  badRequest: (message: string, origin?: string | null) => errorResponse(message, { origin, status: 400 }),

  notFound: (message: string, origin?: string | null) => errorResponse(message, { origin, status: 404 }),

  internal: (message = "Internal server error", origin?: string | null) =>
    errorResponse(message, { origin, status: 500 }),
}
