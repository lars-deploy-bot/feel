import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ErrorCodes } from "@/lib/error-codes"
import { handleWorkspaceApi } from "@/lib/workspace-api-handler"
import { extractDomainFromWorkspace, restartSystemdService } from "@/lib/workspace-service-manager"

const InstallPackageSchema = z.object({
  workspaceRoot: z.string(),
  packageName: z
    .string()
    .min(1)
    .max(214) // npm package name length limit
    .regex(
      /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/,
      "Invalid package name format. Must follow npm naming conventions.",
    ),
  version: z
    .string()
    .regex(/^[\d.]+$|^\^[\d.]+$|^~[\d.]+$|^>=?[\d.]+$|^<=?[\d.]+$|^latest$|^next$/, "Invalid version format")
    .optional(),
  dev: z.boolean().optional(),
})

export async function POST(req: Request) {
  return handleWorkspaceApi(req, {
    schema: InstallPackageSchema,
    handler: async ({ data, requestId }) => {
      const { workspaceRoot, packageName, version, dev = false } = data

      // Verify package.json exists
      const packageJsonPath = join(workspaceRoot, "package.json")
      if (!existsSync(packageJsonPath)) {
        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.INVALID_REQUEST,
            message: "No package.json found in workspace",
            requestId,
          },
          { status: 400 },
        )
      }

      try {
        // Build package specifier with optional version
        const packageSpec = version ? `${packageName}@${version}` : packageName
        const args = dev ? ["add", "-D", packageSpec] : ["add", packageSpec]

        console.log(`[install-package ${requestId}] Running: bun ${args.join(" ")} in ${workspaceRoot}`)

        // Use spawnSync with args array to prevent shell injection
        const result = spawnSync("bun", args, {
          cwd: workspaceRoot,
          encoding: "utf-8",
          timeout: 60000, // 60 second timeout
          shell: false, // CRITICAL: no shell = no injection attacks
        })

        if (result.error) {
          throw result.error
        }

        if (result.status !== 0) {
          const stderr = result.stderr || ""
          console.error(`[install-package ${requestId}] Command failed with status ${result.status}:`, stderr)

          return NextResponse.json(
            {
              ok: false,
              error: ErrorCodes.PACKAGE_INSTALL_FAILED,
              message: `Failed to install ${packageSpec}`,
              details: {
                package: packageSpec,
                exitCode: result.status,
                stderr: stderr.trim(),
                stdout: result.stdout?.trim() || "",
              },
              requestId,
            },
            { status: 500 },
          )
        }

        const output = result.stdout || ""
        console.log(`[install-package ${requestId}] Success:`, output)

        // Extract domain from workspace path
        const domain = extractDomainFromWorkspace(workspaceRoot)

        // Attempt to restart the dev server if we have a valid domain
        if (domain) {
          const restartResult = restartSystemdService(domain, requestId)

          // If restart failed, return a partial failure (package installed, but service restart failed)
          if (!restartResult.success) {
            return NextResponse.json(
              {
                ok: false,
                error: ErrorCodes.DEV_SERVER_RESTART_FAILED,
                message: restartResult.message,
                details: {
                  service: `site@${domain.replace(/\./g, "-")}.service`,
                  packageInstalled: true,
                  packageSpec,
                },
                requestId,
              },
              { status: 500 },
            )
          }

          // Success: both installation and restart succeeded
          return NextResponse.json({
            ok: true,
            message: `Successfully installed ${packageSpec}${dev ? " (dev dependency)" : ""} and restarted dev server`,
            details: {
              packageSpec,
              devServerRestarted: true,
            },
            requestId,
          })
        }

        // Success: installation succeeded, but domain couldn't be determined (dev server won't auto-restart)
        return NextResponse.json({
          ok: true,
          message: `Successfully installed ${packageSpec}${dev ? " (dev dependency)" : ""}. Note: Could not auto-restart dev server (invalid workspace path).`,
          details: {
            packageSpec,
            devServerRestarted: false,
            reason: "Could not extract domain from workspace path",
          },
          requestId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[install-package ${requestId}] Error:`, errorMessage)

        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.PACKAGE_INSTALL_FAILED,
            message: `Failed to install ${packageName}${version ? `@${version}` : ""}`,
            details: {
              package: packageName,
              version,
              reason: errorMessage,
            },
            requestId,
          },
          { status: 500 },
        )
      }
    },
  })
}
