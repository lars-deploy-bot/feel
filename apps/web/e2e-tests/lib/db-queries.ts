/**
 * Type-safe Supabase query helpers for live E2E tests.
 *
 * Column names are compile-time validated against AppDatabase via `keyof Row`.
 * A typo like "mesage_count" will fail at compile time, not at runtime.
 */

import type { AppDatabase } from "@webalive/database"
import { createServiceAppClient } from "@/lib/supabase/service"

// ---------------------------------------------------------------------------
// Type-safe column constants
// ---------------------------------------------------------------------------

type ConversationRow = AppDatabase["app"]["Tables"]["conversations"]["Row"]
type ConversationTabRow = AppDatabase["app"]["Tables"]["conversation_tabs"]["Row"]
type MessageRow = AppDatabase["app"]["Tables"]["messages"]["Row"]

// Column constants: compile-time validated via `keyof Row`.
// A typo like "mesage_count" will fail here, not at runtime.
// Used in .eq()/.gte()/.in()/.order() — .select() uses string literals (Supabase typegen requirement).
const COL_WORKSPACE: keyof ConversationRow = "workspace"
const COL_LAST_MESSAGE_AT: keyof ConversationRow = "last_message_at"
const COL_MESSAGE_COUNT: keyof ConversationRow = "message_count"

const COL_TAB_CONVERSATION_ID: keyof ConversationTabRow = "conversation_id"

const COL_MSG_TAB_ID: keyof MessageRow = "tab_id"
const COL_MSG_SEQ: keyof MessageRow = "seq"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 500
const DEFAULT_POLL_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Poll until a conversation matching the criteria appears.
 * Uses `last_message_at` so serial tests sharing a page work correctly.
 */
export async function pollForConversation(opts: {
  workspace: string
  minMessages: number
  afterTime: Date
  timeoutMs?: number
}): Promise<{ conversationId: string; messageCount: number }> {
  const { workspace, minMessages, afterTime, timeoutMs = DEFAULT_POLL_TIMEOUT_MS } = opts
  const app = createServiceAppClient()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { data } = await app
      .from("conversations")
      .select("conversation_id, message_count")
      .eq(COL_WORKSPACE, workspace)
      .gte(COL_LAST_MESSAGE_AT, afterTime.toISOString())
      .gte(COL_MESSAGE_COUNT, minMessages)
      .order(COL_LAST_MESSAGE_AT, { ascending: false })
      .limit(1)

    const convo = data?.[0]
    if (convo) {
      return { conversationId: convo.conversation_id, messageCount: convo.message_count }
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  throw new Error(
    `Timeout: no conversation in "${workspace}" with >= ${minMessages} messages after ${afterTime.toISOString()}`,
  )
}

/** Get ordered message types for a conversation (via conversation_tabs → messages join). */
export async function getMessageTypes(conversationId: string): Promise<string[]> {
  const app = createServiceAppClient()

  const { data: tabs, error: tabsErr } = await app
    .from("conversation_tabs")
    .select("tab_id")
    .eq(COL_TAB_CONVERSATION_ID, conversationId)

  if (tabsErr) throw new Error(`tabs query: ${tabsErr.message}`)
  if (!tabs?.length) throw new Error(`no tabs for conversation ${conversationId}`)

  const { data: messages, error: msgsErr } = await app
    .from("messages")
    .select("type")
    .in(
      COL_MSG_TAB_ID,
      tabs.map(t => t.tab_id),
    )
    .order(COL_MSG_SEQ, { ascending: true })

  if (msgsErr) throw new Error(`messages query: ${msgsErr.message}`)
  if (!messages?.length) throw new Error(`no messages for conversation ${conversationId}`)

  return messages.map(m => m.type)
}
