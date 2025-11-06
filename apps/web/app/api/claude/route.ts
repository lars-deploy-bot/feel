import { type Options, query } from "@anthropic-ai/claude-agent-sdk"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import { isWorkspaceAuthenticated } from "@/features/auth/lib/auth"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { getWorkspace, type Workspace } from "@/features/workspace/lib/workspace-secure"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { isTerminalMode } from "@/features/workspace/types/workspace"
import { createToolPermissionHandler } from "@/lib/claude/tool-permissions"
import { addCorsHeaders } from "@/lib/cors-utils"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { generateRequestId } from "@/lib/utils"
import { BodySchema } from "@/types/guards/api"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const requestId = generateRequestId()
  const origin = req.headers.get("origin")
  console.log(`[Claude API ${requestId}] === REQUEST START ===`)

  try {
    const jar = await cookies()
    console.log(`[Claude API ${requestId}] Checking session cookie...`)

    if (!hasSessionCookie(jar.get("session"))) {
      console.log(`[Claude API ${requestId}] No session cookie found`)
      const res = NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: getErrorMessage(ErrorCodes.NO_SESSION),
          requestId,
        },
        { status: 401 },
      )
      addCorsHeaders(res, origin)
      return res
    }
    console.log(`[Claude API ${requestId}] Session cookie verified`)

    console.log(`[Claude API ${requestId}] Parsing request body...`)
    let body: any
    try {
      body = await req.json()
      console.log(`[Claude API ${requestId}] Raw body keys:`, Object.keys(body))
    } catch (jsonError) {
      console.error(`[Claude API ${requestId}] Failed to parse JSON body:`, jsonError)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_JSON,
          message: getErrorMessage(ErrorCodes.INVALID_JSON),
          details: { error: jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error" },
          requestId,
        },
        { status: 400 },
      )
    }

    // Validate request body
    const parseResult = BodySchema.safeParse(body)
    if (!parseResult.success) {
      console.error(`[Claude API ${requestId}] Schema validation failed:`, parseResult.error.issues)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: getErrorMessage(ErrorCodes.INVALID_REQUEST),
          details: { issues: parseResult.error.issues },
          requestId,
        },
        { status: 400 },
      )
    }

    const { message, workspace: requestWorkspace } = parseResult.data
    console.log(
      `[Claude API ${requestId}] Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    )
    console.log(`[Claude API ${requestId}] Starting Claude SDK query...`)

    const host = (await headers()).get("host") || "localhost"
    console.log(`[Claude API ${requestId}] Host: ${host}`)

    // Resolve workspace with ownership info
    let workspace: Workspace
    let cwd: string
    let resolvedWorkspaceName: string

    try {
      if (isTerminalMode(host)) {
        const workspaceResult = resolveWorkspace(host, { ...body, workspace: requestWorkspace }, requestId, origin)
        if (!workspaceResult.success) {
          return workspaceResult.response
        }
        cwd = workspaceResult.workspace
        const stats = require("node:fs").statSync(cwd)
        workspace = { root: cwd, uid: stats.uid, gid: stats.gid, tenantId: host }
        resolvedWorkspaceName = requestWorkspace || "unknown"
      } else {
        workspace = getWorkspace(host)
        cwd = workspace.root
        resolvedWorkspaceName = host
      }

      // Security: Verify user is authenticated for this specific workspace
      const isAuthenticated = await isWorkspaceAuthenticated(resolvedWorkspaceName)
      if (!isAuthenticated) {
        console.log(`[Claude API ${requestId}] User not authenticated for workspace: ${resolvedWorkspaceName}`)
        const errorRes = NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_NOT_AUTHENTICATED,
            message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED),
            workspace: resolvedWorkspaceName,
            requestId,
          },
          { status: 401 },
        )
        addCorsHeaders(errorRes, origin)
        return errorRes
      }
      console.log(`[Claude API ${requestId}] Workspace authentication verified for: ${resolvedWorkspaceName}`)
    } catch (workspaceError) {
      console.error(`[Claude API ${requestId}] Workspace resolution failed:`, workspaceError)
      const errorRes = NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_FOUND,
          message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_FOUND),
          details: { error: workspaceError instanceof Error ? workspaceError.message : "Unknown error" },
          requestId,
        },
        { status: 404 },
      )
      addCorsHeaders(errorRes, origin)
      return errorRes
    }

    console.log(`[Claude API ${requestId}] Working directory: ${cwd}`)
    console.log(`[Claude API ${requestId}] Claude model: ${process.env.CLAUDE_MODEL || "not set"}`)

    // Use shared tool permission handler
    const canUseTool = createToolPermissionHandler(workspace, requestId)

    const opts: Options = {
      cwd,
      allowedTools: ["Write", "Edit", "Read", "Glob", "Grep", "mcp__tools__generate_persona"],
      permissionMode: "acceptEdits",
      canUseTool,
      systemPrompt: getSystemPrompt({
        projectId: body.projectId,
        userId: body.userId,
        workspaceFolder: cwd,
        additionalContext: body.additionalContext,
      }),
      settingSources: ["project"],
      model: process.env.CLAUDE_MODEL,
    }

    try {
      console.log(`[Claude API ${requestId}] Creating query with options:`, {
        cwd,
        allowedTools: opts.allowedTools,
        permissionMode: opts.permissionMode,
        model: opts.model,
      })

      const q = query({ prompt: message, options: opts })
      console.log(`[Claude API ${requestId}] Query created, starting iteration...`)

      let queryResult: any = null
      let messageCount = 0
      for await (const m of q) {
        messageCount++
        console.log(`[Claude API ${requestId}] Message ${messageCount}: type=${m.type}`)
        if (m.type === "result") {
          queryResult = m
          console.log(`[Claude API ${requestId}] Got result message:`, {
            success: !!queryResult,
            hasContent: !!(queryResult as any)?.content,
            contentLength: (queryResult as any)?.content?.length || 0,
          })
        }
      }

      console.log(`[Claude API ${requestId}] Query iteration completed. Total messages: ${messageCount}`)
      console.log(`[Claude API ${requestId}] Final query result:`, {
        hasResult: !!queryResult,
        resultType: queryResult?.type,
        resultKeys: queryResult ? Object.keys(queryResult) : [],
      })

      const response = { ok: true, host, cwd, result: queryResult, requestId }
      console.log(`[Claude API ${requestId}] === REQUEST SUCCESS ===`)
      const res = NextResponse.json(response)
      addCorsHeaders(res, origin)
      return res
    } catch (error) {
      console.error(`[Claude API ${requestId}] Query failed:`, error)
      console.error(`[Claude API ${requestId}] Error stack:`, error instanceof Error ? error.stack : "No stack trace")

      const errorResponse = {
        ok: false,
        error: ErrorCodes.QUERY_FAILED,
        message: getErrorMessage(ErrorCodes.QUERY_FAILED),
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        requestId,
      }

      console.log(`[Claude API ${requestId}] === REQUEST ERROR ===`)
      const errorRes = NextResponse.json(errorResponse, { status: 500 })
      addCorsHeaders(errorRes, origin)
      return errorRes
    }
  } catch (outerError) {
    console.error(`[Claude API ${requestId}] Outer catch - request processing failed:`, outerError)
    const outerErrorRes = NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.REQUEST_PROCESSING_FAILED,
        message: getErrorMessage(ErrorCodes.REQUEST_PROCESSING_FAILED),
        details: { error: outerError instanceof Error ? outerError.message : "Unknown error" },
        requestId,
      },
      { status: 500 },
    )
    addCorsHeaders(outerErrorRes, origin)
    return outerErrorRes
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin")
  const res = new NextResponse(null, { status: 200 })
  addCorsHeaders(res, origin)
  return res
}
