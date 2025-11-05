import { toolsMcp, workspaceManagementMcp } from "@alive-brug/tools"
import type { Options } from "@anthropic-ai/claude-agent-sdk"
import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { requireSessionUser } from "@/features/auth/lib/auth"
import {
  SessionStoreMemory,
  sessionKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { isInputSafe } from "@/features/chat/lib/formatMessage"
import { createClaudeStream, createSSEResponse } from "@/features/chat/lib/streamHandler"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { getWorkspace, type Workspace } from "@/features/workspace/lib/workspace-secure"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { isTerminalMode } from "@/features/workspace/types/workspace"
import { runAgentChild, shouldUseChildProcess } from "@/lib/agent-child-runner"
import { createToolPermissionHandler } from "@/lib/claude/tool-permissions"
import { addCorsHeaders } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { logInput } from "@/lib/input-logger"
import { generateRequestId } from "@/lib/utils"
import { BodySchema } from "@/types/guards/api"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  console.log(`[Claude Stream ${requestId}] === STREAM REQUEST START ===`)

  // Defense-in-depth: Block real API calls during E2E tests
  if (process.env.PLAYWRIGHT_TEST === "true") {
    console.error(`[Claude Stream ${requestId}] ⛔ BLOCKED: Real API call attempted during E2E test`)
    return NextResponse.json(
      {
        ok: false,
        error: ErrorCodes.TEST_MODE_BLOCK,
        message: getErrorMessage(ErrorCodes.TEST_MODE_BLOCK),
        requestId,
      },
      { status: 403 },
    )
  }

  try {
    const jar = await cookies()
    console.log(`[Claude Stream ${requestId}] Checking session cookie...`)

    if (!hasSessionCookie(jar.get("session"))) {
      console.log(`[Claude Stream ${requestId}] No session cookie found`)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.NO_SESSION,
          message: getErrorMessage(ErrorCodes.NO_SESSION),
          requestId,
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
      console.error(`[Claude Stream ${requestId}] Schema validation failed:`, parseResult.error.issues)
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

    const { message, workspace: requestWorkspace, conversationId } = parseResult.data
    console.log(`[Claude Stream ${requestId}] Conversation: ${conversationId}`)
    console.log(
      `[Claude Stream ${requestId}] Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    )

    // Check input safety
    console.log(`[Claude Stream ${requestId}] Checking input safety...`)
    const safetyCheck = await isInputSafe(message)
    if (safetyCheck === "unsafe") {
      console.log(`[Claude Stream ${requestId}] Input flagged as unsafe`)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.INVALID_REQUEST,
          message: "Your message contains inappropriate content. Please keep it professional and appropriate.",
          requestId,
        },
        { status: 400 },
      )
    }
    console.log(`[Claude Stream ${requestId}] Input safety check passed`)

    const host = (await headers()).get("host") || "localhost"
    const origin = req.headers.get("origin")
    console.log(`[Claude Stream ${requestId}] Host: ${host}`)

    let workspace: Workspace
    let cwd: string

    try {
      if (isTerminalMode(host)) {
        const workspaceResult = resolveWorkspace(host, { ...body, workspace: requestWorkspace }, requestId, origin)
        if (!workspaceResult.success) {
          return workspaceResult.response
        }
        cwd = workspaceResult.workspace
        const stats = require("node:fs").statSync(cwd)
        workspace = { root: cwd, uid: stats.uid, gid: stats.gid, tenantId: host }
      } else {
        workspace = getWorkspace(host)
        cwd = workspace.root
      }
    } catch (workspaceError) {
      console.error(`[Claude Stream ${requestId}] Workspace resolution failed:`, workspaceError)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_FOUND,
          message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_FOUND, { host }),
          details: {
            host,
            requestWorkspace,
            error: workspaceError instanceof Error ? workspaceError.message : "Unknown error",
          },
          requestId,
        },
        { status: 404 },
      )
    }

    logInput({
      timestamp: new Date().toISOString(),
      userId: user.id,
      conversationId,
      workspace: requestWorkspace ?? "default",
      cwd,
      messageLength: message.length,
      message,
      requestId,
    })

    const convKey = sessionKey({
      userId: user.id,
      workspace: requestWorkspace,
      conversationId,
    })
    console.log(`[Claude Stream ${requestId}] Session key: ${convKey}`)

    if (!tryLockConversation(convKey)) {
      console.log(`[Claude Stream ${requestId}] Conversation already in progress`)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.CONVERSATION_BUSY,
          message: getErrorMessage(ErrorCodes.CONVERSATION_BUSY),
          requestId,
        },
        { status: 409 },
      )
    }

    req.signal?.addEventListener("abort", () => unlockConversation(convKey), { once: true })

    const existingSessionId = await SessionStoreMemory.get(convKey)
    console.log(`[Claude Stream ${requestId}] Existing session: ${existingSessionId ? "found" : "none"}`)

    console.log(`[Claude Stream ${requestId}] Working directory: ${cwd}`)
    console.log(`[Claude Stream ${requestId}] Claude model: ${env.CLAUDE_MODEL}`)

    // Use shared tool permission handler
    const canUseTool = createToolPermissionHandler(workspace, requestId)

    const maxTurns = Number.parseInt(env.CLAUDE_MAX_TURNS, 10)
    if (Number.isNaN(maxTurns) || maxTurns < 1) {
      console.warn(`[Claude Stream ${requestId}] Invalid CLAUDE_MAX_TURNS, using default: 25`)
    }
    const effectiveMaxTurns = Number.isNaN(maxTurns) || maxTurns < 1 ? 25 : maxTurns

    console.log(`[Claude Stream ${requestId}] Max turns limit: ${effectiveMaxTurns}`)

    const claudeOptions: Options = {
      cwd,
      allowedTools: [
        "Write",
        "Edit",
        "Read",
        "Glob",
        "Grep",
        "mcp__workspace-management__restart_dev_server",
        "mcp__workspace-management__install_package",
        "mcp__tools__list_guides",
        "mcp__tools__get_guide",
        "mcp__tools__generate_persona",
      ],
      permissionMode: "acceptEdits",
      canUseTool,
      maxTurns: effectiveMaxTurns,
      systemPrompt: getSystemPrompt({
        projectId: body.projectId,
        userId: body.userId,
        workspaceFolder: cwd,
        additionalContext: body.additionalContext,
      }),
      settingSources: [], // Disabled: prevents SDK from overriding allowedTools whitelist
      model: env.CLAUDE_MODEL,
      mcpServers: {
        "workspace-management": workspaceManagementMcp,
        tools: toolsMcp,
      },
      ...(existingSessionId ? { resume: existingSessionId } : {}),
    }

    console.log(`[Claude Stream ${requestId}] Creating stream...`)

    const useChildProcess = shouldUseChildProcess(cwd)
    console.log(`[Claude Stream ${requestId}] Use child process: ${useChildProcess}`)

    if (useChildProcess) {
      console.log(`[Claude Stream ${requestId}] Using child process runner`)

      const childStream = runAgentChild(cwd, {
        message,
        model: env.CLAUDE_MODEL,
        maxTurns: effectiveMaxTurns,
        resume: existingSessionId || undefined,
        systemPrompt: claudeOptions.systemPrompt,
      })

      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      const sseStream = new ReadableStream({
        async start(controller) {
          const reader = childStream.getReader()
          let buffer = ""

          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split("\n")
              buffer = lines.pop() || ""

              for (const line of lines) {
                if (!line.trim()) continue

                try {
                  const childEvent = JSON.parse(line)

                  const streamEvent = {
                    type: childEvent.type,
                    requestId,
                    timestamp: new Date().toISOString(),
                    data:
                      childEvent.type === "message"
                        ? {
                            messageCount: childEvent.messageCount,
                            messageType: childEvent.messageType,
                            content: childEvent.content,
                          }
                        : childEvent.type === "session"
                          ? { sessionId: childEvent.sessionId }
                          : childEvent.type === "complete"
                            ? { totalMessages: childEvent.totalMessages, result: childEvent.result }
                            : childEvent,
                  }

                  const sseData = `event: bridge_${childEvent.type}\ndata: ${JSON.stringify(streamEvent)}\n\n`
                  controller.enqueue(encoder.encode(sseData))

                  if (childEvent.type === "session" && childEvent.sessionId) {
                    await SessionStoreMemory.set(convKey, childEvent.sessionId)
                  }
                } catch (parseError) {
                  console.error(
                    `[Claude Stream ${requestId}] Failed to parse child output (length: ${line.length}):`,
                    parseError instanceof Error ? parseError.message : String(parseError),
                  )
                  console.error(`[Claude Stream ${requestId}] Line preview:`, line.substring(0, 200))
                }
              }
            }

            if (buffer.trim()) {
              try {
                const childEvent = JSON.parse(buffer)
                const streamEvent = {
                  type: childEvent.type,
                  requestId,
                  timestamp: new Date().toISOString(),
                  data:
                    childEvent.type === "message"
                      ? {
                          messageCount: childEvent.messageCount,
                          messageType: childEvent.messageType,
                          content: childEvent.content,
                        }
                      : childEvent.type === "session"
                        ? { sessionId: childEvent.sessionId }
                        : childEvent.type === "complete"
                          ? { totalMessages: childEvent.totalMessages, result: childEvent.result }
                          : childEvent,
                }

                const sseData = `event: bridge_${childEvent.type}\ndata: ${JSON.stringify(streamEvent)}\n\n`
                controller.enqueue(encoder.encode(sseData))
              } catch (_parseError) {
                console.error(`[Claude Stream ${requestId}] Failed to parse final buffer:`, buffer)
              }
            }

            console.log(`[Claude Stream ${requestId}] Child process stream complete`)
          } catch (error) {
            console.error(`[Claude Stream ${requestId}] Child process stream error:`, error)
            const errorData = `event: bridge_error\ndata: ${JSON.stringify({
              type: "error",
              requestId,
              timestamp: new Date().toISOString(),
              data: {
                error: ErrorCodes.STREAM_ERROR,
                code: ErrorCodes.STREAM_ERROR,
                message: getErrorMessage(ErrorCodes.STREAM_ERROR),
                details: { error: String(error) },
              },
            })}\n\n`
            controller.enqueue(encoder.encode(errorData))
          } finally {
            unlockConversation(convKey)
            controller.close()
          }
        },
      })

      return new Response(sseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      })
    } else {
      console.log(`[Claude Stream ${requestId}] Using standard in-process stream`)

      const { stream } = createClaudeStream({
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
        requestSignal: req.signal,
        onClose: () => unlockConversation(convKey),
        maxTurns: effectiveMaxTurns,
      })

      return createSSEResponse(stream)
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
