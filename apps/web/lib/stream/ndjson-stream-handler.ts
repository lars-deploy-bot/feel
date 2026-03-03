/**
 * NDJSON Stream Handler - Process child process output with credit charging
 *
 * ARCHITECTURE:
 * - Credits are the primary currency (stored and charged in credits)
 * - LLM tokens from Claude API are converted to credits only at charge time
 * - Example: Claude uses 1000 LLM tokens → converted to 10 credits → charged to workspace
 *
 * Responsibilities:
 * - Parse NDJSON events from child process
 * - Handle session ID storage (via optional callback)
 * - Charge workspace credits for actual LLM token usage
 * - Build typed stream messages
 * - Manage stream lifecycle and cancellation
 *
 * This module encapsulates the complete streaming pipeline: receiving raw bytes
 * from child process, parsing NDJSON, routing to session/message handlers,
 * applying credit charges, and sending typed messages to client.
 */

import * as Sentry from "@sentry/nextjs"
import { type OAuthWarning, STREAMING } from "@webalive/shared"
import { sessionStore, type TabSessionKey } from "@/features/auth/lib/sessionStore"
import type {
  BridgeCompleteMessage,
  BridgeDoneMessage,
  BridgeErrorMessage,
  BridgeInterruptMessage,
  BridgeMessageEvent,
  BridgeMessageType,
  BridgePingMessage,
  BridgeSessionMessage,
  BridgeStartMessage,
  StreamMessage,
} from "@/features/chat/lib/streaming/ndjson"
import {
  BridgeInterruptSource,
  BridgeStreamType,
  BridgeSyntheticMessageType,
  createPingMessage,
  createWarningMessage,
  encodeNDJSON,
} from "@/features/chat/lib/streaming/ndjson"
import { isAssistantMessageWithUsage, isBridgeMessageEvent } from "@/features/chat/types/guards"
import { ErrorCodes, getErrorMessage } from "@/lib/error-codes"
import { logStreamError } from "@/lib/error-logger"
import type { ClaudeModel } from "@/lib/models/claude-models"
import { calculateCreditsToCharge } from "@/lib/models/model-pricing"
import { chargeCreditsDirectly } from "@/lib/tokens"

type ParsedChildEvent =
  | { kind: "stream_session"; sessionId: string }
  | { kind: "stream_message"; messageCount: number; messageType: string; content: unknown }
  | { kind: "stream_complete"; totalMessages: number; result: unknown }
  | { kind: "stream_start"; host: string; cwd: string; message: string; messageLength: number; isResume?: boolean }
  | { kind: "stream_error"; details: unknown }
  | { kind: "stream_ping" }
  | { kind: "stream_done" }
  | { kind: "stream_interrupt"; source: unknown }
  | { kind: "unknown"; rawType: string; raw: unknown }

type ParsedMessageChildEvent = Extract<ParsedChildEvent, { kind: "stream_message" }>

interface AssistantMessageBlock {
  type: "text"
  text: string
}

interface AssistantMessageContent {
  content?: unknown
}

interface AssistantSDKErrorContent {
  type?: unknown
  error?: unknown
  message?: AssistantMessageContent
}

function getObjectProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") {
    return undefined
  }
  return Reflect.get(value, key)
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const record: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry
  }
  return record
}

function getStringProperty(value: unknown, key: string): string | undefined {
  const property = getObjectProperty(value, key)
  return typeof property === "string" ? property : undefined
}

function getNumberProperty(value: unknown, key: string): number | undefined {
  const property = getObjectProperty(value, key)
  return typeof property === "number" ? property : undefined
}

function isTextAssistantMessageBlock(block: unknown): block is AssistantMessageBlock {
  return getObjectProperty(block, "type") === "text" && typeof getObjectProperty(block, "text") === "string"
}

function toAssistantSdkErrorContent(value: unknown): AssistantSDKErrorContent | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const messageValue = getObjectProperty(value, "message")
  const message: AssistantMessageContent | undefined =
    messageValue && typeof messageValue === "object"
      ? {
          content: getObjectProperty(messageValue, "content"),
        }
      : undefined

  return {
    type: getObjectProperty(value, "type"),
    error: getObjectProperty(value, "error"),
    message,
  }
}

