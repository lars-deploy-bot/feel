import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import {
  createErrorResponse,
  getSafeSessionCookie,
  requireSessionUser,
  verifyWorkspaceAccess,
} from "@/features/auth/lib/auth"
import {
  SessionStoreMemory,
  sessionKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { isInputSafe } from "@/features/chat/lib/formatMessage"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { COOKIE_NAMES } from "@/lib/auth/cookies"
import { hasStripeMcpAccess } from "@/lib/claude/agent-constants.mjs"
import { getStripeOAuth } from "@/lib/oauth/oauth-instances"
import { addCorsHeaders } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { logInput } from "@/lib/input-logger"
import { DEFAULT_MODEL } from "@/lib/models/claude-models"
import { createRequestLogger } from "@/lib/request-logger"
import { registerCancellation, startTTLCleanup, unregisterCancellation } from "@/lib/stream/cancellation-registry"
import { type CancelState, createNDJSONStream } from "@/lib/stream/ndjson-stream-handler"
import { createAppClient } from "@/lib/supabase/app"
import type { TokenSource } from "@/lib/tokens"
import { getOrgCredits } from "@/lib/tokens"
import { generateRequestId } from "@/lib/utils"
import { runAgentChild } from "@/lib/workspace-execution/agent-child-runner"
import { BodySchema } from "@/types/guards/api"

export const runtime = "nodejs"

// Start TTL cleanup on server start (once)
startTTLCleanup()

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const logger = createRequestLogger("Claude Stream", requestId)

  logger.log("=== STREAM REQUEST START ===")

  // Defense-in-depth: Block real API calls during E2E tests
  if (process.env.PLAYWRIGHT_TEST === "true") {
    logger.error("⛔ BLOCKED: Real API call attempted during E2E test")
    return createErrorResponse(ErrorCodes.TEST_MODE_BLOCK, 403, { requestId })
  }

  // Track lock acquisition for cleanup in error handler
  let lockAcquired = false
  let convKey = ""

  try {
    const jar = await cookies()
    logger.log("Checking session cookie...")

    if (!hasSessionCookie(jar.get(COOKIE_NAMES.SESSION))) {
      logger.log("No session cookie found")
      return createErrorResponse(ErrorCodes.NO_SESSION, 401, { requestId })
    }
    logger.log("Session cookie verified")

    // Get user from session
    const user = await requireSessionUser()
    logger.log("User:", user.id)

    logger.log("Parsing request body...")
    let body: Record<string, unknown>
    try {
      body = await req.json()
      logger.log("Raw body keys:", Object.keys(body))
    } catch (jsonError) {
      logger.error("Failed to parse JSON body:", jsonError)
      return createErrorResponse(ErrorCodes.INVALID_JSON, 400, {
        details: { error: jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error" },
        requestId,
      })
    }

    // Validate request body
    const parseResult = BodySchema.safeParse(body)
    if (!parseResult.success) {
      logger.error("Schema validation failed:", parseResult.error.issues)
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, {
        details: { issues: parseResult.error.issues },
        requestId,
      })
    }

    const {
      message,
      workspace: requestWorkspace,
      conversationId,
      apiKey: userApiKey,
      model: userModel,
      projectId,
      userId,
      additionalContext,
    } = parseResult.data
    logger.log("Conversation:", conversationId)
    logger.log(
      `Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    )
    if (userApiKey) {
      logger.log("User provided API key (validation already done in schema)")
    } else {
      logger.log("No user API key provided")
    }
    if (userModel) {
      logger.log("Using user-selected model:", userModel)
    }

    // Check input safety
    logger.log("Checking input safety...")
    const safetyCheck = await isInputSafe(message)
    if (safetyCheck === "unsafe") {
      logger.log("Input flagged as unsafe")
      return createErrorResponse(ErrorCodes.INVALID_REQUEST, 400, {
        message: "Your message contains inappropriate content. Please keep it professional and appropriate.",
        requestId,
      })
    }
    logger.log("Input safety check passed")

    const host = (await headers()).get("host") || "localhost"
    const origin = req.headers.get("origin")
    logger.log("Host:", host)

    let cwd: string
    let resolvedWorkspaceName: string | null
    let tokenSource: TokenSource

    try {
      // Security: Verify workspace authorization BEFORE resolving paths
      resolvedWorkspaceName = await verifyWorkspaceAccess(user, body, `[Claude Stream ${requestId}]`)

      if (!resolvedWorkspaceName) {
        return createErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, 401, { requestId })
      }
      logger.log("Workspace authentication verified for:", resolvedWorkspaceName)

      // Only after authorization, resolve workspace path
      const workspaceResult = resolveWorkspace(host, { ...body, workspace: requestWorkspace }, requestId, origin)
      if (!workspaceResult.success) {
        return workspaceResult.response
      }
      cwd = workspaceResult.workspace

      // Determine which API key to use: org credits vs user-provided key
      const orgCredits = (await getOrgCredits(resolvedWorkspaceName)) ?? 0
      const COST_ESTIMATE = 1 // Conservative estimate - 1 credit minimum for 200 credit starting balance

      // Guard: reject if no sufficient credits AND no API key
      if (orgCredits < COST_ESTIMATE && !userApiKey) {
        logger.log(`Insufficient credits (${orgCredits}/${COST_ESTIMATE} required) and no fallback API key`)
        return NextResponse.json(
          {
            ok: false,
            error: ErrorCodes.INSUFFICIENT_TOKENS,
            message:
              orgCredits <= 0
                ? "Organization credits exhausted. Add your API key in Settings to continue using Claude."
                : `Insufficient credits (${orgCredits}/${COST_ESTIMATE} required). Add your API key in Settings as a fallback.`,
            workspace: resolvedWorkspaceName,
            requestId,
          },
          { status: 402 },
        )
      }

      // Cases 1 & 2: We're guaranteed to have either org credits or a user API key
      tokenSource = orgCredits >= COST_ESTIMATE ? "workspace" : "user_provided"

      if (tokenSource === "workspace") {
        logger.log(`Using org credits (${orgCredits} available)`)
      } else {
        logger.log(`Using user-provided API key (workspace has ${orgCredits} credits)`)
      }
    } catch (workspaceError) {
      logger.error("Workspace resolution failed:", workspaceError)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_FOUND,
          message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_FOUND, { host: requestWorkspace || host }),
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

    // Verify domain exists in app.domains
    const app = await createAppClient("service")
    const { data: domainRecord } = await app
      .from("domains")
      .select("domain_id, hostname, port")
      .eq("hostname", resolvedWorkspaceName)
      .single()

    if (!domainRecord) {
      logger.error("Domain not found in database:", resolvedWorkspaceName)
      return NextResponse.json(
        {
          ok: false,
          error: ErrorCodes.WORKSPACE_NOT_FOUND,
          message: getErrorMessage(ErrorCodes.WORKSPACE_NOT_FOUND, { host: resolvedWorkspaceName }),
          requestId,
        },
        { status: 404 },
      )
    }

    convKey = sessionKey({
      userId: user.id,
      workspace: resolvedWorkspaceName, // Use domain for conversation key (for locking compatibility)
      conversationId,
    })
    logger.log(`Domain: ${domainRecord.hostname} (port: ${domainRecord.port}, id: ${domainRecord.domain_id})`)
    logger.log("Session key:", convKey)
    logger.log("Attempting to lock conversation...")

    if (!tryLockConversation(convKey)) {
      logger.log("❌ LOCK FAILED - Conversation already in progress for key:", convKey)
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
    logger.log("✅ LOCK ACQUIRED for:", convKey)

    const existingSessionId = await SessionStoreMemory.get(convKey)
    logger.log(`Existing session: ${existingSessionId ? `found (${existingSessionId})` : "none"}`)

    logger.log("Working directory:", cwd)

    // Force default model for credit users (cost management)
    // API key users can choose any model
    const effectiveModel =
      tokenSource === "workspace"
        ? DEFAULT_MODEL // ENFORCED for org credits
        : userModel || env.CLAUDE_MODEL // User's choice with API key

    if (tokenSource === "workspace" && userModel && userModel !== DEFAULT_MODEL) {
      logger.log(`Model override: User requested ${userModel} but forcing ${DEFAULT_MODEL} for org credits`)
    }
    logger.log("Claude model:", effectiveModel)

    const maxTurns = Number.parseInt(env.CLAUDE_MAX_TURNS, 10)
    if (Number.isNaN(maxTurns) || maxTurns < 1) {
      console.warn(`[Claude Stream ${requestId}] Invalid CLAUDE_MAX_TURNS, using default: 25`)
    }
    const effectiveMaxTurns = Number.isNaN(maxTurns) || maxTurns < 1 ? 25 : maxTurns

    logger.log("Max turns limit:", effectiveMaxTurns)

    // Fetch user's Stripe OAuth token if connected
    let stripeAccessToken: string | undefined
    try {
      const stripeOAuth = getStripeOAuth()
      stripeAccessToken = await stripeOAuth.getAccessToken(user.id, "stripe")
      logger.log("User has Stripe OAuth connection")
    } catch {
      // User not connected to Stripe - this is normal
      stripeAccessToken = undefined
    }
    const hasStripeConnection = !!stripeAccessToken

    const systemPrompt = getSystemPrompt({
      projectId,
      userId,
      workspaceFolder: cwd,
      hasStripeMcpAccess: hasStripeMcpAccess(resolvedWorkspaceName, hasStripeConnection),
      additionalContext,
    })

    logger.log("Spawning child process runner")

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
      stripeAccessToken, // Pass user's Stripe OAuth token for MCP server
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
        logger.log("Released conversation lock and unregistered cancellation")
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

    logger.log("Stream response ready, cancellation registered")
    return response
  } catch (outerError) {
    logger.error("Outer catch - request processing failed:", outerError)

    // CRITICAL: Release lock if we acquired it before the error occurred
    // This prevents deadlocks when errors happen during stream setup
    if (lockAcquired) {
      try {
        unlockConversation(convKey)
        logger.log("Released conversation lock after error")
      } catch (unlockError) {
        logger.error("Failed to unlock conversation in error handler:", unlockError)
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
