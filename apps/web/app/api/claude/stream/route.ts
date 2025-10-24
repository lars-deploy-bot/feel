import path from "node:path"
import { createClaudeStream, createSSEResponse } from "@/app/features/claude/streamHandler"
import { getSystemPrompt } from "@/app/features/claude/systemPrompt"
import { requireSessionUser } from "@/lib/auth"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes } from "@/lib/error-codes"
import { SessionStoreMemory, sessionKey, tryLockConversation, unlockConversation } from "@/lib/sessionStore"
import { resolveWorkspace } from "@/lib/workspace-utils"
import { BodySchema, isToolAllowed } from "@/types/guards/api"
import { hasSessionCookie } from "@/types/guards/auth"
import { isPathWithinWorkspace } from "@/types/guards/workspace"
import type { Options, PermissionResult } from "@anthropic-ai/claude-agent-sdk"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(2, 8)
  console.log(`[Claude Stream ${requestId}] === STREAM REQUEST START ===`)

  try {
    const jar = await cookies()
    console.log(`[Claude Stream ${requestId}] Checking session cookie...`)

    if (!hasSessionCookie(jar.get("session"))) {
      console.log(`[Claude Stream ${requestId}] No session cookie found`)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: "Authentication required - no session cookie found",
        },
        { status: 401 },
      )
    }
    console.log(`[Claude Stream ${requestId}] Session cookie verified`)

    // Get user from session
    const user = await requireSessionUser()
    console.log(`[Claude Stream ${requestId}] User: ${user.id}`)

    console.log(`[Claude Stream ${requestId}] Parsing request body...`)
    let body: any
    try {
      body = await req.json()
      console.log(`[Claude Stream ${requestId}] Raw body keys:`, Object.keys(body))
    } catch (jsonError) {
      console.error(`[Claude Stream ${requestId}] Failed to parse JSON body:`, jsonError)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_JSON,
          message: "Request body is not valid JSON",
          details: { message: jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error" },
        },
        { status: 400 },
      )
    }

    // Validate request body
    const parseResult = BodySchema.safeParse(body)
    if (!parseResult.success) {
      console.error(`[Claude Stream ${requestId}] Schema validation failed:`, parseResult.error.issues)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message:
            "Invalid request body. Required: message (string), conversationId (uuid). Optional: workspace (string)",
          details: { issues: parseResult.error.issues },
        },
        { status: 400 },
      )
    }

    const { message, workspace: requestWorkspace, conversationId } = parseResult.data
    console.log(`[Claude Stream ${requestId}] Conversation: ${conversationId}`)
    console.log(
      `[Claude Stream ${requestId}] Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    )

    const host = (await headers()).get("host") || "localhost"
    const origin = req.headers.get("origin")
    console.log(`[Claude Stream ${requestId}] Host: ${host}`)

    // Get workspace using utility
    const workspaceResult = resolveWorkspace(host, { ...body, workspace: requestWorkspace }, requestId, origin)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }
    const cwd = workspaceResult.workspace

    // Create session key for this conversation
    const convKey = sessionKey({
      userId: user.id,
      workspace: requestWorkspace,
      conversationId,
    })
    console.log(`[Claude Stream ${requestId}] Session key: ${convKey}`)

    // Try to lock conversation to prevent concurrent requests
    if (!tryLockConversation(convKey)) {
      console.log(`[Claude Stream ${requestId}] Conversation already in progress`)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.CONVERSATION_BUSY,
          message: "Another request is already in progress for this conversation",
        },
        { status: 409 },
      )
    }

    // Check for existing session to resume
    const existingSessionId = await SessionStoreMemory.get(convKey)
    console.log(`[Claude Stream ${requestId}] Existing session: ${existingSessionId ? "found" : "none"}`)

    console.log(`[Claude Stream ${requestId}] Working directory: ${cwd}`)
    console.log(`[Claude Stream ${requestId}] Claude model: ${process.env.CLAUDE_MODEL || "not set"}`)

    const canUseTool: Options["canUseTool"] = async (toolName, input) => {
      console.log(`[Claude Stream ${requestId}] Tool requested: ${toolName}`)
      console.log(`[Claude Stream ${requestId}] Tool input:`, JSON.stringify(input, null, 2))

      const ALLOWED = new Set(["Write", "Edit", "Read", "Glob", "Grep"])
      if (!isToolAllowed(toolName, ALLOWED)) {
        console.log(`[Claude Stream ${requestId}] Tool denied: ${toolName}`)
        return { behavior: "deny", message: `tool_not_allowed: ${toolName}` }
      }

      const filePath = (input as any).file_path || (input as any).notebook_path || (input as any).path || null

      if (filePath) {
        const norm = path.normalize(filePath)
        console.log(`[Claude Stream ${requestId}] File path requested: ${norm}`)
        if (!isPathWithinWorkspace(norm, cwd, path.sep)) {
          console.log(`[Claude Stream ${requestId}] Path denied - outside workspace: ${norm}`)
          return { behavior: "deny", message: "path_outside_workspace" }
        }
        console.log(`[Claude Stream ${requestId}] Path allowed: ${norm}`)
      }

      const allow: PermissionResult = {
        behavior: "allow",
        updatedInput: input,
        updatedPermissions: [],
      }
      console.log(`[Claude Stream ${requestId}] Tool allowed: ${toolName}`)
      return allow
    }

    const claudeOptions: Options = {
      cwd,
      allowedTools: ["Write", "Edit", "Read", "Glob", "Grep"],
      permissionMode: "acceptEdits",
      canUseTool,
      systemPrompt: getSystemPrompt({
        projectId: body.projectId,
        userId: body.userId,
        workspaceFolder: cwd,
        additionalContext: body.additionalContext,
      }),
      settingSources: [],
      model: process.env.CLAUDE_MODEL,
      // Resume existing session if we have one
      ...(existingSessionId ? { resume: existingSessionId } : {}),
    }

    console.log(`[Claude Stream ${requestId}] Creating stream...`)

    try {
      // Create and return SSE stream
      const stream = createClaudeStream({
        message,
        claudeOptions,
        requestId,
        host,
        cwd,
        user,
        conversation: {
          key: convKey,
          store: SessionStoreMemory,
        },
      })

      return createSSEResponse(stream)
    } finally {
      // Always unlock conversation when stream ends
      unlockConversation(convKey)
    }
  } catch (outerError) {
    console.error(`[Claude Stream ${requestId}] Outer catch - request processing failed:`, outerError)

    const origin = req.headers.get("origin")
    const errorRes = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.REQUEST_PROCESSING_FAILED,
        message: "Failed to process streaming request",
        details: { message: outerError instanceof Error ? outerError.message : "Unknown error" },
        requestId,
      },
      { status: 500 },
    )
    addCorsHeaders(errorRes, origin)
    return errorRes
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin)
  return res
}