function isBridgeMessageType(value: unknown): value is BridgeMessageType {
  return typeof value === "string"
}

function isInterruptSource(value: unknown): value is BridgeInterruptMessage["data"]["source"] {
  return value === BridgeInterruptSource.HTTP_ABORT || value === BridgeInterruptSource.CLIENT_CANCEL
}

function isSdkResultMessage(value: unknown): value is BridgeCompleteMessage["data"]["result"] {
  return Boolean(value) && typeof value === "object" && getObjectProperty(value, "type") === "result"
}

function parseChildEvent(raw: unknown): ParsedChildEvent {
  const record = toRecord(raw)
  if (!record) {
    return { kind: "unknown", rawType: "non-object", raw }
  }

  const type = getStringProperty(record, "type")
  if (!type) {
    return { kind: "unknown", rawType: "missing-type", raw }
  }

  switch (type) {
    case BridgeStreamType.SESSION: {
      const sessionId = getStringProperty(record, "sessionId")
      if (!sessionId) {
        return { kind: "unknown", rawType: "stream_session_missing_session_id", raw }
      }
      return { kind: "stream_session", sessionId }
    }
    case BridgeStreamType.MESSAGE:
      return {
        kind: "stream_message",
        messageCount: getNumberProperty(record, "messageCount") ?? 0,
        messageType: getStringProperty(record, "messageType") ?? "unknown",
        content: getObjectProperty(record, "content"),
      }
    case BridgeStreamType.COMPLETE:
      return {
        kind: "stream_complete",
        totalMessages: getNumberProperty(record, "totalMessages") ?? 0,
        result: getObjectProperty(record, "result"),
      }
    case BridgeStreamType.START: {
      const message = getStringProperty(record, "message") ?? ""
      const messageLength = getNumberProperty(record, "messageLength") ?? message.length
      const isResumeValue = getObjectProperty(record, "isResume")
      const startEvent: ParsedChildEvent = {
        kind: "stream_start",
        host: getStringProperty(record, "host") ?? "",
        cwd: getStringProperty(record, "cwd") ?? "",
        message,
        messageLength,
      }
      if (typeof isResumeValue === "boolean") {
        startEvent.isResume = isResumeValue
      }
      return startEvent
    }
    case "error":
      return { kind: "stream_error", details: raw }
    case BridgeStreamType.PING:
      return { kind: "stream_ping" }
    case BridgeStreamType.DONE:
      return { kind: "stream_done" }
    case BridgeStreamType.INTERRUPT:
      return {
        kind: "stream_interrupt",
        source: getObjectProperty(record, "source") ?? getObjectProperty(record, "content"),
      }
    default:
      return { kind: "unknown", rawType: type, raw }
  }
}

