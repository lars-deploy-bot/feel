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

import { chownSync, copyFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"
import { query } from "@anthropic-ai/claude-agent-sdk"
import {
  ALLOWED_TOOLS,
  BRIDGE_STREAM_TYPES,
  DISALLOWED_TOOLS,
  MCP_SERVERS,
  PERMISSION_MODE,
  SETTINGS_SOURCES,
} from "../lib/claude/agent-constants.mjs"

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

    // Copy Claude credentials to temp location BEFORE dropping privileges
    const originalHome = process.env.HOME || "/root"
    const tempHome = `/tmp/claude-home-${targetUid}`
    const credSource = join(originalHome, ".claude", ".credentials.json")
    const credDest = join(tempHome, ".claude", ".credentials.json")

    if (existsSync(credSource)) {
      mkdirSync(join(tempHome, ".claude"), { recursive: true, mode: 0o755 })
      copyFileSync(credSource, credDest)
      // Chown the entire temp home directory and all contents
      chownSync(tempHome, targetUid, targetGid)
      chownSync(join(tempHome, ".claude"), targetUid, targetGid)
      chownSync(credDest, targetUid, targetGid)
      process.env.HOME = tempHome
      console.error(`[runner] Copied credentials to ${tempHome}`)
    }

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
    console.error(`[runner] Running as UID:${process.getuid()} GID:${process.getgid()}`)
    console.error(`[runner] HOME: ${process.env.HOME}`)
    console.error(`[runner] Using OAuth credentials from ${process.env.HOME}/.claude/.credentials.json`)

    const request = await readStdinJson()
    console.error(`[runner] Received request: ${request.message?.substring(0, 50)}...`)

    /**
     * Tool permission handler - enforces ALLOWED_TOOLS whitelist and DISALLOWED_TOOLS blacklist
     * @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool}
     */
    const canUseTool = async (toolName, input, options) => {
      // Explicit deny list takes precedence
      if (DISALLOWED_TOOLS.includes(toolName)) {
        console.error(`[runner] SECURITY: Blocked explicitly disallowed tool: ${toolName}`)
        return {
          behavior: "deny",
          message: `Tool "${toolName}" is explicitly disallowed for security reasons.`,
        }
      }

      // Check allow list
      if (!ALLOWED_TOOLS.includes(toolName)) {
        console.error(`[runner] SECURITY: Blocked unauthorized tool: ${toolName}`)
        return {
          behavior: "deny",
          message: `Tool "${toolName}" is not in the allowed tools list. Only these tools are permitted: ${ALLOWED_TOOLS.join(", ")}`,
        }
      }

      console.error(`[runner] Tool allowed: ${toolName}`)
      return {
        behavior: "allow",
        updatedInput: input,
        updatedPermissions: [],
      }
    }

    // MCP tools use process.cwd() which is set by process.chdir() above
    // No workspace injection needed - tools default to process.cwd()
    const agentQuery = query({
      prompt: request.message,
      options: {
        cwd: process.cwd(),
        model: request.model,
        maxTurns: request.maxTurns || 25,
        permissionMode: PERMISSION_MODE,
        allowedTools: ALLOWED_TOOLS,
        disallowedTools: DISALLOWED_TOOLS,
        canUseTool,
        settingSources: SETTINGS_SOURCES,
        mcpServers: MCP_SERVERS,
        systemPrompt: request.systemPrompt,
        resume: request.resume,
      },
    })

    let messageCount = 0
    let queryResult = null

    for await (const message of agentQuery) {
      messageCount++

      if (message.type === "result") {
        queryResult = message
      }

      // Filter system init message to only show allowed tools
      let outputMessage = message
      if (message.type === "system" && message.subtype === "init" && message.tools) {
        outputMessage = {
          ...message,
          tools: message.tools.filter(tool => ALLOWED_TOOLS.includes(tool)),
        }
      }

      process.stdout.write(
        `${JSON.stringify({
          type: BRIDGE_STREAM_TYPES.MESSAGE,
          messageCount,
          messageType: message.type,
          content: outputMessage,
        })}\n`,
      )
    }

    process.stdout.write(
      `${JSON.stringify({
        type: BRIDGE_STREAM_TYPES.COMPLETE,
        totalMessages: messageCount,
        result: queryResult,
      })}\n`,
    )

    console.error(`[runner] Success: ${messageCount} messages`)
  } catch (error) {
    console.error("[runner-error]", error?.stack || String(error))
    process.exit(1)
  }
})()
