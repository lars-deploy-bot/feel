import { exec } from "node:child_process"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { createErrorResponse } from "@/features/auth/lib/auth"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()
  const requestId = crypto.randomUUID()

  if (!jar.get("manager_session")) {
    const res = createErrorResponse(ErrorCodes.UNAUTHORIZED, 401, { requestId })
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { action } = body

    if (!action) {
      const res = createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, { field: "action", requestId })
      addCorsHeaders(res, origin)
      return res
    }

    if (action === "reload_caddy") {
      try {
        const { stdout, stderr } = await execAsync("systemctl reload caddy")
        const res = NextResponse.json({ ok: true, output: stdout, error: stderr || null })
        addCorsHeaders(res, origin)
        return res
      } catch (error) {
        const res = createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500, {
          exception: error instanceof Error ? error.message : "Failed to reload Caddy",
        })
        addCorsHeaders(res, origin)
        return res
      }
    }

    if (action === "restart_bridge") {
      try {
        execAsync("pm2 restart claude-bridge").catch(() => {})
        const res = NextResponse.json({ ok: true })
        addCorsHeaders(res, origin)
        return res
      } catch (error) {
        const res = createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500, {
          exception: error instanceof Error ? error.message : "Failed to restart bridge",
        })
        addCorsHeaders(res, origin)
        return res
      }
    }

    if (action === "backup_websites") {
      try {
        const { stdout, stderr } = await execAsync("/root/webalive/claude-bridge/backup-websites.sh")
        const res = NextResponse.json({ ok: true, output: stdout, error: stderr || null })
        addCorsHeaders(res, origin)
        return res
      } catch (error) {
        const res = createErrorResponse(ErrorCodes.INTERNAL_ERROR, 500, {
          exception: error instanceof Error ? error.message : "Failed to backup websites",
        })
        addCorsHeaders(res, origin)
        return res
      }
    }

    const res = createErrorResponse(ErrorCodes.UNKNOWN_ACTION, 400, { action, requestId })
    addCorsHeaders(res, origin)
    return res
  } catch (_error) {
    const res = createErrorResponse(ErrorCodes.INVALID_JSON, 400, { requestId })
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
