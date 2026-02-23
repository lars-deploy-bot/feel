/**
 * Minimal HTTP helpers.
 *
 * No Express dependency — just raw Node http. Keeps the service lightweight.
 */

import type { IncomingMessage, ServerResponse } from "node:http"

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

export async function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8")
        if (!raw.trim()) {
          resolve({})
          return
        }
        resolve(JSON.parse(raw) as Record<string, unknown>)
      } catch (err) {
        reject(new Error(`Invalid JSON body: ${String(err)}`))
      }
    })
    req.on("error", reject)
  })
}
