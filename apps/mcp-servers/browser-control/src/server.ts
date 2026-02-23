/**
 * Browser Control Server
 *
 * HTTP server on 127.0.0.1:5061 that manages a headless Chromium
 * instance for website QA. The agent's browser tool calls this server.
 *
 * Auth: X-Internal-Secret header (same pattern as other internal tools).
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { browserPool } from "./browser-pool.js"
import { sendError } from "./http.js"
import { handleAct } from "./routes/act.js"
import { handleConsole } from "./routes/console.js"
import { handleOpen } from "./routes/open.js"
import { handleScreenshot } from "./routes/screenshot.js"
import { handleSnapshot } from "./routes/snapshot.js"
import { handleStatus } from "./routes/status.js"

const PORT = 5061
const HOST = "127.0.0.1"

// Auth secret — must match INTERNAL_TOOLS_SECRET in the worker environment
const INTERNAL_SECRET = process.env.INTERNAL_TOOLS_SECRET ?? ""

if (!INTERNAL_SECRET) {
  console.warn("[browser-control] WARNING: INTERNAL_TOOLS_SECRET is not set. Auth is disabled.")
}

function isAuthorized(req: IncomingMessage): boolean {
  // If no secret is configured, allow all (dev mode)
  if (!INTERNAL_SECRET) return true

  const header = req.headers["x-internal-secret"]
  const token = Array.isArray(header) ? header[0] : header
  return token === INTERNAL_SECRET
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Auth check
  if (!isAuthorized(req)) {
    sendError(res, 401, "Unauthorized")
    return
  }

  const url = new URL(req.url ?? "/", `http://${HOST}`)
  const method = req.method ?? "GET"
  const path = url.pathname

  try {
    // Route dispatch
    if (method === "GET" && path === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" })
      res.end("ok")
      return
    }

    if (method === "GET" && path.startsWith("/status")) {
      await handleStatus(req, res)
      return
    }

    if (method === "POST" && path === "/open") {
      await handleOpen(req, res)
      return
    }

    if (method === "POST" && path === "/screenshot") {
      await handleScreenshot(req, res)
      return
    }

    if (method === "POST" && path === "/snapshot") {
      await handleSnapshot(req, res)
      return
    }

    if (method === "POST" && path === "/act") {
      await handleAct(req, res)
      return
    }

    if (method === "POST" && path === "/console") {
      await handleConsole(req, res)
      return
    }

    sendError(res, 404, `Not found: ${method} ${path}`)
  } catch (err) {
    console.error(`[server] Unhandled error on ${method} ${path}:`, err)
    sendError(res, 500, `Internal error: ${String(err instanceof Error ? err.message : err)}`)
  }
}

// Start server
const server = createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error("[server] Fatal request error:", err)
    if (!res.headersSent) {
      sendError(res, 500, "Internal server error")
    }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[browser-control] Listening on http://${HOST}:${PORT}`)
  console.log(`[browser-control] Auth: ${INTERNAL_SECRET ? "enabled" : "disabled (dev mode)"}`)
})

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[browser-control] Received ${signal}, shutting down...`)
  server.close()
  await browserPool.shutdown()
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
