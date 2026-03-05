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

export type InternalMcpServer = "alive-tools" | "alive-workspace"

type WorkspaceKind = "site" | "platform"
type ToolVisibility = "visible" | "silent"
type ToolRole = "member" | "admin" | "superadmin"

export interface InternalToolDescriptor {
  /** snake_case tool name (e.g. "search_tools") */
  name: string
  /** Which MCP server this tool belongs to */
  mcpServer: InternalMcpServer
  /** Whether the tool is registered in MCP servers and available at runtime */
  enabled: boolean
  /** Stream policy reason string (required) */
  reason: string
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
  {
    name: "search_tools",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Internal tool discovery is allowed.",
  },
  {
    name: "list_workflows",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Workflow discovery is allowed.",
  },
  {
    name: "get_workflow",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Workflow reads are allowed.",
  },
  {
    name: "debug_workspace",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Workspace diagnostics are allowed.",
  },
  {
    name: "get_alive_super_template",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Template reads are allowed.",
  },
  {
    name: "read_server_logs",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Server log reads are allowed.",
  },
  {
    name: "ask_clarification",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Clarification tool is allowed.",
  },
  {
    name: "ask_website_config",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Website config collection is allowed.",
  },
  {
    name: "ask_automation_config",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Automation config collection is allowed.",
  },
  {
    name: "list_automations",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Listing automations is allowed.",
  },
  {
    name: "generate_persona",
    mcpServer: "alive-tools",
    enabled: true,
    reason: "Persona generation is allowed.",
  },

  // =========================================================================
  // alive-workspace server (site workspace tools, block plan mode by default)
  // =========================================================================
  {
    name: "check_codebase",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Codebase analysis is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "restart_dev_server",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Dev server restart mutates runtime state and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "install_package",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Package install mutates dependencies and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "delete_file",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "File deletion mutates workspace and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "switch_serve_mode",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Serve mode changes runtime behavior and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "copy_shared_asset",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Copying assets mutates workspace and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "create_website",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Website creation mutates workspace and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "git_push",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Git push mutates remote repository and is site-workspace only.",
    workspaceKinds: ["site"],
  },
  {
    name: "browser",
    mcpServer: "alive-workspace",
    enabled: true,
    reason: "Browser control is available in site and platform workspaces.",
    workspaceKinds: ["site", "platform"],
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
 * Get all qualified internal MCP tool names, optionally filtered by enabled state.
 */
export function getInternalMcpToolNames(filter?: { enabled?: boolean }): string[] {
  let descriptors: readonly InternalToolDescriptor[] = INTERNAL_TOOL_DESCRIPTORS
  if (filter?.enabled !== undefined) {
    descriptors = descriptors.filter(d => d.enabled === filter.enabled)
  }
  return descriptors.map(qualifiedMcpName)
}

/**
 * Get descriptors grouped by MCP server name.
 */
export function getDescriptorsByServer(): Record<InternalMcpServer, InternalToolDescriptor[]> {
  const result: Record<InternalMcpServer, InternalToolDescriptor[]> = {
    "alive-tools": [],
    "alive-workspace": [],
  }
  for (const d of INTERNAL_TOOL_DESCRIPTORS) {
    result[d.mcpServer].push(d)
  }
  return result
}
