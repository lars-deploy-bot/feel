import type { ServerWebSocket } from "bun"
import "./sentry" // Init Sentry before any other imports
import { env } from "./env"
import { bridgePty, handleClose, handleMessage } from "./pty-bridge"
import { cleanExpiredLeases, consumeLease, createLease } from "./session-store"

const PORT = env.PORT
const INTERNAL_SECRET = env.SHELL_PASSWORD

interface WsData {
  sandboxId: string
  hostname: string
  workspace: string
}

// Clean expired leases every 30s
setInterval(cleanExpiredLeases, 30_000)

Bun.serve<WsData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url)

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "e2b-terminal" })
    }

    // Internal lease creation (called by apps/web terminal lease route)
    if (url.pathname === "/internal/lease" && req.method === "POST") {
      return handleLeaseRequest(req)
    }

    // WebSocket upgrade for /e2b/ws
    if (url.pathname === "/e2b/ws") {
      const leaseToken = url.searchParams.get("lease")
      if (!leaseToken) {
        return Response.json({ error: "Missing lease parameter" }, { status: 401 })
      }

      const entry = consumeLease(leaseToken)
      if (!entry) {
        return Response.json({ error: "Invalid or expired lease" }, { status: 401 })
      }

      const upgraded = server.upgrade(req, {
        data: {
          sandboxId: entry.sandboxId,
          hostname: entry.hostname,
          workspace: entry.workspace,
        },
      })

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 500 })
      }

      return undefined
    }

    return Response.json({ error: "Not found" }, { status: 404 })
  },

  websocket: {
    open(ws: ServerWebSocket<WsData>) {
      bridgePty(ws)
    },
    message(ws: ServerWebSocket<WsData>, message: Buffer | string) {
      handleMessage(ws, message)
    },
    close(ws: ServerWebSocket<WsData>) {
      handleClose(ws)
    },
  },
})

async function handleLeaseRequest(req: Request): Promise<Response> {
  const secret = req.headers.get("X-Internal-Secret")
  if (secret !== INTERNAL_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    workspace?: string
    sandboxDomain?: {
      domain_id?: string
      hostname?: string
      sandbox_id?: string
      sandbox_status?: string
    }
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const workspace = body.workspace
  const sandboxId = body.sandboxDomain?.sandbox_id
  const hostname = body.sandboxDomain?.hostname

  if (!workspace || typeof workspace !== "string") {
    return Response.json({ error: "Missing workspace" }, { status: 400 })
  }
  if (!sandboxId || typeof sandboxId !== "string") {
    return Response.json({ error: "Missing sandbox_id" }, { status: 400 })
  }
  if (!hostname || typeof hostname !== "string") {
    return Response.json({ error: "Missing hostname" }, { status: 400 })
  }

  const lease = createLease(workspace, sandboxId, hostname)
  const expiresAt = Math.floor(Date.now() / 1000) + 90

  return Response.json({
    lease,
    workspace,
    expiresAt,
  })
}

console.log(`[e2b-terminal] Listening on port ${PORT}`)
