import { AsyncLocalStorage } from "node:async_hooks"
import { tool } from "@anthropic-ai/claude-agent-sdk"
import { getDiscoverableToolNames, getInternalMcpToolNames, PATHS } from "@webalive/shared"
import { z } from "zod"
import type { ToolResult } from "../../lib/api-client.js"
import {
  DETAIL_LEVELS,
  type DetailLevel,
  getSearchToolRegistry,
  TOOL_CATEGORIES,
  type ToolCategory,
} from "./tool-registry.js"

// =============================================================================
// DISCOVERABLE TOOL HANDLERS
//
// These are the handler functions for tools with tier="discoverable".
// search_tools proxies to them when called with `execute`.
// =============================================================================

type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>

/**
 * Lazy-loaded handler registry for discoverable tools.
 * Handlers are imported on first use to avoid loading all tool code at startup.
 */
async function getDiscoverableHandler(toolName: string): Promise<ToolHandler | null> {
  switch (toolName) {
    // alive-tools server
    case "list_workflows": {
      const { listWorkflows } = await import("./list-workflows.js")
      return () => listWorkflows()
    }
    case "get_workflow": {
      const { getWorkflow } = await import("./get-workflow.js")
      return params => getWorkflow(params as Parameters<typeof getWorkflow>[0])
    }
    case "debug_workspace": {
      const { debugWorkspace } = await import("../composite/debug-workspace.js")
      return params => debugWorkspace(params as Parameters<typeof debugWorkspace>[0])
    }
    case "get_alive_super_template": {
      const { getTemplate } = await import("../templates/get-template.js")
      return params => getTemplate(params as Parameters<typeof getTemplate>[0], PATHS.TEMPLATES_ROOT)
    }
    case "read_server_logs": {
      const { readServerLogs } = await import("../debug/read-server-logs.js")
      return params => readServerLogs(params as Parameters<typeof readServerLogs>[0])
    }
    case "ask_website_config": {
      const { askWebsiteConfig } = await import("../ai/ask-website-config.js")
      return params => askWebsiteConfig(params as Parameters<typeof askWebsiteConfig>[0])
    }
    case "ask_automation_config": {
      const { askAutomationConfig } = await import("../ai/ask-automation-config.js")
      return params => askAutomationConfig(params as Parameters<typeof askAutomationConfig>[0])
    }
    case "list_automations": {
      const { listAutomations } = await import("../automations/list-automations.js")
      return params => listAutomations(params as Parameters<typeof listAutomations>[0])
    }
    case "generate_persona": {
      const { generatePersona } = await import("../personas/generate-persona.js")
      return params => generatePersona(params as Parameters<typeof generatePersona>[0])
    }
    // alive-workspace server
    case "check_codebase": {
      const { checkCodebase } = await import("../workspace/check-codebase.js")
      return params => checkCodebase(params as Parameters<typeof checkCodebase>[0])
    }
    case "switch_serve_mode": {
      const { switchServeMode } = await import("../workspace/switch-serve-mode.js")
      return params => switchServeMode(params as Parameters<typeof switchServeMode>[0])
    }
    case "copy_shared_asset": {
      const { copySharedAsset } = await import("../workspace/copy-shared-asset.js")
      return params => copySharedAsset(params as Parameters<typeof copySharedAsset>[0])
    }
    case "create_website": {
      const { createWebsite } = await import("../workspace/create-website.js")
      return params => createWebsite(params as Parameters<typeof createWebsite>[0])
    }
    case "git_push": {
      const { gitPush } = await import("../workspace/git-push.js")
      return params => gitPush(params as Parameters<typeof gitPush>[0])
    }
    default:
      return null
  }
}

// =============================================================================
// SCHEMA
// =============================================================================

export const searchToolsParamsSchema = {
  category: z
    .enum(TOOL_CATEGORIES)
    .optional()
    .describe(
      `Category to browse. Options: ${TOOL_CATEGORIES.join(", ")}. Required when discovering tools (no execute).`,
    ),
  detail_level: z
    .enum(DETAIL_LEVELS)
    .optional()
    .default("standard")
    .describe(
      "'minimal' (names only), 'standard' (names + descriptions), 'full' (complete parameter schemas). Default: 'standard'",
    ),
  execute: z
    .string()
    .optional()
    .describe(
      "Tool name to execute. When provided, runs the tool directly and returns its result. Use after discovering tools via category search.",
    ),
  params: z.record(z.string(), z.unknown()).optional().describe("Parameters to pass to the tool when using execute."),
}

export type SearchToolsParams = {
  category?: ToolCategory
  detail_level?: DetailLevel
  execute?: string
  params?: Record<string, unknown>
}

export type SearchToolsResult = ToolResult

let connectedOAuthProviders: string[] = []
const connectedOAuthProvidersContext = new AsyncLocalStorage<ReadonlySet<string>>()

function normalizeProviders(providers: string[]): string[] {
  return [
    ...new Set(providers.filter((provider): provider is string => typeof provider === "string" && provider.length > 0)),
  ]
}

function getEffectiveConnectedProviders(): string[] {
  const scopedProviders = connectedOAuthProvidersContext.getStore()
  if (scopedProviders) {
    return [...scopedProviders]
  }
  return connectedOAuthProviders
}

