/**
 * Centralized error codes for consistent error handling across frontend and backend
 */

export const ErrorCodes = {
  // Workspace errors (1xxx)
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_INVALID: "WORKSPACE_INVALID",
  WORKSPACE_MISSING: "WORKSPACE_MISSING",

  // Authentication errors (2xxx)
  NO_SESSION: "NO_SESSION",
  AUTH_REQUIRED: "AUTH_REQUIRED",

  // Request errors (3xxx)
  INVALID_JSON: "INVALID_JSON",
  INVALID_REQUEST: "INVALID_REQUEST",

  // Conversation errors (4xxx)
  CONVERSATION_BUSY: "CONVERSATION_BUSY",

  // SDK errors (5xxx)
  QUERY_FAILED: "QUERY_FAILED",
  ERROR_MAX_TURNS: "ERROR_MAX_TURNS",

  // Image errors (6xxx)
  TENANT_NOT_CONFIGURED: "TENANT_NOT_CONFIGURED",
  NO_FILE: "NO_FILE",
  FILE_TOO_SMALL: "FILE_TOO_SMALL",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  IMAGE_PROCESSING_FAILED: "IMAGE_PROCESSING_FAILED",

  // General errors
  REQUEST_PROCESSING_FAILED: "REQUEST_PROCESSING_FAILED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export interface StructuredError {
  ok: false
  error: ErrorCode
  message: string
  details?: Record<string, any>
  requestId?: string
}

/**
 * Get user-friendly error message based on error code
 */
export function getErrorMessage(code: ErrorCode, details?: Record<string, any>): string {
  switch (code) {
    case ErrorCodes.WORKSPACE_NOT_FOUND:
      return details?.host
        ? `Workspace directory not found for hostname '${details.host}'.`
        : "Workspace directory not found."

    case ErrorCodes.WORKSPACE_INVALID:
      return "Invalid workspace path provided."

    case ErrorCodes.WORKSPACE_MISSING:
      return "Terminal hostname requires a workspace parameter."

    case ErrorCodes.NO_SESSION:
    case ErrorCodes.AUTH_REQUIRED:
      return "Authentication required. Please log in."

    case ErrorCodes.INVALID_JSON:
      return "Invalid request format."

    case ErrorCodes.INVALID_REQUEST:
      return "Invalid request. Please check your input."

    case ErrorCodes.CONVERSATION_BUSY:
      return "Another request is already in progress for this conversation."

    case ErrorCodes.QUERY_FAILED:
      return "Claude query failed. Please try again."

    case ErrorCodes.ERROR_MAX_TURNS:
      return "Maximum conversation turns exceeded."

    case ErrorCodes.TENANT_NOT_CONFIGURED:
      return "This domain is not configured for image uploads."

    case ErrorCodes.NO_FILE:
      return "No file was provided for upload."

    case ErrorCodes.FILE_TOO_SMALL:
      return "File is too small. Please select a larger image."

    case ErrorCodes.FILE_TOO_LARGE:
      return "File is too large. Please select a smaller image."

    case ErrorCodes.INVALID_FILE_TYPE:
      return "Invalid file type. Please select a valid image file."

    case ErrorCodes.IMAGE_PROCESSING_FAILED:
      return "Failed to process the image. Please try again."

    case ErrorCodes.REQUEST_PROCESSING_FAILED:
      return "Failed to process request."

    default:
      return "An unexpected error occurred."
  }
}

/**
 * Get detailed help text for error codes
 */
export function getErrorHelp(code: ErrorCode, details?: Record<string, any>): string | null {
  switch (code) {
    case ErrorCodes.WORKSPACE_NOT_FOUND:
      if (details?.suggestion) {
        return details.suggestion
      }
      return "Please create the workspace directory or check your configuration."

    case ErrorCodes.ERROR_MAX_TURNS:
      return "The conversation has reached the maximum number of turns allowed. Consider starting a new conversation."

    default:
      return null
  }
}

/**
 * Check if an error code is workspace-related
 */
export function isWorkspaceError(code: string): boolean {
  return code.startsWith("WORKSPACE_")
}
