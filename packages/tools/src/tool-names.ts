/**
 * Shared Tool Name Constants
 *
 * Single source of truth for all tool names across the codebase.
 * Import these instead of hardcoding strings.
 *
 * @example
 * ```typescript
 * import { LINEAR, FILE_OPS } from "@alive-brug/tools"
 *
 * if (toolName === LINEAR.CREATE_ISSUE) { ... }
 * ```
 */

// ============================================================
// LINEAR MCP TOOLS
// ============================================================

export const LINEAR = {
  CREATE_ISSUE: "mcp__linear__create_issue",
  UPDATE_ISSUE: "mcp__linear__update_issue",
  GET_ISSUE: "mcp__linear__get_issue",
  LIST_ISSUES: "mcp__linear__list_issues",
  CREATE_COMMENT: "mcp__linear__create_comment",
  LIST_COMMENTS: "mcp__linear__list_comments",
  LIST_PROJECTS: "mcp__linear__list_projects",
  LIST_TEAMS: "mcp__linear__list_teams",
} as const

export type LinearTool = (typeof LINEAR)[keyof typeof LINEAR]

// ============================================================
// STRIPE MCP TOOLS
// ============================================================

// Specific Stripe tool names
export const STRIPE = {
  LIST_SUBSCRIPTIONS: "mcp__stripe__list_subscriptions",
  LIST_CUSTOMERS: "mcp__stripe__list_customers",
  FETCH_RESOURCES: "mcp__stripe__fetch_stripe_resources",
  RETRIEVE_BALANCE: "mcp__stripe__retrieve_balance",
  GET_ACCOUNT_INFO: "mcp__stripe__get_stripe_account_info",
  LIST_PAYMENT_INTENTS: "mcp__stripe__list_payment_intents",
  SEARCH_RESOURCES: "mcp__stripe__search_stripe_resources",
} as const

// Stripe tool patterns for matching dynamic tool names
// Use with matchesPattern() helper for wildcard matching
export const STRIPE_PATTERNS = {
  CREATE_ANY: "mcp__stripe__create_*",
  UPDATE_ANY: "mcp__stripe__update_*",
  LIST_ANY: "mcp__stripe__list_*",
  GET_ANY: "mcp__stripe__get_*",
  RETRIEVE_ANY: "mcp__stripe__retrieve_*",
  SEARCH_ANY: "mcp__stripe__search_*",
} as const

export type StripeTool = (typeof STRIPE)[keyof typeof STRIPE]
export type StripePattern = (typeof STRIPE_PATTERNS)[keyof typeof STRIPE_PATTERNS]

// ============================================================
// FILE OPERATIONS (SDK built-in)
// ============================================================

export const FILE_OPS = {
  READ: "read",
  WRITE: "write",
  EDIT: "edit",
  GREP: "grep",
  GLOB: "glob",
} as const

export type FileOpTool = (typeof FILE_OPS)[keyof typeof FILE_OPS]

// ============================================================
// OTHER TOOLS
// ============================================================

export const OTHER = {
  BASH: "bash",
  TASK: "task",
} as const

export type OtherTool = (typeof OTHER)[keyof typeof OTHER]

// ============================================================
// ALL TOOLS (union type)
// ============================================================

export type ToolName = LinearTool | StripeTool | FileOpTool | OtherTool

// For dynamic/unknown tools, use this explicitly
export type AnyToolName = ToolName | (string & {})
