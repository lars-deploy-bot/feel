import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { statSync } from "node:fs"
import {
  createErrorResponse,
  getSafeSessionCookie,
  requireSessionUser,
  verifyWorkspaceAccess,
} from "@/features/auth/lib/auth"
import { fetchAndSaveAnalyzeImages, buildAnalyzeImagePrompt } from "@/lib/image-analyze/fetch-and-save"
import { SessionStoreMemory, tabKey, tryLockConversation, unlockConversation } from "@/features/auth/lib/sessionStore"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { isInputSafe } from "@/features/chat/lib/formatMessage"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { COOKIE_NAMES } from "@/lib/auth/cookies"
import {
  hasStripeMcpAccess,
  getAllowedTools,
  getDisallowedTools,
  getOAuthMcpServers,
  PERMISSION_MODE,
  SETTINGS_SOURCES,
  BRIDGE_STREAM_TYPES,
} from "@/lib/claude/agent-constants.mjs"
import { fetchOAuthTokens } from "@/lib/oauth/fetch-oauth-tokens"
import { fetchUserEnvKeys } from "@/lib/oauth/fetch-user-env-keys"
import { addCorsHeaders } from "@/lib/cors-utils"
import { env } from "@/lib/env"
import { ErrorCodes } from "@/lib/error-codes"
import { logInput } from "@/lib/input-logger"
import { type ClaudeModel, DEFAULT_MODEL, isValidClaudeModel } from "@/lib/models/claude-models"
import { createRequestLogger } from "@/lib/request-logger"
import { registerCancellation, startTTLCleanup, unregisterCancellation } from "@/lib/stream/cancellation-registry"
import { type CancelState, createNDJSONStream } from "@/lib/stream/ndjson-stream-handler"
import {
  createStreamBuffer,
  appendToStreamBuffer,
  completeStreamBuffer,
  errorStreamBuffer,
} from "@/lib/stream/stream-buffer"
import { createAppClient } from "@/lib/supabase/app"
import type { TokenSource } from "@/lib/tokens"
import { getOrgCredits } from "@/lib/tokens"
import { generateRequestId } from "@/lib/utils"
import { runAgentChild } from "@/lib/workspace-execution/agent-child-runner"
import { detectServeMode } from "@/lib/workspace-execution/command-runner"
import { BodySchema } from "@/types/guards/api"
import { DEFAULTS, WORKER_POOL, SUPERADMIN } from "@webalive/shared"
import { getWorkerPool, type WorkerToParentMessage } from "@webalive/worker-pool"

export const runtime = "nodejs"

