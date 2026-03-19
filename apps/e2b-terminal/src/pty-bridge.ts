import type { ServerWebSocket } from "bun"
import type { CommandHandle } from "e2b"
import { Sandbox } from "e2b"
import { env } from "./env"
import { Sentry } from "./sentry"

interface WsData {
  sandboxId: string
  hostname: string
  workspace: string
}

function isResizeMessage(raw: unknown): raw is { type: "resize"; cols: number; rows: number } {
  if (typeof raw !== "object" || raw === null) return false
  return (
    "type" in raw &&
    raw.type === "resize" &&
    "cols" in raw &&
    typeof raw.cols === "number" &&
    "rows" in raw &&
    typeof raw.rows === "number"
  )
}

const E2B_DOMAIN = env.E2B_DOMAIN

/**
 * Bridge a WebSocket connection to an E2B sandbox PTY.
 *
 * Protocol (matches shell-server-go):
 * - Client → Server: binary = PTY input, JSON { type: "resize", cols, rows }
 * - Server → Client: binary = PTY output, JSON { type: "connected" | "exit" | "error" }
 */
export async function bridgePty(ws: ServerWebSocket<WsData>): Promise<void> {
  const { sandboxId, hostname } = ws.data

  let sandbox: Sandbox
  try {
    sandbox = await Sandbox.connect(sandboxId, {
      domain: E2B_DOMAIN,
      timeoutMs: 10_000,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error(`[pty-bridge] Failed to connect to sandbox ${sandboxId} for ${hostname}: ${msg}`)
    Sentry.captureException(err, { extra: { sandboxId, hostname } })
    ws.send(JSON.stringify({ type: "error", message: `Sandbox not available: ${msg}` }))
    ws.close(1011, "Sandbox connection failed")
    return
  }

  let ptyHandle: CommandHandle
  let ptyPid: number

  try {
    ptyHandle = await sandbox.pty.create({
      cols: 80,
      rows: 24,
      onData: (data: Uint8Array) => {
        if (ws.readyState === 1) {
          ws.sendBinary(data)
        }
      },
      timeoutMs: 0, // No timeout — keep alive until client disconnects
    })

    ptyPid = ptyHandle.pid

    // Guard: if the WebSocket closed while we were awaiting pty.create(), kill the orphan
    if (ws.readyState !== 1) {
      await sandbox.pty.kill(ptyPid).catch(() => {})
      return
    }

    console.log(`[pty-bridge] PTY created for ${hostname}: pid=${ptyPid}`)

    // Signal connected (matches shell-server-go protocol)
    ws.send(JSON.stringify({ type: "connected" }))

    // Wait for process exit in background
    ptyHandle
      .wait()
      .then(result => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "exit", exitCode: result.exitCode ?? null }))
          ws.close(1000, "Process exited")
        }
      })
      .catch(err => {
        console.error(`[pty-bridge] PTY wait error for ${hostname}:`, err)
        Sentry.captureException(err, { extra: { hostname, sandboxId } })
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "error", message: "PTY process error" }))
          ws.close(1011, "PTY error")
        }
      })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error(`[pty-bridge] Failed to create PTY for ${hostname}: ${msg}`)
    Sentry.captureException(err, { extra: { hostname, sandboxId } })
    ws.send(JSON.stringify({ type: "error", message: `Failed to create terminal: ${msg}` }))
    ws.close(1011, "PTY creation failed")
    return
  }

  // Store handlers on ws.data for message/close handling
  const bridge = { sandbox, ptyPid }
  activeBridges.set(ws, bridge)
}

interface ActiveBridge {
  sandbox: Sandbox
  ptyPid: number
}

const activeBridges = new Map<ServerWebSocket<WsData>, ActiveBridge>()

/** Handle incoming WebSocket message (input or resize) */
export function handleMessage(ws: ServerWebSocket<WsData>, message: Buffer | string): void {
  const bridge = activeBridges.get(ws)
  if (!bridge) return

  if (typeof message === "string") {
    // JSON control message
    try {
      const raw: unknown = JSON.parse(message)
      if (isResizeMessage(raw)) {
        bridge.sandbox.pty.resize(bridge.ptyPid, { cols: raw.cols, rows: raw.rows }).catch(err => {
          console.error("[pty-bridge] Resize error:", err)
        })
      }
    } catch {
      // Ignore malformed JSON
    }
  } else {
    // Binary: PTY input
    bridge.sandbox.pty.sendInput(bridge.ptyPid, new Uint8Array(message)).catch(err => {
      console.error("[pty-bridge] sendInput error:", err)
    })
  }
}

/** Clean up on WebSocket close */
export function handleClose(ws: ServerWebSocket<WsData>): void {
  const bridge = activeBridges.get(ws)
  if (!bridge) return

  bridge.sandbox.pty.kill(bridge.ptyPid).catch(() => {
    // Best-effort kill
  })
  activeBridges.delete(ws)
  console.log(`[pty-bridge] Connection closed for ${ws.data.hostname}, pid=${bridge.ptyPid}`)
}
