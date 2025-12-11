# Plan Part 2: Database Schema

Supabase tables and Dexie.js IndexedDB schema for message storage.

## Supabase Tables

**IMPORTANT**: The Supabase client MUST be configured with `schema: "app"`. See client setup below.

```sql
-- Conversations (all conversations stored server-side)
CREATE TABLE app.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace TEXT NOT NULL,                              -- domain name
  org_id UUID NOT NULL REFERENCES iam.orgs(org_id),
  creator_id UUID NOT NULL REFERENCES iam.users(user_id),
  title TEXT NOT NULL DEFAULT 'New conversation',
  visibility TEXT NOT NULL DEFAULT 'private',           -- 'private' | 'shared'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Metadata for scalability (avoid scanning messages)
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  first_user_message_id UUID,
  auto_title_set BOOLEAN NOT NULL DEFAULT FALSE,
  -- Soft delete (NEVER hard delete - causes multi-device desync)
  deleted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,

  CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'shared'))
);

-- Conversation tabs (multiple tabs per conversation)
CREATE TABLE app.conversation_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES app.conversations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'current',
  position INT NOT NULL DEFAULT 0,                      -- for ordering
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Tab-level metadata
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  UNIQUE(conversation_id, position)
);

-- Messages (belong to tabs, not conversations)
CREATE TABLE app.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES app.conversation_tabs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                                   -- 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'thinking' | 'system'
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),        -- Track streaming updates
  -- Message lifecycle (sync streaming state to teammates)
  status TEXT NOT NULL DEFAULT 'complete',              -- 'streaming' | 'complete' | 'interrupted' | 'error'
  aborted_at TIMESTAMPTZ,                               -- When user hit stop
  error_code TEXT,                                      -- Error code if status = 'error'
  -- Message origin (for debugging and migrations)
  origin TEXT NOT NULL DEFAULT 'local',                 -- 'local' | 'remote' | 'migration'

  CONSTRAINT valid_type CHECK (type IN ('user', 'assistant', 'tool_use', 'tool_result', 'thinking', 'system')),
  CONSTRAINT valid_status CHECK (status IN ('streaming', 'complete', 'interrupted', 'error')),
  CONSTRAINT valid_origin CHECK (origin IN ('local', 'remote', 'migration'))
);

-- Indexes
CREATE INDEX idx_conversations_workspace ON app.conversations(workspace, updated_at DESC);
CREATE INDEX idx_conversations_creator ON app.conversations(creator_id, updated_at DESC);
CREATE INDEX idx_conversations_org_shared ON app.conversations(org_id, visibility, updated_at DESC)
  WHERE visibility = 'shared';
-- Filter out deleted/archived by default
CREATE INDEX idx_conversations_active ON app.conversations(workspace, updated_at DESC)
  WHERE deleted_at IS NULL AND archived_at IS NULL;
CREATE INDEX idx_messages_tab ON app.messages(tab_id, created_at);
CREATE INDEX idx_messages_tab_status ON app.messages(tab_id, status);
CREATE INDEX idx_tabs_conversation ON app.conversation_tabs(conversation_id, position);

-- RLS Policies
ALTER TABLE app.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.conversation_tabs ENABLE ROW LEVEL SECURITY;

-- Conversations: creator can do everything, org members can view shared
CREATE POLICY "Users can manage their own conversations"
  ON app.conversations FOR ALL
  USING (creator_id = auth.uid());

CREATE POLICY "Org members can view shared conversations"
  ON app.conversations FOR SELECT
  USING (
    visibility = 'shared' AND
    org_id IN (SELECT org_id FROM iam.org_memberships WHERE user_id = auth.uid())
  );

-- Messages: same access as parent conversation (via tab)
CREATE POLICY "Users can manage messages in their conversations"
  ON app.messages FOR ALL
  USING (
    tab_id IN (
      SELECT t.id FROM app.conversation_tabs t
      JOIN app.conversations c ON c.id = t.conversation_id
      WHERE c.creator_id = auth.uid()
    )
  );

CREATE POLICY "Org members can view messages in shared conversations"
  ON app.messages FOR SELECT
  USING (
    tab_id IN (
      SELECT t.id FROM app.conversation_tabs t
      JOIN app.conversations c ON c.id = t.conversation_id
      WHERE c.visibility = 'shared'
      AND c.org_id IN (SELECT org_id FROM iam.org_memberships WHERE user_id = auth.uid())
    )
  );

-- Tabs: same access as parent conversation
CREATE POLICY "Users can manage tabs in their conversations"
  ON app.conversation_tabs FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM app.conversations WHERE creator_id = auth.uid()
    )
  );

CREATE POLICY "Org members can view tabs in shared conversations"
  ON app.conversation_tabs FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM app.conversations
      WHERE visibility = 'shared'
      AND org_id IN (SELECT org_id FROM iam.org_memberships WHERE user_id = auth.uid())
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION app.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON app.conversations
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON app.messages
  FOR EACH ROW EXECUTE FUNCTION app.update_updated_at();
```

