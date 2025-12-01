import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { COOKIE_NAMES } from "@webalive/shared"
import { validateWorkspacePath } from "../../lib/workspace-validator.js"
import type { ToolResult } from "../../lib/bridge-api-client.js"

export const switchServeModeParamsSchema = {
  mode: z
    .enum(["dev", "build"])
    .describe("'dev' for development server (hot reload), 'build' for production build (faster, no hot reload)"),
  build_first: z
    .boolean()
    .optional()
    .default(true)
    .describe("When switching to 'build' mode, run the build first (default: true)"),
}

export type SwitchServeModeParams = {
  mode: "dev" | "build"
  build_first?: boolean
}

function getApiBaseUrl(): string {
  const portEnv = process.env.PORT
  if (!portEnv) {
    throw new Error("Invalid PORT environment variable")
  }
  const port = Number.parseInt(portEnv.trim(), 10)
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT environment variable")
  }
  return `http://localhost:${port}`
}

/**
 * Switch the workspace between dev server and production build serving.
 *
 * SECURITY MODEL (API Call Pattern):
 * - Uses API call because systemctl requires root privileges
 * - Child process runs as workspace user (after setuid) - cannot execute systemctl
 * - API route runs in parent process (as root) with full privilege
 * - API route validates workspace authorization before executing systemctl
 */
export async function switchServeMode(params: SwitchServeModeParams): Promise<ToolResult> {
  const workspaceRoot = process.cwd()

  try {
    validateWorkspacePath(workspaceRoot)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      content: [
        {
          type: "text",
          text: `✗ Could not find your site. Make sure you're in the right workspace.\n\nTechnical: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }

  try {
    const apiUrl = `${getApiBaseUrl()}/api/internal-tools/switch-serve-mode`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const sessionCookie = process.env.BRIDGE_SESSION_COOKIE
    const internalSecret = process.env.INTERNAL_TOOLS_SECRET

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionCookie && { Cookie: `${COOKIE_NAMES.SESSION}=${sessionCookie}` }),
        ...(internalSecret && { "X-Internal-Tools-Secret": internalSecret }),
      },
      body: JSON.stringify({
        workspaceRoot,
        mode: params.mode,
        buildFirst: params.build_first ?? true,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const result = (await response.json()) as {
      ok?: boolean
      message?: string
      output?: string
    }

    // For this tool, we want to show the formatted output on both success and failure
    if (result.ok) {
      return {
        content: [{ type: "text", text: result.message || "✓ Mode switched successfully" }],
        isError: false,
      }
    }

    // On failure, show friendly message + technical build output
    const technicalDetails = result.output || result.message || "Unknown error"
    return {
      content: [
        {
          type: "text",
          text: `✗ Could not switch modes. There might be errors in your code that need fixing first.\n\nTechnical details:\n${technicalDetails}`,
        },
      ],
      isError: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (errorMessage.includes("aborted")) {
      return {
        content: [
          {
            type: "text",
            text: "✗ The build is taking too long (over 2 minutes). Your code might have an issue, or there's a lot to compile.\n\nTechnical: Request timed out after 120 seconds",
          },
        ],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `✗ Could not connect to your site's server. This is usually temporary - please try again.\n\nTechnical: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const switchServeModeTool = tool(
  "switch_serve_mode",
  `Switch the workspace between development server and production build serving.

- **dev**: Hot reload, faster rebuilds, better for development
- **build**: Serves pre-built production bundle, faster page loads, no hot reload

Use 'build' mode when:
- The site is ready for production/preview
- You want faster page loads for testing
- Hot reload is not needed

Use 'dev' mode when:
- Actively developing and need hot reload
- Making frequent changes

Examples:
- switch_serve_mode({ mode: "build" }) - Build and serve production
- switch_serve_mode({ mode: "build", build_first: false }) - Serve existing build (skip rebuild)
- switch_serve_mode({ mode: "dev" }) - Switch back to dev server`,
  switchServeModeParamsSchema,
  async args => {
    return switchServeMode(args)
  },
)
