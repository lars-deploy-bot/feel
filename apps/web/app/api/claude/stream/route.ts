import { statSync } from "node:fs"
import * as Sentry from "@sentry/nextjs"
import {
  DEFAULTS,
  isRetiredModel,
  isValidClaudeModel,
  resolveStreamMode,
  STREAM_MODES,
  STREAM_SYNTHETIC_MESSAGE_TYPES,
  type StreamMode,
  SUPERADMIN,
  WORKER_POOL,
} from "@webalive/shared"
import { getWorkerPool, type QueuedInfo, type WorkerToParentMessage } from "@webalive/worker-pool"
import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import {
  AuthenticationError,
  getSafeSessionCookie,
  requireSessionUser,
  verifyWorkspaceAccess,
} from "@/features/auth/lib/auth"
import {
  sessionStore,
  type TabSessionKey,
  tabKey,
  tryLockConversation,
  unlockConversation,
} from "@/features/auth/lib/sessionStore"
import { hasSessionCookie } from "@/features/auth/types/guards"
import { isInputSafeWithDebug } from "@/features/chat/lib/formatMessage"
import {
  BridgeInterruptSource,
  createDoneMessage,
  createInterruptMessage,
  encodeNDJSON,
} from "@/features/chat/lib/streaming/ndjson"
import { getSystemPrompt } from "@/features/chat/lib/systemPrompt"
import { ensureWorkspaceSchema } from "@/features/workspace/lib/ensure-workspace-schema"
import { resolveWorkspace } from "@/features/workspace/lib/workspace-utils"
import { getValidAccessToken, hasOAuthCredentials } from "@/lib/anthropic-oauth"
import { structuredErrorResponse } from "@/lib/api/responses"
import { COOKIE_NAMES } from "@/lib/auth/cookies"
import {
  getAllowedTools,
  getDisallowedTools,
  getOAuthMcpServers,
  hasStripeMcpAccess,
  SETTINGS_SOURCES,
  STREAM_TYPES,
} from "@/lib/claude/agent-constants.mjs"
import { addCorsHeaders } from "@/lib/cors-utils"
import { DOMAIN_RUNTIME_SELECT, resolveDomainRuntimeQuery } from "@/lib/domain/resolve-domain-runtime"
import { env } from "@/lib/env"
import { ErrorCodes } from "@/lib/error-codes"
import { buildAnalyzeImagePrompt, fetchAndSaveAnalyzeImages } from "@/lib/image-analyze/fetch-and-save"
import { logInput } from "@/lib/input-logger"
import { fetchOAuthTokens } from "@/lib/oauth/fetch-oauth-tokens"
import { fetchUserEnvKeys } from "@/lib/oauth/fetch-user-env-keys"
import { getRequestId } from "@/lib/request-id"
import { createRequestLogger } from "@/lib/request-logger"
import { getRuntimeAccessDecision } from "@/lib/runtime/authorization"
import { consumeCancelIntent, consumeCancelIntentByRequestId } from "@/lib/stream/cancel-intent-registry"
import { registerCancellation, startTTLCleanup, unregisterCancellation } from "@/lib/stream/cancellation-registry"
import { type CancelState, createNDJSONStream } from "@/lib/stream/ndjson-stream-handler"
import {
  appendToStreamBuffer,
  completeStreamBuffer,
  createStreamBuffer,
  errorStreamBuffer,
} from "@/lib/stream/stream-buffer"
import { createAppClient } from "@/lib/supabase/app"
import { createRLSAppClient } from "@/lib/supabase/server-rls"
import type { TokenSource } from "@/lib/tokens"
import { getOrgCredits } from "@/lib/tokens"
import { runAgentChild } from "@/lib/workspace-execution/agent-child-runner"
import { BodySchema } from "@/types/guards/api"
import { logRetryContract } from "./retry-observability"

export const runtime = "nodejs"

// Start TTL cleanup on server start (once)
startTTLCleanup()

