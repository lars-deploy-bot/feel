/**
 * Centralized error codes for consistent error handling across frontend and backend
 */

export const ErrorCodes = {
  // Workspace errors (1xxx)
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_INVALID: "WORKSPACE_INVALID",
  WORKSPACE_MISSING: "WORKSPACE_MISSING",
  WORKSPACE_NOT_AUTHENTICATED: "WORKSPACE_NOT_AUTHENTICATED",
  PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",

  // Authentication errors (2xxx)
  NO_SESSION: "NO_SESSION",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INSUFFICIENT_TOKENS: "INSUFFICIENT_TOKENS",

  // Request errors (3xxx)
  INVALID_JSON: "INVALID_JSON",
  INVALID_REQUEST: "INVALID_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_SLUG: "MISSING_SLUG",
  INVALID_SLUG: "INVALID_SLUG",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",

  // Conversation errors (4xxx)
  CONVERSATION_BUSY: "CONVERSATION_BUSY",

  // SDK errors (5xxx)
  QUERY_FAILED: "QUERY_FAILED",
  ERROR_MAX_TURNS: "ERROR_MAX_TURNS",
  API_AUTH_FAILED: "API_AUTH_FAILED",

  // Tool errors (5.5xxx)
  TOOL_NOT_ALLOWED: "TOOL_NOT_ALLOWED",

  // File errors (6xxx)
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",

  // Image errors (7xxx)
  TENANT_NOT_CONFIGURED: "TENANT_NOT_CONFIGURED",
  NO_FILE: "NO_FILE",
  FILE_TOO_SMALL: "FILE_TOO_SMALL",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  IMAGE_PROCESSING_FAILED: "IMAGE_PROCESSING_FAILED",
  IMAGE_UPLOAD_FAILED: "IMAGE_UPLOAD_FAILED",
  IMAGE_LIST_FAILED: "IMAGE_LIST_FAILED",
  IMAGE_DELETE_FAILED: "IMAGE_DELETE_FAILED",

  // Stream errors (8xxx)
  STREAM_ERROR: "STREAM_ERROR",
  STREAM_PARSE_ERROR: "STREAM_PARSE_ERROR",
  RESPONSE_CREATION_FAILED: "RESPONSE_CREATION_FAILED",

  // Workspace management errors (9xxx)
  WORKSPACE_RESTART_FAILED: "WORKSPACE_RESTART_FAILED",
  SLUG_TAKEN: "SLUG_TAKEN",
  SITE_NOT_FOUND: "SITE_NOT_FOUND",
  DEPLOYMENT_FAILED: "DEPLOYMENT_FAILED",

  // General errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  REQUEST_PROCESSING_FAILED: "REQUEST_PROCESSING_FAILED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  TEST_MODE_BLOCK: "TEST_MODE_BLOCK",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export interface StructuredError {
  ok: false
  error: ErrorCode
  message: string
  help?: string // Optional actionable guidance from getErrorHelp()
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
        ? `I cannot find the workspace directory for '${details.host}'. Please ask your administrator to set up the workspace.`
        : "I cannot find the workspace directory. Please ask your administrator to set up the workspace."

    case ErrorCodes.WORKSPACE_INVALID:
      return "The workspace path is not valid. Please contact your administrator."

    case ErrorCodes.WORKSPACE_MISSING:
      return "I need a workspace to work in. Please provide a workspace parameter."

    case ErrorCodes.WORKSPACE_NOT_AUTHENTICATED:
      return "You need to log in to access this workspace. Please enter your passcode."

    case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
      return details?.attemptedPath
        ? `I cannot access '${details.attemptedPath}' - it's outside my allowed workspace. I can only access files within your project directory.`
        : "I cannot access this file - it's outside my allowed workspace. I can only access files within your project directory."

    case ErrorCodes.NO_SESSION:
    case ErrorCodes.AUTH_REQUIRED:
      return "You need to log in first. Please refresh the page and enter your passcode."

    case ErrorCodes.UNAUTHORIZED:
      return "You don't have access to this. Please check with your administrator if you need permission."

    case ErrorCodes.INVALID_CREDENTIALS:
      return "The passcode is incorrect. Please check your passcode and try again."

    case ErrorCodes.INSUFFICIENT_TOKENS:
      return details?.balance !== undefined
        ? `You don't have enough tokens to make this request (current balance: ${details.balance}). Please contact support to add more tokens.`
        : "You don't have enough tokens to make this request. Please contact support to add more tokens."

    case ErrorCodes.INVALID_JSON:
      return "I received malformed data. Please try sending your message again."

    case ErrorCodes.INVALID_REQUEST:
      return details?.field
        ? `The ${details.field} field is missing or invalid. Please check your input.`
        : "Something is missing or incorrect in your request. Please check your input and try again."

    case ErrorCodes.CONVERSATION_BUSY:
      return "I'm still working on your previous request. Please wait for me to finish before sending another message."

    case ErrorCodes.QUERY_FAILED:
      return "I encountered an error while processing your request. This might be a temporary issue - please try again."

    case ErrorCodes.ERROR_MAX_TURNS:
      return "This conversation has become too long. Please start a new conversation to continue."

    case ErrorCodes.TOOL_NOT_ALLOWED: {
      const tool = details?.tool || "this tool"
      const allowed = details?.allowed?.join(", ") || "file operation tools"
      return `I cannot use ${tool} for security reasons. I can only use these tools: ${allowed}`
    }

    case ErrorCodes.FILE_READ_ERROR:
      return details?.filePath
        ? `I cannot read the file '${details.filePath}'. It might not exist, or I might not have permission to read it.`
        : "I cannot read this file. It might not exist, or I might not have permission to read it."

    case ErrorCodes.FILE_WRITE_ERROR:
      return details?.filePath
        ? `I cannot write to '${details.filePath}'. I might not have permission to modify it.`
        : "I cannot write to this file. I might not have permission to modify it."

    case ErrorCodes.API_AUTH_FAILED:
      return "API authentication failed. The API key may be expired or invalid."

    case ErrorCodes.TENANT_NOT_CONFIGURED:
      return "Image uploads are not set up for this workspace yet. Please contact your administrator."

    case ErrorCodes.NO_FILE:
      return "You didn't select a file. Please choose an image to upload."

    case ErrorCodes.FILE_TOO_SMALL:
      return details?.minSize
        ? `This image is too small. Please select an image larger than ${details.minSize}.`
        : "This image is too small. Please select a larger image."

    case ErrorCodes.FILE_TOO_LARGE:
      return details?.maxSize
        ? `This image is too large. Please select an image smaller than ${details.maxSize}.`
        : "This image is too large. Please select a smaller image (max 10MB)."

    case ErrorCodes.INVALID_FILE_TYPE:
      return "I can only process image files (PNG, JPG, WebP). Please select a valid image."

    case ErrorCodes.IMAGE_PROCESSING_FAILED:
      return "I couldn't process this image. The file might be corrupted - please try a different image."

    case ErrorCodes.IMAGE_UPLOAD_FAILED:
      return "I couldn't upload the image. Please check your connection and try again."

    case ErrorCodes.IMAGE_LIST_FAILED:
      return "I couldn't load the list of images. Please refresh the page and try again."

    case ErrorCodes.IMAGE_DELETE_FAILED:
      return "I couldn't delete the image. Please try again or contact support if the problem persists."

    case ErrorCodes.STREAM_ERROR:
      return "I encountered an error while streaming my response. You might see incomplete messages. Please try asking again."

    case ErrorCodes.STREAM_PARSE_ERROR:
      return "I had trouble sending my response. Some parts might be missing. Please try again."

    case ErrorCodes.RESPONSE_CREATION_FAILED:
      return "I couldn't start responding to your message. Please try sending it again."

    case ErrorCodes.WORKSPACE_RESTART_FAILED:
      return "I couldn't restart your workspace. Please try again or contact support if the problem continues."

    case ErrorCodes.VALIDATION_ERROR:
      return details?.message || "Something in your input isn't valid. Please check what you entered and try again."

    case ErrorCodes.MISSING_SLUG:
      return "You need to provide a site name (slug). Please enter a site name."

    case ErrorCodes.INVALID_SLUG:
      return "The site name format is invalid. Please use only letters, numbers, and hyphens."

    case ErrorCodes.UNKNOWN_ACTION:
      return details?.action
        ? `I don't know how to handle the action '${details.action}'. Please check the available actions.`
        : "I don't recognize that action. Please check the available actions."

    case ErrorCodes.SLUG_TAKEN:
      return details?.slug
        ? `The site name '${details.slug}' is already in use. Please choose a different name.`
        : "This site name is already in use. Please choose a different name."

    case ErrorCodes.SITE_NOT_FOUND:
      return details?.slug
        ? `I couldn't find a site named '${details.slug}'. Please check the name and try again.`
        : "I couldn't find that site. Please check the site name and try again."

    case ErrorCodes.DEPLOYMENT_FAILED:
      return "I couldn't deploy your site. Please check the deployment logs to see what went wrong."

    case ErrorCodes.TEST_MODE_BLOCK:
      return "I'm in test mode right now and can't make real API calls. Please mock this endpoint in your test."

    case ErrorCodes.INTERNAL_ERROR:
      return "Something went wrong on my end. This is usually temporary - please try again in a moment."

    case ErrorCodes.REQUEST_PROCESSING_FAILED:
      return "I couldn't process your request. Please try again, and contact support if the problem continues."

    default:
      return "Something unexpected went wrong. Please try again, and let support know if you keep seeing this."
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
      return "Ask your administrator to create the workspace directory for this domain."

    case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
      return details?.workspacePath
        ? `I can only work with files in: ${details.workspacePath}`
        : "For security, I can only access files within your project workspace."

    case ErrorCodes.ERROR_MAX_TURNS:
      return "Click 'New Conversation' to start fresh and continue working."

    case ErrorCodes.TOOL_NOT_ALLOWED:
      return "For security, I'm limited to file operations: Read, Write, Edit, Glob (find files), and Grep (search files)."

    case ErrorCodes.FILE_READ_ERROR:
      return "Make sure the file exists and hasn't been deleted. Check that the file path is correct."

    case ErrorCodes.FILE_WRITE_ERROR:
      return "Make sure the file isn't locked by another program and that your workspace has write permissions."

    case ErrorCodes.STREAM_PARSE_ERROR:
      return "This usually happens with network issues. Try refreshing the page or checking your connection."

    case ErrorCodes.CONVERSATION_BUSY:
      return "Wait a moment for my current response to finish, then you can send your next message."

    case ErrorCodes.INVALID_CREDENTIALS:
      return "Check your passcode and try again."

    case ErrorCodes.API_AUTH_FAILED:
      return "Please contact the system administrator to update the API key."

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
