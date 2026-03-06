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

import { chownSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"
import { query } from "@anthropic-ai/claude-agent-sdk"
import { DEFAULTS, isOAuthMcpTool, isStreamClientVisibleTool, resolveStreamMode, STREAM_MODES } from "@webalive/shared"
import { withSearchToolsConnectedProviders } from "@webalive/tools"
import {
  getAllowedTools,
  getDisallowedTools,
  getMcpServers,
  SETTINGS_SOURCES,
  STREAM_TYPES,
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

    // Set HOME to workspace user's actual home directory.
    // TARGET_HOME is set by agent-child-runner.ts (e.g. /srv/webalive/sites/domain.com).
    // This is where the user's own tool configs (gh, git, etc.) live.
    // For superadmin, HOME stays as-is (inherited from parent = /root).
    const targetHome = process.env.TARGET_HOME
    if (targetHome) {
      process.env.HOME = targetHome
      // Ensure the SDK can write its .claude/ session dir inside the workspace home
      const claudeDir = join(targetHome, ".claude")
      if (!existsSync(claudeDir)) {
        try {
          mkdirSync(claudeDir, { recursive: true, mode: 0o700 })
          if (targetUid && targetGid) {
            chownSync(claudeDir, targetUid, targetGid)
          }
        } catch {
          // Non-fatal: session dir may already exist or be managed externally.
          console.error(`[runner] Could not create ${claudeDir}, continuing`)
        }
      }
      console.error(`[runner] HOME set to workspace: ${targetHome}`)
    }

    // SUPERADMIN MODE: uid/gid = 0 means skip privilege drop (run as root)
    // This is only set when user is superadmin AND workspace is alive
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

    const request = await readStdinJson()
    console.error(`[runner] Received request: ${request.message?.substring(0, 50)}...`)

    if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
      throw new Error("[runner] Missing CLAUDE_CODE_OAUTH_TOKEN. Legacy runner requires OAuth token auth.")
    }

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

    // Stream mode: use explicit request.streamMode when valid, otherwise derive from permission mode.
    const requestedStreamMode = typeof request.streamMode === "string" ? request.streamMode : null
    const fallbackMode =
      request.permissionMode === "plan"
        ? "plan"
        : request.permissionMode === "bypassPermissions"
          ? "superadmin"
          : "default"
    const requestedOrFallbackMode =
      requestedStreamMode && Object.hasOwn(STREAM_MODES, requestedStreamMode) ? requestedStreamMode : fallbackMode
    const streamMode = resolveStreamMode(requestedOrFallbackMode, { isAdmin, isSuperadmin })
    const modeConfig = STREAM_MODES[streamMode] || STREAM_MODES.default
    const effectivePermissionMode = request.permissionMode || modeConfig.permissionMode
    if (requestedStreamMode && requestedStreamMode !== requestedOrFallbackMode) {
      console.error(
        `[runner] Invalid streamMode "${requestedStreamMode}", falling back to "${requestedOrFallbackMode}"`,
      )
    }
    if (requestedOrFallbackMode !== streamMode) {
      console.error(`[runner] Unauthorized streamMode "${requestedOrFallbackMode}", falling back to "${streamMode}"`)
    }
    if (streamMode !== "default") {
      console.error(`[runner] Stream mode: ${streamMode} (MCP enabled: ${modeConfig.mcpEnabled})`)
    }

    // Get base allowed tools (SDK + internal MCP tools)
    // Admin users get TaskStop; superadmin re-enables Task/WebSearch.
    // Member-only MCP resource tools remain hidden for elevated roles.
    // isSuperadmin is also used as isSuperadminWorkspace — the alive workspace
    // is the only superadmin workspace, and site-specific tools (switch_serve_mode, etc.)
    // should not be available there since it's not a Vite site.
    const baseAllowedTools = getAllowedTools(
      targetCwd || process.cwd(),
      isAdmin,
      isSuperadmin,
      isSuperadmin,
      streamMode,
    )
    // Extra tools from trigger request (e.g. email's send_reply)
    if (request.extraTools?.length) {
      baseAllowedTools.push(...request.extraTools)
      console.error(`[runner] Extra tools added: ${request.extraTools.join(", ")}`)
    }
    const disallowedTools = getDisallowedTools(isAdmin, isSuperadmin, streamMode, isSuperadmin)

    console.error(`[runner] Base allowed tools count: ${baseAllowedTools.length}`)
    if (streamMode !== "default") {
      console.error(`[runner] ${streamMode} mode: ${baseAllowedTools.length} tools available under registry policy`)
    }
    if (isSuperadmin) {
      const hasTask = baseAllowedTools.includes("Task")
      const hasWebSearch = baseAllowedTools.includes("WebSearch")
      console.error(
        `[runner] 🔓 SUPERADMIN tools: Task=${hasTask}, WebSearch=${hasWebSearch}, disallowed=${disallowedTools.length}`,
      )
    } else if (isAdmin) {
      const hasTaskStop = baseAllowedTools.includes("TaskStop")
      console.error(`[runner] Admin tools: TaskStop=${hasTaskStop}, disallowed=${disallowedTools.length}`)
    }

    // MCP tools use process.cwd() which is set by process.chdir() above
    // No workspace injection needed - tools default to process.cwd()

    // Get MCP servers with user-specific OAuth tokens
    // Uses registry from @webalive/shared - add new providers there
    const workspaceMcpServers = modeConfig.mcpEnabled ? getMcpServers(targetCwd || process.cwd(), { oauthTokens }) : {}

    // Load optional MCP servers required by extraTools.
    // Tool names follow mcp__<server-name>__<tool> — we extract server names
    // and load them from the registry on demand.
    const OPTIONAL_MCP_REGISTRY = {
      "alive-email": async () => {
        const { emailInternalMcp } = await import("@webalive/tools")
        return emailInternalMcp
      },
    }

    if (modeConfig.mcpEnabled && request.extraTools?.length) {
      const requiredServers = new Set()
      for (const tool of request.extraTools) {
        const match = tool.match(/^mcp__([^_]+(?:-[^_]+)*)__/)
        if (match) requiredServers.add(match[1])
      }
      for (const serverName of requiredServers) {
        const loader = OPTIONAL_MCP_REGISTRY[serverName]
        if (loader) {
          workspaceMcpServers[serverName] = await loader()
          console.error(`[runner] Loaded optional MCP server: ${serverName}`)
        }
      }
    } else if (!modeConfig.mcpEnabled && request.extraTools?.some(tool => tool.startsWith("mcp__"))) {
      console.error(`[runner] Ignoring MCP extraTools in ${streamMode} mode`)
    }

    console.error("[runner] MCP servers enabled:", Object.keys(workspaceMcpServers).join(", "))

    // Log available secrets for debugging (without revealing values)
    console.error(`[runner] Internal tools secret: ${process.env.INTERNAL_TOOLS_SECRET ? "✓ present" : "✗ missing"}`)

    // Log resume parameters
    if (request.resumeSessionAt) {
      console.error(`[runner] Resuming at message: ${request.resumeSessionAt}`)
    }

    let messageCount = 0
    let queryResult = null

    await withSearchToolsConnectedProviders(connectedProviders, async () => {
      // Bun auto-loads workspace .env files unless disabled. Disable this so
      // auth never comes from project-local .env state.
      const isBunRuntime = typeof Bun !== "undefined"
      const claudeExecutable = isBunRuntime ? "bun" : "node"
      const claudeExecutableArgs = isBunRuntime ? ["--no-env-file"] : []

      const agentQuery = query({
        prompt: request.message,
        options: {
          cwd: process.cwd(),
          executable: claudeExecutable,
          executableArgs: claudeExecutableArgs,
          model: request.model,
          maxTurns: request.maxTurns || DEFAULTS.CLAUDE_MAX_TURNS,
          permissionMode: effectivePermissionMode,
          ...(effectivePermissionMode === "bypassPermissions" ? { allowDangerouslySkipPermissions: true } : {}),
          allowedTools: baseAllowedTools,
          disallowedTools, // Dynamic based on admin status
          settingSources: SETTINGS_SOURCES,
          mcpServers: workspaceMcpServers,
          systemPrompt: request.systemPrompt,
          // Session resumption: We use explicit session IDs for multi-conversation tracking
          resume: request.resume,
          // Resume at specific message (for message deletion/editing)
          resumeSessionAt: request.resumeSessionAt,
          // Alternative: continue: true - SDK auto-continues most recent conversation (no session ID needed)
          // continue: true,
        },
      })

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
              type: STREAM_TYPES.SESSION,
              sessionId: message.session_id,
            })}\n`,
          )
        }

        // Filter system init message to only show allowed + client-visible tools
        let outputMessage = message
        if (message.type === "system" && message.subtype === "init" && message.tools) {
          outputMessage = {
            ...message,
            tools: message.tools.filter(
              tool =>
                (baseAllowedTools.includes(tool) || isOAuthMcpTool(tool, connectedProviders)) &&
                isStreamClientVisibleTool(tool),
            ),
          }
        }

        process.stdout.write(
          `${JSON.stringify({
            type: STREAM_TYPES.MESSAGE,
            messageCount,
            messageType: message.type,
            content: outputMessage,
          })}\n`,
        )
      }
    })

    process.stdout.write(
      `${JSON.stringify({
        type: STREAM_TYPES.COMPLETE,
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
