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

export const STREAM_SDK_TOOL_NAMES = [
  "Task",
  "Bash",
  "TaskOutput",
  "ExitPlanMode",
  "Edit",
  "Read",
  "Write",
  "Glob",
  "Grep",
  "TaskStop",
  "ListMcpResources",
  "Mcp",
  "NotebookEdit",
  "ReadMcpResource",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "AskUserQuestion",
  // Stream-only compatibility tools
  "Skill",
  "BashOutput",
] as const
export type StreamSdkToolName = (typeof STREAM_SDK_TOOL_NAMES)[number]

/**
 * Derived from INTERNAL_TOOL_DESCRIPTORS (single source of truth).
 * Only enabled tools get a stream policy entry.
 */
export const STREAM_INTERNAL_MCP_TOOLS: readonly string[] = INTERNAL_TOOL_DESCRIPTORS.filter(d => d.enabled).map(
  qualifiedMcpName,
)
export type StreamInternalMcpToolName = string

export type StreamPolicyToolName = StreamSdkToolName | (string & {})

const ALL_ROLES = ["member", "admin", "superadmin"] as const
const ADMIN_AND_SUPERADMIN = ["admin", "superadmin"] as const
const SUPERADMIN_ONLY = ["superadmin"] as const
const MEMBER_ONLY = ["member"] as const
const BOTH_WORKSPACE_KINDS = ["site", "platform"] as const

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
    ...(d.workspaceKinds ? { workspaceKinds: d.workspaceKinds as readonly StreamWorkspaceKind[] } : {}),
    ...(d.planMode ? { planMode: d.planMode } : {}),
    ...(d.visibility ? { visibility: d.visibility as StreamToolVisibility } : {}),
    ...(d.roles ? { roles: d.roles as readonly StreamToolRole[] } : {}),
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
  Read: policy({ reason: "Workspace-scoped file reads are allowed." }),
  Write: policy({ reason: "Workspace file writes are allowed in normal mode.", planMode: "block" }),
  Edit: policy({ reason: "Workspace file edits are allowed in normal mode.", planMode: "block" }),
  Glob: policy({ reason: "Workspace discovery is allowed." }),
  Grep: policy({ reason: "Workspace search is allowed." }),
  Bash: policy({ reason: "Shell commands are allowed with runtime safeguards.", planMode: "block" }),
  TaskOutput: policy({ reason: "Task output streaming is allowed." }),
  BashOutput: policy({ reason: "Legacy bash output alias is allowed." }),
  TodoWrite: policy({ reason: "Planning scratchpad is allowed but hidden from user UI.", visibility: "silent" }),
  AskUserQuestion: policy({ reason: "Clarification UI questions are allowed for all roles." }),
  Mcp: policy({ reason: "MCP bridge invocation is allowed." }),
  ListMcpResources: policy({
    reason: "MCP resource listing is member-only by product policy.",
    roles: MEMBER_ONLY,
  }),
  ReadMcpResource: policy({
    reason: "MCP resource reading is member-only by product policy.",
    roles: MEMBER_ONLY,
  }),
  NotebookEdit: policy({ reason: "Notebook editing is allowed in normal mode.", planMode: "block" }),
  WebFetch: policy({ reason: "Single-page fetch is allowed." }),
  Skill: policy({ reason: "Local skills are allowed." }),
  TaskStop: policy({
    reason: "Stopping tasks is admin/superadmin only.",
    roles: ADMIN_AND_SUPERADMIN,
    planMode: "block",
  }),
  Task: policy({ reason: "Subagent spawning is superadmin-only.", roles: SUPERADMIN_ONLY, planMode: "block" }),
  WebSearch: policy({ reason: "Web search is superadmin-only.", roles: SUPERADMIN_ONLY }),
  ExitPlanMode: policy({
    reason: "Exiting plan mode requires explicit user action in UI.",
    roles: [],
    requiresUserApproval: true,
    planMode: "block",
  }),
} as const satisfies Record<StreamSdkToolName, StreamToolPolicy>

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

  const allowedSdkTools = sdkTools.filter(tool => getStreamToolDecision(tool, context).executable)
  const disallowedSdkTools = sdkTools.filter(tool => !getStreamToolDecision(tool, context).executable)

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
export const STREAM_PERMISSION_MODE = "default" as const

/**
 * Default settings sources for Stream.
 */
export const STREAM_SETTINGS_SOURCES = ["project", "user"] as const

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
export function allowTool(input: Record<string, unknown>) {
  return { behavior: "allow" as const, updatedInput: input, updatedPermissions: [] }
}

/**
 * Tool permission response for denying a tool.
 */
export function denyTool(message: string) {
  return { behavior: "deny" as const, message }
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
      if (toolName === "ExitPlanMode") {
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
  return getSdkToolsForPolicyEvaluation().filter(tool => !getStreamToolDecision(tool, context).executable)
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
