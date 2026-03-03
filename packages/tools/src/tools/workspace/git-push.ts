import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { callApi, type ToolResult } from "../../lib/api-client.js"

export const gitPushParamsSchema = {
  branch: z.string().optional().describe("Branch to push. If omitted, pushes the current branch."),
  remote: z
    .string()
    .optional()
    .describe(
      'Remote name (default: "origin"). The remote is auto-configured from the site\'s source repository if not already set.',
    ),
}

export type GitPushParams = {
  branch?: string
  remote?: string
}

/**
 * Push committed changes to the remote repository.
 *
 * SECURITY MODEL (API Call Pattern):
 * - Uses API call because OAuth token retrieval requires platform-level access
 * - GitHub token is injected via GIT_ASKPASS (Daytona push pattern):
 *   control plane pushes credentials TO sandbox per-operation
 * - Token never touches disk, never in env file, only in child process memory
 * - API route validates workspace authorization before executing push
 * - planMode: "block" — user must approve plan before Claude can push
 */
export async function gitPush(params: GitPushParams): Promise<ToolResult> {
  const workspaceRoot = process.cwd()

  const result = await callApi({
    endpoint: "/api/git/push",
    body: {
      workspaceRoot,
      ...(params.branch && { branch: params.branch }),
      ...(params.remote && { remote: params.remote }),
    },
    timeout: 120000, // 2 minutes for large repos
  })

  return result
}

export const gitPushTool = tool(
  "git_push",
  "Push committed changes to the remote GitHub repository. Requires the user to have GitHub connected via OAuth in Settings. The remote is automatically configured from the site's source repository metadata if not already set up. Use this after committing changes that should be pushed upstream.",
  gitPushParamsSchema,
  async args => {
    return gitPush(args)
  },
)
