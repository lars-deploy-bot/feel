import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { isWorkspaceAuthenticated, requireSessionUser } from "@/features/auth/lib/auth"
import {
  SessionStoreMemory,
  sessionKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { isInputSafe } from "@/features/chat/lib/formatMessage"
import {
  type BridgeErrorMessage,
  BridgeStreamType,
  encodeNDJSON,
  type StreamMessage,
} from "@/features/chat/lib/streaming/ndjson"
import { isAssistantMessageWithUsage, isBridgeMessageEvent } from "@/features/chat/types/guards"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { getWorkspace, type Workspace } from "@/features/workspace/lib/workspace-secure"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { isTerminalMode } from "@/features/workspace/types/workspace"
import { runAgentChild } from "@/lib/agent-child-runner"
import { addCorsHeaders } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { logInput } from "@/lib/input-logger"
import { calculateTokenCost, deductTokens, type TokenSource } from "@/lib/tokens"
import { loadDomainPasswords } from "@/types/guards/api"
import { generateRequestId } from "@/lib/utils"
import { BodySchema } from "@/types/guards/api"

export const runtime = "nodejs"

/**
 * Deduct tokens for assistant message if it has usage data
 * Only deducts when using workspace credits (not user API key)
 * Uses actual token usage from API response, not estimates
 * @returns true if tokens were deducted, false otherwise
 */
function deductTokensForMessage(
  message: StreamMessage,
  workspace: string,
  requestId: string
): boolean {
  if (!isBridgeMessageEvent(message) || !isAssistantMessageWithUsage(message)) {
    return false
  }

  const usage = message.data.content.message.usage
  const tokenCost = calculateTokenCost(usage)

  try {
    const newBalance = deductTokens(workspace, tokenCost)

    if (newBalance !== null) {
      console.log(
        `[Claude Stream ${requestId}] Deducted ${tokenCost} tokens (input: ${usage.input_tokens}, output: ${usage.output_tokens}), new balance: ${newBalance}`
      )
      return true
    }

    console.error(`[Claude Stream ${requestId}] Failed to deduct ${tokenCost} tokens (insufficient balance)`)
    return false
  } catch (error) {
    // Deduction failure - stream already succeeded, tokens were consumed by API
    // Log but don't crash - user got the response they paid for
    console.error(
      `[Claude Stream ${requestId}] Error deducting tokens: ${error instanceof Error ? error.message : String(error)}`
    )
    // Return false but don't propagate error - stream already ran
    return false
  }
}

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

  // Track lock acquisition for cleanup in error handler
  let lockAcquired = false
  let convKey = ""

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

    const {
      message,
      workspace: requestWorkspace,
      conversationId,
      apiKey: userApiKey,
      model: userModel,
    } = parseResult.data
    console.log(`[Claude Stream ${requestId}] Conversation: ${conversationId}`)
    console.log(
      `[Claude Stream ${requestId}] Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    )
    if (userApiKey) {
      console.log(`[Claude Stream ${requestId}] User provided API key (validation already done in schema)`)
    } else {
      console.log(`[Claude Stream ${requestId}] No user API key provided`)
    }
    if (userModel) {
      console.log(`[Claude Stream ${requestId}] Using user-selected model: ${userModel}`)
    }

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
    let resolvedWorkspaceName: string
    let tokenSource: TokenSource

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
        console.log(`[Claude Stream ${requestId}] User not authenticated for workspace: ${resolvedWorkspaceName}`)
        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.WORKSPACE_NOT_AUTHENTICATED,
            message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED),
            workspace: resolvedWorkspaceName,
            requestId,
          },
          { status: 401 },
        )
      }
      console.log(`[Claude Stream ${requestId}] Workspace authentication verified for: ${resolvedWorkspaceName}`)

      // Determine which API key to use: workspace tokens vs user-provided key
      const passwords = loadDomainPasswords()
      const domainConfig = passwords[resolvedWorkspaceName]
      const workspaceTokens = domainConfig?.tokens ?? 0
      const COST_ESTIMATE = 100 // Conservative estimate - reasonable for 200 token starting balance

      // Guard: reject if no sufficient tokens AND no API key
      if (workspaceTokens < COST_ESTIMATE && !userApiKey) {
        console.log(
          `[Claude Stream ${requestId}] Insufficient tokens (${workspaceTokens}/${COST_ESTIMATE} required) and no fallback API key`
        )
        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.INSUFFICIENT_TOKENS,
            message:
              workspaceTokens <= 0
                ? "Workspace credits exhausted. Add your API key in Settings to continue using Claude."
                : `Insufficient workspace credits (${workspaceTokens}/${COST_ESTIMATE} required). Add your API key in Settings as a fallback.`,
            workspace: resolvedWorkspaceName,
            requestId,
          },
          { status: 402 },
        )
      }

      // Cases 1 & 2: We're guaranteed to have either workspace tokens or a user API key
      tokenSource =
        workspaceTokens >= COST_ESTIMATE ? "workspace" : "user_provided"

      if (tokenSource === "workspace") {
        console.log(`[Claude Stream ${requestId}] Using workspace tokens (${workspaceTokens} available)`)
      } else {
        console.log(`[Claude Stream ${requestId}] Using user-provided API key (workspace has ${workspaceTokens} tokens)`)
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

    convKey = sessionKey({
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

    lockAcquired = true

    req.signal?.addEventListener(
      "abort",
      () => {
        try {
          unlockConversation(convKey)
        } catch (error) {
          console.error(`[Claude Stream ${requestId}] Failed to unlock conversation on abort:`, error)
        }
      },
      { once: true },
    )

    const existingSessionId = await SessionStoreMemory.get(convKey)
    console.log(
      `[Claude Stream ${requestId}] Existing session: ${existingSessionId ? `found (${existingSessionId})` : "none"}`,
    )

    console.log(`[Claude Stream ${requestId}] Working directory: ${cwd}`)
    const effectiveModel = userModel || env.CLAUDE_MODEL
    console.log(`[Claude Stream ${requestId}] Claude model: ${effectiveModel}`)

    const maxTurns = Number.parseInt(env.CLAUDE_MAX_TURNS, 10)
    if (Number.isNaN(maxTurns) || maxTurns < 1) {
      console.warn(`[Claude Stream ${requestId}] Invalid CLAUDE_MAX_TURNS, using default: 25`)
    }
    const effectiveMaxTurns = Number.isNaN(maxTurns) || maxTurns < 1 ? 25 : maxTurns

    console.log(`[Claude Stream ${requestId}] Max turns limit: ${effectiveMaxTurns}`)

    const systemPrompt = getSystemPrompt({
      projectId: body.projectId,
      userId: body.userId,
      workspaceFolder: cwd,
      additionalContext: body.additionalContext,
    })

    console.log(`[Claude Stream ${requestId}] Spawning child process runner`)

    const childStream = runAgentChild(cwd, {
      message,
      model: effectiveModel,
      maxTurns: effectiveMaxTurns,
      resume: existingSessionId || undefined,
      systemPrompt,
      apiKey: userApiKey || undefined,
    })

    const decoder = new TextDecoder()

    const ndjsonStream = new ReadableStream({
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

                const message: StreamMessage = {
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
                      : childEvent.type === "complete"
                        ? { totalMessages: childEvent.totalMessages, result: childEvent.result }
                        : childEvent,
                }

                // Session events are server-side only - store but don't forward to client
                // This prevents exposing SDK session IDs which are security-sensitive
                if (childEvent.type === "bridge_session" && childEvent.sessionId) {
                  console.log(`[Claude Stream ${requestId}] Storing session ID: ${childEvent.sessionId}`)
                  await SessionStoreMemory.set(convKey, childEvent.sessionId)
                } else {
                  // Only deduct tokens if using workspace credits (not user API key)
                  if (tokenSource === "workspace") {
                    deductTokensForMessage(message, resolvedWorkspaceName, requestId)
                  }
                  controller.enqueue(encodeNDJSON(message))
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

              // Session events are server-side only (see comment above)
              if (childEvent.type === "bridge_session" && childEvent.sessionId) {
                console.log(`[Claude Stream ${requestId}] Storing session ID (final): ${childEvent.sessionId}`)
                await SessionStoreMemory.set(convKey, childEvent.sessionId)
              } else {
                const message: StreamMessage = {
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
                      : childEvent.type === "complete"
                        ? { totalMessages: childEvent.totalMessages, result: childEvent.result }
                        : childEvent,
                }

                // Only deduct tokens if using workspace credits (not user API key)
                if (tokenSource === "workspace") {
                  deductTokensForMessage(message, resolvedWorkspaceName, requestId)
                }
                controller.enqueue(encodeNDJSON(message))
              }
            } catch (_parseError) {
              console.error(`[Claude Stream ${requestId}] Failed to parse final buffer:`, buffer)
            }
          }

          console.log(`[Claude Stream ${requestId}] Child process stream complete`)
        } catch (error) {
          console.error(`[Claude Stream ${requestId}] Child process stream error:`, error)
          const errorMessage: BridgeErrorMessage = {
            type: BridgeStreamType.ERROR,
            requestId,
            timestamp: new Date().toISOString(),
            data: {
              error: ErrorCodes.STREAM_ERROR,
              code: ErrorCodes.STREAM_ERROR,
              message: getErrorMessage(ErrorCodes.STREAM_ERROR),
              details: { error: String(error) },
            },
          }
          controller.enqueue(encodeNDJSON(errorMessage))
        } finally {
          unlockConversation(convKey)
          controller.close()
        }
      },
    })

    return new Response(ndjsonStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (outerError) {
    console.error(`[Claude Stream ${requestId}] Outer catch - request processing failed:`, outerError)

    // CRITICAL: Release lock if we acquired it before the error occurred
    // This prevents deadlocks when errors happen during stream setup
    if (lockAcquired) {
      try {
        unlockConversation(convKey)
        console.log(`[Claude Stream ${requestId}] Released conversation lock after error`)
      } catch (unlockError) {
        console.error(`[Claude Stream ${requestId}] Failed to unlock conversation in error handler:`, unlockError)
      }
    }

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