function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`)
}

/**
 * Shared cancellation state between registry and stream
 */
export interface CancelState {
  requested: boolean
  reader: ReadableStreamDefaultReader<Uint8Array> | null
}

/**
 * Configuration for NDJSON stream handler
 *
 * The stream handler is responsible for:
 * - Parsing NDJSON from child process
 * - Extracting and storing session IDs
 * - Building typed stream messages
 * - Charging workspace credits for actual LLM usage
 * - Managing stream lifecycle and cancellation
 */
interface StreamHandlerConfig {
  childStream: ReadableStream<Uint8Array>
  conversationKey: TabSessionKey
  requestId: string
  /**
   * Tab ID for routing responses to correct tab
   * Included in every NDJSON event so client knows where to route the message
   */
  tabId?: string
  conversationWorkspace: string
  /**
   * Token source determines credit billing:
   * - "workspace": Charge from workspace credit balance
   * - "user_provided": User auth path (OAuth/no-credit), no charges
   */
  tokenSource: "workspace" | "user_provided"
  /**
   * The Claude model being used (for pricing calculation)
   * Required for accurate cost calculation based on model-specific pricing
   */
  model: ClaudeModel
  /**
   * Called when a session ID is received from the child process
   * Allows caller to store session ID or perform other session setup
   */
  onSessionIdReceived?: (sessionId: string) => Promise<void>
  /**
   * Called when the stream completes (success, error, or abort)
   * Used for cleanup like releasing conversation locks
   * Guaranteed to be called exactly once via finally block
   */
  onStreamComplete?: () => void
  /**
   * Shared cancellation state with registry
   * Allows explicit cancellation via separate HTTP request
   */
  cancelState: CancelState
  /**
   * Optional process-safe cancel intent consumer.
   * When provided, stream polls this callback to detect stop requests that were
   * queued in shared storage by another server process.
   */
  consumeCancelIntent?: () => Promise<boolean>
  /**
   * OAuth warnings to inject into stream at start
   * Shows user-facing warnings for expired/revoked tokens
   */
  oauthWarnings?: OAuthWarning[]
  /**
   * Called for each message sent to client (for buffering/persistence)
   * Receives the raw NDJSON line before encoding
   */
  onMessage?: (message: StreamMessage | BridgeErrorMessage) => void
}

/**
 * Mutable token accumulator for a single stream request.
 * Tokens are summed across all assistant messages during streaming,
 * then charged as a single lump sum on stream_complete (or in the
 * finally block for abort/error). This avoids per-message rounding
 * to zero that caused #282.
 */
interface TokenAccumulator {
  inputTokens: number
  outputTokens: number
  charged: boolean
}

function createTokenAccumulator(): TokenAccumulator {
  return { inputTokens: 0, outputTokens: 0, charged: false }
}

/**
 * Charge accumulated tokens for the entire stream request.
 *
 * Called once on stream_complete (or finally for abort/error).
 * Uses model-based pricing → atomic Supabase RPC deduction.
 */
async function chargeAccumulatedCredits(
  accumulator: TokenAccumulator,
  model: ClaudeModel,
  workspace: string,
  requestId: string,
): Promise<void> {
  if (accumulator.charged) return
  accumulator.charged = true

  if (accumulator.inputTokens === 0 && accumulator.outputTokens === 0) return

  const creditsToCharge = calculateCreditsToCharge(model, accumulator.inputTokens, accumulator.outputTokens)

  try {
    const newBalance = await chargeCreditsDirectly(workspace, creditsToCharge)

    if (newBalance === null) {
      Sentry.withScope(scope => {
        scope.setLevel("warning")
        scope.setTag("workspace", workspace)
        scope.setTag("model", model)
        scope.setContext("credit_charge", {
          requestId,
          creditsToCharge,
          inputTokens: accumulator.inputTokens,
          outputTokens: accumulator.outputTokens,
        })
        Sentry.captureMessage("Insufficient credits to charge accumulated tokens")
      })
    }
  } catch (error) {
    Sentry.captureException(error)
  }
}

/**
 * Extract a short, human-readable preview from assistant message content.
 */
function extractAssistantTextPreview(content: AssistantSDKErrorContent): string | null {
  const blocks = content.message?.content
  if (!Array.isArray(blocks)) {
    return null
  }

  const previewParts = blocks
    .filter(isTextAssistantMessageBlock)
    .map(block => block.text)
    .join("\n")
    .trim()

  if (!previewParts) {
    return null
  }

  return previewParts.slice(0, 500)
}

/**
 * Capture SDK assistant error telemetry with rich context.
 * This helps identify whether the error originated from the SDK/Anthropic side
 * vs our own platform credit logic.
 */
function captureAssistantSdkErrorTelemetry(
  childEvent: ParsedMessageChildEvent,
  requestId: string,
  workspace: string,
  model: ClaudeModel,
  tokenSource: "workspace" | "user_provided",
  capturedErrorTypes: Set<string>,
): void {
  if (childEvent.messageType !== "assistant") {
    return
  }
  const assistantContent = toAssistantSdkErrorContent(childEvent.content)
  if (!assistantContent) {
    return
  }
  const sdkErrorType = typeof assistantContent.error === "string" ? assistantContent.error : null
  if (!sdkErrorType) {
    return
  }

  // Avoid duplicate Sentry events for the same SDK error type within one request.
  if (capturedErrorTypes.has(sdkErrorType)) {
    return
  }
  capturedErrorTypes.add(sdkErrorType)

  const assistantTextPreview = extractAssistantTextPreview(assistantContent)
  let rawContentPreview = ""
  try {
    rawContentPreview = JSON.stringify(assistantContent).slice(0, 2000)
  } catch {
    rawContentPreview = "[unserializable_assistant_content]"
  }

  console.error(
    `[NDJSON Stream ${requestId}] SDK assistant error '${sdkErrorType}' (workspace=${workspace}, model=${model})\n` +
      `  Content: ${rawContentPreview}` +
      (assistantTextPreview ? `\n  Text: ${assistantTextPreview}` : ""),
  )

  // Transient upstream errors (Anthropic API 500s, overloads, rate limits) are expected
  // and not actionable — log as warning, not error, to avoid Sentry noise.
  const transientErrorTypes = new Set(["unknown", "overloaded", "rate_limit", "api_error"])
  const isTransient = transientErrorTypes.has(sdkErrorType)

  Sentry.withScope(scope => {
    scope.setLevel(isTransient ? "warning" : "error")
    scope.setTag("error_source", "claude_agent_sdk_assistant_message")
    scope.setTag("sdk_error_type", sdkErrorType)
    scope.setTag("sdk_error_transient", isTransient ? "true" : "false")
    scope.setTag("workspace", workspace)
    scope.setTag("model", model)
    scope.setTag("token_source", tokenSource)
    scope.setContext("sdk_assistant_error", {
      requestId,
      workspace,
      model,
      tokenSource,
      source: "assistant_message.error",
      childEventType: childEvent.kind,
      messageType: childEvent.messageType,
      messageCount: childEvent.messageCount,
      assistantTextPreview: assistantTextPreview ?? "",
      rawContentPreview,
    })
    if (isTransient) {
      Sentry.captureMessage(
        `[SDK_UPSTREAM] type=${sdkErrorType} workspace=${workspace} requestId=${requestId}`,
        "warning",
      )
    } else {
      Sentry.captureException(
        new Error(`[SDK_ASSISTANT_ERROR] type=${sdkErrorType} source=assistant_message.error requestId=${requestId}`),
      )
    }
  })
}

/**
 * Process a single child event - handle session or message
 * Encapsulates the session/message routing logic to avoid duplication
 *
 * @returns Object indicating if this was a completion event (for early lock release)
 */
async function processChildEvent(
  childEvent: ParsedChildEvent,
  requestId: string,
  tabId: string | undefined,
  conversationKey: TabSessionKey,
  workspace: string,
  tokenSource: "workspace" | "user_provided",
  model: ClaudeModel,
  onSessionIdReceived: ((sessionId: string) => Promise<void>) | undefined,
  controller: ReadableStreamDefaultController<Uint8Array>,
  capturedAssistantErrorTypes: Set<string>,
  tokenAccumulator: TokenAccumulator,
  onMessage?: (message: StreamMessage | BridgeErrorMessage) => void,
): Promise<{ isComplete: boolean }> {
  // Store SDK session ID in Supabase so the next message can resume this
  // conversation. The SDK also writes the session to disk as a JSONL file
  // at CLAUDE_CONFIG_DIR/projects/<hash>/<session-id>.jsonl — both must
  // exist for resume to work. If the JSONL file is missing (e.g. due to
  // permissions), the session ID here becomes stale and route.ts clears it.
  if (childEvent.kind === "stream_session") {
    console.log(
      `[NDJSON Stream ${requestId}] [SESSION DEBUG] Received stream_session event, sessionId: ${childEvent.sessionId}`,
    )
    console.log(`[NDJSON Stream ${requestId}] [SESSION DEBUG] Storing to key: ${conversationKey}`)
    try {
      await sessionStore.set(conversationKey, childEvent.sessionId)
      console.log(`[NDJSON Stream ${requestId}] [SESSION DEBUG] Session stored successfully`)
      if (onSessionIdReceived) {
        await onSessionIdReceived(childEvent.sessionId)
      }
    } catch (error) {
      console.error(
        `[NDJSON Stream ${requestId}] Failed to store session ID:`,
        error instanceof Error ? error.message : String(error),
      )
      Sentry.captureException(error)
    }
    return { isComplete: false }
  }

  // Build message and send to client (includes tabId for routing)
  switch (childEvent.kind) {
    case "stream_message":
      captureAssistantSdkErrorTelemetry(
        childEvent,
        requestId,
        workspace,
        model,
        tokenSource,
        capturedAssistantErrorTypes,
      )
      break
    case "stream_complete":
    case "stream_start":
    case "stream_error":
    case "stream_ping":
    case "stream_done":
    case "stream_interrupt":
    case "unknown":
      break
    default:
      assertNever(childEvent, "Unhandled parsed child event kind in processChildEvent")
  }

  const message = buildStreamMessage(childEvent, requestId, tabId)

  // Accumulate token usage for end-of-stream charging (fixes #282).
  // Previously charged per-message, but small turns rounded to 0 credits.
  if (tokenSource === "workspace" && isBridgeMessageEvent(message) && isAssistantMessageWithUsage(message)) {
    const usage = message.data.content.message.usage
    tokenAccumulator.inputTokens += usage.input_tokens
    tokenAccumulator.outputTokens += usage.output_tokens
  }

  // Notify listener before sending (for buffering)
  onMessage?.(message)

  controller.enqueue(encodeNDJSON(message))

  // Signal completion when we receive stream_complete event
  // This allows early lock release before child process finishes SDK cleanup
  const isComplete = childEvent.kind === "stream_complete"
  return { isComplete }
}

/** Counter for generating unique message IDs within a request */
const messageCounters = new Map<string, number>()

/** Generate the next stream sequence number (1-based, monotonic per request) */
function nextStreamSeq(requestId: string): number {
  const count = (messageCounters.get(requestId) ?? 0) + 1
  messageCounters.set(requestId, count)
  return count
}

/** Build a message ID from requestId + streamSeq */
function buildMessageId(requestId: string, streamSeq: number): string {
  return `${requestId}-${streamSeq}`
}

/** Clean up message counter when stream ends */
export function cleanupMessageCounter(requestId: string): void {
  messageCounters.delete(requestId)
}

/**
 * Strip <system-reminder> tags from content
 * These tags contain internal Claude instructions that should not be shown to users
 */
function stripSystemReminders(content: unknown): unknown {
  if (typeof content === "string") {
    // Remove all <system-reminder>...</system-reminder> tags
    // Strategy: Remove the tag and preserve spacing as appropriate
    // - If tag has newlines inside OR is between newlines, preserve one newline
    // - Otherwise just remove inline (space before/after gets collapsed naturally)
    let stripped = content.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, match => {
      // If the tag contains newlines, it was multiline - replace with single newline
      if (match.includes("\n")) {
        return "\n"
      }
      // Inline tag - just remove it
      return ""
    })

    // Clean up whitespace: collapse multiple spaces, trim excess newlines
    stripped = stripped.replace(/ +/g, " ") // Multiple spaces → single space
    stripped = stripped.replace(/\n{3,}/g, "\n\n") // 3+ newlines → 2 newlines

    return stripped.trim()
  }

  if (Array.isArray(content)) {
    return content.map(stripSystemReminders)
  }

  if (content && typeof content === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(content)) {
      result[key] = stripSystemReminders(value)
    }
    return result
  }

  return content
}

/**
 * Build a stream message from child event
 * Includes tabId for routing and messageId for idempotency
 */
function buildStreamMessage(
  childEvent: ParsedChildEvent,
  requestId: string,
  tabId?: string,
): StreamMessage | BridgeErrorMessage {
  const timestamp = new Date().toISOString()
  const streamSeq = nextStreamSeq(requestId)
  const messageId = buildMessageId(requestId, streamSeq)

  switch (childEvent.kind) {
    case "stream_error": {
      const errorMessage: BridgeErrorMessage = {
        type: BridgeStreamType.ERROR,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {
          error: ErrorCodes.STREAM_ERROR,
          code: ErrorCodes.STREAM_ERROR,
          message: getErrorMessage(ErrorCodes.STREAM_ERROR),
          details: { error: String(childEvent.details) },
        },
      }
      return errorMessage
    }
    case "stream_start": {
      const startMessage: BridgeStartMessage = {
        type: BridgeStreamType.START,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {
          host: childEvent.host,
          cwd: childEvent.cwd,
          message: childEvent.message,
          messageLength: childEvent.messageLength,
          isResume: childEvent.isResume,
        },
      }
      return startMessage
    }
    case "stream_session": {
      const sessionMessage: BridgeSessionMessage = {
        type: BridgeStreamType.SESSION,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: { sessionId: childEvent.sessionId },
      }
      return sessionMessage
    }
    case "stream_message": {
      const messageType = isBridgeMessageType(childEvent.messageType)
        ? childEvent.messageType
        : BridgeSyntheticMessageType.WARNING
      const messageEvent: BridgeMessageEvent = {
        type: BridgeStreamType.MESSAGE,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {
          messageCount: childEvent.messageCount,
          messageType,
          content: stripSystemReminders(childEvent.content),
        },
      }
      return messageEvent
    }
    case "stream_complete": {
      const sanitizedResult = stripSystemReminders(childEvent.result)
      const completeMessage: BridgeCompleteMessage = {
        type: BridgeStreamType.COMPLETE,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {
          totalMessages: childEvent.totalMessages,
          result: isSdkResultMessage(sanitizedResult) ? sanitizedResult : null,
        },
      }
      return completeMessage
    }
    case "stream_ping": {
      const pingMessage: BridgePingMessage = {
        type: BridgeStreamType.PING,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {},
      }
      return pingMessage
    }
    case "stream_done": {
      const doneMessage: BridgeDoneMessage = {
        type: BridgeStreamType.DONE,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {},
      }
      return doneMessage
    }
    case "stream_interrupt": {
      const source = isInterruptSource(childEvent.source) ? childEvent.source : BridgeInterruptSource.CLIENT_CANCEL
      const interruptMessage: BridgeInterruptMessage = {
        type: BridgeStreamType.INTERRUPT,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {
          message: "Response interrupted by user",
          source,
        },
      }
      return interruptMessage
    }
    case "unknown": {
      const fallbackError: BridgeErrorMessage = {
        type: BridgeStreamType.ERROR,
        requestId,
        messageId,
        streamSeq,
        tabId,
        timestamp,
        data: {
          error: ErrorCodes.STREAM_ERROR,
          code: ErrorCodes.STREAM_ERROR,
          message: getErrorMessage(ErrorCodes.STREAM_ERROR),
          details: `Unexpected stream event type: ${childEvent.rawType}`,
        },
      }
      return fallbackError
    }
    default:
      return assertNever(childEvent, "Unhandled parsed child event kind in buildStreamMessage")
  }
}

/**
 * Create an NDJSON stream from child process output
 *
 * Handles:
 * - NDJSON parsing and buffering
 * - Session ID extraction and callback invocation
 * - Message transformation and routing
 * - Token deduction for workspace-funded requests (synchronous)
 * - Error handling and recovery
 * - Graceful shutdown and cancellation
 *
 * @param config - Stream handler configuration
 * @returns ReadableStream that can be sent as HTTP response
 */
export function createNDJSONStream(config: StreamHandlerConfig): ReadableStream<Uint8Array> {
  const {
    childStream,
    conversationKey,
    requestId,
    tabId,
    conversationWorkspace,
    tokenSource,
    model,
    onSessionIdReceived,
    onStreamComplete,
    cancelState,
    consumeCancelIntent,
    oauthWarnings,
    onMessage,
  } = config

  const decoder = new TextDecoder()
  let cleanupCalled = false // Track if cleanup was already called (shared between start and cancel)
  const CANCEL_INTENT_POLL_INTERVAL_MS = 250

  return new ReadableStream({
    async start(controller) {
      const reader = childStream.getReader()
      cancelState.reader = reader // Store for explicit cancellation
      const capturedAssistantErrorTypes = new Set<string>()
      const tokenAccumulator = createTokenAccumulator()
      let buffer = ""

      // Inject OAuth warnings at the start of the stream
      if (oauthWarnings && oauthWarnings.length > 0) {
        for (const warning of oauthWarnings) {
          const warningMessage = createWarningMessage(
            requestId,
            {
              category: "oauth",
              provider: warning.provider,
              message: warning.message,
              action: "Reconnect",
            },
            tabId,
          )
          controller.enqueue(encodeNDJSON(warningMessage))
          console.log(`[NDJSON Stream ${requestId}] Injected OAuth warning for ${warning.provider}`)
        }
      }

      // Heartbeat to keep Cloudflare connection alive during long tool executions.
      // setInterval runs via the event loop while `await reader.read()` is suspended.
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encodeNDJSON(createPingMessage(requestId)))
        } catch {
          clearInterval(heartbeatInterval)
        }
      }, STREAMING.HEARTBEAT_INTERVAL_MS)

      let intentCheckInFlight = false
      let sharedIntentPollErrorCaptured = false
      const checkSharedCancelIntent = async () => {
        if (!consumeCancelIntent || cancelState.requested || intentCheckInFlight) {
          return
        }

        intentCheckInFlight = true
        try {
          const consumed = await consumeCancelIntent()
          if (!consumed || cancelState.requested) {
            return
          }

          console.log(`[NDJSON Stream ${requestId}] Shared cancel intent consumed; cancelling stream`)
          cancelState.requested = true
          cancelState.reader?.cancel().catch(error => {
            console.error(`[NDJSON Stream ${requestId}] Failed to cancel reader from shared intent:`, error)
            Sentry.captureException(error)
          })
        } catch (error) {
          console.warn(`[NDJSON Stream ${requestId}] Shared cancel intent check failed:`, error)
          if (!sharedIntentPollErrorCaptured) {
            sharedIntentPollErrorCaptured = true
            Sentry.captureException(error)
          }
        } finally {
          intentCheckInFlight = false
        }
      }

      const cancelIntentPollInterval = consumeCancelIntent
        ? setInterval(() => {
            void checkSharedCancelIntent()
          }, CANCEL_INTENT_POLL_INTERVAL_MS)
        : null

      try {
        // Catch intents that may have been queued immediately before stream start.
        await checkSharedCancelIntent()

        while (true) {
          // Check if explicitly cancelled via cancel endpoint or client abort
          // Just break - the finally block will release the lock after abort completes
          if (cancelState.requested) {
            console.log(`[NDJSON Stream ${requestId}] Breaking loop due to cancellation`)
            break
          }

          const { done, value } = await reader.read()
          if (done) {
            break
          }

          // Decode incoming data and split by newlines
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          // Process each complete NDJSON line
          for (const line of lines) {
            // Check for cancellation during processing for better responsiveness
            // Just break - the finally block will release the lock after abort completes
            if (cancelState.requested) {
              console.log(`[NDJSON Stream ${requestId}] Cancelled during line processing`)
              break
            }

            if (!line.trim()) continue

            try {
              const childEvent = parseChildEvent(JSON.parse(line))
              const { isComplete } = await processChildEvent(
                childEvent,
                requestId,
                tabId,
                conversationKey,
                conversationWorkspace,
                tokenSource,
                model,
                onSessionIdReceived,
                controller,
                capturedAssistantErrorTypes,
                tokenAccumulator,
                onMessage,
              )

              // EARLY LOCK RELEASE: Release lock immediately when complete event is received
              // Don't wait for child process SDK cleanup (MCP servers, sessions)
              // This mirrors the cancellation pattern (lines above)
              if (isComplete && !cleanupCalled) {
                // Charge accumulated credits before releasing the lock
                if (tokenSource === "workspace") {
                  await chargeAccumulatedCredits(tokenAccumulator, model, conversationWorkspace, requestId)
                }
                onStreamComplete?.()
                cleanupCalled = true
              }
            } catch (parseError) {
              console.error(
                `[NDJSON Stream ${requestId}] Failed to parse child output (length: ${line.length}):`,
                parseError instanceof Error ? parseError.message : String(parseError),
              )
              console.error(`[NDJSON Stream ${requestId}] Line preview:`, line.substring(0, 200))
            }
          }

          // Break outer loop if cancelled during processing
          if (cancelState.requested) break
        }

        // Process final buffered content
        if (buffer.trim()) {
          try {
            const childEvent = parseChildEvent(JSON.parse(buffer))
            const { isComplete } = await processChildEvent(
              childEvent,
              requestId,
              tabId,
              conversationKey,
              conversationWorkspace,
              tokenSource,
              model,
              onSessionIdReceived,
              controller,
              capturedAssistantErrorTypes,
              tokenAccumulator,
              onMessage,
            )

            // EARLY LOCK RELEASE: Same pattern as in the main loop
            if (isComplete && !cleanupCalled) {
              if (tokenSource === "workspace") {
                await chargeAccumulatedCredits(tokenAccumulator, model, conversationWorkspace, requestId)
              }
              onStreamComplete?.()
              cleanupCalled = true
            }
          } catch (_parseError) {
            console.error(`[NDJSON Stream ${requestId}] Failed to parse final buffer:`, buffer)
          }
        }

        console.log(`[NDJSON Stream ${requestId}] Child process stream complete`)
      } catch (error) {
        // Log detailed error with build info for backend tracking
        logStreamError({ requestId, workspace: conversationWorkspace, model, error })

        // Send minimal error to frontend (user sees error ID for correlation)
        const streamSeq = nextStreamSeq(requestId)
        const errorMessage: BridgeErrorMessage = {
          type: BridgeStreamType.ERROR,
          requestId,
          messageId: buildMessageId(requestId, streamSeq),
          streamSeq,
          timestamp: new Date().toISOString(),
          data: {
            error: ErrorCodes.STREAM_ERROR,
            code: ErrorCodes.STREAM_ERROR,
            message: getErrorMessage(ErrorCodes.STREAM_ERROR),
          },
        }
        controller.enqueue(encodeNDJSON(errorMessage))
      } finally {
        clearInterval(heartbeatInterval)
        if (cancelIntentPollInterval) {
          clearInterval(cancelIntentPollInterval)
        }
        // Guaranteed cleanup: runs on success, error, or cancellation
        // Close the stream so client knows we're done
        // NOTE: When stream is cancelled, controller may already be closed. Wrap in try-catch
        // to ensure onStreamComplete() is ALWAYS called (critical for lock release).
        try {
          controller.close()
        } catch (closeError) {
          // Expected when stream was cancelled - controller is already closed
          console.log(
            `[NDJSON Stream ${requestId}] Controller already closed (expected on cancel):`,
            closeError instanceof Error ? closeError.message : String(closeError),
          )
        }

        // Charge accumulated credits for abort/error cases (idempotent — skips if already charged)
        if (
          tokenSource === "workspace" &&
          !tokenAccumulator.charged &&
          (tokenAccumulator.inputTokens > 0 || tokenAccumulator.outputTokens > 0)
        ) {
          await chargeAccumulatedCredits(tokenAccumulator, model, conversationWorkspace, requestId)
        }

        // Release conversation lock and perform any other cleanup
        // Only call if not already called during explicit cancellation
        if (!cleanupCalled) {
          onStreamComplete?.()
          cleanupCalled = true
        }

        // Clean up message counter to prevent memory leak
        cleanupMessageCounter(requestId)

        console.log(`[NDJSON Stream ${requestId}] Stream finalized and cleaned up`)
      }
    },

    /**
     * Called when stream is cancelled (client abort)
     * Propagates cancellation to child process for graceful shutdown
     *
     * IMPORTANT: We do NOT release the lock here! The abort signal needs to reach
     * the worker pool first, and the worker pool's cleanup timeout (500ms) will
     * reset the worker's busy state. Only after that should the lock be released.
     * The finally block in start() handles lock release after the abort completes.
     *
     * Flow:
     * 1. Client aborts fetch
     * 2. cancel() is called → triggers abort signal via reader.cancel()
     * 3. childStream.cancel() → workerAbortController.abort()
     * 4. Worker pool manager receives abort, sends cancel to worker, sets 500ms timeout
     * 5. After worker responds or timeout fires, worker state is reset to "ready"
     * 6. reader.cancel() completes → start() loop exits → finally block releases lock
     */
    cancel() {
      console.log(`[NDJSON Stream ${requestId}] Stream cancelled by client (abort)`)

      // Set cancellation flag so start() loop can exit cleanly
      cancelState.requested = true

      // Cancel the reader - this propagates to childStream.cancel() which aborts the worker
      // The lock will be released by the finally block in start() after the abort completes
      if (cancelState.reader) {
        cancelState.reader.cancel().catch(error => {
          console.error(`[NDJSON Stream ${requestId}] Failed to cancel reader:`, error)
          Sentry.captureException(error)
        })
      }
    },
  })
}