## Supabase Client Configuration

**CRITICAL**: Configure the client to use the `app` schema. Without this, queries will fail.

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@webalive/database"

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "app" },  // REQUIRED - tables are in app schema
    }
  )

// IMPORTANT: The table names in code ("conversations", "messages", "conversation_tabs")
// refer to app.conversations, app.messages, app.conversation_tabs.
// Do NOT change without updating the migrations.
```

## Local IndexedDB (Dexie) - Cache Layer

**File: `apps/web/lib/db/messageDb.ts`**

```typescript
"use client"

import Dexie, { type Table } from "dexie"

// User-scoped DB name (SECURITY CRITICAL)
// Different users on same browser get different databases
const ENV = process.env.NEXT_PUBLIC_ENV ?? "local"

export function getMessageDbName(userId: string): string {
  return `claude-messages-${ENV}-${userId}`
}

// IMPORTANT: Types defined here MUST NOT be used in React components
// Use adapters (toUIMessage/fromUIMessage) to convert

export type ConversationVisibility = "private" | "shared"
export type DbMessageType = "user" | "assistant" | "tool_use" | "tool_result" | "thinking" | "system"
export type DbMessageStatus = "streaming" | "complete" | "interrupted" | "error"
export type DbMessageOrigin = "local" | "remote" | "migration"

// Discriminated union for type-safe content
// Include future types now to prevent breaking migrations
export type DbMessageContent =
  | { kind: "text"; text: string }
  | { kind: "tool_use"; toolName: string; toolUseId: string; args: unknown }
  | { kind: "tool_result"; toolName: string; toolUseId: string; result: unknown }
  | { kind: "thinking"; text: string }
  | { kind: "system"; text: string; code?: string }           // Future: system notices
  | { kind: "file"; fileId: string; fileName: string; size: number; mimeType: string }  // Future
  | { kind: "diff"; language: string; diff: string }          // Future: code diffs

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
  // Soft delete (NEVER hard delete)
  deletedAt?: number
  archivedAt?: number
  // Sync metadata
  syncedAt?: number
  remoteUpdatedAt?: number  // Server's updated_at for conflict detection
  pendingSync?: boolean
  // Offline retry
  lastSyncError?: string
  lastSyncAttemptAt?: number
  nextRetryAt?: number
}

export interface DbMessage {
  id: string
  tabId: string  // Messages belong to tabs, NOT conversations (critical!)
  type: DbMessageType
  content: DbMessageContent  // Structured content
  createdAt: number
  updatedAt: number  // Updated on each snapshot during streaming
  version: number  // Schema version for future migrations (current: 1)
  status: DbMessageStatus  // Message lifecycle status
  origin: DbMessageOrigin  // Where message came from (debugging/migrations)
  // Interruption metadata (optional)
  abortedAt?: number  // Timestamp when user stopped the stream
  errorCode?: string  // Error code if status === "error"
  // Sync metadata
  syncedAt?: number
  pendingSync?: boolean  // IMPORTANT: false during streaming, true only when finalized
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
  // Sync metadata
  syncedAt?: number
  pendingSync?: boolean
}

class MessageDatabase extends Dexie {
  conversations!: Table<DbConversation>
  messages!: Table<DbMessage>
  tabs!: Table<DbTab>