/**
 * Sets connected OAuth providers for runtime tool discovery filtering.
 * Called by stream runners before each query.
 */
export function setSearchToolsConnectedProviders(providers: string[]): void {
  connectedOAuthProviders = normalizeProviders(providers)
}

/**
 * Runs a callback with request-scoped connected OAuth providers.
 * Prevents provider leakage across concurrent queries in shared processes.
 */
export async function withSearchToolsConnectedProviders<T>(providers: string[], run: () => Promise<T> | T): Promise<T> {
  const normalizedProviders = new Set(normalizeProviders(providers))
  return await connectedOAuthProvidersContext.run(normalizedProviders, async () => run())
}

// =============================================================================
// EXECUTE MODE
// =============================================================================

/** Names of discoverable tools that can be executed via search_tools */
const DISCOVERABLE_TOOL_NAMES = new Set<string>(
  getDiscoverableToolNames().map((qualified: string) => {
    // Extract bare name from "mcp__alive-tools__debug_workspace" → "debug_workspace"
    const parts = qualified.split("__")
    return parts[parts.length - 1] ?? qualified
  }),
)

async function executeDiscoverableTool(toolName: string, params: Record<string, unknown>): Promise<SearchToolsResult> {
  if (!DISCOVERABLE_TOOL_NAMES.has(toolName)) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Tool "${toolName}" is not a discoverable tool. It may already be available directly — try calling it by name.\n\nDiscoverable tools: ${[...DISCOVERABLE_TOOL_NAMES].join(", ")}`,
        },
      ],
      isError: true,
    }
  }

  const handler = await getDiscoverableHandler(toolName)
  if (!handler) {
    return {
      content: [{ type: "text" as const, text: `No handler found for tool "${toolName}".` }],
      isError: true,
    }
  }

  try {
    const result = await handler(params)
    return {
      content: result.content,
      isError: result.isError,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: "text" as const, text: `Tool "${toolName}" failed: ${message}` }],
      isError: true,
    }
  }
}

// =============================================================================
// DISCOVER MODE
// =============================================================================

function discoverTools(category: ToolCategory, detail_level: DetailLevel): SearchToolsResult {
  const tools = getSearchToolRegistry(getEffectiveConnectedProviders()).filter(t => t.category === category)

  if (tools.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `# No Tools Found\n\nCategory: "${category}"\n\nNo tools found in this category.`,
        },
      ],
      isError: false,
    }
  }

  let output = `# Tools in "${category}" (${tools.length})\n\n`

  for (const t of tools) {
    if (detail_level === "minimal") {
      output += `- **${t.name}**\n`
    } else if (detail_level === "standard") {
      output += `### ${t.name}\n`
      output += `${t.description}\n`
      output += `- **Context cost:** ${t.contextCost}\n\n`
    } else {
      output += `### ${t.name}\n`
      output += `${t.description}\n\n`
      output += `- **Context cost:** ${t.contextCost}\n`

      if (t.parameters && t.parameters.length > 0) {
        output += "- **Parameters:**\n"
        for (const param of t.parameters) {
          output += `  - \`${param.name}\` (${param.type}${param.required ? ", required" : ", optional"}): ${param.description}\n`
        }
      }
      output += "\n"
    }
  }

  output += "\n---\n"
  output += 'To use a discoverable tool, call: `search_tools({ execute: "<tool_name>", params: { ... } })`\n'

  return {
    content: [{ type: "text" as const, text: output }],
    isError: false,
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function searchTools(params: SearchToolsParams): Promise<SearchToolsResult> {
  try {
    // Execute mode: proxy to a discoverable tool
    if (params.execute) {
      return executeDiscoverableTool(params.execute, params.params ?? {})
    }

    // Discover mode: list tools by category
    if (!params.category) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Provide a category to discover tools, or use execute to run a discoverable tool.\n\nCategories: ${TOOL_CATEGORIES.join(", ")}`,
          },
        ],
        isError: true,
      }
    }

    return discoverTools(params.category, params.detail_level ?? "standard")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: "text" as const, text: `# Tool Search Failed\n\nError: ${errorMessage}` }],
      isError: true,
    }
  }
}

export const searchToolsTool = tool(
  "search_tools",
  `Discover and execute tools on demand. Most specialized tools are not loaded by default — use this tool to find and run them.

**Discover mode** (browse available tools):
  search_tools({ category: "debugging" })
  search_tools({ category: "workspace", detail_level: "full" })

**Execute mode** (run a discovered tool):
  search_tools({ execute: "debug_workspace", params: { workspace: "my-site.alive.best" } })
  search_tools({ execute: "read_server_logs", params: { workspace: "my-site.alive.best", lines: 50 } })

Categories: ${TOOL_CATEGORIES.join(", ")}

Always discover first if unsure which tool to use. Then execute with the correct parameters.`,
  searchToolsParamsSchema,
  async args => {
    return searchTools(args)
  },
)

/**
 * Get list of enabled internal MCP tool names with mcp__ prefixes.
 * Derived from INTERNAL_TOOL_DESCRIPTORS (single source of truth).
 */
export function getEnabledMcpToolNames(): string[] {
  return getInternalMcpToolNames({ enabled: true })
}
