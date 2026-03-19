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

/**
 * Discoverable tool handlers accept Record<string, unknown> from the search_tools
 * dispatcher. Params are Zod-validated by the SDK before reaching handlers, so the
 * runtime shape is guaranteed to match each handler's expected type.
 *
 * Each handler does its own internal validation (safeParse) as a second layer of defense.
 */
type ToolHandler = (params: Record<string, unknown>) => Promise<ToolResult>

/**
 * Lazy-loaded handler registry for discoverable tools.
 * Handlers are imported on first use to avoid loading all tool code at startup.
 *
 * Params come from `searchToolsParamsSchema.params` (z.record(z.string(), z.unknown())),
 * which is structurally `Record<string, unknown>`. Each handler validates its own params
 * internally, so passing Record<string, unknown> is safe.
 */
async function getDiscoverableHandler(toolName: string): Promise<ToolHandler | null> {
  switch (toolName) {
    // alive-tools server
    case "list_workflows": {
      const { listWorkflows } = await import("./list-workflows.js")
      return () => listWorkflows()
    }
    case "get_workflow": {
      const { getWorkflow, getWorkflowParamsSchema } = await import("./get-workflow.js")
      return params => getWorkflow(z.object(getWorkflowParamsSchema).parse(params))
    }
    case "debug_workspace": {
      const { debugWorkspace, debugWorkspaceParamsSchema } = await import("../composite/debug-workspace.js")
      return params => debugWorkspace(z.object(debugWorkspaceParamsSchema).parse(params))
    }
    case "get_alive_super_template": {
      const { getTemplate, getTemplateParamsSchema } = await import("../templates/get-template.js")
      return params => getTemplate(z.object(getTemplateParamsSchema).parse(params), PATHS.TEMPLATES_ROOT)
    }
    case "read_server_logs": {
      const { readServerLogs, readServerLogsParamsSchema } = await import("../debug/read-server-logs.js")
      return params => readServerLogs(z.object(readServerLogsParamsSchema).parse(params))
    }
    case "ask_website_config": {
      const { askWebsiteConfig, askWebsiteConfigParamsSchema } = await import("../ai/ask-website-config.js")
      return params => askWebsiteConfig(z.object(askWebsiteConfigParamsSchema).parse(params))
    }
    case "ask_automation_config": {
      const { askAutomationConfig, askAutomationConfigParamsSchema } = await import("../ai/ask-automation-config.js")
      return params => askAutomationConfig(z.object(askAutomationConfigParamsSchema).parse(params))
    }
    case "list_automations": {
      const { listAutomations, listAutomationsParamsSchema } = await import("../automations/list-automations.js")
      return params => listAutomations(z.object(listAutomationsParamsSchema).parse(params))
    }
    case "generate_persona": {
      const { generatePersona, generatePersonaParamsSchema } = await import("../personas/generate-persona.js")
      return params => generatePersona(z.object(generatePersonaParamsSchema).parse(params))
    }
    // alive-workspace server
    case "check_codebase": {
      const { checkCodebase } = await import("../workspace/check-codebase.js")
      // checkCodebase accepts Record<string, never> (no params)
      return () => checkCodebase({})
    }
    case "switch_serve_mode": {
      const { switchServeMode, switchServeModeParamsSchema } = await import("../workspace/switch-serve-mode.js")
      return params => switchServeMode(z.object(switchServeModeParamsSchema).parse(params))
    }
    case "copy_shared_asset": {
      const { copySharedAsset, copySharedAssetParamsSchema } = await import("../workspace/copy-shared-asset.js")
      return params => copySharedAsset(z.object(copySharedAssetParamsSchema).parse(params))
    }
    case "create_website": {
      const { createWebsite, createWebsiteParamsSchema } = await import("../workspace/create-website.js")
      return params => createWebsite(z.object(createWebsiteParamsSchema).parse(params))
    }
    case "git_push": {
      const { gitPush, gitPushParamsSchema } = await import("../workspace/git-push.js")
      return params => gitPush(z.object(gitPushParamsSchema).parse(params))
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
  search_tools({ execute: "debug_workspace", params: { workspace: "my-site.example.com" } })
  search_tools({ execute: "read_server_logs", params: { workspace: "my-site.example.com", lines: 50 } })

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
