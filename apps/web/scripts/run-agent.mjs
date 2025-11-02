#!/usr/bin/env node
/**
 * Child Process Agent Runner
 *
 * Runs Claude Agent SDK as the workspace user (not root).
 * All file operations inherit the correct UID/GID from the process.
 *
 * Usage: Spawned by parent route with:
 *   - stdin: JSON request
 *   - stdout: NDJSON events
 *   - stderr: errors/logs
 */

import { mkdirSync } from "node:fs"
import process from "node:process"
import { query } from "@anthropic-ai/claude-agent-sdk"

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

    const input = await readStdinJson()
    console.error(`[runner] Received request: ${input.message?.substring(0, 50)}...`)

    const q = query({
      prompt: input.message,
      options: {
        cwd: process.cwd(),
        model: input.model,
        maxTurns: input.maxTurns || 25,
        permissionMode: "acceptEdits",
        allowedTools: ["Write", "Edit", "Read", "Glob", "Grep"],
        systemPrompt: input.systemPrompt,
        resume: input.resume
      }
    })

    let messageCount = 0
    let sessionId = null
    let queryResult = null

    for await (const m of q) {
      messageCount++

      if (m.type === 'system' && !sessionId) {
        const match = JSON.stringify(m).match(/"session_id":"([^"]+)"/)
        if (match) sessionId = match[1]
      }

      if (m.type === 'result') {
        queryResult = m
      }

      process.stdout.write(JSON.stringify({
        type: "message",
        messageCount,
        messageType: m.type,
        content: m
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
