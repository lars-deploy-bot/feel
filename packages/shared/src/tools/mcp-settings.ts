/**
 * MCP Tool Settings — Shared Configuration
 *
 * Centralizes tunable limits and settings for internal MCP tools.
 * Import from here instead of hardcoding magic numbers in tool implementations.
 */

// ---------------------------------------------------------------------------
// ask_clarification
// ---------------------------------------------------------------------------

/** Maximum number of clarification questions per invocation */
export const CLARIFICATION_MAX_QUESTIONS = 8

/** Exact number of options each clarification question must have (a 4th "Other" is added by the frontend) */
export const CLARIFICATION_OPTIONS_PER_QUESTION = 3

// ---------------------------------------------------------------------------
// create_website
// ---------------------------------------------------------------------------

/** Minimum length for a website subdomain slug */
export const WEBSITE_SLUG_MIN_LENGTH = 3

/** Maximum length for a website subdomain slug */
export const WEBSITE_SLUG_MAX_LENGTH = 16

/** Maximum characters for site ideas/description */
export const WEBSITE_SITE_IDEAS_MAX_CHARS = 5000

// ---------------------------------------------------------------------------
// read_server_logs / debug_workspace
// ---------------------------------------------------------------------------

/** Maximum log lines that can be requested */
export const LOGS_MAX_LINES = 1000

/** Default log lines for read_server_logs */
export const LOGS_DEFAULT_LINES = 100

/** Default log lines for debug_workspace (higher for debugging context) */
export const LOGS_DEBUG_DEFAULT_LINES = 200

// ---------------------------------------------------------------------------
// sessions_list
// ---------------------------------------------------------------------------

/** Maximum message preview count per session */
export const SESSIONS_LIST_MAX_MESSAGE_PREVIEW = 20

/** Maximum sessions to return */
export const SESSIONS_LIST_MAX_LIMIT = 100

/** Default sessions to return */
export const SESSIONS_LIST_DEFAULT_LIMIT = 50

// ---------------------------------------------------------------------------
// sessions_send
// ---------------------------------------------------------------------------

/** Maximum timeout in seconds for waiting on a reply */
export const SESSIONS_SEND_MAX_TIMEOUT_SECONDS = 300

/** Default timeout in seconds */
export const SESSIONS_SEND_DEFAULT_TIMEOUT_SECONDS = 30

// ---------------------------------------------------------------------------
// sessions_history
// ---------------------------------------------------------------------------

/** Maximum messages to return from history */
export const SESSIONS_HISTORY_MAX_LIMIT = 100

/** Default messages to return from history */
export const SESSIONS_HISTORY_DEFAULT_LIMIT = 50
