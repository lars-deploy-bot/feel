import type { Options } from "@anthropic-ai/claude-agent-sdk"
import { ensurePathWithinWorkspace, type Workspace } from "@/features/workspace/lib/workspace-secure"
import { isToolAllowed } from "@/types/guards/api"

export const ALLOWED_TOOLS = new Set(["Write", "Edit", "Read", "Glob", "Grep"])

function extractFilePath(input: Record<string, unknown>): string | null {
  const filePathValue = input.file_path ?? input.path ?? input.notebook_path
  return typeof filePathValue === "string" ? filePathValue : null
}

export function createToolPermissionHandler(workspace: Workspace, requestId: string): Options["canUseTool"] {
  return async (toolName, input) => {
    console.log(`[Request ${requestId}] Tool requested: ${toolName}`)

    if (!isToolAllowed(toolName, ALLOWED_TOOLS)) {
      console.log(`[Request ${requestId}] Tool denied: ${toolName}`)
      return {
        behavior: "deny",
        message: `tool_not_allowed: ${toolName}`,
      }
    }

    const filePath = extractFilePath(input)

    if (filePath) {
      try {
        ensurePathWithinWorkspace(filePath, workspace.root)
        console.log(`[Request ${requestId}] Path allowed: ${filePath}`)
      } catch {
        console.log(`[Request ${requestId}] Path outside workspace: ${filePath}`)
        return {
          behavior: "deny",
          message: "path_outside_workspace",
        }
      }
    }

    console.log(`[Request ${requestId}] Tool allowed: ${toolName}`)
    return {
      behavior: "allow",
      updatedInput: {
        ...input,
        __workspace: workspace,
      },
      updatedPermissions: [],
    }
  }
}
