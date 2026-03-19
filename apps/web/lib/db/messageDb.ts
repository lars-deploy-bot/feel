"use client"

import { STREAM_ENV } from "@webalive/shared"
import Dexie, { type Table } from "dexie"
import type { Attachment } from "@/features/chat/components/ChatInput/types"
import {
  type AutomationSourceMetadata,
  type ConversationSource,
  normalizeConversationSourcePayload,
} from "@/lib/conversations/source"
import type { MessageStatus, MessageType } from "@/lib/conversations/sync-types"

/**
 * Dexie.js IndexedDB Schema for Message Storage
 *
 * User-scoped database name prevents cross-user data leakage when
 * different users log in on the same browser.
 *
 * SECURITY CRITICAL: DB is instantiated lazily AFTER user is known.
 * Never instantiate at module level.
 */

function getMessageDbEnv(): string {
  // "use client" file — only NEXT_PUBLIC_ vars are available at runtime
  const rawEnv = process.env.NEXT_PUBLIC_STREAM_ENV

  switch (rawEnv) {
    case STREAM_ENV.LOCAL:
    case STREAM_ENV.DEV:
    case STREAM_ENV.STAGING:
    case STREAM_ENV.PRODUCTION:
    case STREAM_ENV.STANDALONE:
      return rawEnv
    default:
      throw new Error(
        `Invalid message DB environment: ${String(rawEnv)}. ` +
          "Expected one of: local, dev, staging, production, standalone.",
      )
  }
}

export function getMessageDbName(userId: string): string {
  return `claude-messages-${getMessageDbEnv()}-${userId}`
}

// =============================================================================
// Type Definitions
// =============================================================================

// IMPORTANT: These types MUST NOT be used in React components directly.
// Use adapters (toUIMessage/fromUIMessage) to convert.

export type ConversationVisibility = "private" | "shared"
/** Derived from shared MESSAGE_TYPES constant — see lib/conversations/sync-types.ts */
export type DbMessageType = MessageType
/** Derived from shared MESSAGE_STATUSES constant — see lib/conversations/sync-types.ts */
export type DbMessageStatus = MessageStatus
export type DbMessageOrigin = "local" | "remote" | "migration"

/** Allowed conversation sources */
export type { AutomationSourceMetadata, ConversationSource } from "@/lib/conversations/source"
export { AUTOMATION_RUN_SOURCE } from "@/lib/conversations/source"

/**
 * Tab draft state — persisted to IndexedDB and synced to Supabase.
 * Generic container for all draft data (text, attachments, future fields).
 * Auto-saved on change, restored on tab switch or page load.
 */
export interface TabDraft {
  text?: string
  attachments?: Attachment[]
}

/**
 * Discriminated union for type-safe content storage.
 * Include future types now to prevent breaking migrations later.
 */
export type DbMessageContent =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; toolName: string; toolUseId: string; args: unknown }
  | { kind: "tool_result"; toolName: string; toolUseId: string; result: unknown }
  | { kind: "thinking"; text: string }
  | { kind: "system"; text: string; code?: string }
  | { kind: "sdk_message"; data: unknown } // SDK message passthrough
  | { kind: "file"; fileId: string; fileName: string; size: number; mimeType: string } // Future
  | { kind: "diff"; language: string; diff: string } // Future

export interface DbConversation {
  id: string
  workspace: string
  orgId: string
  creatorId: string
  title: string
  visibility: ConversationVisibility
  createdAt: number
  updatedAt: number
  // Metadata for scalability (avoid scanning messages)
  messageCount?: number
  lastMessageAt?: number
  firstUserMessageId?: string
  autoTitleSet?: boolean
  // Conversation source — required, normalized to "chat" at ingress
  source: ConversationSource
  sourceMetadata?: AutomationSourceMetadata
  // User-level favorite — Dexie is the single owner of this flag.
  // Favorited conversations stick in the top section until explicitly unfavorited.
  favorited?: boolean
  // Soft delete (NEVER hard delete - causes multi-device desync)
  deletedAt?: number
  archivedAt?: number
  // Sync metadata
  syncedAt?: number
  remoteUpdatedAt?: number // Server's updated_at for conflict detection
  pendingSync?: boolean
  // Offline retry
  lastSyncError?: string
  lastSyncAttemptAt?: number
  nextRetryAt?: number
}