function createImmediateInterruptResponse(requestId: string, tabId?: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const interrupt = createInterruptMessage(requestId, BridgeInterruptSource.CLIENT_CANCEL)
      const done = createDoneMessage(requestId)

      if (tabId) {
        interrupt.tabId = tabId
        done.tabId = tabId
      }

      controller.enqueue(encodeNDJSON(interrupt))
      controller.enqueue(encodeNDJSON(done))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Request-Id": requestId,
      "Access-Control-Expose-Headers": "X-Request-Id",
    },
  })
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req)
  const logger = createRequestLogger("Claude Stream", requestId)
  const startTime = Date.now()
  const timing = (label: string) => logger.log(`[TIMING] ${label}: +${Date.now() - startTime}ms`)

  logger.log("=== STREAM REQUEST START ===")
  timing("request_received")

  // Defense-in-depth: Block real API calls during E2E tests
  if (process.env.PLAYWRIGHT_TEST === "true") {
    logger.error("⛔ BLOCKED: Real API call attempted during E2E test")
    return structuredErrorResponse(ErrorCodes.TEST_MODE_BLOCK, { status: 403, details: { requestId } })
  }

  // Track lock acquisition for cleanup in error handler
  let lockAcquired = false
  let sessionKey: TabSessionKey | null = null // Tab session key: used for BOTH session persistence AND lock

  const cleanupLockedStreamAfterError = (context: string, errorMessage: string) => {
    const sessionKeyForCleanup = sessionKey
    if (!lockAcquired || !sessionKeyForCleanup) {
      return
    }

    const runCleanupStep = (step: string, fn: () => void) => {
      try {
        fn()
      } catch (cleanupError) {
        logger.error(`Failed to ${step} after ${context}:`, cleanupError)
      }
    }

    runCleanupStep("unregister cancellation", () => {
      unregisterCancellation(requestId)
    })

    runCleanupStep("unlock conversation", () => {
      unlockConversation(sessionKeyForCleanup)
    })

    runCleanupStep("mark stream buffer as errored", () => {
      errorStreamBuffer(requestId, errorMessage).catch(err => {
        logger.log("Failed to mark buffer as errored (non-fatal):", err)
      })
    })

    lockAcquired = false
    logger.log(`Finished locked-stream cleanup after ${context}`)
  }

  try {
    const jar = await cookies()
    logger.log("Checking session cookie...")

    if (!hasSessionCookie(jar.get(COOKIE_NAMES.SESSION))) {
      logger.log("No session cookie found")
      return structuredErrorResponse(ErrorCodes.NO_SESSION, { status: 401, details: { requestId } })
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
      return structuredErrorResponse(ErrorCodes.INVALID_JSON, {
        status: 400,
        details: { error: jsonError instanceof Error ? jsonError.message : "Unknown JSON parse error", requestId },
      })
    }

    // Validate request body
    const parseResult = BodySchema.safeParse(body)
    if (!parseResult.success) {
      logger.error("Schema validation failed:", parseResult.error.issues)
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { issues: parseResult.error.issues, requestId },
      })
    }

    const {
      message,
      workspace: requestWorkspace,
      worktree,
      conversationId,
      tabGroupId,
      tabId,
      model: userModel,
      voiceLanguage,
      projectId,
      additionalContext,
      analyzeImageUrls,
      streamMode: rawStreamMode,
      resumeSessionAt,
    } = parseResult.data
    logger.log("Conversation:", conversationId)
    logger.log(
      `Message received (${message.length} chars): ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
    )
    if (userModel) {
      logger.log("Using user-selected model:", userModel)
    }

    // Check input safety (skip for superadmins - they should never be interrupted)
    if (!user.isSuperadmin) {
      logger.log("Checking input safety...")
      const safetyCheck = await isInputSafeWithDebug(message)
      if (safetyCheck.result === "unsafe") {
        logger.log(`Input flagged as unsafe. Model response: "${safetyCheck.debug.rawContent?.slice(0, 200)}"`)
        return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
          status: 400,
          details: { field: "message content", requestId },
        })
      }
      logger.log("Input safety check passed")
    } else {
      logger.log("Skipping input safety check (superadmin)")
    }

    const host = (await headers()).get("host")
    if (!host) {
      return structuredErrorResponse(ErrorCodes.INVALID_REQUEST, {
        status: 400,
        details: { field: "Host header", requestId },
      })
    }
    const origin = req.headers.get("origin")
    logger.log("Host:", host)

    let cwd: string
    let resolvedWorkspaceName: string | null
    let tokenSource: TokenSource
    let oauthAccessToken: string | null = null

    try {
      // Security: Verify workspace authorization BEFORE resolving paths
      resolvedWorkspaceName = await verifyWorkspaceAccess(user, body, `[Claude Stream ${requestId}]`)

      if (!resolvedWorkspaceName) {
        return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_AUTHENTICATED, { status: 401, details: { requestId } })
      }
      logger.log("Workspace authentication verified for:", resolvedWorkspaceName)

      // Only after authorization, resolve workspace path
      const workspaceResult = await resolveWorkspace({ ...body, workspace: requestWorkspace }, requestId, origin)
      if (!workspaceResult.success) {
        return workspaceResult.response
      }
      cwd = workspaceResult.workspace

      // Ensure workspace has required directory structure (.alive/files, etc.)
      await ensureWorkspaceSchema(cwd)

      // Step 1: Resolve authentication from trusted sources only.
      // Never rely on workspace-local .env files for auth discovery.
      if (!hasOAuthCredentials()) {
        logger.log("No OAuth credentials available")
        return structuredErrorResponse(ErrorCodes.OAUTH_CONFIG_ERROR, {
          status: 503,
          details: { provider: "Anthropic", workspace: resolvedWorkspaceName, requestId },
        })
      }

      // OAuth: refresh if needed, then pass resolved access token explicitly.
      // Runtime auth must only come from trusted token storage, never request/body keys.
      logger.log("Using OAuth credentials from secure token store")
      try {
        const oauthResult = await getValidAccessToken()
        if (!oauthResult) {
          logger.log("OAuth credentials missing or unreadable")
          return structuredErrorResponse(ErrorCodes.OAUTH_EXPIRED, {
            status: 503,
            details: { workspace: resolvedWorkspaceName, requestId },
          })
        }
        if (oauthResult.refreshed) {
          logger.log("OAuth token was expired and has been refreshed")
        }
        oauthAccessToken = oauthResult.accessToken
      } catch (refreshError) {
        logger.error("OAuth token refresh failed:", refreshError)
        Sentry.captureException(refreshError)
        return structuredErrorResponse(ErrorCodes.OAUTH_EXPIRED, {
          status: 503,
          details: { workspace: resolvedWorkspaceName, requestId },
        })
      }

      // Step 2: Determine billing (workspace credits vs OAuth/no-credit path)
      const orgCredits = await getOrgCredits(resolvedWorkspaceName)
      const COST_ESTIMATE = 1

      if (orgCredits !== null && orgCredits >= COST_ESTIMATE) {
        tokenSource = "workspace"
        logger.log(`Billing: workspace credits (${orgCredits} available)`)
      } else {
        // Using OAuth - no credit deduction (also handles transient credit lookup failures)
        tokenSource = "user_provided"
        if (orgCredits === null) {
          logger.warn("Credit lookup failed for workspace, falling back to OAuth:", resolvedWorkspaceName)
        } else {
          logger.log(`Billing: OAuth (no credit deduction, workspace has ${orgCredits} credits)`)
        }
      }
    } catch (workspaceError) {
      logger.error("Workspace resolution failed:", workspaceError)
      Sentry.captureException(workspaceError)
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, {
        status: 404,
        details: {
          host: requestWorkspace || host,
          requestWorkspace,
          requestFailed: true,
          requestId,
        },
      })
    }

    if (!oauthAccessToken) {
      logger.error("OAuth access token resolution failed")
      return structuredErrorResponse(ErrorCodes.OAUTH_EXPIRED, {
        status: 503,
        details: { workspace: resolvedWorkspaceName ?? requestWorkspace ?? host, requestId },
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
    const app = user.isSuperadmin ? await createAppClient("service") : await createRLSAppClient()
    const domainRecord = await resolveDomainRuntimeQuery(
      resolvedWorkspaceName,
      app.from("domains").select(DOMAIN_RUNTIME_SELECT).eq("hostname", resolvedWorkspaceName).single(),
    )

    if (!domainRecord) {
      logger.error("Domain not found in database:", resolvedWorkspaceName)
      return structuredErrorResponse(ErrorCodes.WORKSPACE_NOT_FOUND, {
        status: 404,
        details: { host: resolvedWorkspaceName, requestId },
      })
    }

    // Session key: each tab = one independent Claude session
    sessionKey = tabKey({
      userId: user.id,
      workspace: resolvedWorkspaceName,
      worktree,
      tabGroupId,
      tabId,
    })

    logger.log(
      `Domain: ${domainRecord.hostname} (port: ${domainRecord.port}, id: ${domainRecord.domain_id}, mode: ${domainRecord.execution_mode})`,
    )
    logger.log("Session key:", sessionKey)
    logger.log("Attempting to lock...")

    if (!tryLockConversation(sessionKey)) {
      logger.log("❌ LOCK FAILED - Request already in progress for key:", sessionKey)
      return structuredErrorResponse(ErrorCodes.CONVERSATION_BUSY, { status: 409, details: { requestId } })
    }

    lockAcquired = true
    logger.log("✅ LOCK ACQUIRED for:", sessionKey)

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

    registerCancellation(requestId, user.id, sessionKey, () => {
      logger.log("===== CANCEL CALLBACK INVOKED =====")
      logger.log("Cancel callback: lockKey =", sessionKey, "requestId =", requestId)

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

    // Super-early stop race fix:
    // If cancel endpoint was hit before registration, consume queued intent now
    // and short-circuit this request before any expensive setup starts.
    const startupConsumeResults = await Promise.allSettled([
      consumeCancelIntent(sessionKey, user.id),
      consumeCancelIntentByRequestId(requestId, user.id),
    ])
    const consumedConversationIntent = startupConsumeResults[0].status === "fulfilled" && startupConsumeResults[0].value
    const consumedRequestIntent = startupConsumeResults[1].status === "fulfilled" && startupConsumeResults[1].value
    if (startupConsumeResults.some(r => r.status === "rejected")) {
      logger.warn("Cancel-intent check degraded during startup; continuing with partial results")
    }
    if (consumedConversationIntent || consumedRequestIntent) {
      logger.log("Queued cancel intent detected immediately after registration, short-circuiting stream startup")
      unregisterCancellation(requestId)
      unlockConversation(sessionKey)
      lockAcquired = false
      return createImmediateInterruptResponse(requestId, tabId)
    }

    // Create stream buffer for reconnection support
    // Buffer persists to Redis so users can retrieve missed messages if they disconnect
    try {
      await createStreamBuffer(requestId, sessionKey, user.id, tabId)
      logger.log("Stream buffer created for reconnection support")
    } catch (bufferError) {
      // Non-fatal: continue without buffering if Redis unavailable
      logger.log("Stream buffer creation failed (non-fatal):", bufferError)
    }

    // Session resume flow:
    // 1. Look up SDK session ID from our Supabase store (keyed by user+workspace+tab)
    // 2. Pass it as `resume` to the worker pool → SDK resumes the conversation
    // 3. SDK loads the session JSONL from CLAUDE_CONFIG_DIR/projects/
    // 4. If the JSONL file is missing, SDK throws "No conversation found"
    //    → caught below in SESSION RECOVERY, clears stale ID, retries fresh
    timing("before_session_lookup")
    logger.log(`[SESSION DEBUG] Looking up session for key: ${sessionKey}`)
    let existingSessionId: string | null
    try {
      existingSessionId = await sessionStore.get(sessionKey)
    } catch (sessionLookupError) {
      logger.error("[SESSION DEBUG] Session lookup failed:", sessionLookupError)
      throw new Error(
        `[SESSION LOOKUP FAILED] ${
          sessionLookupError instanceof Error ? sessionLookupError.message : String(sessionLookupError)
        }`,
      )
    }
    timing("after_session_lookup")
    logger.log(`[SESSION DEBUG] Existing session: ${existingSessionId ? `found (${existingSessionId})` : "none"}`)

    logger.log("Working directory:", cwd)

    // Resolve and validate the requested model.
    // Admins can use any valid model. Other users on org credits need explicit access.
    const requestedModel = userModel ?? env.CLAUDE_MODEL
    if (!isValidClaudeModel(requestedModel)) {
      const code = isRetiredModel(requestedModel) ? ErrorCodes.MODEL_NOT_AVAILABLE : ErrorCodes.MODEL_INVALID
      return structuredErrorResponse(code, {
        status: 400,
        details: { requestId, model: requestedModel, retired: isRetiredModel(requestedModel) },
      })
    }

    logger.log("Claude model:", requestedModel)
    logger.log("User isAdmin:", user.isAdmin)
    logger.log("User isSuperadmin:", user.isSuperadmin)

    // Check if this is a superadmin accessing the Alive workspace
    const isSuperadminWorkspace = resolvedWorkspaceName === SUPERADMIN.WORKSPACE_NAME && user.isSuperadmin
    if (isSuperadminWorkspace) {
      logger.log("🔓 SUPERADMIN MODE: Alive workspace access granted")
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
    const hasOutlookConnection = !!oauthTokens.outlook
    // TODO(calendar): detect oauthTokens.outlook_calendar when Outlook calendar MCP is wired

    // Log warnings for debugging
    if (oauthWarnings.length > 0) {
      logger.log(`OAuth warnings: ${oauthWarnings.map(w => w.provider).join(", ")}`)
    }

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

    // Build list of connected email providers for provider-aware prompt guidance
    const connectedEmailProviders: Array<"gmail" | "outlook"> = []
    if (hasGmailConnection) connectedEmailProviders.push("gmail")
    if (hasOutlookConnection) connectedEmailProviders.push("outlook")

    const systemPrompt = getSystemPrompt({
      projectId,
      hasStripeMcpAccess: hasStripeMcpAccess(resolvedWorkspaceName, hasStripeConnection),
      connectedEmailProviders,
      additionalContext,
      voiceLanguage,
    })

    logger.log("Spawning child process runner")

    // Get session cookie value to pass to child process for API authentication
    // Validates JWT format to prevent "jwt malformed" errors in MCP tools
    const sessionCookie = await getSafeSessionCookie(`[Claude Stream ${requestId}]`)

    let childStream: ReadableStream<Uint8Array>

    // Stream mode: determines tool availability and SDK permission mode
    const requestedStreamMode: StreamMode = rawStreamMode ?? "default"
    const streamMode = resolveStreamMode(requestedStreamMode, {
      isAdmin: user.isAdmin,
      isSuperadmin: user.isSuperadmin,
    })
    if (requestedStreamMode !== streamMode) {
      logger.log(`Stream mode fallback: requested=${requestedStreamMode}, effective=${streamMode}`)
    }
    const modeConfig = STREAM_MODES[streamMode]
    const effectivePermissionMode = modeConfig.permissionMode
    if (streamMode !== "default") {
      logger.log(`Stream mode: ${streamMode} (permission: ${effectivePermissionMode})`)
    }

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
      // Note: Internal MCP servers (alive-workspace, alive-sandboxed-fs, alive-tools) are created locally
      // in the worker because createSdkMcpServer returns function objects that cannot
      // be serialized via IPC. Only OAuth HTTP servers are passed here.
      const allowedTools = getAllowedTools(cwd, user.isAdmin, user.isSuperadmin, isSuperadminWorkspace, streamMode)
      const disallowedTools = getDisallowedTools(user.isAdmin, user.isSuperadmin, streamMode, isSuperadminWorkspace)

      if (streamMode !== "default") {
        logger.log(`${streamMode} mode: ${allowedTools.length} tools available under registry policy`)
      }

      const oauthMcpServers: Record<string, unknown> = {}
      if (modeConfig.mcpEnabled) {
        const rawOauthMcpServers = getOAuthMcpServers(oauthTokens)
        if (rawOauthMcpServers && typeof rawOauthMcpServers === "object") {
          for (const [providerKey, providerConfig] of Object.entries(rawOauthMcpServers)) {
            oauthMcpServers[providerKey] = providerConfig
          }
        }
      }

      const agentConfig = {
        allowedTools,
        disallowedTools,
        permissionMode: effectivePermissionMode,
        settingSources: SETTINGS_SOURCES,
        oauthMcpServers,
        streamTypes: STREAM_TYPES,
        streamMode, // Pass stream mode to worker
        isAdmin: user.isAdmin, // Pass to worker for permission checks
        isSuperadmin: user.isSuperadmin, // Superadmin gets elevated tool policy
        isSuperadminWorkspace, // Whether accessing the alive workspace specifically
      }

      const pool = getWorkerPool()
      timing("before_worker_pool_query")

      // Convert worker pool callback API to ReadableStream for compatibility with createNDJSONStream
      let firstMessageReceived = false
      childStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const runtimeAccess = getRuntimeAccessDecision(user, resolvedWorkspaceName, true)

          // Helper to run query with given resume session and optional message position
          const runQuery = async (resumeId: string | undefined, resumeAtMessage: string | undefined) => {
            return pool.query(credentials, {
              requestId,
              ownerKey: user.id,
              workloadClass: "chat",
              payload: {
                message: finalMessage,
                model: requestedModel,
                maxTurns: maxTurns,
                resume: resumeId,
                resumeSessionAt: resumeAtMessage,
                systemPrompt,
                oauthAccessToken,
                oauthTokens,
                userEnvKeys, // User-defined environment keys for MCP servers
                agentConfig,
                sessionCookie, // Required for MCP tools to authenticate API calls
                runtimeAccess,
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
                    type: STREAM_TYPES.SESSION,
                    sessionId: msg.sessionId,
                  })}\n`
                  controller.enqueue(new TextEncoder().encode(sessionLine))
                  logger.log("[SESSION DEBUG] Enqueued stream_session line to childStream")
                }
              },
              onQueued: (info: QueuedInfo) => {
                const queueLine = `${JSON.stringify({
                  type: STREAM_SYNTHETIC_MESSAGE_TYPES.QUEUED,
                  reason: info.reason,
                  position: info.position,
                })}\n`
                controller.enqueue(new TextEncoder().encode(queueLine))
                logger.log(`[QUEUE] Request queued: reason=${info.reason} position=${info.position}`)
              },
              signal: workerAbortController.signal,
            })
          }

          try {
            await runQuery(existingSessionId || undefined, resumeSessionAt || undefined)
            controller.close()
          } catch (err) {
            const getObjectProperty = (value: unknown, key: string): unknown => {
              if (!value || typeof value !== "object") {
                return undefined
              }
              return Reflect.get(value, key)
            }

            const buildCombinedErrorMessage = (error: unknown): string => {
              const baseMessage = error instanceof Error ? error.message : String(error)
              const stderrValue = getObjectProperty(error, "stderr")
              const stderr = typeof stderrValue === "string" ? stderrValue : ""
              const diagnostics = getObjectProperty(error, "diagnostics")

              const diagnosticHints: string[] = []
              if (diagnostics && typeof diagnostics === "object") {
                const failureType = getObjectProperty(diagnostics, "failureType")
                const phase = getObjectProperty(diagnostics, "phase")
                const stderrExcerpt = getObjectProperty(diagnostics, "stderrExcerpt")
                if (typeof failureType === "string" && typeof phase === "string") {
                  diagnosticHints.push(`${failureType}:${phase}`)
                }
                if (typeof stderrExcerpt === "string") {
                  diagnosticHints.push(stderrExcerpt)
                }
                const surfacedErrorMessage = getObjectProperty(diagnostics, "surfacedErrorMessage")
                if (typeof surfacedErrorMessage === "string") {
                  diagnosticHints.push(surfacedErrorMessage)
                }
                const originalErrorMessage = getObjectProperty(diagnostics, "originalErrorMessage")
                if (typeof originalErrorMessage === "string") {
                  diagnosticHints.push(originalErrorMessage)
                }
                const queryResultErrors = getObjectProperty(diagnostics, "queryResultErrors")
                if (Array.isArray(queryResultErrors)) {
                  const stringErrors = queryResultErrors.filter((item): item is string => typeof item === "string")
                  diagnosticHints.push(...stringErrors)
                }
              } else if (Array.isArray(diagnostics)) {
                for (const item of diagnostics) {
                  if (typeof item === "string") {
                    diagnosticHints.push(item)
                  }
                }
              }

              return [baseMessage, stderr, ...diagnosticHints].filter(Boolean).join(" ")
            }

            // Error recovery for stale session/message references
            // The error may come as "agent process exited with code 1" with the actual
            // error message in stderr, so we check both
            const stderrValue = getObjectProperty(err, "stderr")
            const stderrMessage = typeof stderrValue === "string" ? stderrValue : ""
            const combinedMessage = buildCombinedErrorMessage(err)

            // NEW: Check for "message not found" error (stale resumeSessionAt)
            // This happens when the frontend sends a message ID that no longer exists in the session
            const isMessageNotFound = combinedMessage.includes("No message found with message.uuid of")

            if (isMessageNotFound && resumeSessionAt && existingSessionId && sessionKey) {
              logger.log(
                `[MESSAGE RECOVERY] Message "${resumeSessionAt}" not found in session "${existingSessionId}", retrying without resumeSessionAt...`,
              )
              try {
                // Retry with session but WITHOUT resumeSessionAt - start from session beginning
                await runQuery(existingSessionId, undefined)
                logRetryContract(logger, {
                  retry_attempted: true,
                  retry_reason: "stale_message",
                  retry_outcome: "success",
                })
                controller.close()
                return
              } catch (retryErr) {
                // If that also fails, check if it's a session not found error
                const retryCombined = buildCombinedErrorMessage(retryErr)
                const isSessionNotFoundOnRetry =
                  retryCombined.includes("No conversation found") ||
                  (retryCombined.includes("session") && retryCombined.includes("not found"))

                if (isSessionNotFoundOnRetry) {
                  logger.log(
                    `[SESSION RECOVERY] Session "${existingSessionId}" also not found, clearing and starting fresh...`,
                  )
                  try {
                    try {
                      await sessionStore.delete(sessionKey)
                    } catch (deleteError) {
                      logRetryContract(logger, {
                        retry_attempted: true,
                        retry_reason: "stale_message",
                        retry_outcome: "failed",
                      })
                      logger.error("[SESSION RECOVERY] Failed to clear stale session:", deleteError)
                      controller.error(deleteError)
                      return
                    }
                    await runQuery(undefined, undefined)
                    logRetryContract(logger, {
                      retry_attempted: true,
                      retry_reason: "stale_message",
                      retry_outcome: "success",
                    })
                    controller.close()
                    return
                  } catch (finalErr) {
                    logRetryContract(logger, {
                      retry_attempted: true,
                      retry_reason: "stale_message",
                      retry_outcome: "failed",
                    })
                    logger.error("[SESSION RECOVERY] Final retry failed:", finalErr)
                    controller.error(finalErr)
                    return
                  }
                }

                logRetryContract(logger, {
                  retry_attempted: true,
                  retry_reason: "stale_message",
                  retry_outcome: "failed",
                })
                logger.error("[MESSAGE RECOVERY] Retry without message failed:", retryErr)
                controller.error(retryErr)
                return
              }
            }

            // Check for "tool use concurrency issues" (corrupt session state — pending tool_use without tool_result)
            // Anthropic returns 400 when resuming a session with unresolved tool calls.
            // Don't auto-recover (would lose context). Instead clear the session and tell the
            // frontend so it can offer "continue in new tab" with conversation history.
            const isToolConcurrency = combinedMessage.includes("tool use concurrency")

            if (isToolConcurrency && existingSessionId && sessionKey) {
              logRetryContract(logger, {
                retry_attempted: false,
                retry_reason: "not_applicable",
                retry_outcome: "not_attempted",
              })
              logger.log(
                `[SESSION CORRUPT] Tool use concurrency error on session "${existingSessionId}", clearing session and notifying frontend`,
              )
              await sessionStore.delete(sessionKey)
              controller.error(
                new Error(
                  JSON.stringify({
                    ok: false,
                    error: ErrorCodes.SESSION_CORRUPT,
                    message:
                      "This conversation's session got interrupted during a tool call and can't be resumed. You can continue in a new tab with your conversation history.",
                  }),
                ),
              )
              return
            }

            // Session recovery: The SDK stores session JSONL files at
            // CLAUDE_CONFIG_DIR/projects/<hash>/<session-id>.jsonl. If those files
            // are lost (permissions issue, disk cleanup, SDK update), the SDK
            // returns "No conversation found" even though our Supabase session
            // store has a valid session ID. When this happens, clear the stale
            // ID from our store and start a fresh conversation.
            //
            // Common cause: worker-entry.mjs projects/ dir permissions (see
            // the SESSION PERSISTENCE ARCHITECTURE comment there).
            const isSessionNotFound =
              combinedMessage.includes("No conversation found") ||
              (combinedMessage.includes("session") && combinedMessage.includes("not found"))

            if (isSessionNotFound && existingSessionId && sessionKey) {
              logger.log(
                `[SESSION RECOVERY] Session "${existingSessionId}" not found (detected in: ${stderrMessage ? "stderr" : "message"}), clearing and retrying...`,
              )
              try {
                // Clear stale session from store
                try {
                  await sessionStore.delete(sessionKey)
                } catch (deleteError) {
                  logRetryContract(logger, {
                    retry_attempted: true,
                    retry_reason: "stale_session",
                    retry_outcome: "failed",
                  })
                  logger.error("[SESSION RECOVERY] Failed to clear stale session:", deleteError)
                  controller.error(deleteError)
                  return
                }
                logger.log("[SESSION RECOVERY] Cleared stale session, starting fresh conversation")

                // Retry without resume - start fresh conversation
                await runQuery(undefined, undefined)
                logRetryContract(logger, {
                  retry_attempted: true,
                  retry_reason: "stale_session",
                  retry_outcome: "success",
                })
                controller.close()
                return
              } catch (retryErr) {
                logRetryContract(logger, {
                  retry_attempted: true,
                  retry_reason: "stale_session",
                  retry_outcome: "failed",
                })
                logger.error("[SESSION RECOVERY] Retry failed:", retryErr)
                controller.error(retryErr)
                return
              }
            }

            logRetryContract(logger, {
              retry_attempted: false,
              retry_reason: "not_applicable",
              retry_outcome: "not_attempted",
            })
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
        model: requestedModel,
        maxTurns: maxTurns,
        resume: existingSessionId || undefined,
        resumeSessionAt: resumeSessionAt || undefined,
        systemPrompt,
        oauthAccessToken,
        sessionCookie,
        oauthTokens, // OAuth tokens for connected MCP providers (stripe, linear, etc.)
        isAdmin: user.isAdmin, // Enables admin-only tool policy (TaskStop)
        isSuperadmin: user.isSuperadmin, // Superadmin gets elevated tool policy
        isSuperadminWorkspace, // Whether accessing the alive workspace specifically
        permissionMode: effectivePermissionMode, // Plan mode: "plan" = read-only exploration
        streamMode,
      })
    }

    // Create NDJSON stream from child process output
    // Handles: NDJSON parsing, session ID storage, credit charging, error handling, cancellation
    const ndjsonStream = createNDJSONStream({
      childStream,
      conversationKey: sessionKey, // For Claude SDK session persistence
      requestId,
      tabId, // Tab ID for routing responses to correct tab
      conversationWorkspace: resolvedWorkspaceName,
      tokenSource,
      model: requestedModel, // For model-specific credit calculation
      cancelState, // Pass shared cancellation state
      consumeCancelIntent: async () => {
        const pollConsumeResults = await Promise.allSettled([
          consumeCancelIntent(sessionKey!, user.id),
          consumeCancelIntentByRequestId(requestId, user.id),
        ])
        const consumedByConversation = pollConsumeResults[0].status === "fulfilled" && pollConsumeResults[0].value
        const consumedByRequest = pollConsumeResults[1].status === "fulfilled" && pollConsumeResults[1].value
        if (pollConsumeResults.some(result => result.status === "rejected")) {
          logger.warn("Cancel-intent polling degraded; continuing with partial results")
        }
        return consumedByConversation || consumedByRequest
      },
      oauthWarnings, // OAuth warnings to inject into stream
      onMessage: message => {
        // Buffer each message for reconnection support (non-blocking)
        const streamSeq = message.streamSeq
        if (typeof streamSeq !== "number") {
          logger.log("Skipping buffer append (missing streamSeq)")
          return
        }
        appendToStreamBuffer(requestId, JSON.stringify(message), streamSeq).catch(err => {
          logger.log("Failed to buffer message (non-fatal):", err)
        })
      },
      onStreamComplete: () => {
        // Guaranteed cleanup: unregister, unlock, mark buffer complete
        unregisterCancellation(requestId)
        unlockConversation(sessionKey!)

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
    // Revoked session → 401 (not a 500)
    if (outerError instanceof AuthenticationError) {
      cleanupLockedStreamAfterError("auth error", outerError.message)
      const origin = req.headers.get("origin")
      const authRes = structuredErrorResponse(ErrorCodes.NO_SESSION, {
        status: 401,
        details: { message: "Authentication required", requestId },
      })
      addCorsHeaders(authRes, origin)
      return authRes
    }

    logger.error("Outer catch - request processing failed:", outerError)
    Sentry.captureException(outerError)

    // CRITICAL: Ensure both lock and cancellation registry are cleaned up after any setup failure
    cleanupLockedStreamAfterError("request error", outerError instanceof Error ? outerError.message : "Unknown error")

    const origin = req.headers.get("origin")
    const errorRes = structuredErrorResponse(ErrorCodes.REQUEST_PROCESSING_FAILED, {
      status: 500,
      details: { message: outerError instanceof Error ? outerError.message : "Unknown error", requestId },
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
