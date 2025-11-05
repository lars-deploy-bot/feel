import { tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { callBridgeApi, successResult, type ToolResult } from "../../lib/bridge-api-client.js"

export const installPackageParamsSchema = {
  packageName: z.string().describe("The npm/JavaScript package name to install (e.g., 'react', 'lodash', '@types/node')"),
  version: z
    .string()
    .optional()
    .describe("Optional package version (e.g., '18.2.0', '^18.0.0', '~2.1.0', 'latest', 'next')"),
  dev: z.boolean().optional().describe("Whether to install as a dev dependency (default: false)"),
  workspaceRoot: z
    .string()
    .optional()
    .describe("The root path of the workspace (defaults to current working directory if not provided)"),
}

export type InstallPackageParams = {
  packageName: string
  version?: string
  dev?: boolean
  workspaceRoot?: string
}

export async function installPackage(params: InstallPackageParams): Promise<ToolResult> {
  const { packageName, version, dev = false, workspaceRoot } = params

  // Use explicit workspace root or default to current directory
  const resolvedWorkspaceRoot = workspaceRoot || process.cwd()
  const packageSpec = version ? `${packageName}@${version}` : packageName

  const result = await callBridgeApi({
    endpoint: "/api/install-package",
    body: { workspaceRoot: resolvedWorkspaceRoot, packageName, version, dev },
  })

  // Customize success message with package info
  if (!result.isError) {
    return successResult(`Successfully installed ${packageSpec}${dev ? " (dev dependency)" : ""}`)
  }

  return result
}

export const installPackageTool = tool(
  "install_package",
  "Installs JavaScript/npm packages in the user's workspace using bun. IMPORTANT: This tool is ONLY for JavaScript packages from npm (e.g., react, lodash, @types/node). Do NOT use for Python, system packages, or non-JS dependencies. The installation runs in the user's workspace with proper isolation and security. Use this when the user needs to add new npm dependencies to their Node.js/JavaScript project.",
  installPackageParamsSchema,
  async args => {
    return installPackage(args)
  },
)
