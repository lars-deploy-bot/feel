import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createErrorResponse } from "@/features/auth/lib/auth"
import { ErrorCodes } from "@/lib/error-codes"
import { handleWorkspaceApi } from "@/lib/workspace-api-handler"
import { runAsWorkspaceUser } from "@/lib/workspace-execution/command-runner"

type ServeMode = "dev" | "build" | "unknown"

/**
 * Detect the current serve mode by reading the systemd override file.
 */
function detectCurrentMode(serviceName: string): ServeMode {
  const overrideConf = `/etc/systemd/system/${serviceName}.d/override.conf`
  try {
    const content = readFileSync(overrideConf, "utf-8")
    if (content.includes("bun run dev")) {
      return "dev"
    }
    if (content.includes("bun run preview")) {
      return "build"
    }
    return "unknown"
  } catch {
    // No override file means default (dev mode)
    return "dev"
  }
}

const SwitchServeModeSchema = z.object({
  workspaceRoot: z.string(),
  mode: z.enum(["dev", "build"]),
  buildFirst: z.boolean().optional().default(true),
})

/**
 * Format build output - just show the actual output
 */
function formatBuildOutput(buildOutput?: { stdout?: string; stderr?: string }, error?: string): string {
  const parts: string[] = []

  if (buildOutput?.stderr?.trim()) {
    parts.push(buildOutput.stderr.trim())
  }

  if (buildOutput?.stdout?.trim()) {
    parts.push(buildOutput.stdout.trim())
  }

  if (error) {
    parts.push(error)
  }

  return parts.join("\n\n") || "Build failed with no output"
}

/**
 * POST /api/internal-tools/switch-serve-mode
 *
 * Internal API for switching workspace between dev and build serving modes.
 * Runs with root privileges to modify systemd service configuration.
 *
 * Used by: mcp__alive-workspace__switch_serve_mode
 *
 * Security:
 * - Internal tools secret (X-Internal-Tools-Secret header)
 * - Session authentication via handleWorkspaceApi
 * - Workspace authorization validation
 */
export async function POST(req: Request) {
  // Security: Verify internal tools secret
  const internalSecret = process.env.INTERNAL_TOOLS_SECRET
  const providedSecret = req.headers.get("x-internal-tools-secret")

  if (!internalSecret || providedSecret !== internalSecret) {
    console.error("[switch-serve-mode] Unauthorized: Invalid or missing internal tools secret")
    return createErrorResponse(ErrorCodes.UNAUTHORIZED, 401, { requestId: crypto.randomUUID() })
  }

  return handleWorkspaceApi(req, {
    schema: SwitchServeModeSchema,
    handler: async ({ data, requestId }) => {
      const { workspaceRoot, mode, buildFirst } = data

      const sitePath = dirname(workspaceRoot)
      const domain = basename(sitePath)
      const serviceSlug = domain.replace(/\./g, "-")
      const serviceName = `site@${serviceSlug}.service`
      const overrideDir = `/etc/systemd/system/${serviceName}.d`
      const overrideConf = join(overrideDir, "override.conf")

      // Detect current mode before switching
      const previousMode = detectCurrentMode(serviceName)
      const alreadyInMode = previousMode === mode

      console.log(`[switch-serve-mode ${requestId}] Switching ${domain} from ${previousMode} to ${mode} mode`)

      try {
        // If switching to build mode and buildFirst is true, run the build
        if (mode === "build" && buildFirst) {
          console.log(`[switch-serve-mode ${requestId}] Running build...`)

          const buildResult = await runAsWorkspaceUser({
            command: "bun",
            args: ["run", "build"],
            workspaceRoot,
            timeout: 120000, // 2 minutes for build
          })

          if (!buildResult.success) {
            return NextResponse.json({
              ok: false,
              message: formatBuildOutput({ stdout: buildResult.stdout, stderr: buildResult.stderr }),
              requestId,
            })
          }

          console.log(`[switch-serve-mode ${requestId}] Build completed`)
        }

        // Update systemd override configuration
        // Use ${PORT} from EnvironmentFile - systemd loads /etc/sites/<slug>.env
        const execStart =
          mode === "dev"
            ? `/bin/sh -c 'exec /usr/local/bin/bun run dev --port \${PORT:-3333} --host 0.0.0.0'`
            : `/bin/sh -c 'exec /usr/local/bin/bun run preview --port \${PORT:-3333} --host 0.0.0.0'`

        const overrideContent = `[Service]
ExecStart=
ExecStart=${execStart}
`

        // Ensure override directory exists
        if (!existsSync(overrideDir)) {
          mkdirSync(overrideDir, { recursive: true })
        }

        // Write override configuration
        writeFileSync(overrideConf, overrideContent, { encoding: "utf-8" })
        console.log(`[switch-serve-mode ${requestId}] Updated ${overrideConf}`)

        // Reload systemd and restart service
        execSync("systemctl daemon-reload", { encoding: "utf-8", timeout: 10000 })
        execSync(`systemctl restart ${serviceName}`, { encoding: "utf-8", timeout: 10000 })

        console.log(`[switch-serve-mode ${requestId}] Service restarted in ${mode} mode`)

        // Build informative message based on previous state
        const modeLabel = mode === "dev" ? "Development" : "Production"
        const previousLabel =
          previousMode === "dev" ? "development" : previousMode === "build" ? "production" : "unknown"

        let message: string
        if (alreadyInMode) {
          // Already in this mode - still restart, but inform user
          const explanation =
            mode === "dev"
              ? "Server restarted. Changes will appear instantly (hot reload)."
              : "Server restarted with existing production build."
          message = `✓ Already in ${modeLabel.toLowerCase()} mode. ${explanation}`
        } else {
          // Switched modes
          const explanation =
            mode === "dev"
              ? "Changes you make will appear instantly on the site."
              : "Your site is now running the fast, optimized version."
          message = `✓ Switched from ${previousLabel} to ${modeLabel.toLowerCase()} mode. ${explanation}`
        }

        return NextResponse.json({
          ok: true,
          message,
          previousMode,
          currentMode: mode,
          requestId,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`[switch-serve-mode ${requestId}] Error:`, error)

        return NextResponse.json({
          ok: false,
          message: errorMessage,
          requestId,
        })
      }
    },
  })
}
