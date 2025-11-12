/**
 * Tool Registry
 *
 * Central registry of all MCP tools with their metadata.
 * This is the single source of truth for enabled/disabled tools.
 */

/**
 * SDK Built-in Tools
 *
 * These are Claude Agent SDK's built-in file operation tools.
 * They are NOT included in the tool registry but are always available.
 */
export const SDK_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"] as const

export type SDKTool = (typeof SDK_TOOLS)[number]

/**
 * Tool categories (typed for compile-time safety)
 */
export const TOOL_CATEGORIES = [
  "meta",
  "composite",
  "batch",
  "documentation",
  "debugging",
  "development",
  "workspace",
  "external-mcp",
] as const

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

/**
 * Context cost levels
 */
export type ContextCost = "low" | "medium" | "high"

/**
 * Detail levels for progressive disclosure
 */
export const DETAIL_LEVELS = ["minimal", "standard", "full"] as const

export type DetailLevel = (typeof DETAIL_LEVELS)[number]

/**
 * Tool metadata for discovery and progressive disclosure
 */
export interface ToolMetadata {
  name: string
  category: ToolCategory
  description: string
  contextCost: ContextCost
  enabled: boolean
  parameters?: {
    name: string
    type: string
    required: boolean
    description: string
  }[]
}

export const TOOL_REGISTRY: ToolMetadata[] = [
  // Meta tools (tool discovery)
  {
    name: "search_tools",
    category: "meta",
    description:
      "Discovers available tools by category using progressive disclosure. Returns tool metadata with configurable detail levels.",
    contextCost: "low",
    enabled: true,
    parameters: [
      {
        name: "category",
        type: "string",
        required: true,
        description:
          "Category to search (meta, composite, batch, documentation, debugging, development, workspace, external-mcp)",
      },
      {
        name: "detail_level",
        type: "string",
        required: false,
        description:
          "'minimal' (names only), 'standard' (names + descriptions), 'full' (complete parameter schemas). Default: 'standard'",
      },
    ],
  },

  // Composite tools (reduce round trips)
  {
    name: "debug_workspace",
    category: "composite",
    description: "All-in-one debugging: reads logs + analyzes patterns + suggests fixes. USE THIS FIRST for debugging.",
    contextCost: "medium",
    enabled: true,
    parameters: [
      {
        name: "workspace",
        type: "string",
        required: true,
        description: "Workspace domain",
      },
      {
        name: "lines",
        type: "number",
        required: false,
        description: "Log lines to analyze (default: 200)",
      },
      {
        name: "since",
        type: "string",
        required: false,
        description: "Time range (e.g., '5 minutes ago')",
      },
    ],
  },
  {
    name: "find_guide",
    category: "composite",
    description: "Searches AND retrieves guides in one call. Reduces round trips from 2+ to 1.",
    contextCost: "high",
    enabled: false,
    parameters: [
      {
        name: "query",
        type: "string",
        required: true,
        description: "Search query (e.g., 'authentication', 'vite errors')",
      },
      {
        name: "category",
        type: "string",
        required: false,
        description: "Optional category filter",
      },
      {
        name: "auto_retrieve",
        type: "boolean",
        required: false,
        description: "If true, retrieves best match. If false, lists matches. Default: true",
      },
    ],
  },

  // Batch operations
  {
    name: "batch_get_guides",
    category: "batch",
    description: "Retrieves multiple guides in one call (max 5). Reduces round trips for bulk operations.",
    contextCost: "high",
    enabled: false,
    parameters: [
      {
        name: "requests",
        type: "array",
        required: true,
        description: "Array of guide requests (max 5), each with category and optional topic",
      },
      {
        name: "include_separator",
        type: "boolean",
        required: false,
        description: "Add separators between guides. Default: true",
      },
    ],
  },

  // Documentation tools
  {
    name: "list_guides",
    category: "documentation",
    description: "Lists available development guides with result hints. Context-efficient modes available.",
    contextCost: "low",
    enabled: false,
    parameters: [
      {
        name: "category",
        type: "string",
        required: false,
        description: "Guide category (e.g., '30-guides', 'workflows')",
      },
      {
        name: "detail_level",
        type: "string",
        required: false,
        description: "'brief' (titles only) or 'full' (titles + descriptions). Default: 'brief'",
      },
    ],
  },
  {
    name: "get_guide",
    category: "documentation",
    description: "Retrieves full guide content. Can return large markdown documents.",
    contextCost: "high",
    enabled: false,
    parameters: [
      {
        name: "category",
        type: "string",
        required: true,
        description: "Guide category",
      },
      {
        name: "topic",
        type: "string",
        required: false,
        description: "Filter by topic keyword",
      },
    ],
  },

  // Template tools
  {
    name: "get_alive_super_template",
    category: "documentation",
    description: "Retrieves Alive Super Template content for implementing specific features.",
    contextCost: "high",
    enabled: true,
    parameters: [
      {
        name: "template_id",
        type: "string",
        required: true,
        description: "Template ID (e.g., 'carousel-thumbnails-v1.0.0')",
      },
    ],
  },

  // Debugging tools
  {
    name: "read_server_logs",
    category: "debugging",
    description:
      "Reads systemd logs with summary mode, regex filtering, and result hints. Advanced filtering available.",
    contextCost: "high",
    enabled: true,
    parameters: [
      {
        name: "workspace",
        type: "string",
        required: true,
        description: "Workspace domain (e.g., 'two.goalive.nl')",
      },
      {
        name: "search",
        type: "string",
        required: false,
        description: "Basic search term",
      },
      {
        name: "search_regex",
        type: "string",
        required: false,
        description: "Advanced regex pattern (e.g., 'error|warn', 'failed.*build')",
      },
      {
        name: "lines",
        type: "number",
        required: false,
        description: "Number of log lines (1-1000, default: 100)",
      },
      {
        name: "since",
        type: "string",
        required: false,
        description: "Time range (e.g., '5 minutes ago')",
      },
      {
        name: "summary_only",
        type: "boolean",
        required: false,
        description: "Return only summary stats (context-efficient). Default: false",
      },
    ],
  },

  // Other tools
  {
    name: "generate_persona",
    category: "development",
    description: "Generates persona content for testing",
    contextCost: "medium",
    enabled: true,
  },
  {
    name: "check_codebase",
    category: "workspace",
    description:
      "Runs TypeScript type checking (tsc) and ESLint to verify code quality. Use BEFORE committing code, after making changes, or when debugging type errors. Returns detailed information about any TypeScript errors or lint warnings found.",
    contextCost: "medium",
    enabled: true,
    parameters: [],
  },
  {
    name: "restart_dev_server",
    category: "workspace",
    description: "Restarts systemd dev server for a workspace",
    contextCost: "low",
    enabled: true,
    parameters: [
      {
        name: "workspace",
        type: "string",
        required: true,
        description: "Workspace domain",
      },
    ],
  },
  {
    name: "install_package",
    category: "workspace",
    description: "Install a package in the user's workspace using bun",
    contextCost: "low",
    enabled: true,
    parameters: [
      {
        name: "package_name",
        type: "string",
        required: true,
        description: "Package name to install (e.g., 'lodash', '@types/node')",
      },
    ],
  },

  // External MCP Servers (workspace-specific)
  {
    name: "stripe",
    category: "external-mcp",
    description:
      "Stripe payment integration (larsvandeneeden.com only). Access to Stripe API for payments, customers, subscriptions, etc.",
    contextCost: "medium",
    enabled: false, // Only available for specific workspaces, dynamically enabled
  },
]
