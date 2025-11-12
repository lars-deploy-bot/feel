import { execSync } from "node:child_process"
import { basename, dirname } from "node:path"
import { NextResponse } from "next/server"
import { z } from "zod"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { handleWorkspaceApi } from "@/lib/workspace-api-handler"
import { runAsWorkspaceUser } from "@/lib/workspace-execution/command-runner"

const RestartSchema = z.object({
  workspaceRoot: z.string(),
})

export async function POST(req: Request) {
  return handleWorkspaceApi(req, {
    schema: RestartSchema,
    handler: async ({ data, requestId }) => {
      const { workspaceRoot } = data

      const sitePath = dirname(workspaceRoot)
      const domain = basename(sitePath)
      const serviceSlug = domain.replace(/\./g, "-")
      const serviceName = `site@${serviceSlug}.service`

      try {
        // Clear Vite cache to prevent stale dependency issues
        // IMPORTANT: Run as workspace user to ensure correct file ownership
        try {
          const result = await runAsWorkspaceUser({
            command: "rm",
            args: ["-rf", "node_modules/.vite"],
            workspaceRoot,
            timeout: 5000,
          })

          if (!result.success) {
            console.warn(`[restart-workspace ${requestId}] Failed to clear Vite cache:`, result.stderr)
            // Continue with restart anyway - cache clear is optional
          } else {
            console.log(`[restart-workspace ${requestId}] Vite cache cleared`)
          }
        } catch (cacheError) {
          // Cache might not exist or command failed, continue with restart
          console.warn(`[restart-workspace ${requestId}] Cache clear error:`, cacheError)
        }

        // Restart the systemd service (runs as root - system operation)
        execSync(`systemctl restart ${serviceName}`, {
          encoding: "utf-8",
          timeout: 10000,
        })

        return NextResponse.json({
          ok: true,
          service: serviceName,
          message: `Vite cache cleared and dev server restarted: ${serviceName}`,
          requestId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_RESTART_FAILED,
            message: getErrorMessage(ErrorCodes.WORKSPACE_RESTART_FAILED),
            details: {
              service: serviceName,
              error: errorMessage,
            },
            requestId,
          },
          { status: 500 },
        )
      }
    },
  })
}
