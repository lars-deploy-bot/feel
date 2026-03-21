/**
 * Execution Attempts
 *
 * Worker-pool execution strategy returning an isolated AttemptResult.
 */

import { statSync } from "node:fs"
import * as Sentry from "@sentry/nextjs"
import type { OnPersistMessage } from "@webalive/automation-engine"
import { authorizeRuntimeAccess } from "@webalive/runtime-auth"
import { DEFAULTS, WORKER_POOL } from "@webalive/shared"
import { isQueryResultCancelled, type QueryResult } from "@webalive/worker-pool"
import {
  getAllowedTools,
  getDisallowedTools,
  PERMISSION_MODE,
  SETTINGS_SOURCES,
  STREAM_TYPES,
} from "@/lib/claude/agent-constants.mjs"
import { isRecord } from "@/lib/utils"

// =============================================================================
// Isolated Attempt Result
// =============================================================================

// =============================================================================
// SDK Result Type Guards
// =============================================================================

/**
 * SDK result subtypes from SDKResultMessage (claude-agent-sdk).
 * "success" = completed normally.
 * All others are errors — the SDK ran but could not produce a valid result.
 */
const SDK_ERROR_SUBTYPES = new Set([
  "error_during_execution",
  "error_max_turns",
  "error_max_budget_usd",
  "error_max_structured_output_retries",
])

/** Shape of SDKResultSuccess (subtype: "success", result: string) */
interface SdkSuccessResult {
  subtype: "success"
  result: string
  total_cost_usd?: number
  num_turns?: number
  usage?: { input_tokens: number; output_tokens: number }
}

/** Shape of SDKResultError (subtype: error_*, errors: string[]) */
interface SdkErrorResult {
  subtype: string
  errors: string[]
  total_cost_usd?: number
  num_turns?: number
  usage?: { input_tokens: number; output_tokens: number }
}

function isSdkSuccessResult(v: unknown): v is SdkSuccessResult {
  return isRecord(v) && v.subtype === "success" && typeof v.result === "string"
}

function isSdkErrorResult(v: unknown): v is SdkErrorResult {
  return (
    isRecord(v) &&
    typeof v.subtype === "string" &&
    v.subtype !== "success" &&
    (v.subtype.startsWith("error_") || SDK_ERROR_SUBTYPES.has(v.subtype)) &&
    Array.isArray(v.errors)
  )
}

/** Each execution attempt produces its own isolated result */
export interface AttemptResult {
  textMessages: string[]
  allMessages: unknown[]
  finalResponse: string
  /** Text extracted from a named tool call's input.text (set via responseToolName) */
  toolResponseText?: string
  /** Set when SDK reports an error result (auth failure, max turns, budget, etc.) */
  sdkError?: SdkErrorResult
  costUsd?: number
  numTurns?: number
  usage?: { input_tokens: number; output_tokens: number }
}

/**
 * Extract input.text from a tool_use block matching the given tool name.
 * Matches both exact name and MCP-prefixed name (e.g. "send_reply" matches "mcp__alive-email__send_reply").
 */
function extractToolResponseText(blocks: unknown[], toolName: string): string | undefined {
  for (const block of blocks) {
    if (
      isRecord(block) &&
      block.type === "tool_use" &&
      typeof block.name === "string" &&
      (block.name === toolName || block.name.endsWith(`__${toolName}`)) &&
      isRecord(block.input) &&
      typeof block.input.text === "string"
    ) {
      return block.input.text
    }
  }
  return undefined
}

/**
 * Create a fresh, isolated message collector for a single attempt.
 * @param responseToolName — when set, extracts input.text from matching tool_use blocks
 */
function createMessageCollector(responseToolName?: string): {
  state: AttemptResult
  collect: (msg: Record<string, unknown>) => void
} {
  const state: AttemptResult = {
    textMessages: [],
    allMessages: [],
    finalResponse: "",
  }

  const collect = (msg: Record<string, unknown>) => {
    if (msg.type === "message" && typeof msg.content === "object" && msg.content !== null) {
      state.allMessages.push(msg.content)

      const content = msg.content
      if (!isRecord(content)) return

      if (content.role === "assistant" && Array.isArray(content.content)) {
        for (const block of content.content) {
          if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
            state.textMessages.push(block.text)
          }
        }
        if (responseToolName) {
          const toolText = extractToolResponseText(content.content as unknown[], responseToolName)
          if (toolText) state.toolResponseText = toolText
        }
      }
      if (content.messageType === "assistant" && isRecord(content.content)) {
        const inner = content.content
        // Worker pool wraps SDK messages: content.message.content has the text blocks
        if (isRecord(inner.message)) {
          const message = inner.message
          if (Array.isArray(message.content)) {
            for (const block of message.content) {
              if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
                state.textMessages.push(block.text)
              }
            }
            if (responseToolName) {
              const toolText = extractToolResponseText(message.content as unknown[], responseToolName)
              if (toolText) state.toolResponseText = toolText
            }
          }
        }
      }
    } else if (msg.type === "complete" && isRecord(msg.result)) {
      state.allMessages.push(msg)
      const result = msg.result
      // Worker pool: result.result is the SDK result object
      const sdkResult = result.result
      if (isSdkSuccessResult(sdkResult)) {
        state.finalResponse = sdkResult.result
      } else if (isSdkErrorResult(sdkResult)) {
        state.sdkError = sdkResult
      }
      if (isRecord(sdkResult)) {
        if (typeof sdkResult.total_cost_usd === "number") {
          state.costUsd = sdkResult.total_cost_usd
        }
        if (typeof sdkResult.num_turns === "number") {
          state.numTurns = sdkResult.num_turns
        }
        if (isRecord(sdkResult.usage)) {
          const u = sdkResult.usage
          if (typeof u.input_tokens === "number" && typeof u.output_tokens === "number") {
            state.usage = { input_tokens: u.input_tokens, output_tokens: u.output_tokens }
          }
        }
      }
    }
  }

  return { state, collect }
}

