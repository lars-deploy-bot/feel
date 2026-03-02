/**
 * Persist SDK messages into app.messages for automation run transcripts.
 *
 * Each call inserts a single row into `app.messages` so the automation
 * transcript is visible through the normal chat UI.
 *
 * Content is wrapped as `{ kind: "sdk_message", data: <sdkMessage> }` to match
 * the DbMessageContent discriminated union the frontend expects.
 *
 * Error handling: logs and returns false — message persistence must never
 * block or kill the run.
 */

import type { Json } from "@webalive/database"
import type { AppClient, MessageInsert } from "./types"

/**
 * SDK message types that produce meaningful transcript entries.
 * "assistant" = Claude response (text, tool_use blocks)
 * "user"      = tool results
 * "result"    = final result (success/error, cost, usage)
 *
 * Excluded: "system" (init, compaction, status), "tool_progress" (ephemeral timers),
 * "auth_status" (OAuth progress), "compact_boundary" (internal markers).
 */
const TRANSCRIPT_MESSAGE_TYPES = new Set(["assistant", "user", "result"])

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** IPC message whose content has been validated as a persistable SDK message. */
export interface PersistableMessage extends Record<string, unknown> {
  type: "message"
  content: Json
}

/**
 * Returns true if this IPC message should be persisted to the transcript.
 * Also narrows the type so `msg.content` is typed as `Json` after the check.
 *
 * Filters at two levels:
 * 1. IPC level: only "message" type (skips "session", "complete")
 * 2. SDK level: only assistant/user/result (skips system, tool_progress, auth_status)
 *
 * The IPC "complete" envelope is NOT persisted — result data (cost, usage, turns)
 * is already captured by the message collector and stored in automation_runs.
 */
export function shouldPersist(msg: Record<string, unknown>): msg is PersistableMessage {
  // Only IPC "message" type carries SDK messages worth persisting.
  if (msg.type !== "message") return false

  // Within IPC "message", check inner SDK message type.
  if (!isRecord(msg.content)) return false

  const inner = msg.content
  // Worker pool path: inner.messageType
  if (typeof inner.messageType === "string") {
    return TRANSCRIPT_MESSAGE_TYPES.has(inner.messageType)
  }
  // Direct SDK path: inner.role
  if (typeof inner.role === "string") {
    return TRANSCRIPT_MESSAGE_TYPES.has(inner.role)
  }

  return false
}

/**
 * Unwrap the NDJSON stream envelope from an IPC message's content.
 *
 * Worker pool sends:
 *   { type: "stream_message", messageType: "assistant", content: <SDK msg> }
 *
 * Direct SDK sends the SDK message directly:
 *   { role: "assistant", content: [...] }
 *
 * This function extracts the inner SDK message from the worker pool envelope,
 * or returns the value as-is for the direct SDK path.
 *
 * Must be called AFTER shouldPersist() confirms the message is persistable.
 */
export function unwrapStreamEnvelope(ipcContent: Json): Json {
  if (!isRecord(ipcContent)) return ipcContent

  // Worker pool path: has messageType + nested content object
  if (typeof ipcContent.messageType === "string" && ipcContent.content != null) {
    return ipcContent.content as Json
  }

  // Direct SDK path: already the SDK message
  return ipcContent
}

export interface PersistMessageOptions {
  supabase: AppClient
  tabId: string
  seq: number
  sdkMessage: Json
}

export async function persistRunMessage(opts: PersistMessageOptions): Promise<boolean> {
  try {
    // Wrap as { kind: "sdk_message", data: ... } to match the DbMessageContent
    // discriminated union. The frontend's toUIMessage() switches on content.kind.
    const row: MessageInsert = {
      tab_id: opts.tabId,
      seq: opts.seq,
      type: "sdk_message",
      content: { kind: "sdk_message", data: opts.sdkMessage },
      status: "complete",
      version: 1,
    }
    const { error } = await opts.supabase.from("messages").insert(row)
    if (error) {
      console.error(`[Engine] persistRunMessage seq=${opts.seq} failed:`, error.message)
      return false
    }
    return true
  } catch (err) {
    console.error(`[Engine] persistRunMessage seq=${opts.seq} threw:`, err)
    return false
  }
}

/**
 * Update conversation and tab metadata after all messages are persisted.
 * Sets message_count, last_message_at, updated_at so the conversation
 * appears correctly in conversation lists and sorting.
 */
export async function updateConversationMetadata(opts: {
  supabase: AppClient
  conversationId: string
  tabId: string
  messageCount: number
}): Promise<void> {
  const now = new Date().toISOString()

  try {
    // Update tab message_count and last_message_at
    const { error: tabError } = await opts.supabase
      .from("conversation_tabs")
      .update({
        message_count: opts.messageCount,
        last_message_at: now,
      })
      .eq("tab_id", opts.tabId)

    if (tabError) {
      console.error("[Engine] updateConversationMetadata tab failed:", tabError.message)
    }

    // Update conversation message_count, last_message_at, updated_at
    const { error: convError } = await opts.supabase
      .from("conversations")
      .update({
        message_count: opts.messageCount,
        last_message_at: now,
        updated_at: now,
      })
      .eq("conversation_id", opts.conversationId)

    if (convError) {
      console.error("[Engine] updateConversationMetadata conversation failed:", convError.message)
    }
  } catch (err) {
    console.error("[Engine] updateConversationMetadata threw:", err)
  }
}
