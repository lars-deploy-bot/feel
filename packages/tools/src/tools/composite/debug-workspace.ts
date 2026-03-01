import { tool } from "@anthropic-ai/claude-agent-sdk"
import { DOMAINS, LOGS_DEBUG_DEFAULT_LINES, LOGS_MAX_LINES } from "@webalive/shared"
import { z } from "zod"
import type { ToolResult } from "../../lib/api-client.js"
import { readServerLogs } from "../debug/read-server-logs.js"

/**
 * Composite tool: Reads logs with sensible defaults for debugging
 */

const exampleDomain = `two.${DOMAINS.WILDCARD}`
const demoDomain = `demo.${DOMAINS.WILDCARD}`

export const debugWorkspaceParamsSchema = {
  workspace: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i)
    .describe(`Workspace domain (e.g., '${exampleDomain}')`),
  lines: z
    .number()
    .int()
    .min(1)
    .max(LOGS_MAX_LINES)
    .optional()
    .default(LOGS_DEBUG_DEFAULT_LINES)
    .describe(`Log lines to analyze (default: ${LOGS_DEBUG_DEFAULT_LINES})`),
  since: z.string().optional().describe('Time range (e.g., "5 minutes ago", "1 hour ago")'),
}

export type DebugWorkspaceParams = {
  workspace: string
  lines?: number
  since?: string
}

export type DebugWorkspaceResult = ToolResult

export async function debugWorkspace(params: DebugWorkspaceParams): Promise<DebugWorkspaceResult> {
  const { workspace, lines = LOGS_DEBUG_DEFAULT_LINES, since } = params

  // Just read the logs with sensible defaults
  return readServerLogs({
    workspace,
    lines,
    since: since || "10 minutes ago", // Default to recent logs only
  })
}

export const debugWorkspaceTool = tool(
  "debug_workspace",
  `Quick workspace debugging: reads recent server logs (last 10 minutes by default).

Use this FIRST when troubleshooting workspace issues. Returns raw logs for you to analyze.

Examples:
- debug_workspace({ workspace: "${exampleDomain}" })
- debug_workspace({ workspace: "${demoDomain}", since: "5 minutes ago" })`,
  debugWorkspaceParamsSchema,
  async args => {
    return debugWorkspace(args)
  },
)
