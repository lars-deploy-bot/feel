/**
 * Stream Tools Configuration
 *
 * Stream tool permissions and runtime configuration.
 *
 * Internal MCP tool policies are generated from INTERNAL_TOOL_DESCRIPTORS
 * (packages/shared/src/tools/internal-tool-descriptors.ts — the single source of truth).
 * SDK tool policies are maintained here (SDK tools are external to our codebase).
 *
 * This file defines:
 * - A single per-tool policy registry (SDK + internal MCP tools)
 * - Role/workspace/plan-mode enforcement helpers
 * - Derived runtime config (allowed/disallowed/visible tool lists)
 *
 * Used by:
 * - apps/web runtime routes and runners
 * - packages/tools ask-ai bridge mode
 * - worker-pool tool permission enforcement
 */

import { GLOBAL_MCP_PROVIDERS, getGlobalMcpToolNames, isOAuthMcpTool, OAUTH_MCP_PROVIDERS } from "../mcp-providers.js"
import {
  INTERNAL_TOOL_DESCRIPTORS,
  type InternalToolDescriptor,
  qualifiedMcpName,
} from "./internal-tool-descriptors.js"

// =============================================================================
// STREAM TOOL POLICY TYPES
// =============================================================================

export type StreamToolRole = "member" | "admin" | "superadmin"
export type StreamWorkspaceKind = "site" | "platform"
export type StreamPlanModeBehavior = "allow" | "block"
export type StreamToolVisibility = "visible" | "silent"

export interface StreamToolContext {
  role: StreamToolRole
  workspaceKind: StreamWorkspaceKind
  isPlanMode: boolean
  connectedProviders: string[]
}

export interface StreamToolPolicy {
  roles: readonly StreamToolRole[]
  workspaceKinds: readonly StreamWorkspaceKind[]
  planMode: StreamPlanModeBehavior
  visibility: StreamToolVisibility
  requiresUserApproval?: boolean
  reason: string
}

export interface StreamToolDecision {
  executable: boolean
  visibleToClient: boolean
  policyFound: boolean
  reason?: string
}

export interface StreamToolRuntimeConfig {
  allowedTools: string[]
  disallowedTools: string[]
  visibleTools: string[]
}