  constructor(userId: string) {
    super(getMessageDbName(userId))

    // Version 1: Initial schema
    this.version(1).stores({
      // Composite indexes for efficient queries
      // Index for "all conversations for this user across workspaces"
      conversations: "id, [workspace+updatedAt], [workspace+creatorId], [orgId+visibility+updatedAt], [creatorId+updatedAt], pendingSync, deletedAt",
      // Index for efficient pending sync queries per tab
      messages: "id, [tabId+createdAt], [tabId+pendingSync], pendingSync",
      tabs: "id, [conversationId+position], pendingSync",
    })

    // Version 2: Placeholder for future migrations
    // IMPORTANT: Add migrations here, don't redefine version(1) or you'll nuke data
    this.version(2)
      .stores({
        // Same schema - just demonstrating upgrade pattern
        conversations: "id, [workspace+updatedAt], [workspace+creatorId], [orgId+visibility+updatedAt], [creatorId+updatedAt], pendingSync, deletedAt",
        messages: "id, [tabId+createdAt], [tabId+pendingSync], pendingSync",
        tabs: "id, [conversationId+position], pendingSync",
      })
      .upgrade(tx => {
        // Example: ensure all messages have status field
        return tx.table("messages").toCollection().modify((m: DbMessage) => {
          if (!m.status) m.status = "complete"
          if (!m.origin) m.origin = "local"
        })
      })

    // Handle blocked events during schema upgrades
    this.on("blocked", () => {
      console.warn("[dexie] Upgrade blocked by another tab")
      // TODO: Show UI hint to close other tabs
    })
  }
}

// Lazy instantiation AFTER user is known (SECURITY CRITICAL)
let _db: MessageDatabase | null = null
let _dbUserId: string | null = null

export function getMessageDb(userId: string): MessageDatabase {
  if (!_db || _dbUserId !== userId) {
    _db = new MessageDatabase(userId)
    _dbUserId = userId
  }
  return _db
}

// For tests only - do not use in production
export function resetMessageDb(): void {
  _db = null
  _dbUserId = null
}

// Current schema version for new messages
export const CURRENT_MESSAGE_VERSION = 1
```

## Centralized Error Handling

**File: `apps/web/lib/db/safeDb.ts`**

```typescript
"use client"

/**
 * Wrap all Dexie operations to catch quota errors, blocked events, etc.
 * ALWAYS use this instead of calling db methods directly.
 */
export async function safeDb<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op()
  } catch (err) {
    console.error("[dexie] operation failed", {
      error: err,
      // Structured logging for future log ingestion
      errorType: err instanceof Error ? err.name : "unknown",
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    // TODO: surface in a global toast store
    return null
  }
}

// Usage example:
// await safeDb(() => db.messages.add(dbMessage))
// Never call db.messages.add/put/delete directly in UI or store code.
```

## Type Adapters

**File: `apps/web/lib/db/messageAdapters.ts`**

```typescript
"use client"

import type { DbMessage, DbMessageContent, DbMessageType } from "./messageDb"
import type { UIMessage } from "@/features/chat/lib/message-parser"

/**
 * Convert UIMessage to structured DbMessageContent
 */
export function toDbMessageContent(message: UIMessage): DbMessageContent {
  switch (message.type) {
    case "user":
    case "assistant":
      return { kind: "text", text: String(message.content) }
    case "tool_use":
      return {
        kind: "tool_use",
        toolName: message.toolName ?? "unknown",
        toolUseId: message.toolUseId ?? message.id,
        args: message.content,
      }
    case "tool_result":
      return {
        kind: "tool_result",
        toolName: message.toolName ?? "unknown",
        toolUseId: message.toolUseId ?? message.id,
        result: message.content,
      }
    case "thinking":
      return { kind: "thinking", text: String(message.content) }
    default:
      return { kind: "text", text: String(message.content) }
  }
}

/**
 * Convert DbMessage to UIMessage for display
 */
export function toUIMessage(dbMessage: DbMessage): UIMessage {
  const { content, type, id, createdAt } = dbMessage

  switch (content.kind) {
    case "text":
      return { id, type, content: content.text, timestamp: createdAt }
    case "tool_use":
      return {
        id,
        type: "tool_use",
        content: content.args,
        toolName: content.toolName,
        toolUseId: content.toolUseId,
        timestamp: createdAt,
      }
    case "tool_result":
      return {
        id,
        type: "tool_result",
        content: content.result,
        toolName: content.toolName,
        toolUseId: content.toolUseId,
        timestamp: createdAt,
      }
    case "thinking":
      return { id, type: "thinking", content: content.text, timestamp: createdAt }
  }
}

/**
 * Extract title from first user message content
 */
export function extractTitle(content: DbMessageContent): string {
  if (content.kind !== "text") return "New conversation"
  return content.text.slice(0, 50).replace(/\n/g, " ").trim() || "New conversation"
}
```

## Execution Order

1. **[Part 1: Architecture](./one-dexie-architecture.md)** - Read first for context
2. **[Part 2: Schema](./two-dexie-schema.md)** - Implement Supabase + Dexie schema (this doc)
3. **[Part 3: Implementation](./three-dexie-implementation.md)** - Sync service, hooks, store
4. **[Part 4: Streaming](./four-dexie-streaming-integration.md)** - Streaming message lifecycle
