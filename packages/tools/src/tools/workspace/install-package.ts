import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"

// Workspace context injected by permission handler (not from Claude)
interface Workspace {
  root: string
  uid: number
  gid: number
  tenantId: string
}

export const installPackageParamsSchema = {
  packageName: z.string().describe("The npm/JavaScript package name to install (e.g., 'react', 'lodash', '@types/node')"),
  version: z
    .string()
    .optional()
    .describe("Optional package version (e.g., '18.2.0', '^18.0.0', '~2.1.0', 'latest', 'next')"),
  dev: z.boolean().optional().describe("Whether to install as a dev dependency (default: false)"),
}

export type InstallPackageParams = {
  packageName: string
  version?: string
  dev?: boolean
  __workspace?: Workspace // Injected by permission handler, not from Claude
}

export type InstallPackageResult = {
  content: Array<{ type: "text"; text: string }>
  isError: boolean
}

export async function installPackage(params: InstallPackageParams): Promise<InstallPackageResult> {
  const { packageName, version, dev = false, __workspace } = params

  // Workspace context is injected by permission handler - MUST be present
  if (!__workspace) {
    return {
      content: [
        {
          type: "text" as const,
          text: "✗ Security error: Workspace context missing. This tool must be called through the Claude SDK permission system.",
        },
      ],
      isError: true,
    }
  }

  const workspaceRoot = __workspace.root
  const packageSpec = version ? `${packageName}@${version}` : packageName

  try {
    // Port 8998 is the production Claude Bridge API server
    const response = await fetch("http://localhost:8998/api/install-package", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceRoot, packageName, version, dev }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`

      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.message || errorMessage
      } catch {
        // Response wasn't JSON, use status text
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `✗ Failed to install ${packageSpec}\n\n${errorMessage}`,
          },
        ],
        isError: true,
      }
    }

    const result = (await response.json()) as { success?: boolean; message?: string; output?: string }

    if (result.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: `✓ Successfully installed ${packageSpec}${dev ? " (dev dependency)" : ""}\n\n${result.output || result.message || ""}`,
          },
        ],
        isError: false,
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `✗ Failed to install ${packageSpec}\n\n${result.message || "Unknown error"}`,
        },
      ],
      isError: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    return {
      content: [
        {
          type: "text" as const,
          text: `✗ Failed to call install-package API\n\nError: ${errorMessage}`,
        },
      ],
      isError: true,
    }
  }
}

export const installPackageTool = tool(
  "install_package",
  "Installs JavaScript/npm packages in the user's workspace using bun. IMPORTANT: This tool is ONLY for JavaScript packages from npm (e.g., react, lodash, @types/node). Do NOT use for Python, system packages, or non-JS dependencies. The installation runs in the user's workspace with proper isolation and security. Use this when the user needs to add new npm dependencies to their Node.js/JavaScript project.",
  installPackageParamsSchema,
  async args => {
    return installPackage(args)
  },
)
