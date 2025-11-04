import { cookies } from "next/headers"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { type NextRequest, NextResponse } from "next/server"
import { addCorsHeaders } from "@/lib/cors-utils"

const execAsync = promisify(exec)

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin")
  const jar = await cookies()

  if (!jar.get("manager_session")) {
    const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    addCorsHeaders(res, origin)
    return res
  }

  try {
    const body = await req.json()
    const { action } = body

    if (!action) {
      const res = NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 })
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
        const res = NextResponse.json(
          { ok: false, error: error instanceof Error ? error.message : "Failed to reload Caddy" },
          { status: 500 }
        )
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
        const res = NextResponse.json(
          { ok: false, error: error instanceof Error ? error.message : "Failed to restart bridge" },
          { status: 500 }
        )
        addCorsHeaders(res, origin)
        return res
      }
    }

    const res = NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 })
    addCorsHeaders(res, origin)
    return res
  } catch (_error) {
    const res = NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
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
