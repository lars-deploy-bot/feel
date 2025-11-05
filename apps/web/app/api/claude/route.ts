import path from "node:path"
import { type Options, type PermissionResult, query } from "@anthropic-ai/claude-agent-sdk"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { addCorsHeaders } from "@/lib/cors-utils"
import { BodySchema, isToolAllowed } from "@/types/guards/api"
import { isPathWithinWorkspace } from "@/features/workspace/types/workspace"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(2, 8)
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
          error: "no_session",
          message: "Authentication required - no session cookie found",
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
          error: "invalid_json",
          message: "Request body is not valid JSON",
          details: jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error",
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
          error: "invalid_request",
          message:
            "Invalid request body. Required: message (string), conversationId (uuid). Optional: workspace (string)",
          details: parseResult.error.issues,
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

    // Get workspace using utility
    const workspaceResult = resolveWorkspace(host, { ...body, workspace: requestWorkspace }, requestId, origin)
    if (!workspaceResult.success) {
      return workspaceResult.response
    }
    const cwd = workspaceResult.workspace

    console.log(`[Claude API ${requestId}] Working directory: ${cwd}`)
    console.log(`[Claude API ${requestId}] Claude model: ${process.env.CLAUDE_MODEL || "not set"}`)

    const canUseTool: Options["canUseTool"] = async (toolName, input) => {
      console.log(`[Claude API ${requestId}] Tool requested: ${toolName}`)
      console.log(`[Claude API ${requestId}] Tool input:`, JSON.stringify(input, null, 2))

      const ALLOWED = new Set(["Write", "Edit", "Read", "Glob", "Grep"])
      if (!isToolAllowed(toolName, ALLOWED)) {
        console.log(`[Claude API ${requestId}] Tool denied: ${toolName}`)
        return { behavior: "deny", message: `tool_not_allowed: ${toolName}` }
      }

      const filePath = (input as any).file_path || (input as any).notebook_path || (input as any).path || null

      if (filePath) {
        const norm = path.normalize(filePath)
        console.log(`[Claude API ${requestId}] File path requested: ${norm}`)
        if (!isPathWithinWorkspace(norm, cwd, path.sep)) {
          console.log(`[Claude API ${requestId}] Path denied - outside workspace: ${norm}`)
          return { behavior: "deny", message: "path_outside_workspace" }
        }
        console.log(`[Claude API ${requestId}] Path allowed: ${norm}`)
      }

      const allow: PermissionResult = {
        behavior: "allow",
        updatedInput: input,
        updatedPermissions: [],
      }
      console.log(`[Claude API ${requestId}] Tool allowed: ${toolName}`)
      return allow
    }

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
        error: "query_failed",
        message: "Claude SDK query failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
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
        error: "request_processing_failed",
        message: "Failed to process request",
        details: outerError instanceof Error ? outerError.message : "Unknown error",
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
