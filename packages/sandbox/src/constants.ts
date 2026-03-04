/** SDK built-in tools that must be disabled when routing file/shell operations to E2B MCP. */
export const E2B_DISABLED_SDK_TOOLS = ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "NotebookEdit"] as const

/** E2B MCP replacements for file/shell operations. */
export const E2B_MCP_TOOLS = ["mcp__e2b__Read", "mcp__e2b__Write", "mcp__e2b__Edit", "mcp__e2b__Bash"] as const

/**
 * Available E2B sandbox templates.
 * Self-hosted E2B doesn't resolve bare aliases in templateID — use namespaced name.
 */
export const E2B_TEMPLATES = {
  ALIVE: "self-hosted/alive",
} as const

export type E2bTemplate = (typeof E2B_TEMPLATES)[keyof typeof E2B_TEMPLATES]

/** Default template used when creating new sandboxes. */
export const E2B_DEFAULT_TEMPLATE: E2bTemplate = E2B_TEMPLATES.ALIVE