interface StreamToolContextInput {
  isAdmin?: boolean
  isSuperadmin?: boolean
  isSuperadminWorkspace?: boolean
  isPlanMode?: boolean
  connectedProviders?: string[]
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

export function getStreamToolRole(isAdmin: boolean, isSuperadmin: boolean): StreamToolRole {
  if (isSuperadmin) return "superadmin"
  if (isAdmin) return "admin"
  return "member"
}

export function getStreamWorkspaceKind(isSuperadminWorkspace: boolean): StreamWorkspaceKind {
  return isSuperadminWorkspace ? "platform" : "site"
}

export function createStreamToolContext(input: StreamToolContextInput = {}): StreamToolContext {
  const role = getStreamToolRole(!!input.isAdmin, !!input.isSuperadmin)
  const workspaceKind = getStreamWorkspaceKind(!!input.isSuperadminWorkspace)
  const connectedProviders = dedupeStrings((input.connectedProviders ?? []).filter(Boolean))

  return {
    role,
    workspaceKind,
    isPlanMode: !!input.isPlanMode,
    connectedProviders,
  }
}

// =============================================================================
// TOOL REGISTRY (SINGLE SOURCE OF TRUTH)
// =============================================================================

/**
 * SDK tool name constants — the SINGLE source of truth for all SDK tool names.
 *
 * Import `SDK_TOOL` instead of hardcoding "Read", "Write", "Bash", etc.
 * PascalCase values match what the Claude Agent SDK sends at runtime.
 *
 * @example
 * ```typescript
 * import { SDK_TOOL } from "@webalive/shared"
 * if (toolName === SDK_TOOL.READ) { ... }
 * ```
 */
type SdkToolMap = {
  readonly READ: "Read"
  readonly WRITE: "Write"
  readonly EDIT: "Edit"
  readonly GLOB: "Glob"
  readonly GREP: "Grep"
  readonly NOTEBOOK_EDIT: "NotebookEdit"
  readonly BASH: "Bash"
  readonly BASH_OUTPUT: "BashOutput"
  readonly TASK: "Task"
  readonly TASK_OUTPUT: "TaskOutput"
  readonly TASK_STOP: "TaskStop"
  readonly MCP: "Mcp"
  readonly LIST_MCP_RESOURCES: "ListMcpResources"
  readonly READ_MCP_RESOURCE: "ReadMcpResource"
  readonly WEB_FETCH: "WebFetch"
  readonly WEB_SEARCH: "WebSearch"
  readonly ASK_USER_QUESTION: "AskUserQuestion"
  readonly EXIT_PLAN_MODE: "ExitPlanMode"
  readonly TODO_WRITE: "TodoWrite"
  readonly SKILL: "Skill"
}

export const SDK_TOOL: SdkToolMap = {
  // File operations
  READ: "Read",
  WRITE: "Write",
  EDIT: "Edit",
  GLOB: "Glob",
  GREP: "Grep",
  NOTEBOOK_EDIT: "NotebookEdit",
  // Shell
  BASH: "Bash",
  BASH_OUTPUT: "BashOutput",
  // Agents / tasks
  TASK: "Task",
  TASK_OUTPUT: "TaskOutput",
  TASK_STOP: "TaskStop",
  // MCP bridge
  MCP: "Mcp",
  LIST_MCP_RESOURCES: "ListMcpResources",
  READ_MCP_RESOURCE: "ReadMcpResource",
  // Web
  WEB_FETCH: "WebFetch",
  WEB_SEARCH: "WebSearch",
  // UI / planning
  ASK_USER_QUESTION: "AskUserQuestion",
  EXIT_PLAN_MODE: "ExitPlanMode",
  TODO_WRITE: "TodoWrite",
  SKILL: "Skill",
}

export type SdkToolKey = keyof typeof SDK_TOOL
export type StreamSdkToolName = (typeof SDK_TOOL)[SdkToolKey]
export type StreamSdkToolLowerName = Lowercase<StreamSdkToolName>

/** Derived array — kept for backwards compat with existing consumers. */
function defineSdkToolNames<const T extends readonly StreamSdkToolName[]>(...values: T): T {
  return values
}

export const STREAM_SDK_TOOL_NAMES = defineSdkToolNames(
  SDK_TOOL.READ,
  SDK_TOOL.WRITE,
  SDK_TOOL.EDIT,
  SDK_TOOL.GLOB,
  SDK_TOOL.GREP,
  SDK_TOOL.NOTEBOOK_EDIT,
  SDK_TOOL.BASH,
  SDK_TOOL.BASH_OUTPUT,
  SDK_TOOL.TASK,
  SDK_TOOL.TASK_OUTPUT,
  SDK_TOOL.TASK_STOP,
  SDK_TOOL.MCP,
  SDK_TOOL.LIST_MCP_RESOURCES,
  SDK_TOOL.READ_MCP_RESOURCE,
  SDK_TOOL.WEB_FETCH,
  SDK_TOOL.WEB_SEARCH,
  SDK_TOOL.ASK_USER_QUESTION,
  SDK_TOOL.EXIT_PLAN_MODE,
  SDK_TOOL.TODO_WRITE,
  SDK_TOOL.SKILL,
)

type MissingSdkToolNames = Exclude<StreamSdkToolName, (typeof STREAM_SDK_TOOL_NAMES)[number]>
const _assertAllSdkToolNamesListed: MissingSdkToolNames extends never ? true : never = true

/**
 * Lowercase SDK tool name constants — derived from SDK_TOOL (cannot drift).
 * Used for UI routing (switch/case on lowercased tool names).
 *
 * @example
 * ```typescript
 * import { SDK_TOOL_LOWER } from "@webalive/shared"
 * const tool = toolName.toLowerCase()
 * if (tool === SDK_TOOL_LOWER.READ) { ... }
 * ```
 */
type SdkToolLowerMap = {
  readonly [K in SdkToolKey]: Lowercase<(typeof SDK_TOOL)[K]>
}

export const SDK_TOOL_LOWER: SdkToolLowerMap = {
  READ: "read",
  WRITE: "write",
  EDIT: "edit",
  GLOB: "glob",
  GREP: "grep",
  NOTEBOOK_EDIT: "notebookedit",
  BASH: "bash",
  BASH_OUTPUT: "bashoutput",
  TASK: "task",
  TASK_OUTPUT: "taskoutput",
  TASK_STOP: "taskstop",
  MCP: "mcp",
  LIST_MCP_RESOURCES: "listmcpresources",
  READ_MCP_RESOURCE: "readmcpresource",
  WEB_FETCH: "webfetch",
  WEB_SEARCH: "websearch",
  ASK_USER_QUESTION: "askuserquestion",
  EXIT_PLAN_MODE: "exitplanmode",
  TODO_WRITE: "todowrite",
  SKILL: "skill",
}

// =============================================================================
// TOOL DISPLAY HELPERS (shared across UI components)
// =============================================================================

const STREAM_SDK_TOOL_LOWER_NAME_SET = new Set<string>(Object.values(SDK_TOOL_LOWER))

function isStreamSdkToolLowerName(value: string): value is StreamSdkToolLowerName {
  return STREAM_SDK_TOOL_LOWER_NAME_SET.has(value)
}

/** Case-insensitive SDK tool normalization helper. */
function normalizeSdkToolLowerName(toolName: string): StreamSdkToolLowerName | null {
  const normalized = toolName.toLowerCase()
  return isStreamSdkToolLowerName(normalized) ? normalized : null
}

/** Maps SDK lowercase tool name → action verb (e.g. "read" → "reading"). */
const ACTION_LABELS: Partial<Record<StreamSdkToolLowerName, string>> = {
  [SDK_TOOL_LOWER.READ]: "reading",
  [SDK_TOOL_LOWER.EDIT]: "editing",
  [SDK_TOOL_LOWER.WRITE]: "writing",
  [SDK_TOOL_LOWER.GREP]: "searching",
  [SDK_TOOL_LOWER.GLOB]: "finding",
  [SDK_TOOL_LOWER.BASH]: "running",
  [SDK_TOOL_LOWER.TASK]: "delegating",
  [SDK_TOOL_LOWER.WEB_FETCH]: "fetching",
}

/**
 * Get the action verb for a tool (case-insensitive).
 * Returns lowercase verb like "reading", "editing", or the tool name lowercased as fallback.
 */
export function getToolActionLabel(toolName: string): string {
  const normalized = normalizeSdkToolLowerName(toolName)
  return (normalized ? ACTION_LABELS[normalized] : null) ?? toolName.toLowerCase()
}

/** File tools (lowercase) that have a file_path input. */
const FILE_TOOLS_LOWER: ReadonlySet<StreamSdkToolLowerName> = new Set([
  SDK_TOOL_LOWER.READ,
  SDK_TOOL_LOWER.WRITE,
  SDK_TOOL_LOWER.EDIT,
])

type ToolInputRecord = Record<string, unknown>

function isToolInputRecord(input: unknown): input is ToolInputRecord {
  return typeof input === "object" && input !== null
}

function getInputString(input: ToolInputRecord, key: string): string | null {
  const value = input[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

function getInputFirstString(input: ToolInputRecord, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = getInputString(input, key)
    if (value) return value
  }
  return null
}

function getFileNameFromPath(filePath: string): string {
  const segments = filePath.split(/[\\/]/)
  return segments[segments.length - 1] || filePath
}

function truncate(value: string, maxChars: number): string {
  if (maxChars <= 0) return value
  return value.length > maxChars ? `${value.slice(0, maxChars)}...` : value
}

function getWebFetchHostOrFallback(url: string, maxChars: number): string {
  const cleanHost = (value: string) => value.replace(/^www\./, "")

  try {
    return cleanHost(new URL(url).hostname)
  } catch {
    try {
      return cleanHost(new URL(`https://${url}`).hostname)
    } catch {
      return truncate(url, maxChars)
    }
  }
}

function getBashDetail(command: string, mode: "firstWord" | "firstLine"): string | null {
  const firstLine = command.split(/\r?\n/, 1)[0]?.trim()
  if (!firstLine) return null
  if (mode === "firstLine") return firstLine
  return firstLine.match(/^\S+/)?.[0] ?? null
}

export interface ToolDetailOptions {
  bashDetail?: "firstWord" | "firstLine"
  webFetchFallbackMaxChars?: number
}

/**
 * Extract the relevant detail string from a tool's input (case-insensitive).
 * Returns filename for file tools, pattern for grep/glob, first command word for bash,
 * hostname for webfetch, or null.
 */
export function getToolDetail(toolName: string, input: unknown, options: ToolDetailOptions = {}): string | null {
  if (!isToolInputRecord(input)) return null

  const lower = normalizeSdkToolLowerName(toolName)
  if (!lower) return null

  // File tools → filename
  if (FILE_TOOLS_LOWER.has(lower)) {
    const filePath = getInputFirstString(input, ["file_path", "path"])
    if (filePath) return getFileNameFromPath(filePath)
  }

  if (lower === SDK_TOOL_LOWER.GLOB || lower === SDK_TOOL_LOWER.GREP) {
    return getInputString(input, "pattern")
  }
  if (lower === SDK_TOOL_LOWER.BASH) {
    const command = getInputString(input, "command")
    if (!command) return null
    return getBashDetail(command, options.bashDetail ?? "firstWord")
  }
  if (lower === SDK_TOOL_LOWER.WEB_FETCH) {
    const url = getInputString(input, "url")
    if (!url) return null
    return getWebFetchHostOrFallback(url, options.webFetchFallbackMaxChars ?? 30)
  }
  if (lower === SDK_TOOL_LOWER.TASK) {
    return getInputString(input, "description")
  }

  return null
}

/**
 * Derived from INTERNAL_TOOL_DESCRIPTORS (single source of truth).
 * Only enabled tools get a stream policy entry.
 */
export const STREAM_INTERNAL_MCP_TOOLS: readonly string[] = INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled).map(
  qualifiedMcpName,
)
export type StreamInternalMcpToolName = string

export type StreamPolicyToolName = StreamSdkToolName | (string & {})

const ALL_ROLES: readonly StreamToolRole[] = ["member", "admin", "superadmin"]
const ADMIN_AND_SUPERADMIN: readonly StreamToolRole[] = ["admin", "superadmin"]
const SUPERADMIN_ONLY: readonly StreamToolRole[] = ["superadmin"]
const MEMBER_ONLY: readonly StreamToolRole[] = ["member"]
const BOTH_WORKSPACE_KINDS: readonly StreamWorkspaceKind[] = ["site", "platform"]

function policy(overrides: Partial<StreamToolPolicy> & Pick<StreamToolPolicy, "reason">): StreamToolPolicy {
  return {
    roles: ALL_ROLES,
    workspaceKinds: BOTH_WORKSPACE_KINDS,
    planMode: "allow",
    visibility: "visible",
    ...overrides,
  }
}

/**
 * Build a StreamToolPolicy from an InternalToolDescriptor.
 * Applies descriptor overrides to the default policy.
 */
function descriptorToPolicy(d: InternalToolDescriptor): StreamToolPolicy {
  return policy({
    reason: d.reason,
    ...(d.workspaceKinds ? { workspaceKinds: d.workspaceKinds } : {}),
    ...(d.planMode ? { planMode: d.planMode } : {}),
    ...(d.visibility ? { visibility: d.visibility } : {}),
    ...(d.roles ? { roles: d.roles } : {}),
  })
}

/**
 * Generate internal MCP policy entries from INTERNAL_TOOL_DESCRIPTORS.
 * Only enabled tools get policy entries (disabled tools aren't registered).
 */
function generateInternalMcpPolicies(): Record<string, StreamToolPolicy> {
  const entries: Record<string, StreamToolPolicy> = {}
  for (const d of INTERNAL_TOOL_DESCRIPTORS) {
    if (d.enabled) {
      entries[qualifiedMcpName(d)] = descriptorToPolicy(d)
    }
  }
  return entries
}

/**
 * SDK tool policies (hand-maintained — SDK tools are external to our codebase).
 */
const SDK_TOOL_POLICIES: Record<StreamSdkToolName, StreamToolPolicy> = {
  [SDK_TOOL.READ]: policy({ reason: "Workspace-scoped file reads are allowed." }),
  [SDK_TOOL.WRITE]: policy({ reason: "Workspace file writes are allowed in normal mode.", planMode: "block" }),
  [SDK_TOOL.EDIT]: policy({ reason: "Workspace file edits are allowed in normal mode.", planMode: "block" }),
  [SDK_TOOL.GLOB]: policy({ reason: "Workspace discovery is allowed." }),
  [SDK_TOOL.GREP]: policy({ reason: "Workspace search is allowed." }),
  [SDK_TOOL.BASH]: policy({ reason: "Shell commands are allowed with runtime safeguards.", planMode: "block" }),
  [SDK_TOOL.TASK_OUTPUT]: policy({ reason: "Task output streaming is allowed." }),
  [SDK_TOOL.BASH_OUTPUT]: policy({ reason: "Legacy bash output alias is allowed." }),
  [SDK_TOOL.TODO_WRITE]: policy({
    reason: "Planning scratchpad is allowed but hidden from user UI.",
    visibility: "silent",
  }),
  [SDK_TOOL.ASK_USER_QUESTION]: policy({ reason: "Clarification UI questions are allowed for all roles." }),
  [SDK_TOOL.MCP]: policy({ reason: "MCP bridge invocation is allowed.", planMode: "block" }),
  [SDK_TOOL.LIST_MCP_RESOURCES]: policy({
    reason: "MCP resource listing is member-only by product policy.",
    roles: MEMBER_ONLY,
    planMode: "block",
  }),
  [SDK_TOOL.READ_MCP_RESOURCE]: policy({
    reason: "MCP resource reading is member-only by product policy.",
    roles: MEMBER_ONLY,
    planMode: "block",
  }),
  [SDK_TOOL.NOTEBOOK_EDIT]: policy({ reason: "Notebook editing is allowed in normal mode.", planMode: "block" }),
  [SDK_TOOL.WEB_FETCH]: policy({ reason: "Single-page fetch is allowed." }),
  [SDK_TOOL.SKILL]: policy({ reason: "Local skills are allowed." }),
  [SDK_TOOL.TASK_STOP]: policy({
    reason: "Stopping tasks is admin/superadmin only.",
    roles: ADMIN_AND_SUPERADMIN,
    planMode: "block",
  }),
  [SDK_TOOL.TASK]: policy({
    reason: "Subagent spawning is superadmin-only.",
    roles: SUPERADMIN_ONLY,
    planMode: "block",
  }),
  [SDK_TOOL.WEB_SEARCH]: policy({ reason: "Web search is superadmin-only.", roles: SUPERADMIN_ONLY }),
  [SDK_TOOL.EXIT_PLAN_MODE]: policy({
    reason: "Exiting plan mode requires explicit user action in UI.",
    roles: [],
    requiresUserApproval: true,
    planMode: "block",
  }),
} satisfies Record<StreamSdkToolName, StreamToolPolicy>

/**
 * Single registry that defines execution + visibility policy per tool.
 *
 * SDK tool policies are hand-maintained (SDK tools are external).
 * Internal MCP tool policies are generated from INTERNAL_TOOL_DESCRIPTORS.
 */
export const STREAM_TOOL_POLICY_REGISTRY: Record<string, StreamToolPolicy> = {
  ...SDK_TOOL_POLICIES,
  ...generateInternalMcpPolicies(),
}

function isInternalPolicyTool(toolName: string): boolean {
  return toolName.startsWith("mcp__alive-")
}

/**
 * Tools with requiresUserApproval must be in allowedTools (so the SDK registers them)
 * but are denied at runtime by canUseTool. Without this, the SDK strips the tool
 * entirely and returns "No such tool available" instead of the proper deny message.
 */
export function isUserApprovalTool(toolName: string): boolean {
  const p = STREAM_TOOL_POLICY_REGISTRY[toolName]
  return p?.requiresUserApproval === true
}

/**
 * Optional internal MCP server used by automation/email workflows.
 * Kept as prefix policy because tool names may evolve independently.
 */
const OPTIONAL_INTERNAL_PREFIX_POLICIES: ReadonlyArray<{
  prefix: string
  policy: StreamToolPolicy
}> = [
  {
    prefix: "mcp__alive-email__",
    policy: policy({ reason: "Automation email MCP tools are allowed." }),
  },
]

function getPolicyForTool(toolName: string): StreamToolPolicy | undefined {
  const exact = STREAM_TOOL_POLICY_REGISTRY[toolName]
  if (exact) return exact

  const prefixMatch = OPTIONAL_INTERNAL_PREFIX_POLICIES.find(entry => toolName.startsWith(entry.prefix))
  return prefixMatch?.policy
}

export function isStreamPolicyTool(toolName: string): boolean {
  return !!getPolicyForTool(toolName)
}

export function isStreamClientVisibleTool(toolName: string): boolean {
  const policy = getPolicyForTool(toolName)
  if (policy) {
    return policy.visibility === "visible"
  }
  // Internal tools without explicit policy fail closed.
  if (isInternalPolicyTool(toolName)) {
    return false
  }
  return true
}

export function getStreamToolDecision(toolName: string, context: StreamToolContext): StreamToolDecision {
  const policy = getPolicyForTool(toolName)

  if (!policy) {
    // Internal tools must always have a policy entry (fail closed).
    if (isInternalPolicyTool(toolName)) {
      return {
        executable: false,
        visibleToClient: false,
        policyFound: false,
        reason: `Internal tool "${toolName}" has no policy entry in STREAM_TOOL_POLICY_REGISTRY.`,
      }
    }

    // External MCP tools are controlled by allowedTools + OAuth checks.
    return {
      executable: true,
      visibleToClient: true,
      policyFound: false,
    }
  }

  const visibleToClient = policy.visibility === "visible"

  if (policy.requiresUserApproval) {
    return {
      executable: false,
      visibleToClient,
      policyFound: true,
      reason: policy.reason,
    }
  }

  if (!policy.roles.includes(context.role)) {
    return {
      executable: false,
      visibleToClient,
      policyFound: true,
      reason: policy.reason,
    }
  }

  if (!policy.workspaceKinds.includes(context.workspaceKind)) {
    return {
      executable: false,
      visibleToClient,
      policyFound: true,
      reason: policy.reason,
    }
  }

  if (context.isPlanMode && policy.planMode === "block") {
    return {
      executable: false,
      visibleToClient,
      policyFound: true,
      reason: `Tool "${toolName}" is blocked in plan mode. ${policy.reason}`,
    }
  }

  return {
    executable: true,
    visibleToClient,
    policyFound: true,
  }
}

function getSdkToolsForPolicyEvaluation(): string[] {
  return [...STREAM_SDK_TOOL_NAMES]
}

function getInternalMcpToolsForPolicyEvaluation(getEnabledMcpToolNames: () => string[]): string[] {
  // SECURITY INVARIANT:
  // Any enabled `mcp__alive-*` tool is treated as internal and must be
  // explicitly policy-registered (or covered by an approved prefix policy),
  // otherwise it is denied by default (fail closed).
  return getEnabledMcpToolNames().filter(name => name.startsWith("mcp__alive-"))
}

/**
 * Build runtime allowed/disallowed/visible tool lists from the single registry.
 */
export function buildStreamToolRuntimeConfig(
  getEnabledMcpToolNames: () => string[],
  context: StreamToolContext,
): StreamToolRuntimeConfig {
  const sdkTools = getSdkToolsForPolicyEvaluation()
  const internalMcpTools = getInternalMcpToolsForPolicyEvaluation(getEnabledMcpToolNames)

  const allowedSdkTools = sdkTools.filter(
    tool => getStreamToolDecision(tool, context).executable || isUserApprovalTool(tool),
  )
  const disallowedSdkTools = sdkTools.filter(
    tool => !getStreamToolDecision(tool, context).executable && !isUserApprovalTool(tool),
  )

  const allowedInternalMcpTools = internalMcpTools.filter(tool => getStreamToolDecision(tool, context).executable)

  const globalMcpTools = getGlobalMcpToolNames()

  const allowedTools = dedupeStrings([...allowedSdkTools, ...allowedInternalMcpTools, ...globalMcpTools])
  const visibleTools = allowedTools.filter(tool => getStreamToolDecision(tool, context).visibleToClient)

  return {
    allowedTools,
    disallowedTools: disallowedSdkTools,
    visibleTools,
  }
}

// =============================================================================
// DEFAULT STREAM SETTINGS
// =============================================================================

/**
 * Default permission mode for Stream.
 */
export const STREAM_PERMISSION_MODE: "default" = "default"

/**
 * Default settings sources for Stream.
 */
export const STREAM_SETTINGS_SOURCES: readonly ["project"] = ["project"]

// =============================================================================
// SHELL HEAVY COMMAND SAFEGUARDS
// =============================================================================

const EXACT_HEAVY_BASH_COMMANDS = new Set([
  // Monorepo-specific scripts (don't exist in site workspaces)
  "bun run static-check",
  "bun run check:pre-push",
  "bun run check:all",
  // Next.js build (sites use Vite, not Next.js)
  "next build",
  // Never allow spawning Claude inside Claude
  "claude",
])

const HEAVY_BASH_PATTERNS = [
  /\b(?:tsc|npx\s+tsc|bunx?\s+tsc|pnpm\s+tsc|yarn\s+tsc)\b/,
  /(?:^|(?:&&|\|\||\||;)\s*)(?:\.\/)?claude(?:\b|$)/,
  /(?:^|(?:&&|\|\||\||;)\s*)(?:npx|bunx?|pnpm\s+dlx|yarn\s+dlx)\s+(?:\.\/)?claude(?:\b|$)/,
  /claude-agent-sdk\/cli\.js/,
  /\b(turbo|bun run turbo)\s+run\s+(build|type-check|lint|test)\b/,
]

/**
 * Detect shell commands that are known to be expensive at monorepo scope.
 */
export function isHeavyBashCommand(command: unknown): boolean {
  if (typeof command !== "string") return false
  const normalized = command.toLowerCase().trim().replace(/\s+/g, " ")
  if (!normalized) return false
  if (EXACT_HEAVY_BASH_COMMANDS.has(normalized)) return true
  return HEAVY_BASH_PATTERNS.some(pattern => pattern.test(normalized))
}

// =============================================================================
// TOOL PERMISSION RESPONSE HELPERS
// =============================================================================

/**
 * Tool permission response for allowing a tool.
 */
export function allowTool(input: Record<string, unknown>): {
  behavior: "allow"
  updatedInput: Record<string, unknown>
  updatedPermissions: unknown[]
} {
  return { behavior: "allow", updatedInput: input, updatedPermissions: [] }
}

/**
 * Tool permission response for denying a tool.
 */
export function denyTool(message: string): { behavior: "deny"; message: string } {
  return { behavior: "deny", message }
}

/**
 * Create canUseTool handler from the registry-based policy.
 */
export function createStreamCanUseTool(
  context: StreamToolContext,
  allowedTools: string[],
): (
  toolName: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; toolUseID: string; [key: string]: unknown },
) => Promise<
  | { behavior: "allow"; updatedInput?: Record<string, unknown>; updatedPermissions?: unknown[] }
  | { behavior: "deny"; message: string }
