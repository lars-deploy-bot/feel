import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

/**
 * Tool metadata for discovery and progressive disclosure
 * Follows Anthropic article best practices: load tool definitions on-demand
 */
interface ToolMetadata {
  name: string
  category: string
  description: string
  contextCost: "low" | "medium" | "high"
  parameters?: {
    name: string
    type: string
    required: boolean
    description: string
  }[]
}

const TOOL_REGISTRY: ToolMetadata[] = [
  // Meta tools
  {
    name: "search_tools",
    category: "meta",
    description: "Discovers available tools with progressive disclosure. Start here to find what tools exist.",
    contextCost: "low",
    parameters: [
      {
        name: "query",
        type: "string",
        required: false,
        description: "Search query (e.g., 'logs', 'guides', 'debugging')",
      },
      {
        name: "category",
        type: "string",
        required: false,
        description: "Filter by category",
      },
      {
        name: "detail_level",
        type: "string",
        required: false,
        description: "'minimal', 'standard', or 'full'. Default: 'standard'",
      },
    ],
  },

  // Composite tools (reduce round trips)
  {
    name: "debug_workspace",
    category: "composite",
    description: "All-in-one debugging: reads logs + analyzes patterns + suggests fixes. USE THIS FIRST for debugging.",
    contextCost: "medium",
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

  // Debugging tools
  {
    name: "read_server_logs",
    category: "debugging",
    description: "Reads systemd logs with summary mode, regex filtering, and result hints. Advanced filtering available.",
    contextCost: "high",
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
  },
  {
    name: "restart_dev_server",
    category: "workspace",
    description: "Restarts systemd dev server for a workspace",
    contextCost: "low",
    parameters: [
      {
        name: "workspace",
        type: "string",
        required: true,
        description: "Workspace domain",
      },
    ],
  },
]

export const searchToolsParamsSchema = {
  query: z
    .string()
    .optional()
    .describe('Search query (matches name, category, description). E.g., "logs", "guides", "debugging"'),
  category: z.string().optional().describe('Filter by category (e.g., "documentation", "debugging")'),
  detail_level: z
    .enum(["minimal", "standard", "full"])
    .optional()
    .default("standard")
    .describe(
      "'minimal' (names only), 'standard' (names + descriptions), 'full' (complete parameter schemas). Default: 'standard'",
    ),
}

export type SearchToolsParams = {
  query?: string
  category?: string
  detail_level?: "minimal" | "standard" | "full"
}

export type SearchToolsResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

export async function searchTools(params: SearchToolsParams): Promise<SearchToolsResult> {
  const { query, category, detail_level = "standard" } = params

  try {
    let tools = TOOL_REGISTRY

    // Filter by category
    if (category) {
      tools = tools.filter(t => t.category === category)
    }

    // Filter by query
    if (query) {
      const q = query.toLowerCase()
      tools = tools.filter(
        t =>
          t.name.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      )
    }

    if (tools.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `# No Matching Tools\n\n${query ? `Query: "${query}"\n` : ""}${category ? `Category: "${category}"\n` : ""}\n\nTry a different search or browse all categories.`,
          },
        ],
        isError: false,
      }
    }

    // Format based on detail level
    let output = `# Tool Search Results (${tools.length})\n\n`

    if (query) output += `**Query:** "${query}"\n`
    if (category) output += `**Category:** "${category}"\n\n`
    if (!query && !category) output += "**All available tools**\n\n"

    // Group by category
    const byCategory = tools.reduce(
      (acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = []
        acc[tool.category].push(tool)
        return acc
      },
      {} as Record<string, ToolMetadata[]>,
    )

    for (const [cat, catTools] of Object.entries(byCategory)) {
      output += `## ${cat} (${catTools.length})\n\n`

      for (const tool of catTools) {
        if (detail_level === "minimal") {
          // Just name
          output += `- **${tool.name}**\n`
        } else if (detail_level === "standard") {
          // Name + description + context cost
          output += `### ${tool.name}\n`
          output += `${tool.description}\n`
          output += `- **Context cost:** ${tool.contextCost}\n\n`
        } else {
          // Full schema
          output += `### ${tool.name}\n`
          output += `${tool.description}\n\n`
          output += `- **Context cost:** ${tool.contextCost}\n`

          if (tool.parameters && tool.parameters.length > 0) {
            output += "- **Parameters:**\n"
            for (const param of tool.parameters) {
              output += `  - \`${param.name}\` (${param.type}${param.required ? ", required" : ", optional"}): ${param.description}\n`
            }
          }
          output += "\n"
        }
      }
    }

    output += "\n---\n\n"
    output += "**Progressive disclosure best practice:**\n"
    output += "- Use `detail_level: 'minimal'` to discover available tools (lowest context cost)\n"
    output += "- Use `detail_level: 'standard'` to see descriptions and context costs\n"
    output += "- Use `detail_level: 'full'` only when you need complete parameter schemas\n"
    output += "\n**Context efficiency tips:**\n"
    output += "- Tools marked 'high' context cost return large results—use filtering parameters\n"
    output += "- For `read_server_logs`, use `summary_only: true` to get stats without full logs\n"
    output += "- For `list_guides`, use `detail_level: 'brief'` to get only titles\n"

    return {
      content: [
        {
          type: "text" as const,
          text: output,
        },
      ],
      isError: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `# Tool Search Failed\n\nError: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const searchToolsTool = tool(
  "search_tools",
  `Discovers available tools using progressive disclosure. Returns tool metadata with configurable detail levels. Use this BEFORE calling unfamiliar tools to understand what's available and their context costs.

Best practices:
- Start with 'minimal' to browse tool names (lowest context usage)
- Use 'standard' for descriptions and context costs
- Only use 'full' when you need complete parameter schemas

Examples:
- search_tools({ query: "logs" }) - Find log-related tools
- search_tools({ category: "documentation" }) - Browse documentation tools
- search_tools({ detail_level: "minimal" }) - List all tools (names only)`,
  searchToolsParamsSchema,
  async args => {
    return searchTools(args)
  },
)
