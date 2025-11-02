/**
 * Agent Child Process Runner
 *
 * Spawns Claude Agent SDK in a child process running as the workspace user.
 * This ensures all file operations inherit correct ownership.
 */

import { spawn } from "node:child_process"
import { statSync } from "node:fs"
import { resolve } from "node:path"
import { env } from "@/lib/env"

interface WorkspaceCredentials {
  uid: number
  gid: number
}

interface AgentRequest {
  message: string
  model?: string
  maxTurns?: number
  resume?: string
  systemPrompt?: string
  [key: string]: any
}

/**
 * Get workspace owner credentials from directory stats
 */
function getWorkspaceCredentials(workspaceRoot: string): WorkspaceCredentials {
  const st = statSync(workspaceRoot)

  if (!st.uid || !st.gid || st.uid === 0 || st.gid === 0) {
    throw new Error(`Invalid workspace owner for ${workspaceRoot}: uid=${st.uid} gid=${st.gid}`)
  }

  return { uid: st.uid, gid: st.gid }
}

/**
 * Check if workspace should use child process (has dedicated non-root user)
 */
export function shouldUseChildProcess(workspaceRoot: string): boolean {
  try {
    const st = statSync(workspaceRoot)
    return st.uid !== 0 && st.gid !== 0
  } catch {
    return false
  }
}

/**
 * Run Claude Agent in a child process as the workspace user
 *
 * @param workspaceRoot - Absolute path to workspace directory
 * @param payload - Agent request payload
 * @returns ReadableStream of NDJSON events
 */
export function runAgentChild(
  workspaceRoot: string,
  payload: AgentRequest
): ReadableStream<Uint8Array> {
  const { uid, gid } = getWorkspaceCredentials(workspaceRoot)
  const runnerPath = resolve(process.cwd(), "scripts/run-agent.mjs")

  console.log(`[agent-child] Spawning runner as UID:${uid} GID:${gid}`)
  console.log(`[agent-child] Runner: ${runnerPath}`)
  console.log(`[agent-child] Workspace: ${workspaceRoot}`)

  const child = spawn(process.execPath, [runnerPath], {
    cwd: workspaceRoot,
    env: {
      PATH: process.env.PATH,
      ANTHROPIC_API_KEY: env.ANTH_API_SECRET,
      NODE_ENV: env.NODE_ENV,
      TARGET_UID: String(uid),
      TARGET_GID: String(gid),
      LANG: "C.UTF-8",
      LC_CTYPE: "C.UTF-8"
    },
    stdio: ["pipe", "pipe", "pipe"]
  })

  console.log(`[agent-child] Spawned as root (will drop to ${uid}:${gid}): PID ${child.pid}`)

  const requestJson = JSON.stringify(payload)
  child.stdin.write(requestJson)
  child.stdin.end()

  console.log(`[agent-child] Request sent to child (${requestJson.length} bytes)`)

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {

      child.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk))
      })

      child.stdout.on("end", () => {
        console.log(`[agent-child] stdout ended`)
        controller.close()
      })

      child.on("error", (error) => {
        console.error(`[agent-child] Process error:`, error)
        controller.error(error)
      })

      child.on("exit", (code, signal) => {
        if (code !== 0) {
          console.error(`[agent-child] Exited with code ${code}, signal ${signal}`)
        } else {
          console.log(`[agent-child] Exited successfully`)
        }
      })
    },

    cancel() {
      console.log(`[agent-child] Stream cancelled, killing child`)
      child.kill("SIGTERM")
    }
  })

  child.stderr.on("data", (data: Buffer) => {
    console.error(`[agent-child stderr]`, data.toString().trim())
  })

  return stream
}