// Start TTL cleanup on server start (once)
startTTLCleanup()

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const logger = createRequestLogger("Claude Stream", requestId)
  const startTime = Date.now()
  const timing = (label: string) => logger.log(`[TIMING] ${label}: +${Date.now() - startTime}ms`)

  logger.log("=== STREAM REQUEST START ===")
  timing("request_received")

  // Defense-in-depth: Block real API calls during E2E tests
  if (process.env.PLAYWRIGHT_TEST === "true") {
    logger.error("⛔ BLOCKED: Real API call attempted during E2E test")
    return createErrorResponse(ErrorCodes.TEST_MODE_BLOCK, 403, { requestId })
  }

  // Track lock acquisition for cleanup in error handler
  let lockAcquired = false
  let sessionStoreKey = "" // For Claude SDK session persistence (per conversation)
  let concurrencyLockKey = "" // For concurrent request prevention (per tab)

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
      tabId,
      apiKey: userApiKey,
      model: userModel,
      projectId,
      userId,
      additionalContext,
      analyzeImageUrls,
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

    // Check input safety (skip for superadmins - they should never be interrupted)
    if (!user.isSuperadmin) {
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
    } else {
      logger.log("Skipping input safety check (superadmin)")
    }

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
        return createErrorResponse(ErrorCodes.INSUFFICIENT_TOKENS, 402, {
          workspace: resolvedWorkspaceName,
          requestId,
        })
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
      return createErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, 404, {
        host: requestWorkspace || host,
        details: {
          host,
          requestWorkspace,
          error: workspaceError instanceof Error ? workspaceError.message : "Unknown error",
        },
        requestId,
      })
    }

    logInput({
      timestamp: new Date().toISOString(),
      userId: user.id,
      tabId,
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
      return createErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, 404, {
        host: resolvedWorkspaceName,
        requestId,
      })
    }

    // Tab key: used for BOTH Claude SDK session persistence AND concurrency locking
    // Tab is now the primary chat entity - each tab = one independent Claude session
    // Session key and lock key are now the same (both use tabId)
    sessionStoreKey = tabKey({
      userId: user.id,
      workspace: resolvedWorkspaceName,
      tabId,
    })

    // Lock key is now identical to session key (tab-based, not conversation-based)
    concurrencyLockKey = sessionStoreKey

    logger.log(`Domain: ${domainRecord.hostname} (port: ${domainRecord.port}, id: ${domainRecord.domain_id})`)
    logger.log("Session key:", sessionStoreKey)
    logger.log("Lock key:", concurrencyLockKey)
    logger.log("Attempting to lock...")

    if (!tryLockConversation(concurrencyLockKey)) {
      logger.log("❌ LOCK FAILED - Request already in progress for key:", concurrencyLockKey)
      return createErrorResponse(ErrorCodes.CONVERSATION_BUSY, 409, { requestId })
    }

    lockAcquired = true
    logger.log("✅ LOCK ACQUIRED for:", concurrencyLockKey)

    // === CANCELLATION SETUP - MUST BE IMMEDIATELY AFTER LOCK ===
    // CRITICAL: Register cancellation callback RIGHT AFTER lock acquisition.
    // There was a race condition where client could abort during async setup
    // (OAuth, session lookup, etc.) and cancel endpoint would find nothing,
    // leaving the lock held forever → 409 on next request.
    //
    // By registering immediately, cancel endpoint can always find and release the lock.
    const cancelState: CancelState = { requested: false, reader: null }
    const workerAbortController = new AbortController()
    let resolveCancelComplete: (() => void) | null = null

    registerCancellation(requestId, user.id, concurrencyLockKey, () => {
      logger.log("===== CANCEL CALLBACK INVOKED =====")
      logger.log("Cancel callback: lockKey =", concurrencyLockKey, "requestId =", requestId)

      // Return Promise that resolves when onStreamComplete is called
      // CRITICAL: Set resolveCancelComplete BEFORE triggering abort signals,
      // because reader.cancel() synchronously calls onStreamComplete() which
      // needs resolveCancelComplete to already be set!
      return new Promise<void>(resolve => {
        resolveCancelComplete = resolve

        // Now safe to trigger abort - onStreamComplete will find resolveCancelComplete
        cancelState.requested = true
        cancelState.reader?.cancel() // Interrupt blocked read - triggers onStreamComplete
        workerAbortController.abort() // Signal worker pool to cancel (500ms timeout)
        logger.log("Cancel callback: abort signals sent, waiting for cleanup to complete...")
      })
    })
    logger.log("Cancellation registered for requestId:", requestId)

    // Create stream buffer for reconnection support
    // Buffer persists to Redis so users can retrieve missed messages if they disconnect
    try {
      await createStreamBuffer(requestId, sessionStoreKey, user.id, tabId)
      logger.log("Stream buffer created for reconnection support")
    } catch (bufferError) {
      // Non-fatal: continue without buffering if Redis unavailable
      logger.log("Stream buffer creation failed (non-fatal):", bufferError)
    }

    timing("before_session_lookup")
    logger.log(`[SESSION DEBUG] Looking up session for key: ${sessionStoreKey}`)
    const existingSessionId = await SessionStoreMemory.get(sessionStoreKey)
    timing("after_session_lookup")
    logger.log(`[SESSION DEBUG] Existing session: ${existingSessionId ? `found (${existingSessionId})` : "none"}`)

    logger.log("Working directory:", cwd)

    // Force default model for credit users (cost management)
    // API key users can choose any model
    // Exception: eedenlars@gmail.com can use any model
    const isUnrestrictedUser = user.email === "eedenlars@gmail.com"

    // Determine model with proper type validation
    let effectiveModel: ClaudeModel
    if (tokenSource === "workspace" && !isUnrestrictedUser) {
      // ENFORCED for org credits - always use default
      effectiveModel = DEFAULT_MODEL
    } else {
      // User's choice with API key or unrestricted user
      const requestedModel = userModel || env.CLAUDE_MODEL
      effectiveModel = isValidClaudeModel(requestedModel) ? requestedModel : DEFAULT_MODEL
    }

    if (tokenSource === "workspace" && userModel && userModel !== DEFAULT_MODEL && !isUnrestrictedUser) {
      logger.log(`Model override: User requested ${userModel} but forcing ${DEFAULT_MODEL} for org credits`)
    }
    logger.log("Claude model:", effectiveModel)
    logger.log("User isAdmin:", user.isAdmin)
    logger.log("User isSuperadmin:", user.isSuperadmin)

    // Check if this is a superadmin accessing the Bridge workspace
    const isSuperadminWorkspace = resolvedWorkspaceName === SUPERADMIN.WORKSPACE_NAME && user.isSuperadmin
    if (isSuperadminWorkspace) {
      logger.log("🔓 SUPERADMIN MODE: Bridge workspace access granted")
    }

    // Admins (and superadmins who inherit admin) get 2x maxTurns
    const maxTurns = user.isAdmin ? DEFAULTS.CLAUDE_MAX_TURNS * 2 : DEFAULTS.CLAUDE_MAX_TURNS

    logger.log("Max turns limit:", maxTurns, user.isAdmin ? "(admin 2x)" : "")

    // Fetch OAuth tokens and user env keys in parallel for performance
    const [oauthResult, userEnvKeysResult] = await Promise.all([
      fetchOAuthTokens(user.id, logger),
      fetchUserEnvKeys(user.id, logger),
    ])

    const { tokens: oauthTokens, warnings: oauthWarnings } = oauthResult
    const { envKeys: userEnvKeys } = userEnvKeysResult
    const hasStripeConnection = !!oauthTokens.stripe
    const hasGmailConnection = !!oauthTokens.gmail

    // Log warnings for debugging
    if (oauthWarnings.length > 0) {
      logger.log(`OAuth warnings: ${oauthWarnings.map(w => w.provider).join(", ")}`)
    }

    // Detect if workspace is running in production mode (build) vs dev mode
    const serveMode = detectServeMode(cwd)
    const isProductionMode = serveMode === "build"
    logger.log(`Serve mode: ${serveMode} (isProduction: ${isProductionMode})`)

    // Handle analyze mode images: fetch from photobook and save to workspace
    // This allows Claude to use the Read tool to visually analyze the images
    let finalMessage = message
    if (analyzeImageUrls && analyzeImageUrls.length > 0) {
      logger.log(`Fetching ${analyzeImageUrls.length} analyze image(s)...`)
      timing("before_fetch_analyze_images")

      // Build base URL from request origin or host
      const protocol = req.headers.get("x-forwarded-proto") || "https"
      const baseUrl = origin || `${protocol}://${host}`

      const savedImages = await fetchAndSaveAnalyzeImages(analyzeImageUrls, cwd, baseUrl)
      timing("after_fetch_analyze_images")

      if (savedImages.length > 0) {
        logger.log(`Saved ${savedImages.length} image(s) for analysis`)
        finalMessage = buildAnalyzeImagePrompt(message, savedImages)
      } else {
        logger.log("No images were successfully fetched for analysis")
      }
    }

    const systemPrompt = getSystemPrompt({
      projectId,
      userId,
      workspaceFolder: cwd,
      hasStripeMcpAccess: hasStripeMcpAccess(resolvedWorkspaceName, hasStripeConnection),
      hasGmailAccess: hasGmailConnection,
      additionalContext,
      isProduction: isProductionMode,
    })

    logger.log("Spawning child process runner")

    // Get session cookie value to pass to child process for API authentication
    // Validates JWT format to prevent "jwt malformed" errors in MCP tools
    const sessionCookie = await getSafeSessionCookie(`[Claude Stream ${requestId}]`)

    let childStream: ReadableStream<Uint8Array>

    if (WORKER_POOL.ENABLED) {
      // === PERSISTENT WORKER POOL ===
      // Reuses workers between requests for faster response times
      logger.log("Using persistent worker pool")

      // Get workspace credentials from directory ownership
      // SUPERADMIN: Skip credentials - run as root (uid/gid = 0)
      let credentials: { uid: number; gid: number; cwd: string; workspaceKey: string }
      if (isSuperadminWorkspace) {
        logger.log("🔓 SUPERADMIN: Running as root (uid=0, gid=0)")
        credentials = {
          uid: 0,
          gid: 0,
          cwd,
          workspaceKey: resolvedWorkspaceName,
        }
      } else {
        const st = statSync(cwd)
        credentials = {
          uid: st.uid,
          gid: st.gid,
          cwd,
          workspaceKey: resolvedWorkspaceName,
        }
      }

      // Build agent config to pass to worker (worker doesn't import from apps/web)
      // Note: Internal MCP servers (alive-workspace, alive-tools) are created locally
      // in the worker because createSdkMcpServer returns function objects that cannot
      // be serialized via IPC. Only OAuth HTTP servers are passed here.
      const allowedTools = getAllowedTools(cwd, user.isAdmin, isSuperadminWorkspace)
      const disallowedTools = getDisallowedTools(user.isAdmin, isSuperadminWorkspace)

      // Log admin/superadmin tools for debugging
      if (isSuperadminWorkspace) {
        const hasTask = allowedTools.includes("Task")
        const hasWebSearch = allowedTools.includes("WebSearch")
        logger.log(
          `🔓 SUPERADMIN tools: Task=${hasTask}, WebSearch=${hasWebSearch}, allowedCount=${allowedTools.length}, disallowedCount=${disallowedTools.length}`,
        )
      } else if (user.isAdmin) {
        const hasBash = allowedTools.includes("Bash")
        logger.log(
          `Admin tools: Bash=${hasBash}, allowedCount=${allowedTools.length}, disallowedCount=${disallowedTools.length}`,
        )
      }

      const agentConfig = {
        allowedTools,
        disallowedTools,
        permissionMode: PERMISSION_MODE,
        settingSources: SETTINGS_SOURCES,
        oauthMcpServers: getOAuthMcpServers(oauthTokens) as Record<string, unknown>,
        bridgeStreamTypes: BRIDGE_STREAM_TYPES,
        isAdmin: user.isAdmin, // Pass to worker for permission checks
        isSuperadmin: isSuperadminWorkspace, // Superadmin has all tools, runs as root
      }

      const pool = getWorkerPool()
      timing("before_worker_pool_query")

      // Convert worker pool callback API to ReadableStream for compatibility with createNDJSONStream
      let firstMessageReceived = false
      childStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            await pool.query(credentials, {
              requestId,
              payload: {
                message: finalMessage,
                model: effectiveModel,
                maxTurns: maxTurns,
                resume: existingSessionId || undefined,
                systemPrompt,
                apiKey: userApiKey || undefined,
                oauthTokens,
                userEnvKeys, // User-defined environment keys for MCP servers
                agentConfig,
                sessionCookie, // Required for MCP tools to authenticate API calls
              },
              onMessage: (msg: WorkerToParentMessage) => {
                // Track first message timing
                if (!firstMessageReceived) {
                  firstMessageReceived = true
                  timing("first_message_from_worker")
                }
                // Convert worker message to NDJSON line
                if (msg.type === "message" && "content" in msg) {
                  const line = `${JSON.stringify(msg.content)}\n`
                  controller.enqueue(new TextEncoder().encode(line))
                } else if (msg.type === "complete" && "result" in msg) {
                  const line = `${JSON.stringify(msg.result)}\n`
                  controller.enqueue(new TextEncoder().encode(line))
                } else if (msg.type === "session" && "sessionId" in msg) {
                  // Session ID is handled internally by the NDJSON stream handler
                  // but we still need to emit it for session storage
                  logger.log(`[SESSION DEBUG] Received session from worker: ${msg.sessionId}`)
                  const sessionLine = `${JSON.stringify({
                    type: BRIDGE_STREAM_TYPES.SESSION,
                    sessionId: msg.sessionId,
                  })}\n`
                  controller.enqueue(new TextEncoder().encode(sessionLine))
                  logger.log("[SESSION DEBUG] Enqueued bridge_session line to childStream")
                }
              },
              signal: workerAbortController.signal,
            })
            controller.close()
          } catch (err) {
            logger.error("Worker pool query failed:", err)
            controller.error(err)
          }
        },
        cancel() {
          // Stream cancelled (e.g., client disconnect)
          // Note: Main cancellation path is via workerAbortController.abort() in the
          // cancellation callback. This is a fallback for direct stream cancellation.
          cancelState.requested = true
          workerAbortController.abort()
        },
      })
    } else {
      // === SPAWN-PER-REQUEST (LEGACY) ===
      logger.log("Spawning child process runner")
      if (isSuperadminWorkspace) {
        logger.log("🔓 SUPERADMIN tools (legacy): isSuperadmin=true")
      } else if (user.isAdmin) {
        logger.log(`Admin tools (legacy): isAdmin=${user.isAdmin}`)
      }

      childStream = runAgentChild(cwd, {
        message: finalMessage,
        model: effectiveModel,
        maxTurns: maxTurns,
        resume: existingSessionId || undefined,
        systemPrompt,
        apiKey: userApiKey || undefined,
        sessionCookie,
        oauthTokens, // OAuth tokens for connected MCP providers (stripe, linear, etc.)
        isAdmin: user.isAdmin, // Enable Bash tools for admins
        isSuperadmin: isSuperadminWorkspace, // Superadmin has all tools, runs as root
      })
    }

    // Create NDJSON stream from child process output
    // Handles: NDJSON parsing, session ID storage, credit charging, error handling, cancellation
    const ndjsonStream = createNDJSONStream({
      childStream,
      conversationKey: sessionStoreKey, // For Claude SDK session persistence
      requestId,
      tabId, // Tab ID for routing responses to correct tab
      conversationWorkspace: resolvedWorkspaceName,
      tokenSource,
      model: effectiveModel, // For model-specific credit calculation
      cancelState, // Pass shared cancellation state
      oauthWarnings, // OAuth warnings to inject into stream
      onMessage: message => {
        // Buffer each message for reconnection support (non-blocking)
        appendToStreamBuffer(requestId, JSON.stringify(message)).catch(err => {
          logger.log("Failed to buffer message (non-fatal):", err)
        })
      },
      onStreamComplete: () => {
        // Guaranteed cleanup: unregister, unlock, mark buffer complete
        unregisterCancellation(requestId)
        unlockConversation(concurrencyLockKey)

        // Mark buffer as complete (non-blocking)
        completeStreamBuffer(requestId).catch(err => {
          logger.log("Failed to complete buffer (non-fatal):", err)
        })

        // Resolve cancel Promise if cancel was requested
        // This signals to the cancel endpoint that cleanup is complete
        if (resolveCancelComplete) {
          logger.log("Resolving cancel completion Promise")
          resolveCancelComplete()
          resolveCancelComplete = null
        }

        logger.log("Released conversation lock, unregistered cancellation, completed buffer")
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
        unlockConversation(concurrencyLockKey)
        logger.log("Released lock after error")

        // Mark buffer as errored (non-blocking)
        errorStreamBuffer(requestId, outerError instanceof Error ? outerError.message : "Unknown error").catch(err => {
          logger.log("Failed to mark buffer as errored (non-fatal):", err)
        })
      } catch (unlockError) {
        logger.error("Failed to unlock conversation in error handler:", unlockError)
      }
    }

    const origin = req.headers.get("origin")
    const errorRes = createErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, 500, {
      details: { message: outerError instanceof Error ? outerError.message : "Unknown error" },
      requestId,
    })
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