// =============================================================================
// Worker Pool Attempt
// =============================================================================

export interface ExecutionParams {
  requestId: string
  cwd: string
  fullPrompt: string
  selectedModel: string
  systemPrompt: string
  timeoutSeconds: number
  /** Additional MCP tool names to register */
  extraTools?: string[]
  /** Extract response from this tool's input.text */
  responseToolName?: string
  /** Optional callback to persist each SDK message into app.messages */
  onPersistMessage?: OnPersistMessage
}

interface WorkerPoolParams extends ExecutionParams {
  workspace: string
  userId: string
  oauthAccessToken: string
  /** Enable superadmin tool policy for alive workspace automations */
  enableSuperadminTools?: boolean
  /** Session cookie for authenticating API callbacks (e.g. restart_dev_server) */
  sessionCookie?: string
}

export async function tryWorkerPool(params: WorkerPoolParams): Promise<AttemptResult> {
  const {
    requestId,
    cwd,
    workspace,
    userId,
    fullPrompt,
    selectedModel,
    systemPrompt,
    timeoutSeconds,
    extraTools,
    responseToolName,
    oauthAccessToken,
    sessionCookie,
    onPersistMessage,
  } = params

  const { getWorkerPool } = await import("@webalive/worker-pool")

  const st = statSync(cwd)
  const credentials = {
    uid: st.uid,
    gid: st.gid,
    cwd,
    workspaceKey: workspace,
  }

  const useSuperadminTools = params.enableSuperadminTools === true

  const allowedTools = Array.from(
    new Set([
      ...getAllowedTools(cwd, useSuperadminTools, useSuperadminTools, useSuperadminTools, "default", "systemd"),
      ...(extraTools ?? []),
    ]),
  )

  const agentConfig = {
    allowedTools,
    disallowedTools: getDisallowedTools(
      useSuperadminTools,
      useSuperadminTools,
      "default",
      useSuperadminTools,
      "systemd",
    ),
    permissionMode: PERMISSION_MODE,
    settingSources: SETTINGS_SOURCES,
    oauthMcpServers: {} as Record<string, unknown>,
    streamTypes: STREAM_TYPES,
    isAdmin: useSuperadminTools,
    isSuperadmin: useSuperadminTools,
    extraTools,
  }
  const runtimeAccess = authorizeRuntimeAccess({
    userId,
    workspace,
    hasWorkspaceAccess: true,
    isAdmin: useSuperadminTools,
    isSuperadmin: useSuperadminTools,
    canWriteFiles: true,
    canDeleteFiles: true,
    canEnsureRunning: true,
    canLeaseTerminal: false,
  })

  const pool = getWorkerPool()
  const abort = new AbortController()

  // Arm the timeout on the first message — NOT before entering the queue.
  // Jobs may wait in the pool queue (workspace/user slot limits) and the
  // timeout should only cover actual execution time, not queue wait.
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const armTimeout = () => {
    if (!timeoutId) {
      timeoutId = setTimeout(() => abort.abort(), timeoutSeconds * 1000)
    }
  }

  const { state, collect } = createMessageCollector(responseToolName)

  try {
    const result: QueryResult = await pool.query(credentials, {
      requestId,
      ownerKey: userId,
      workloadClass: "automation",
      payload: {
        message: fullPrompt,
        model: selectedModel,
        maxTurns: DEFAULTS.CLAUDE_MAX_TURNS,
        systemPrompt,
        oauthAccessToken,
        oauthTokens: {},
        userEnvKeys: {},
        agentConfig,
        sessionCookie,
        runtimeAccess,
      },
      onMessage: (msg: Record<string, unknown>) => {
        armTimeout()
        console.log(`[Automation ${requestId}] Message: type=${String(msg.type ?? "unknown")}`)
        collect(msg)
        if (onPersistMessage) {
          try {
            onPersistMessage(msg)
          } catch (error) {
            Sentry.captureException(error, {
              tags: { "automation.requestId": requestId },
              extra: { msgType: String(msg.type ?? "unknown") },
            })
          }
        }
      },
      signal: abort.signal,
    })

    if (isQueryResultCancelled(result)) {
      throw new Error("Automation timed out during execution")
    }

    return state
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export { WORKER_POOL }
