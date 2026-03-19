/**
 * Shared types for conversation sync — used by BOTH client and server.
 *
 * This file is the single source of truth for:
 * - Message type and status enums (const arrays + derived types)
 * - Sync payload shapes (client → server push)
 * - Sync response shapes (server → client fetch)
 * - Conflict and result types
 *
 * IMPORTANT: No "use client" directive — importable by API routes and client code alike.
 */

// =============================================================================
// Message Type & Status Constants (single source of truth)
// =============================================================================

/** All valid message types. Derive union types from this array, never duplicate. */
export const MESSAGE_TYPES = [
  "user",
  "assistant",
  "tool_use",
  "tool_result",
  "thinking",
  "system",
  "sdk_message",
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

/** All valid message statuses. Derive union types from this array, never duplicate. */
export const MESSAGE_STATUSES = ["streaming", "complete", "interrupted", "error"] as const

export type MessageStatus = (typeof MESSAGE_STATUSES)[number]

/** Runtime validation Sets — derived from the const arrays above. */
export const VALID_MESSAGE_TYPES: ReadonlySet<string> = new Set(MESSAGE_TYPES)
export const VALID_MESSAGE_STATUSES: ReadonlySet<string> = new Set(MESSAGE_STATUSES)

// =============================================================================
// Sync Payload Types (client → server via POST /api/conversations/sync)
// =============================================================================

export interface SyncConversationPayload {
  id: string
  workspace: string
  orgId: string
  title: string
  visibility: "private" | "shared"
  messageCount: number
  lastMessageAt: number | null
  firstUserMessageId: string | null
  autoTitleSet: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  archivedAt: number | null
  /** Last known server updated_at — used for conflict detection. */
  remoteUpdatedAt?: number | null
}

export interface SyncTabPayload {
  id: string
  conversationId: string
  name: string
  position: number
  messageCount: number
  lastMessageAt: number | null
  createdAt: number
  closedAt: number | null
  draft: unknown
}

export interface SyncMessagePayload {
  id: string
  tabId: string
  type: MessageType
  content: unknown
  version: number
  status: MessageStatus
  seq: number
  abortedAt: number | null
  errorCode: string | null
  createdAt: number
  updatedAt: number
}

/** Single conversation sync request (backwards compatible). */
export interface SyncRequest {
  conversation: SyncConversationPayload
  tabs: SyncTabPayload[]
  messages: SyncMessagePayload[]
}

/** Batch sync request — multiple conversations in one request. */
export interface BatchSyncRequest {
  conversations: SyncRequest[]
}

// =============================================================================
// Sync Response Types (server → client)
// =============================================================================

export interface ConflictInfo {
  conversationId: string
  localUpdatedAt: number
  serverUpdatedAt: number
}

export interface SyncResult {
  success: boolean
  synced: {
    conversations: number
    tabs: number
    messages: number
  }
  conflicts?: ConflictInfo[]
  errors?: string[]
}

// =============================================================================
// Fetch Response Types (server → client via GET /api/conversations)
// =============================================================================

export interface ServerTab {
  id: string
  conversationId: string
  name: string
  position: number
  messageCount: number
  lastMessageAt: number | null
  createdAt: number
  closedAt: number | null
  draft: unknown
}

export interface ServerConversation {
  id: string
  workspace: string
  orgId: string
  creatorId: string
  title: string
  visibility: "private" | "shared"
  messageCount: number
  lastMessageAt: number | null
  firstUserMessageId: string | null
  autoTitleSet: boolean
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  archivedAt: number | null
  source: unknown
  sourceMetadata: unknown
  tabs: ServerTab[]
}

export interface ConversationsResponse {
  own: ServerConversation[]
  shared: ServerConversation[]
  hasMore?: boolean
  nextCursor?: string | null
}

export interface ServerMessage {
  id: string
  tabId: string
  type: string
  content: unknown
  version: number
  status: string
  seq: number
  abortedAt: number | null
  errorCode: string | null
  createdAt: number
  updatedAt: number
}

export interface MessagesResponse {
  messages: ServerMessage[]
  hasMore: boolean
  nextCursor: string | null
}
