import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { callBridgeApi, type ToolResult } from "../../lib/bridge-api-client.js"

export const restartServerParamsSchema = {
  workspaceRoot: z.string().describe("The root path of the workspace (e.g., /srv/webalive/sites/example.com/user)"),
}

export type RestartServerParams = {
  workspaceRoot: string
}

export async function restartServer(params: RestartServerParams): Promise<ToolResult> {
  const { workspaceRoot } = params

  return callBridgeApi({
    endpoint: "/api/restart-workspace",
    body: { workspaceRoot },
  })
}

export const restartServerTool = tool(
  "restart_dev_server",
  "Clears the Vite dependency cache and restarts the systemd dev server for the current workspace. Use this after: adding new dependencies, encountering component rendering issues, making structural changes, or when UI components appear to work structurally but don't respond to interactions. This fixes stale Vite cache issues that can cause mysterious 'renders but doesn't work' problems.",
  restartServerParamsSchema,
  async args => {
    return restartServer(args)
  },
)
