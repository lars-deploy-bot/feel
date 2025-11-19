import { execSync } from "node:child_process"
import { type NextRequest, NextResponse } from "next/server"
import { isManagerAuthenticated } from "@/features/auth/lib/auth"
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
    const res = NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Manager authentication required", requestId },
      { status: 401 },
    )
    addCorsHeaders(res, origin)
    return res
  }

  try {
    console.log("[Manager] Starting Caddy reload")
    const output = execSync("systemctl reload caddy", { encoding: "utf-8" })

    console.log("[Manager] Caddy reload completed")

    const res = NextResponse.json({
      ok: true,
      output,
      message: "Caddy configuration reloaded successfully",
      requestId,
    })
    addCorsHeaders(res, origin)
    return res
  } catch (error) {
    console.error("[Manager] Caddy reload failed:", error)
    const res = NextResponse.json(
      {
        ok: false,
        error: "RELOAD_FAILED",
        message: error instanceof Error ? error.message : "Failed to reload Caddy",
        requestId,
      },
      { status: 500 },
    )
    addCorsHeaders(res, origin)
    return res
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer")?.split("/").slice(0, 3).join("/")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin ?? null)
  return res
}
