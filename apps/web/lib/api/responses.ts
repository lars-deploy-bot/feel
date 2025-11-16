/**
 * API Response Helpers
 *
 * Standardized response builders for API routes.
 * Use these instead of manually creating NextResponse objects.
 */

import { NextResponse } from "next/server"
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
    const { addCorsHeaders } = require("@/lib/cors-utils")
    addCorsHeaders(response, origin)
  }

  return response
}

/**
 * Create an error response
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
  options: ResponseOptions = {},
): NextResponse {
  const data: OrganizationsResponse = {
    ok: true,
    organizations,
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
