/** SDK built-in tools that must be disabled when routing file/shell operations to E2B MCP. */
export const E2B_DISABLED_SDK_TOOLS = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "NotebookEdit"] as const

/** E2B MCP replacements for file/search/shell operations. */
export const E2B_MCP_TOOLS = [
  "mcp__e2b__Read",
  "mcp__e2b__Write",
  "mcp__e2b__Edit",
  "mcp__e2b__Glob",
  "mcp__e2b__Grep",
  "mcp__e2b__Bash",
] as const

/** Available E2B sandbox templates. */
export const E2B_TEMPLATES = {
  ALIVE: "alive",
  ALIVE_E2E_MINIMAL: "alive-e2e-minimal",
} as const

export type E2bTemplate = (typeof E2B_TEMPLATES)[keyof typeof E2B_TEMPLATES]

/** Default template used when creating new sandboxes. */
export const E2B_DEFAULT_TEMPLATE: E2bTemplate = E2B_TEMPLATES.ALIVE
