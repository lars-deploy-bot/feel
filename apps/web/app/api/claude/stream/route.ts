import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { getSafeSessionCookie, isWorkspaceAuthenticated, requireSessionUser } from "@/features/auth/lib/auth"
import {
  SessionStoreMemory,
  sessionKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { isInputSafe } from "@/features/chat/lib/formatMessage"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { getWorkspace, type Workspace } from "@/features/workspace/lib/workspace-secure"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { isTerminalMode } from "@/features/workspace/types/workspace"
import { runAgentChild } from "@/lib/workspace-execution/agent-child-runner"
import { addCorsHeaders } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { logInput } from "@/lib/input-logger"
import { DEFAULT_MODEL } from "@/lib/models/claude-models"
import { registerCancellation, startTTLCleanup, unregisterCancellation } from "@/lib/stream/cancellation-registry"
import { type CancelState, createNDJSONStream } from "@/lib/stream/ndjson-stream-handler"
import type { TokenSource } from "@/lib/tokens"
import { generateRequestId } from "@/lib/utils"
import { BodySchema, loadDomainPasswords } from "@/types/guards/api"

export const runtime = "nodejs"

// Start TTL cleanup on server start (once)
startTTLCleanup()

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

      // Determine which API key to use: workspace credits vs user-provided key
      const passwords = loadDomainPasswords()
      const domainConfig = passwords[resolvedWorkspaceName]
      const workspaceCredits = domainConfig?.credits ?? 0
      const COST_ESTIMATE = 1 // Conservative estimate - 1 credit minimum for 200 credit starting balance

      // Guard: reject if no sufficient credits AND no API key
      if (workspaceCredits < COST_ESTIMATE && !userApiKey) {
        console.log(
          `[Claude Stream ${requestId}] Insufficient credits (${workspaceCredits}/${COST_ESTIMATE} required) and no fallback API key`,
        )
        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.INSUFFICIENT_TOKENS,
            message:
              workspaceCredits <= 0
                ? "Workspace credits exhausted. Add your API key in Settings to continue using Claude."
                : `Insufficient workspace credits (${workspaceCredits}/${COST_ESTIMATE} required). Add your API key in Settings as a fallback.`,
            workspace: resolvedWorkspaceName,
            requestId,
          },
          { status: 402 },
        )
      }

      // Cases 1 & 2: We're guaranteed to have either workspace credits or a user API key
      tokenSource = workspaceCredits >= COST_ESTIMATE ? "workspace" : "user_provided"

      if (tokenSource === "workspace") {
        console.log(`[Claude Stream ${requestId}] Using workspace credits (${workspaceCredits} available)`)
      } else {
        console.log(
          `[Claude Stream ${requestId}] Using user-provided API key (workspace has ${workspaceCredits} credits)`,
        )
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
    console.log(`[Claude Stream ${requestId}] Attempting to lock conversation...`)

    if (!tryLockConversation(convKey)) {
      console.log(`[Claude Stream ${requestId}] ❌ LOCK FAILED - Conversation already in progress for key: ${convKey}`)
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
    console.log(`[Claude Stream ${requestId}] ✅ LOCK ACQUIRED for: ${convKey}`)

    const existingSessionId = await SessionStoreMemory.get(convKey)
    console.log(
      `[Claude Stream ${requestId}] Existing session: ${existingSessionId ? `found (${existingSessionId})` : "none"}`,
    )

    console.log(`[Claude Stream ${requestId}] Working directory: ${cwd}`)

    // Force default model for credit users (cost management)
    // API key users can choose any model
    const effectiveModel =
      tokenSource === "workspace"
        ? DEFAULT_MODEL // ENFORCED for workspace credits
        : userModel || env.CLAUDE_MODEL // User's choice with API key

    if (tokenSource === "workspace" && userModel && userModel !== DEFAULT_MODEL) {
      console.log(
        `[Claude Stream ${requestId}] Model override: User requested ${userModel} but forcing ${DEFAULT_MODEL} for workspace credits`,
      )
    }
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

    /**
     * === CANCELLATION ARCHITECTURE ===
     *
     * Explicit cancellation via dedicated HTTP endpoint (production-safe).
     * We don't use req.signal.addEventListener("abort") because it doesn't work
     * in production (Cloudflare → Caddy → Next.js proxy layers don't propagate abort).
     *
     * Architecture:
     * 1. Client receives X-Request-Id header immediately (line 369)
     * 2. Client calls POST /api/claude/stream/cancel with requestId (primary path)
     * 3. Cancel endpoint calls cancelStream(requestId, userId) via registry
     * 4. Registry triggers this callback: sets cancelState.requested = true
     * 5. Stream handler (ndjson-stream-handler.ts) checks flag in read loop
     * 6. Stream breaks immediately, onStreamComplete releases lock
     *
     * Fallback (super-early Stop, < 100ms):
     * - If user clicks Stop before X-Request-Id header arrives
     * - Client calls cancel endpoint with conversationId instead
     * - Registry searches by conversationKey, triggers same cancellation
     *
     * Why shared cancelState?
     * - Registry needs to signal cancellation (sets requested = true)
     * - Stream handler needs to check cancellation (reads requested flag)
     * - Reader needs to be interrupted (reader.cancel() breaks blocked read)
     *
     * See docs/streaming/cancellation-architecture.md for full details.
     */
    const cancelState: CancelState = {
      requested: false,
      reader: null,
    }

    // Register cancellation callback BEFORE starting stream
    // This allows cancellation to work even if called before stream fully starts
    registerCancellation(requestId, user.id, convKey, () => {
      cancelState.requested = true
      cancelState.reader?.cancel() // Interrupt blocked read
    })

    // Get session cookie value to pass to child process for API authentication
    // Validates JWT format to prevent "jwt malformed" errors in MCP tools
    const sessionCookie = await getSafeSessionCookie(`[Claude Stream ${requestId}]`)

    const childStream = runAgentChild(cwd, {
      message,
      model: effectiveModel,
      maxTurns: effectiveMaxTurns,
      resume: existingSessionId || undefined,
      systemPrompt,
      apiKey: userApiKey || undefined,
      sessionCookie,
    })

    // Create NDJSON stream from child process output
    // Handles: NDJSON parsing, session ID storage, token deduction, error handling, cancellation
    const ndjsonStream = createNDJSONStream({
      childStream,
      conversationKey: convKey,
      requestId,
      conversationWorkspace: resolvedWorkspaceName,
      tokenSource,
      cancelState, // Pass shared cancellation state
      onStreamComplete: () => {
        // Guaranteed cleanup: unregister, unlock, callback
        unregisterCancellation(requestId)
        unlockConversation(convKey)
        console.log(`[Claude Stream ${requestId}] Released conversation lock and unregistered cancellation`)
      },
    })

    // Return NDJSON stream as HTTP response
    // Cancellation Architecture:
    // - Client calls POST /api/claude/stream/cancel with requestId (primary) or conversationId (fallback)
    // - Registry triggers cancelState.requested = true and reader.cancel()
    // - Stream breaks immediately and onStreamComplete releases lock
    //
    // Note: We don't use req.signal.addEventListener("abort") because it doesn't work
    // in production (Cloudflare → Caddy → Next.js proxy layers don't propagate abort).
    // See docs/streaming/cancellation-architecture.md for details.
    const response = new Response(ndjsonStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Request-Id": requestId, // Send requestId in header for immediate client access
        "Access-Control-Expose-Headers": "X-Request-Id", // Allow JS to read custom header
      },
    })

    console.log(`[Claude Stream ${requestId}] Stream response ready, cancellation registered`)
    return response
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
