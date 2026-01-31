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
  BRIDGE_STREAM_TYPES,
  getAllowedTools,
  getDisallowedTools,
  getMcpServers,
  PERMISSION_MODE,
  SETTINGS_SOURCES,
} from "../lib/claude/agent-constants.mjs"
import { isOAuthMcpTool, DEFAULTS } from "@webalive/shared"

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

    // SUPERADMIN MODE: uid/gid = 0 means skip privilege drop (run as root)
    // This is only set when user is superadmin AND workspace is claude-bridge
    if (targetUid === 0 && targetGid === 0) {
      console.error("[runner] 🔓 SUPERADMIN MODE: Skipping privilege drop (running as root)")
    } else {
      if (targetGid && process.setgid) {
        process.setgid(targetGid)
        console.error(`[runner] Dropped to GID: ${targetGid}`)
      }
      if (targetUid && process.setuid) {
        process.setuid(targetUid)
        console.error(`[runner] Dropped to UID: ${targetUid}`)
      }
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

    // Get OAuth tokens for connected MCP providers
    const oauthTokens = request.oauthTokens || {}
    const connectedProviders = Object.keys(oauthTokens).filter(key => !!oauthTokens[key])
    if (connectedProviders.length > 0) {
      console.error(`[runner] Connected OAuth providers: ${connectedProviders.join(", ")}`)
    }

    // Check admin/superadmin status from request payload
    const isAdmin = request.isAdmin === true
    const isSuperadmin = request.isSuperadmin === true
    console.error(`[runner] isAdmin: ${isAdmin}, isSuperadmin: ${isSuperadmin}`)

    // Plan mode: use from request or fall back to default
    const effectivePermissionMode = request.permissionMode || PERMISSION_MODE
    const isPlanMode = effectivePermissionMode === "plan"
    if (isPlanMode) {
      console.error("[runner] 🔒 PLAN MODE ENABLED: Write/Edit/Bash tools will be blocked")
    }

    // Tools blocked in plan mode (read-only exploration)
    const PLAN_MODE_BLOCKED_TOOLS = [
      "Write",
      "Edit",
      "MultiEdit",
      "Bash",
      "NotebookEdit",
      "mcp__alive-workspace__delete_file",
      "mcp__alive-workspace__install_package",
      "mcp__alive-workspace__restart_dev_server",
      "mcp__alive-workspace__switch_serve_mode",
      "mcp__alive-workspace__create_website",
    ]

    // Get base allowed tools (SDK + internal MCP tools)
    // OAuth MCP tools are allowed dynamically in canUseTool
    // Admin users get Bash, BashOutput, KillShell tools
    // Superadmin users get ALL tools (Task, WebSearch included)
    const baseAllowedTools = getAllowedTools(targetCwd || process.cwd(), isAdmin, isSuperadmin)
    const disallowedTools = getDisallowedTools(isAdmin, isSuperadmin)

    // Plan mode: Filter out blocked tools from allowedTools
    // The SDK auto-allows tools in allowedTools without calling canUseTool,
    // so we must remove them from the list to enforce plan mode restrictions
    const effectiveAllowedTools = isPlanMode
      ? baseAllowedTools.filter(t => !PLAN_MODE_BLOCKED_TOOLS.includes(t))
      : baseAllowedTools

    console.error(`[runner] Base allowed tools count: ${baseAllowedTools.length}`)
    if (isPlanMode) {
      console.error(
        `[runner] 🔒 PLAN MODE: Filtered to ${effectiveAllowedTools.length} tools (removed ${baseAllowedTools.length - effectiveAllowedTools.length} modification tools)`,
      )
    }
    if (isSuperadmin) {
      const hasTask = baseAllowedTools.includes("Task")
      const hasWebSearch = baseAllowedTools.includes("WebSearch")
      console.error(
        `[runner] 🔓 SUPERADMIN tools: Task=${hasTask}, WebSearch=${hasWebSearch}, disallowed=${disallowedTools.length}`,
      )
    } else if (isAdmin) {
      const hasBash = baseAllowedTools.includes("Bash")
      console.error(`[runner] Admin tools: Bash=${hasBash}, disallowed=${disallowedTools.length}`)
    }

    /**
     * Tool permission handler - enforces disallowedTools blacklist and dynamic OAuth MCP tool permissions
     * @type {import('@anthropic-ai/claude-agent-sdk').CanUseTool}
     */
    const canUseTool = async (toolName, input, _options) => {
      // Plan mode: block modification tools
      if (isPlanMode && PLAN_MODE_BLOCKED_TOOLS.includes(toolName)) {
        console.error(`[runner] 🔒 PLAN MODE: Blocked modification tool: ${toolName}`)
        return {
          behavior: "deny",
          message: `Tool "${toolName}" is not allowed in plan mode. Plan mode is for exploration only - Claude can read and analyze but not modify files.`,
        }
      }

      // Explicit deny list takes precedence (respects admin status)
      if (disallowedTools.includes(toolName)) {
        console.error(`[runner] SECURITY: Blocked explicitly disallowed tool: ${toolName}`)
        return {
          behavior: "deny",
          message: `Tool "${toolName}" is explicitly disallowed for security reasons.`,
        }
      }

      // Check base allowed tools (SDK + internal MCP tools)
      if (baseAllowedTools.includes(toolName)) {
        console.error(`[runner] Tool allowed (base): ${toolName}`)
        return {
          behavior: "allow",
          updatedInput: input,
          updatedPermissions: [],
        }
      }

      // Check OAuth MCP tools - auto-allowed if user has that provider connected
      // Uses isOAuthMcpTool from @webalive/shared registry
      if (isOAuthMcpTool(toolName, connectedProviders)) {
        console.error(`[runner] Tool allowed (OAuth MCP): ${toolName}`)
        return {
          behavior: "allow",
          updatedInput: input,
          updatedPermissions: [],
        }
      }

      // Tool not in any allowed list
      console.error(`[runner] SECURITY: Blocked unauthorized tool: ${toolName}`)
      return {
        behavior: "deny",
        message: `Tool "${toolName}" is not permitted. Connect the required integration in Settings to use this tool.`,
      }
    }

    // MCP tools use process.cwd() which is set by process.chdir() above
    // No workspace injection needed - tools default to process.cwd()

    // Get MCP servers with user-specific OAuth tokens
    // Uses registry from @webalive/shared - add new providers there
    const workspaceMcpServers = getMcpServers(targetCwd || process.cwd(), { oauthTokens })
    console.error("[runner] MCP servers enabled:", Object.keys(workspaceMcpServers).join(", "))

    // Log available secrets for debugging (without revealing values)
    console.error(`[runner] Internal tools secret: ${process.env.INTERNAL_TOOLS_SECRET ? "✓ present" : "✗ missing"}`)

    const agentQuery = query({
      prompt: request.message,
      options: {
        cwd: process.cwd(),
        model: request.model,
        maxTurns: request.maxTurns || DEFAULTS.CLAUDE_MAX_TURNS,
        permissionMode: effectivePermissionMode,
        allowedTools: effectiveAllowedTools, // Plan mode filters out modification tools
        disallowedTools, // Dynamic based on admin status
        canUseTool,
        settingSources: SETTINGS_SOURCES,
        mcpServers: workspaceMcpServers,
        systemPrompt: request.systemPrompt,
        // Session resumption: We use explicit session IDs for multi-conversation tracking
        resume: request.resume,
        // Alternative: continue: true - SDK auto-continues most recent conversation (no session ID needed)
        // continue: true,
      },
    })

    let messageCount = 0
    let queryResult = null

    for await (const message of agentQuery) {
      messageCount++

      if (message.type === "result") {
        queryResult = message
      }

      // Capture session ID from system init message
      if (message.type === "system" && message.subtype === "init" && message.session_id) {
        console.error(`[runner] Session ID captured: ${message.session_id}`)

        // Log MCP server status
        if (message.mcpServers) {
          console.error("[runner] MCP server status:", JSON.stringify(message.mcpServers, null, 2))
        }

        // Log available tools (including MCP tools)
        if (message.tools) {
          const mcpTools = message.tools.filter(t => t.startsWith("mcp__"))
          console.error(`[runner] Available MCP tools (${mcpTools.length}):`, mcpTools.join(", "))
        }

        process.stdout.write(
          `${JSON.stringify({
            type: BRIDGE_STREAM_TYPES.SESSION,
            sessionId: message.session_id,
          })}\n`,
        )
      }

      // Filter system init message to only show allowed tools (base + connected OAuth MCP)
      let outputMessage = message
      if (message.type === "system" && message.subtype === "init" && message.tools) {
        outputMessage = {
          ...message,
          tools: message.tools.filter(
            tool => baseAllowedTools.includes(tool) || isOAuthMcpTool(tool, connectedProviders),
          ),
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
