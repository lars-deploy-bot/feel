import type { CanUseTool, Options } from "@anthropic-ai/claude-agent-sdk"
import { ALLOWED_TOOLS, MCP_SERVERS, PERMISSION_MODE, SETTINGS_SOURCES } from "./agent-constants.mjs"

interface BuildAgentOptionsInput {
  cwd: string
  model?: string
  maxTurns: number
  systemPrompt?: string | { type: "preset"; preset: "claude_code"; append?: string }
  resume?: string
  canUseTool?: CanUseTool
}

export function buildAgentOptions(input: BuildAgentOptionsInput): Options {
  const { cwd, model, maxTurns, systemPrompt, resume, canUseTool } = input

  const options: Options = {
    cwd,
    allowedTools: ALLOWED_TOOLS,
    permissionMode: PERMISSION_MODE,
    maxTurns,
    systemPrompt,
    settingSources: SETTINGS_SOURCES,
    model,
    mcpServers: MCP_SERVERS,
  }

  if (canUseTool) {
    options.canUseTool = canUseTool
  }

  if (resume) {
    options.resume = resume
  }

  return options
}
