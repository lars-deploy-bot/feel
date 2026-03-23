/**
 * Centralized error codes for consistent error handling across frontend and backend
 */
import { env } from "@webalive/env/client"

export const ErrorCodes = {
  // Workspace errors (1xxx)
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  WORKSPACE_INVALID: "WORKSPACE_INVALID",
  WORKSPACE_MISSING: "WORKSPACE_MISSING",
  WORKSPACE_NOT_AUTHENTICATED: "WORKSPACE_NOT_AUTHENTICATED",
  WORKSPACE_EXISTS: "WORKSPACE_EXISTS",
  PATH_OUTSIDE_WORKSPACE: "PATH_OUTSIDE_WORKSPACE",

  // Worktree errors (1.5xxx)
  WORKTREE_NOT_GIT: "WORKTREE_NOT_GIT",
  WORKTREE_NOT_FOUND: "WORKTREE_NOT_FOUND",
  WORKTREE_EXISTS: "WORKTREE_EXISTS",
  WORKTREE_INVALID_SLUG: "WORKTREE_INVALID_SLUG",
  WORKTREE_INVALID_BRANCH: "WORKTREE_INVALID_BRANCH",
  WORKTREE_INVALID_FROM: "WORKTREE_INVALID_FROM",
  WORKTREE_BASE_INVALID: "WORKTREE_BASE_INVALID",
  WORKTREE_BRANCH_IN_USE: "WORKTREE_BRANCH_IN_USE",
  WORKTREE_PATH_EXISTS: "WORKTREE_PATH_EXISTS",
  WORKTREE_BRANCH_UNKNOWN: "WORKTREE_BRANCH_UNKNOWN",
  WORKTREE_DELETE_BRANCH_BLOCKED: "WORKTREE_DELETE_BRANCH_BLOCKED",
  WORKTREE_LOCKED: "WORKTREE_LOCKED",
  WORKTREE_DIRTY: "WORKTREE_DIRTY",
  WORKTREE_GIT_FAILED: "WORKTREE_GIT_FAILED",

  // Authentication errors (2xxx)
  NO_SESSION: "NO_SESSION",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  ORG_ACCESS_DENIED: "ORG_ACCESS_DENIED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_SIGNATURE: "INVALID_SIGNATURE",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_REVOKED: "SESSION_REVOKED",
  CANNOT_REVOKE_CURRENT_SESSION: "CANNOT_REVOKE_CURRENT_SESSION",
  INSUFFICIENT_TOKENS: "INSUFFICIENT_TOKENS",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  OAUTH_EXPIRED: "OAUTH_EXPIRED",

  // Request errors (3xxx)
  INVALID_JSON: "INVALID_JSON",
  INVALID_REQUEST: "INVALID_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_SLUG: "MISSING_SLUG",
  INVALID_SLUG: "INVALID_SLUG",
  UNKNOWN_ACTION: "UNKNOWN_ACTION",
  ORG_ID_REQUIRED: "ORG_ID_REQUIRED",
  INVALID_DOMAIN: "INVALID_DOMAIN",
  DOMAIN_ALREADY_EXISTS: "DOMAIN_ALREADY_EXISTS",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",

  // Model errors (3.5xxx)
  MODEL_NOT_AVAILABLE: "MODEL_NOT_AVAILABLE",
  MODEL_INVALID: "MODEL_INVALID",

  // Conversation errors (4xxx)
  CONVERSATION_BUSY: "CONVERSATION_BUSY",
  SESSION_CORRUPT: "SESSION_CORRUPT",

  // SDK errors (5xxx)
  QUERY_FAILED: "QUERY_FAILED",
  ERROR_MAX_TURNS: "ERROR_MAX_TURNS",
  API_AUTH_FAILED: "API_AUTH_FAILED",
  API_BILLING_ERROR: "API_BILLING_ERROR",

  // Tool errors (5.5xxx)
  TOOL_NOT_ALLOWED: "TOOL_NOT_ALLOWED",

  // File errors (6xxx)
  FILE_READ_ERROR: "FILE_READ_ERROR",
  FILE_WRITE_ERROR: "FILE_WRITE_ERROR",
  FILE_DELETE_ERROR: "FILE_DELETE_ERROR",
  FILE_PROTECTED: "FILE_PROTECTED",
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  PATH_IS_DIRECTORY: "PATH_IS_DIRECTORY",
  BINARY_FILE_NOT_SUPPORTED: "BINARY_FILE_NOT_SUPPORTED",
  FILE_TOO_LARGE_TO_READ: "FILE_TOO_LARGE_TO_READ",

  // Package management errors (6.5xxx)
  PACKAGE_INSTALL_FAILED: "PACKAGE_INSTALL_FAILED",
  DEV_SERVER_RESTART_FAILED: "DEV_SERVER_RESTART_FAILED",
  DEV_SERVER_START_FAILED: "DEV_SERVER_START_FAILED",

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
  DEPLOYMENT_IN_PROGRESS: "DEPLOYMENT_IN_PROGRESS",
  EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
  INVALID_ACCESS_CODE: "INVALID_ACCESS_CODE",
  ORG_NOT_FOUND: "ORG_NOT_FOUND",
  SITE_LIMIT_EXCEEDED: "SITE_LIMIT_EXCEEDED",
  RENAME_FAILED: "RENAME_FAILED",

  // Template errors (9.2xxx)
  INVALID_TEMPLATE: "INVALID_TEMPLATE",
  TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",

  // GitHub import errors (9.3xxx)
  GITHUB_NOT_CONNECTED: "GITHUB_NOT_CONNECTED",
  GITHUB_REPO_NOT_FOUND: "GITHUB_REPO_NOT_FOUND",
  GITHUB_CLONE_FAILED: "GITHUB_CLONE_FAILED",

  // Permission errors (9.5xxx)
  PERMISSION_CHECK_FAILED: "PERMISSION_CHECK_FAILED",
  PERMISSION_FIX_FAILED: "PERMISSION_FIX_FAILED",
  SITE_DIRECTORY_NOT_FOUND: "SITE_DIRECTORY_NOT_FOUND",
  SITE_USER_NOT_FOUND: "SITE_USER_NOT_FOUND",

  // OAuth/Integration errors (10xxx)
  INVALID_PROVIDER: "INVALID_PROVIDER",
  OAUTH_CONFIG_ERROR: "OAUTH_CONFIG_ERROR",
  OAUTH_STATE_MISMATCH: "OAUTH_STATE_MISMATCH",
  OAUTH_ACCESS_DENIED: "OAUTH_ACCESS_DENIED",
  OAUTH_MISSING_REQUIRED_SCOPES: "OAUTH_MISSING_REQUIRED_SCOPES",
  OAUTH_PROVIDER_ERROR: "OAUTH_PROVIDER_ERROR",
  OAUTH_ACCOUNT_CONFLICT: "OAUTH_ACCOUNT_CONFLICT",
  INTEGRATION_ERROR: "INTEGRATION_ERROR",
  INTEGRATION_NOT_CONNECTED: "INTEGRATION_NOT_CONNECTED",
  INTEGRATION_NOT_CONFIGURED: "INTEGRATION_NOT_CONFIGURED",

  MEMBER_ALREADY_EXISTS: "MEMBER_ALREADY_EXISTS",

  // Referral errors (11xxx)
  REFERRAL_INVALID_CODE: "REFERRAL_INVALID_CODE",
  REFERRAL_ALREADY_INVITED: "REFERRAL_ALREADY_INVITED",
  REFERRAL_NOT_FOUND: "REFERRAL_NOT_FOUND",
  REFERRAL_CREDIT_FAILED: "REFERRAL_CREDIT_FAILED",
  USER_NOT_FOUND: "USER_NOT_FOUND",

  // Automation errors (12xxx)
  AUTOMATION_JOB_NOT_FOUND: "AUTOMATION_JOB_NOT_FOUND",
  AUTOMATION_RUN_NOT_FOUND: "AUTOMATION_RUN_NOT_FOUND",
  AUTOMATION_JOB_DISABLED: "AUTOMATION_JOB_DISABLED",
  AUTOMATION_ALREADY_RUNNING: "AUTOMATION_ALREADY_RUNNING",

  // Scheduled job errors (13xxx)
  SCHEDULED_JOB_NOT_FOUND: "SCHEDULED_JOB_NOT_FOUND",

  // Shell/terminal errors (14xxx)
  SHELL_SERVER_UNAVAILABLE: "SHELL_SERVER_UNAVAILABLE",
  SANDBOX_NOT_READY: "SANDBOX_NOT_READY",
  WATCH_UNSUPPORTED: "WATCH_UNSUPPORTED",

  // General errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  REQUEST_PROCESSING_FAILED: "REQUEST_PROCESSING_FAILED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  TEST_MODE_BLOCK: "TEST_MODE_BLOCK",
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StructuredError {
  ok: false
  error: ErrorCode
  message: string
  help?: string
  details?: Record<string, any>
  requestId?: string
}

/**
 * Get user-friendly error message based on error code
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getErrorMessage(code: ErrorCode, details?: Record<string, any>): string {
  switch (code) {
    // Workspace
    case ErrorCodes.WORKSPACE_NOT_FOUND:
      return details?.host ? `Workspace '${details.host}' not found.` : "Workspace not found."
    case ErrorCodes.WORKSPACE_INVALID:
      return "Invalid workspace path."
    case ErrorCodes.WORKSPACE_MISSING:
      return "No workspace selected."
    case ErrorCodes.WORKSPACE_NOT_AUTHENTICATED:
      return "Log in to access this workspace."
    case ErrorCodes.WORKSPACE_EXISTS:
      return details?.workspace ? `'${details.workspace}' already exists.` : "Workspace already exists."
    case ErrorCodes.PATH_OUTSIDE_WORKSPACE:
      return "That path is outside the workspace."

    // Worktree
    case ErrorCodes.WORKTREE_NOT_GIT:
      return "Not a git repository."
    case ErrorCodes.WORKTREE_NOT_FOUND:
      return details?.slug ? `Worktree '${details.slug}' not found.` : "Worktree not found."
    case ErrorCodes.WORKTREE_EXISTS:
      return details?.slug ? `Worktree '${details.slug}' already exists.` : "Worktree already exists."
    case ErrorCodes.WORKTREE_INVALID_SLUG:
      return "Invalid slug. Use lowercase letters, numbers, and hyphens."
    case ErrorCodes.WORKTREE_INVALID_BRANCH:
      return "Invalid branch name."
    case ErrorCodes.WORKTREE_INVALID_FROM:
      return "Base ref does not exist."
    case ErrorCodes.WORKTREE_BASE_INVALID:
      return "Not a git repository root."
    case ErrorCodes.WORKTREE_BRANCH_IN_USE:
      return "Branch already checked out by another worktree."
    case ErrorCodes.WORKTREE_PATH_EXISTS:
      return "Worktree path already exists."
    case ErrorCodes.WORKTREE_BRANCH_UNKNOWN:
      return "Cannot delete branch for a detached worktree."
    case ErrorCodes.WORKTREE_DELETE_BRANCH_BLOCKED:
      return "Cannot delete the base branch."
    case ErrorCodes.WORKTREE_LOCKED:
      return "Worktree operation in progress, try again in a moment."
    case ErrorCodes.WORKTREE_DIRTY:
      return "Uncommitted changes. Commit or clean first."
    case ErrorCodes.WORKTREE_GIT_FAILED:
      return details?.message ? `Git failed: ${details.message}` : "Git command failed."

    // Auth
    case ErrorCodes.NO_SESSION:
    case ErrorCodes.AUTH_REQUIRED:
      return "Session expired. Refresh the page to log in."
    case ErrorCodes.UNAUTHORIZED:
      return "No access."
    case ErrorCodes.FORBIDDEN:
      return "Not allowed."
    case ErrorCodes.ORG_ACCESS_DENIED:
      return "No access to this organization."
    case ErrorCodes.INVALID_CREDENTIALS:
      return "Wrong passcode."
    case ErrorCodes.SESSION_NOT_FOUND:
      return "Session not found."
    case ErrorCodes.SESSION_REVOKED:
      return "Session revoked. Log in again."
    case ErrorCodes.CANNOT_REVOKE_CURRENT_SESSION:
      return "Can't revoke current session. Use Sign out."
    case ErrorCodes.INVALID_SIGNATURE:
      return "Invalid signature."
    case ErrorCodes.INSUFFICIENT_TOKENS:
      return details?.balance !== undefined ? `Not enough tokens (${details.balance} remaining).` : "Not enough tokens."
    case ErrorCodes.OAUTH_EXPIRED:
      return "Auth token expired. Try again."
    case ErrorCodes.INSUFFICIENT_CREDITS:
      return details?.balance !== undefined
        ? `Not enough credits (${details.balance} remaining).`
        : "Not enough credits."

    // Request
    case ErrorCodes.INVALID_JSON:
      return "Bad request data. Try again."
    case ErrorCodes.INVALID_REQUEST:
      return details?.field ? `Invalid ${details.field}.` : "Invalid request."
    case ErrorCodes.VALIDATION_ERROR:
      return details?.message || "Invalid input."
    case ErrorCodes.TOO_MANY_REQUESTS:
      return details?.retryAfter ? `Too many requests. Try in ${details.retryAfter}.` : "Too many requests."
    case ErrorCodes.MISSING_SLUG:
      return "Site name required."
    case ErrorCodes.INVALID_SLUG:
      return "Invalid site name. Use letters, numbers, and hyphens."
    case ErrorCodes.UNKNOWN_ACTION:
      return details?.action ? `Unknown action '${details.action}'.` : "Unknown action."
    case ErrorCodes.ORG_ID_REQUIRED:
      return "Select an organization."
    case ErrorCodes.INVALID_DOMAIN:
      return details?.error || "Invalid domain."
    case ErrorCodes.DOMAIN_ALREADY_EXISTS:
      return details?.domain ? `'${details.domain}' already taken.` : "Domain taken."

    // Model
    case ErrorCodes.MODEL_NOT_AVAILABLE:
      if (details?.retired) return `"${details.model}" has been retired. Pick another in Settings.`
      return details?.model ? `No access to "${details.model}". Pick another in Settings.` : "Model not available."
    case ErrorCodes.MODEL_INVALID:
      return details?.model ? `"${details.model}" is not recognized.` : "Unknown model."

    // Conversation
    case ErrorCodes.CONVERSATION_BUSY:
      return "Still working on your previous message."
    case ErrorCodes.SESSION_CORRUPT:
      return "Session interrupted. Continue in a new tab."

    // SDK
    case ErrorCodes.QUERY_FAILED:
      return "Something went wrong. Try again."
    case ErrorCodes.ERROR_MAX_TURNS:
      return "Conversation too long. Start a new one."
    case ErrorCodes.API_AUTH_FAILED:
      return "API authentication failed."
    case ErrorCodes.API_BILLING_ERROR:
      return "Backend billing issue. Your credits are not affected."
    case ErrorCodes.TOOL_NOT_ALLOWED:
      return "Tool not allowed."

    // File
    case ErrorCodes.FILE_READ_ERROR:
      return details?.filePath ? `Can't read '${details.filePath}'.` : "Can't read file."
    case ErrorCodes.FILE_WRITE_ERROR:
      return details?.filePath ? `Can't write to '${details.filePath}'.` : "Can't write file."
    case ErrorCodes.FILE_DELETE_ERROR:
      return details?.filePath ? `Can't delete '${details.filePath}'.` : "Can't delete file."
    case ErrorCodes.FILE_PROTECTED:
      return details?.reason ? `Protected: ${details.reason}` : "File is protected."
    case ErrorCodes.FILE_NOT_FOUND:
      return details?.filePath ? `'${details.filePath}' not found.` : "File not found."
    case ErrorCodes.PATH_IS_DIRECTORY:
      return "That's a directory, not a file."
    case ErrorCodes.BINARY_FILE_NOT_SUPPORTED:
      return "Can't read binary files."
    case ErrorCodes.FILE_TOO_LARGE_TO_READ:
      return details?.size ? `File too large (${Math.round(details.size / 1024)}KB, max 1MB).` : "File too large."

    // Package / Dev server
    case ErrorCodes.PACKAGE_INSTALL_FAILED:
      return details?.package ? `Failed to install '${details.package}'.` : "Package install failed."
    case ErrorCodes.DEV_SERVER_RESTART_FAILED:
      return "Package installed, but dev server didn't restart."
    case ErrorCodes.DEV_SERVER_START_FAILED:
      return "Dev server failed to start."

    // Image
    case ErrorCodes.TENANT_NOT_CONFIGURED:
      return "Image uploads not set up for this workspace."
    case ErrorCodes.NO_FILE:
      return "No file selected."
    case ErrorCodes.FILE_TOO_SMALL:
      return details?.minSize ? `Image too small (min ${details.minSize}).` : "Image too small."
    case ErrorCodes.FILE_TOO_LARGE:
      return details?.maxSize ? `Image too large (max ${details.maxSize}).` : "Image too large (max 10MB)."
    case ErrorCodes.INVALID_FILE_TYPE:
      return "Only PNG, JPG, and WebP images."
    case ErrorCodes.IMAGE_PROCESSING_FAILED:
      return "Image processing failed. Try a different image."
    case ErrorCodes.IMAGE_UPLOAD_FAILED:
      return "Upload failed."
    case ErrorCodes.IMAGE_LIST_FAILED:
      return "Couldn't load images."
    case ErrorCodes.IMAGE_DELETE_FAILED:
      return "Couldn't delete image."

    // Stream
    case ErrorCodes.STREAM_ERROR:
      return "Something went wrong. Try again."
    case ErrorCodes.STREAM_PARSE_ERROR:
      return "Response interrupted. Try again."
    case ErrorCodes.RESPONSE_CREATION_FAILED:
      return "Couldn't start response. Try again."

    // Workspace management
    case ErrorCodes.WORKSPACE_RESTART_FAILED:
      return "Workspace restart failed."
    case ErrorCodes.SLUG_TAKEN:
      return details?.slug ? `'${details.slug}' is taken.` : "Name taken."
    case ErrorCodes.SITE_NOT_FOUND:
      return details?.slug ? `Site '${details.slug}' not found.` : "Site not found."
    case ErrorCodes.DEPLOYMENT_FAILED:
      return "Deployment failed."
    case ErrorCodes.DEPLOYMENT_IN_PROGRESS:
      return details?.domain ? `'${details.domain}' is already deploying.` : "Already deploying."
    case ErrorCodes.EMAIL_ALREADY_REGISTERED:
      return details?.email ? `${details.email} already registered.` : "Email already registered."
    case ErrorCodes.INVALID_ACCESS_CODE:
      return `Invalid access code.${env.NEXT_PUBLIC_CONTACT_EMAIL ? ` Contact ${env.NEXT_PUBLIC_CONTACT_EMAIL}.` : ""}`
    case ErrorCodes.ORG_NOT_FOUND:
      return "Organization not found."
    case ErrorCodes.SITE_LIMIT_EXCEEDED:
      return details?.limit ? `Site limit reached (${details.limit}). Delete one first.` : "Site limit reached."
    case ErrorCodes.INVALID_TEMPLATE:
      return details?.templateId ? `Invalid template '${details.templateId}'.` : "Invalid template."
    case ErrorCodes.TEMPLATE_NOT_FOUND:
      return "Template not found."
    case ErrorCodes.RENAME_FAILED:
      return "Rename failed."

    // GitHub
    case ErrorCodes.GITHUB_NOT_CONNECTED:
      return "Connect GitHub in Settings first."
    case ErrorCodes.GITHUB_REPO_NOT_FOUND:
      return details?.repoUrl ? `Can't access ${details.repoUrl}.` : "Repository not found."
    case ErrorCodes.GITHUB_CLONE_FAILED:
      return details?.message ? `Clone failed: ${details.message}` : "Clone failed."

    // Permissions
    case ErrorCodes.PERMISSION_CHECK_FAILED:
      return "Permission check failed."
    case ErrorCodes.PERMISSION_FIX_FAILED:
      return "Permission fix failed."
    case ErrorCodes.SITE_DIRECTORY_NOT_FOUND:
      return details?.domain ? `No directory for ${details.domain}.` : "Site directory missing."
    case ErrorCodes.SITE_USER_NOT_FOUND:
      return "Site user missing."

    // OAuth / Integration
    case ErrorCodes.INVALID_PROVIDER:
      return details?.reason || "Invalid provider."
    case ErrorCodes.OAUTH_CONFIG_ERROR:
      return details?.provider ? `${details.provider} not configured.` : "OAuth not configured."
    case ErrorCodes.OAUTH_STATE_MISMATCH:
      return "Authorization expired. Try connecting again."
    case ErrorCodes.OAUTH_ACCESS_DENIED:
      return "Authorization denied."
    case ErrorCodes.OAUTH_MISSING_REQUIRED_SCOPES:
      return "Missing required permissions. Reconnect and approve all scopes."
    case ErrorCodes.OAUTH_PROVIDER_ERROR:
      return details?.provider ? `${details.provider} authorization error.` : "Authorization error."
    case ErrorCodes.OAUTH_ACCOUNT_CONFLICT:
      return "Account already connected to another user."
    case ErrorCodes.INTEGRATION_ERROR:
      return details?.provider ? `${details.provider} connection failed.` : "Integration connection failed."
    case ErrorCodes.INTEGRATION_NOT_CONNECTED:
      return details?.provider ? `Connect ${details.provider} in Settings.` : "Integration not connected."
    case ErrorCodes.INTEGRATION_NOT_CONFIGURED:
      return details?.provider ? `${details.provider} needs setup in Settings.` : "Integration needs setup."

    // Referral
    case ErrorCodes.REFERRAL_INVALID_CODE:
      return "Invalid or expired invite code."
    case ErrorCodes.REFERRAL_ALREADY_INVITED:
      return details?.email ? `${details.email} already invited.` : "Already invited."
    case ErrorCodes.REFERRAL_NOT_FOUND:
      return "No pending referral."
    case ErrorCodes.REFERRAL_CREDIT_FAILED:
      return "Credit award failed."
    case ErrorCodes.USER_NOT_FOUND:
      return "User not found."
    case ErrorCodes.MEMBER_ALREADY_EXISTS:
      return details?.email ? `${details.email} is already a member.` : "Already a member."

    // Automation
    case ErrorCodes.AUTOMATION_JOB_NOT_FOUND:
      return "Automation not found."
    case ErrorCodes.AUTOMATION_RUN_NOT_FOUND:
      return "Run not found."
    case ErrorCodes.SCHEDULED_JOB_NOT_FOUND:
      return "Scheduled job not found."
    case ErrorCodes.AUTOMATION_JOB_DISABLED:
      return "Automation is disabled."
    case ErrorCodes.AUTOMATION_ALREADY_RUNNING:
      return "Already running."

    // Shell / Sandbox
    case ErrorCodes.SHELL_SERVER_UNAVAILABLE:
      return "Terminal unavailable. Try again."
    case ErrorCodes.SANDBOX_NOT_READY:
      return "Sandbox not running. Send a message to start it."
    case ErrorCodes.WATCH_UNSUPPORTED:
      return "File watching not available in sandbox."

    // Test
    case ErrorCodes.TEST_MODE_BLOCK:
      return "Test mode — no real API calls."

    // General
    case ErrorCodes.INTERNAL_ERROR:
    case ErrorCodes.REQUEST_PROCESSING_FAILED:
      return "Something went wrong. Try again."

    default:
      return "Something went wrong. Try again."
  }
}

/**
 * Get detailed help text for error codes.
 * Intentionally returns null for all codes — error messages should be
 * self-contained and light. Secondary help text adds noise.
 * Kept as a function so callers don't need to change.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
export function getErrorHelp(_code: ErrorCode, _details?: Record<string, any>): string | null {
  return null
}

/**
 * Check if an error code is workspace-related
 */
export function isWorkspaceError(code: string): boolean {
  return code.startsWith("WORKSPACE_")
}
