/**
 * Browser Control Server
 *
 * HTTP server on 127.0.0.1:5061 that manages a headless Chromium
 * instance for website QA. The agent's browser tool calls this server.
 *
 * Auth: X-Internal-Secret header (same pattern as other internal tools).
 *
 * All POST routes use the `dispatch` function which enforces:
 * - JSON body parsing
 * - AbortSignal from client disconnect (RouteHandler MUST accept it)
 * - Abort check before sending response
 * - Error wrapping
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { browserPool } from "./browser-pool.js"
import { dispatch, sendError } from "./http.js"
import { handleAct } from "./routes/act.js"
import { handleConsole } from "./routes/console.js"
import { handleOpen } from "./routes/open.js"
import { handleScreenshot } from "./routes/screenshot.js"
import { handleSnapshot } from "./routes/snapshot.js"
import { handleStatus } from "./routes/status.js"

const PORT = 5061
const HOST = "0.0.0.0"

// Auth secret — must match INTERNAL_TOOLS_SECRET in the worker environment
const INTERNAL_SECRET = process.env.INTERNAL_TOOLS_SECRET

if (!INTERNAL_SECRET) {
  console.error("[browser-control] FATAL: INTERNAL_TOOLS_SECRET is not set. Refusing to start without auth.")
  process.exit(1)
}

function isAuthorized(req: IncomingMessage): boolean {
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
    // GET routes (no body parsing / abort needed)
    if (method === "GET" && path === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" })
      res.end("ok")
      return
    }

    if (method === "GET" && path.startsWith("/status")) {
      await handleStatus(req, res)
      return
    }

    // POST routes — all go through dispatch (enforces AbortSignal + body parsing)
    if (method === "POST" && path === "/open") return dispatch(handleOpen, req, res)
    if (method === "POST" && path === "/screenshot") return dispatch(handleScreenshot, req, res)
    if (method === "POST" && path === "/snapshot") return dispatch(handleSnapshot, req, res)
    if (method === "POST" && path === "/act") return dispatch(handleAct, req, res)
    if (method === "POST" && path === "/console") return dispatch(handleConsole, req, res)

    sendError(res, 404, `Not found: ${method} ${path}`)
  } catch (err) {
    console.error(`[server] Unhandled error on ${method} ${path}:`, err)
    sendError(res, 500, `Internal error: ${String(err instanceof Error ? err.message : err)}`)
  }
}

// Start server
const server = createServer(async (req, res) => {
  try {
    await handleRequest(req, res)
  } catch (err) {
    console.error("[server] Fatal request error:", err)
    if (!res.headersSent) {
      sendError(res, 500, "Internal server error")
    }
  }
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
