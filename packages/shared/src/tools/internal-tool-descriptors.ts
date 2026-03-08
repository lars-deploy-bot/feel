/**
 * Internal Tool Descriptors — Single Source of Truth
 *
 * Every internal MCP tool MUST be defined here.
 * All other surfaces derive from this canonical list:
 *
 * - Stream policy (STREAM_TOOL_POLICY_REGISTRY in stream-tools.ts)
 * - Stream allowlist (STREAM_INTERNAL_MCP_TOOLS in stream-tools.ts)
 * - Tool discovery registry (INTERNAL_TOOL_REGISTRY in @webalive/tools)
 * - MCP server registration (validated by sync tests in @webalive/tools)
 *
 * When adding or removing a tool, update THIS file only.
 * Sync tests will catch anything that falls out of alignment.
 */

// ---------------------------------------------------------------------------
// Types (self-contained to avoid circular deps with stream-tools.ts)
// ---------------------------------------------------------------------------

export type InternalMcpServer = "alive-tools" | "alive-workspace" | "alive-sandboxed-fs"

type WorkspaceKind = "site" | "platform"
type ToolVisibility = "visible" | "silent"
type ToolRole = "member" | "admin" | "superadmin"

/**
 * Tool loading tier for context efficiency.
 *
 * - "core": Always loaded into Claude's context. These are the tools Claude needs every turn.
 * - "discoverable": NOT loaded by default. Claude uses `search_tools` to discover and invoke them.
 *   This keeps tool descriptions out of the context window until actually needed.
 */
export type ToolTier = "core" | "discoverable"

export interface InternalToolDescriptor {
  /** Tool name as registered in MCP (usually snake_case, but may be SDK-compatible PascalCase aliases like "Read"). */
  name: string
  /** Which MCP server this tool belongs to */
  mcpServer: InternalMcpServer
  /** Whether the tool is registered in MCP servers and available at runtime */
  enabled: boolean
  /** Stream policy reason string (required) */
  reason: string
  /** Loading tier. "core" = always loaded, "discoverable" = loaded via search_tools. Default: "core" */
  tier?: ToolTier
  /** Workspace kinds the tool is available in. Default: all */
  workspaceKinds?: readonly WorkspaceKind[]
  /** Visibility to client UI. Default: "visible" */
  visibility?: ToolVisibility
  /** Restrict to specific roles. Default: all roles */
  roles?: readonly ToolRole[]
}

// ---------------------------------------------------------------------------
// Canonical descriptor array
// ---------------------------------------------------------------------------