export interface DbMessage {
  id: string
  tabId: string // Messages belong to tabs, NOT conversations (critical!)
  type: DbMessageType
  content: DbMessageContent // Structured content
  createdAt: number
  updatedAt: number // Updated on each snapshot during streaming
  version: number // Schema version for future migrations (current: 1)
  status: DbMessageStatus // Message lifecycle status
  origin: DbMessageOrigin // Where message came from (debugging/migrations)
  // Sequence number for reliable ordering (monotonically increasing per tab)
  // More reliable than timestamps for concurrent messages or clock skew
  seq: number
  // Interruption metadata (optional)
  abortedAt?: number // Timestamp when user stopped the stream
  errorCode?: string // Error code if status === "error"
  // Soft delete for message editing (messages "deleted" via resumeSessionAt)
  deletedAt?: number // Timestamp when user deleted this message from context
  // Attachments (images, files, templates, skills) - persisted for user messages
  attachments?: Record<string, unknown>[] // Serialized attachments array
  // Sync metadata
  syncedAt?: number
  pendingSync?: boolean // IMPORTANT: false during streaming, true only when finalized
}

export interface DbTab {
  id: string
  conversationId: string
  name: string
  position: number
  createdAt: number
  // Tab-level metadata
  messageCount?: number
  lastMessageAt?: number
  // Soft-delete: timestamp when tab was closed (undefined = open)
  closedAt?: number
  // Draft state — auto-saved like Gmail drafts, synced to Supabase
  // Contains text input and serializable attachments (no File objects)
  draft?: TabDraft
  // Sync metadata
  syncedAt?: number
  pendingSync?: boolean
}

// =============================================================================
// Database Class
// =============================================================================

class MessageDatabase extends Dexie {
  conversations!: Table<DbConversation>
  messages!: Table<DbMessage>
  tabs!: Table<DbTab>

  constructor(userId: string) {
    super(getMessageDbName(userId))

    const stores = {
      // Composite indexes for efficient queries
      // Index for "all conversations for this user across workspaces"
      conversations:
        "id, [workspace+updatedAt], [workspace+creatorId], [orgId+visibility+updatedAt], [creatorId+updatedAt], pendingSync, deletedAt",
      // Index for efficient pending sync queries per tab
      // Use [tabId+seq] for reliable ordering (sequence > timestamp for concurrent messages)
      messages: "id, [tabId+seq], [tabId+createdAt], tabId, pendingSync",
      tabs: "id, [conversationId+position], pendingSync",
    } as const

    // Version 1: Initial schema
    this.version(1).stores({
      ...stores,
    })

    // Version 2: Backfill/normalize conversation source metadata for legacy rows.
    this.version(2)
      .stores({
        ...stores,
      })
      .upgrade(tx => {
        type MutableConversation = Omit<DbConversation, "source" | "sourceMetadata"> & {
          source?: unknown
          sourceMetadata?: unknown
        }

        return tx
          .table<MutableConversation>("conversations")
          .toCollection()
          .modify(conversation => {
            const normalized = normalizeConversationSourcePayload(conversation.source, conversation.sourceMetadata)
            conversation.source = normalized.source
            conversation.sourceMetadata = normalized.sourceMetadata ?? undefined
          })
      })

    // Handle blocked events during schema upgrades
    this.on("blocked", () => {
      console.warn("[dexie] Upgrade blocked by another tab - please close other Alive tabs")
    })
  }
}

// =============================================================================
// Lazy Instantiation (SECURITY CRITICAL)
// =============================================================================

let _db: MessageDatabase | null = null
let _dbUserId: string | null = null

/**
 * Get the message database for a specific user.
 * Lazily instantiated to ensure user-scoped database name.
 */
export function getMessageDb(userId: string): MessageDatabase {
  if (!_db || _dbUserId !== userId) {
    _db = new MessageDatabase(userId)
    _dbUserId = userId
  }
  return _db
}

/**
 * Reset the database instance (for tests only).
 * DO NOT use in production.
 */
export function resetMessageDb(): void {
  _db = null
  _dbUserId = null
}

/**
 * Current schema version for new messages.
 * Increment when message structure changes.
 */
export const CURRENT_MESSAGE_VERSION = 1
