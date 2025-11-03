#!/usr/bin/env node
/**
 * Child Process Agent Runner
 *
 * Runs Claude Agent SDK as the workspace user.
 * Spawned by parent route handler with workspace credentials.
 *
 * Protocol:
 *   stdin:  JSON request payload
 *   stdout: NDJSON event stream
 *   stderr: Diagnostic logs
 */

import { mkdirSync } from "node:fs"
import process from "node:process"
import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk"
import { z } from "zod"
import { guidesMcp } from "@alive-brug/guides"

const restartServerTool = tool(
  "restart_dev_server",
  "Restarts the systemd dev server for the current workspace. Use this after making structural changes that require a server restart (e.g., changing from localStorage to server-side state, adding new dependencies, modifying server configuration).",
  {
    workspaceRoot: z.string().describe("The root path of the workspace (e.g., /srv/webalive/sites/example.com/user)")
  },
  async (args) => {
    const { workspaceRoot } = args

    try {
      const response = await fetch('http://localhost:8998/api/restart-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceRoot })
      })

      const result = await response.json()

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: `✓ ${result.message}\n\nThe server has been restarted and should now reflect your changes.`
            }
          ],
          isError: false
        }
      } else {
        return {
          content: [
            {
              type: "text",
              text: `✗ ${result.message}`
            }
          ],
          isError: true
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      return {
        content: [
          {
            type: "text",
            text: `✗ Failed to call restart API\n\nError: ${errorMessage}`
          }
        ],
        isError: true
      }
    }
  }
)

const restartServerMcp = createSdkMcpServer({
  name: "workspace-management",
  version: "1.0.0",
  tools: [restartServerTool]
})

async function readStdinJson() {
  const chunks = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"))
}

;(async () => {
  try {
    const targetUid = process.env.TARGET_UID && Number(process.env.TARGET_UID)
    const targetGid = process.env.TARGET_GID && Number(process.env.TARGET_GID)
    const targetCwd = process.env.TARGET_CWD

    if (targetGid && process.setgid) {
      process.setgid(targetGid)
      console.error(`[runner] Dropped to GID: ${targetGid}`)
    }
    if (targetUid && process.setuid) {
      process.setuid(targetUid)
      console.error(`[runner] Dropped to UID: ${targetUid}`)
    }

    process.umask(0o022)

    if (targetCwd) {
      process.chdir(targetCwd)
      console.error(`[runner] Changed to workspace: ${targetCwd}`)
    }

    console.error(`[runner] Working directory: ${process.cwd()}`)

    const debugHome = `/tmp/claude-debug-${process.getuid()}`
    mkdirSync(debugHome, { recursive: true, mode: 0o755 })
    process.env.HOME = debugHome
    console.error(`[runner] HOME set to: ${debugHome}`)
    console.error(`[runner] Running as UID:${process.getuid()} GID:${process.getgid()}`)
    console.error(`[runner] API key present: ${process.env.ANTHROPIC_API_KEY ? 'yes' : 'no'}`)

    const request = await readStdinJson()
    console.error(`[runner] Received request: ${request.message?.substring(0, 50)}...`)

    const agentQuery = query({
      prompt: request.message,
      options: {
        cwd: process.cwd(),
        model: request.model,
        maxTurns: request.maxTurns || 25,
        permissionMode: "acceptEdits",
        allowedTools: [
          "Write",
          "Edit",
          "Read",
          "Glob",
          "Grep",
          "mcp__workspace-management__restart_dev_server",
          "mcp__guides__list_guides",
          "mcp__guides__get_guide",
        ],
        mcpServers: {
          "workspace-management": restartServerMcp,
          guides: guidesMcp,
        },
        systemPrompt: request.systemPrompt,
        resume: request.resume
      }
    })

    let messageCount = 0
    let sessionId = null
    let queryResult = null

    for await (const message of agentQuery) {
      messageCount++

      if (message.type === 'system' && !sessionId) {
        const match = JSON.stringify(message).match(/"session_id":"([^"]+)"/)
        if (match) sessionId = match[1]
      }

      if (message.type === 'result') {
        queryResult = message
      }

      process.stdout.write(JSON.stringify({
        type: "message",
        messageCount,
        messageType: message.type,
        content: message
      }) + "\n")
    }

    if (sessionId) {
      process.stdout.write(JSON.stringify({
        type: "session",
        sessionId
      }) + "\n")
    }

    process.stdout.write(JSON.stringify({
      type: "complete",
      totalMessages: messageCount,
      result: queryResult
    }) + "\n")

    console.error(`[runner] Success: ${messageCount} messages`)

  } catch (error) {
    console.error("[runner-error]", error?.stack || String(error))
    process.exit(1)
  }
})()
