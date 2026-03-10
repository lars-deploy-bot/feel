/**
 * Minimal HTTP helpers.
 *
 * No Express dependency — just raw Node http. Keeps the service lightweight.
 */

import type { IncomingMessage, ServerResponse } from "node:http"
import type { RouteHandler } from "./types.js"

export function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  })
  res.end(body)
}

export function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, { error: message }, status)
}

const MAX_BODY_BYTES = 1_048_576 // 1 MB

export async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy()
        reject(new Error("Request body too large"))
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8")
        if (!raw.trim()) {
          resolve({})
          return
        }
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          reject(new Error("Invalid JSON body: expected an object"))
          return
        }
        resolve(parsed as Record<string, unknown>)
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${String(err)}`))
      }
    })
    req.on("error", reject)
  })
}

/**
 * Dispatch a typed RouteHandler. Handles:
 * 1. JSON body parsing
 * 2. Abort signal from client disconnect
 * 3. Abort check before sending response
 * 4. Error → 500 wrapping
 *
 * Route handlers MUST accept AbortSignal (enforced by RouteHandler type).
 * They can't forget it, and they can't accidentally send to dead connections.
 */
export async function dispatch(handler: RouteHandler, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const controller = new AbortController()
  const onClose = () => controller.abort()
  req.on("close", onClose)

  let body: Record<string, unknown>
  try {
    body = await parseJsonBody(req)
  } catch (err) {
    sendError(res, 400, err instanceof Error ? err.message : "Invalid request body")
    return
  }

  try {
    const result = await handler(body, controller.signal)

    // Client disconnected while handler was running — don't send
    if (controller.signal.aborted) return

    if (result.ok) {
      sendJson(res, result.data)
    } else {
      sendError(res, result.status, result.error)
    }
  } catch (err) {
    if (controller.signal.aborted) return
    console.error("[dispatch] Unhandled route error:", err)
    sendError(res, 500, `Internal error: ${String(err instanceof Error ? err.message : err)}`)
  }
}
