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
  "Restarts the systemd dev server for the current workspace. Use this after making structural changes that require a server restart (e.g., changing from localStorage to server-side state, adding new dependencies, modifying server configuration).",
  restartServerParamsSchema,
  async args => {
    return restartServer(args)
  },
)
