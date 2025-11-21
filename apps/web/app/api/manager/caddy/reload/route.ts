import { execSync } from "node:child_process"
import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
import { createCorsResponse, createCorsSuccessResponse } from "@/lib/api/responses"
import { addCorsHeaders } from "@/lib/cors-utils"
import { generateRequestId } from "@/lib/utils"

/**
 * POST /api/manager/caddy/reload
 *
 * Reload Caddy reverse proxy configuration
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")

  // Check manager authentication
  if (!(await isManagerAuthenticated())) {
    return createCorsResponse(
      origin,
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      401,
    )
  }

  try {
    console.log("[Manager] Starting Caddy reload")
    const output = execSync("systemctl reload caddy", { encoding: "utf-8" })

    console.log("[Manager] Caddy reload completed")

    return createCorsSuccessResponse(origin, {
      output,
      message: "Caddy configuration reloaded successfully",
      requestId,
    })
  } catch (error) {
    console.error("[Manager] Caddy reload failed:", error)
    return createCorsResponse(
      origin,
      {
        ok: false,
        error: "RELOAD_FAILED",
        message: error instanceof Error ? error.message : "Failed to reload Caddy",
        requestId,
      },
      500,
    )
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