export const INTERNAL_TOOL_DESCRIPTORS: readonly InternalToolDescriptor[] = [
  // =========================================================================
  // alive-tools server (general tools, available in all workspace types)
  // =========================================================================
  // --- CORE: always loaded, Claude sees these every turn ---
  {
    name: "search_tools",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "core",
    reason: "Internal tool discovery is allowed.",
  },
  {
    name: "ask_clarification",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "core",
    reason: "Clarification tool is allowed.",
  },

  // --- DISCOVERABLE: Claude finds these via search_tools ---
  {
    name: "list_workflows",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Workflow discovery is allowed.",
  },
  {
    name: "get_workflow",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Workflow reads are allowed.",
  },
  {
    name: "debug_workspace",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Workspace diagnostics are allowed.",
  },
  {
    name: "get_alive_super_template",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Template reads are allowed.",
  },
  {
    name: "read_server_logs",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Server log reads are allowed.",
  },
  {
    name: "ask_website_config",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Website config collection is allowed.",
  },
  {
    name: "ask_automation_config",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Automation config collection is allowed.",
  },
  {
    name: "list_automations",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Listing automations is allowed.",
  },
  {
    name: "generate_persona",
    mcpServer: "alive-tools",
    enabled: true,
    tier: "discoverable",
    reason: "Persona generation is allowed.",
  },

  // =========================================================================
  // alive-workspace server (site workspace tools, block plan mode by default)
  // =========================================================================

  // --- CORE workspace tools ---
  {
    name: "restart_dev_server",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "core",
    reason: "Dev server restart mutates runtime state and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "install_package",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "core",
    reason: "Package install mutates dependencies and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "delete_file",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "core",
    reason: "File deletion mutates workspace and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "browser",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "core",
    reason: "Browser control is available in site and platform workspaces.",
    workspaceKinds: ["site", "platform"],
  },

  // --- DISCOVERABLE workspace tools ---
  {
    name: "check_codebase",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "discoverable",
    reason: "Codebase analysis is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "switch_serve_mode",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "discoverable",
    reason: "Serve mode changes runtime behavior and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "copy_shared_asset",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "discoverable",
    reason: "Copying assets mutates workspace and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "create_website",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "discoverable",
    reason: "Website creation mutates workspace and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "git_push",
    mcpServer: "alive-workspace",
    enabled: true,
    tier: "discoverable",
    reason: "Git push mutates remote repository and is site-workspace only.",
    workspaceKinds: ["site"],
  },

  // =========================================================================
  // alive-sandboxed-fs server (SDK-compatible file/shell gate for site mode)
  // All core — these are the fundamental file/shell operations
  // =========================================================================
  {
    name: "Read",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Site workspace file reads must go through sandboxed path validation.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
  {
    name: "Write",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Site workspace file writes must go through sandboxed path validation.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
  {
    name: "Edit",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Site workspace file edits must go through sandboxed path validation.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
  {
    name: "Glob",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Site workspace glob queries must go through sandboxed path validation.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
  {
    name: "Grep",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Site workspace grep queries must go through sandboxed path validation.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
  {
    name: "Bash",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Site workspace shell commands must go through heavy-command safeguards.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
  {
    name: "NotebookEdit",
    mcpServer: "alive-sandboxed-fs",
    enabled: true,
    tier: "core",
    reason: "Notebook edits in site workspaces must go through sandboxed path validation.",
    workspaceKinds: ["site"],
    roles: ["member", "admin"],
  },
] as const

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/**
 * Build the fully-qualified MCP tool name for a descriptor.
 * Pattern: `mcp__{mcpServer}__{name}`
 */
export function qualifiedMcpName(descriptor: InternalToolDescriptor): string {
  return `mcp__${descriptor.mcpServer}__${descriptor.name}`
}

/**
 * Get all qualified internal MCP tool names, optionally filtered by enabled state and tier.
 */
export function getInternalMcpToolNames(filter?: { enabled?: boolean; tier?: ToolTier }): string[] {
  let descriptors: readonly InternalToolDescriptor[] = INTERNAL_TOOL_DESCRIPTORS
  if (filter?.enabled !== undefined) {
    descriptors = descriptors.filter(d => d.enabled === filter.enabled)
  }
  if (filter?.tier !== undefined) {
    descriptors = descriptors.filter(d => (d.tier ?? "core") === filter.tier)
  }
  return descriptors.map(qualifiedMcpName)
}

/**
 * Check if a tool is discoverable (not loaded by default).
 */
export function isDiscoverableTool(qualifiedName: string): boolean {
  return INTERNAL_TOOL_DESCRIPTORS.some(
    d => qualifiedMcpName(d) === qualifiedName && d.enabled && (d.tier ?? "core") === "discoverable",
  )
}

/**
 * Get discoverable tool names (enabled, tier=discoverable).
 */
export function getDiscoverableToolNames(): string[] {
  return getInternalMcpToolNames({ enabled: true, tier: "discoverable" })
}

/**
 * Get descriptors grouped by MCP server name.
 */
export function getDescriptorsByServer(): Record<InternalMcpServer, InternalToolDescriptor[]> {
  const result: Record<InternalMcpServer, InternalToolDescriptor[]> = {
    "alive-tools": [],
    "alive-workspace": [],
    "alive-sandboxed-fs": [],
  }
  for (const d of INTERNAL_TOOL_DESCRIPTORS) {
    result[d.mcpServer].push(d)
  }
  return result
}