> {
  return async (toolName, input, _options) => {
    const decision = getStreamToolDecision(toolName, context)

    // Policy/internal denies always win (internal tools fail closed).
    if (!decision.executable && (decision.policyFound || isInternalPolicyTool(toolName))) {
      if (toolName === SDK_TOOL.EXIT_PLAN_MODE) {
        return denyTool(
          `You cannot approve your own plan. The user must click "Approve Plan" in the UI. ` +
            "Present the plan clearly and wait for user approval.",
        )
      }
      return denyTool(`Tool "${toolName}" is not available in site builder mode. ${decision.reason ?? ""}`.trim())
    }

    if (allowedTools.includes(toolName)) {
      return allowTool(input)
    }

    // OAuth MCP tools are dynamically available when connected.
    if (isOAuthMcpTool(toolName, context.connectedProviders)) {
      return allowTool(input)
    }

    return denyTool(
      `Tool "${toolName}" is not permitted. Connect the required integration in Settings to use this tool.`,
    )
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all allowed tools for Stream mode (SDK + internal MCP + global MCP).
 */
export function getStreamAllowedTools(
  getEnabledMcpToolNames: () => string[],
  isAdmin = false,
  isSuperadmin = false,
  isSuperadminWorkspace = false,
  isPlanMode = false,
  connectedProviders: string[] = [],
): string[] {
  const context = createStreamToolContext({
    isAdmin,
    isSuperadmin,
    isSuperadminWorkspace,
    isPlanMode,
    connectedProviders,
  })
  return buildStreamToolRuntimeConfig(getEnabledMcpToolNames, context).allowedTools
}

/**
 * Get disallowed SDK tools for Stream mode.
 */
export function getStreamDisallowedTools(
  isAdmin: boolean,
  isSuperadmin = false,
  isPlanMode = false,
  isSuperadminWorkspace = false,
): string[] {
  const context = createStreamToolContext({
    isAdmin,
    isSuperadmin,
    isSuperadminWorkspace,
    isPlanMode,
  })
  return getSdkToolsForPolicyEvaluation().filter(
    tool => !getStreamToolDecision(tool, context).executable && !isUserApprovalTool(tool),
  )
}

/**
 * Backwards-compatible helper that now delegates to registry logic.
 */
export function filterToolsForPlanMode(allowedTools: string[], isPlanMode: boolean): string[] {
  if (!isPlanMode) return allowedTools

  return allowedTools.filter(tool => {
    const toolPolicy = STREAM_TOOL_POLICY_REGISTRY[tool]
    // If no registry entry (e.g. external MCP tool), keep it
    if (!toolPolicy) return true
    return toolPolicy.planMode !== "block"
  })
}

/**
 * MCP server configuration type (simplified for serialization).
 */
export interface StreamMcpServerConfig {
  type: "http" | "sdk"
  url?: string
  headers?: Record<string, string>
}

/**
 * Get MCP servers configuration for Stream mode.
 */
export function getStreamMcpServers<T>(
  internalMcpServers: { "alive-workspace": T; "alive-tools": T },
  oauthTokens: Record<string, string> = {},
): Record<string, T | StreamMcpServerConfig> {
  const servers: Record<string, T | StreamMcpServerConfig> = {
    "alive-workspace": internalMcpServers["alive-workspace"],
    "alive-tools": internalMcpServers["alive-tools"],
  }

  // Add OAuth MCP servers for connected providers
  for (const [providerKey, config] of Object.entries(OAUTH_MCP_PROVIDERS)) {
    const token = oauthTokens[providerKey]
    if (token) {
      servers[providerKey] = {
        type: "http",
        url: config.url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    }
  }

  // Add global MCP servers (always available, no auth required)
  for (const [providerKey, config] of Object.entries(GLOBAL_MCP_PROVIDERS)) {
    servers[providerKey] = {
      type: "http",
      url: config.url,
    }
  }

  return servers
}
