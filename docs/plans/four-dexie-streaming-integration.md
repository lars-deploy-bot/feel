# Plan Part 4: Streaming Integration

How streaming messages flow from server to Dexie persistence, with multi-tab support.

## Current State Analysis

### Server Streaming Protocol

The server emits NDJSON events via `/api/claude/stream`:

```
bridge_start     → Stream initialized
bridge_message   → Complete SDK message (user, assistant, tool_use, etc.)
bridge_complete  → Successful end with result
bridge_interrupt → User cancelled (via cancel endpoint)
bridge_error     → Stream failed
```

**Key insight:** Each `bridge_message` contains a *complete* SDK message, not character-by-character streaming. The "streaming" is at the message level - multiple complete messages arriving over time.

## Shared Event Types (CRITICAL)

**Create a shared type module** imported by both server and client to prevent drift:

**File: `apps/web/lib/bridge/streamTypes.ts`**

```typescript
// IMPORTANT: This file is the single source of truth for stream event types.
// Both server (ndjson-stream-handler.ts) and client (useStreamHandler.ts) import from here.
// DO NOT duplicate these types elsewhere.

export type BridgeStreamType =
  | "bridge_start"
  | "bridge_message"
  | "bridge_complete"
  | "bridge_interrupt"
  | "bridge_error"

export interface BridgeBaseEvent {
  type: BridgeStreamType
  requestId: string
}

export interface BridgeStartEvent extends BridgeBaseEvent {
  type: "bridge_start"
}

export interface BridgeMessageEvent extends BridgeBaseEvent {
  type: "bridge_message"
  messageType: "user" | "assistant" | "tool_use" | "tool_result" | "thinking" | "system"
  complete: boolean  // true if this is the final state of this message
  content: unknown
}

export interface BridgeCompleteEvent extends BridgeBaseEvent {
  type: "bridge_complete"
  result: unknown
}

export interface BridgeInterruptEvent extends BridgeBaseEvent {
  type: "bridge_interrupt"
  source: "user" | "system"
  lastMessageId?: string
}

export interface BridgeErrorEvent extends BridgeBaseEvent {
  type: "bridge_error"
  code: string
  message: string
}

export type BridgeEvent =
  | BridgeStartEvent
  | BridgeMessageEvent
  | BridgeCompleteEvent
  | BridgeInterruptEvent
  | BridgeErrorEvent

// Type guard
export function isBridgeEvent(e: unknown): e is BridgeEvent {
  return typeof e === "object" && e !== null && "type" in e &&
    ["bridge_start", "bridge_message", "bridge_complete", "bridge_interrupt", "bridge_error"]
      .includes((e as { type: string }).type)
}
```

## Architecture

### Source of Truth

```
┌─────────────────────────────────────────────────────────────────┐
│                    Streaming Tab                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Zustand (in-memory)              Dexie (IndexedDB)            │
│   ───────────────────              ──────────────────           │
│                                                                 │
│   streamingBuffers: {              DbMessage {                  │
│     [msgId]: "live text..."          streamState: "streaming"   │
│   }                                   content: "snapshot..."    │
│                                       updatedAt: ...            │
│   activeStreamByTab: {             }                            │
│     [tabId]: msgId                                              │
│   }                                                             │
│                                                                 │
│   UI renders from Zustand buffer (real-time)                    │
│   Dexie gets debounced snapshots (every 300-500ms)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Other Tabs / Windows                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Zustand: streamingBuffers = {} (empty - different instance)   │
│                                                                 │
│   UI renders from Dexie via useLiveQuery                        │
│   Sees lagging snapshots, but still gets updates                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    After Page Refresh                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Zustand: fresh instance, no buffers                           │
│                                                                 │
│   Dexie: message with streamState="streaming" + old updatedAt   │
│   → Treated as "interrupted" in UI (stale stream detection)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Schema Updates

### DbMessage Extended

Update `messageDb.ts`:

```typescript
export type DbMessageStatus = "complete" | "streaming" | "interrupted" | "error"

export interface DbMessage {
  id: string
  tabId: string
  type: DbMessageType
  content: DbMessageContent
  createdAt: number
  updatedAt: number  // NEW: track last update for stale detection
  version: number
  status: DbMessageStatus  // renamed from streamState for consistency
  // Optional metadata for interruptions/errors
  abortedAt?: number
  errorCode?: string
  // Sync metadata
  syncedAt?: number
  pendingSync?: boolean  // Only true when status !== "streaming"
}
```

### Zustand Streaming State

Add to message store (NOT persisted):

```typescript
interface MessageStoreState {
  // ... existing fields

  // Streaming state (per-tab, in-memory only)
  activeStreamByTab: Record<string, string | null>  // tabId -> streaming messageId
  streamingBuffers: Record<string, string>          // messageId -> current text
}
```

## Implementation

### 1. Stream Lifecycle Actions

**File: `apps/web/lib/stores/messageStore.ts`** (additions)

```typescript
import { getMessageDb, CURRENT_MESSAGE_VERSION, type DbMessage } from "@/lib/db/messageDb"
import { safeDb } from "@/lib/db/safeDb"
import { queueSync } from "@/lib/db/conversationSync"

// Debounce helper for Dexie snapshots
let flushTimeouts: Record<string, ReturnType<typeof setTimeout>> = {}
const FLUSH_DEBOUNCE_MS = 300

function scheduleFlushStreamingSnapshot(messageId: string, userId: string) {
  if (flushTimeouts[messageId]) {
    clearTimeout(flushTimeouts[messageId])
  }
  flushTimeouts[messageId] = setTimeout(() => {
    flushStreamingSnapshot(messageId, userId)
    delete flushTimeouts[messageId]
  }, FLUSH_DEBOUNCE_MS)
}

async function flushStreamingSnapshot(messageId: string, userId: string) {
  const { streamingBuffers } = useMessageStore.getState()
  const text = streamingBuffers[messageId]
  if (text == null) return

  const db = getMessageDb(userId)
  await safeDb(() => db.messages.update(messageId, {
    content: { kind: "text", text },
    updatedAt: Date.now(),
    status: "streaming",
    // Still pendingSync: false - don't sync partials
  }))
}

// Track already-finalized messages to prevent double-finalization race conditions
const alreadyFinalized = new Set<string>()

// Store actions (add to existing store)
// ... existing state
activeStreamByTab: {},
streamingBuffers: {},

/**
 * Start a new assistant streaming message
 * Creates skeleton in Dexie immediately (for other tabs/refresh)
 */
startAssistantStream: async (tabId: string) => {
  const { currentConversationId, session } = get()
  if (!session) throw new Error("No session")
  if (!currentConversationId) throw new Error("No active conversation")

  const db = getMessageDb(session.userId)
  const id = crypto.randomUUID()
  const now = Date.now()

  // Create skeleton in Dexie - other tabs will see this
  const dbMessage: DbMessage = {
    id,
    tabId,
    type: "assistant",
    content: { kind: "text", text: "" },
    createdAt: now,
    updatedAt: now,
    version: CURRENT_MESSAGE_VERSION,
    status: "streaming",
    origin: "local",
    pendingSync: false,  // Don't sync partials to Supabase
  }

  await safeDb(() => db.messages.add(dbMessage))

  set(state => ({
    activeStreamByTab: { ...state.activeStreamByTab, [tabId]: id },
    streamingBuffers: { ...state.streamingBuffers, [id]: "" },
  }))

  return id
},

/**
 * Append chunk to streaming message
 * Updates Zustand immediately, debounces Dexie writes
 */
appendToAssistantStream: (messageId: string, deltaText: string) => {
  const { streamingBuffers, session } = get()
  if (!session) return

  const prev = streamingBuffers[messageId] ?? ""
  const next = prev + deltaText

  set({
    streamingBuffers: { ...streamingBuffers, [messageId]: next },
  })

  // Debounced flush to Dexie for other tabs/refresh resilience
  scheduleFlushStreamingSnapshot(messageId, session.userId)
},

/**
 * Finalize stream successfully
 * Marks complete, enables sync to Supabase
 * IDEMPOTENT: Safe to call multiple times
 */
finalizeAssistantStream: async (messageId: string) => {
  // Guard against double-finalization (race conditions from out-of-order events)
  if (alreadyFinalized.has(messageId)) return
  alreadyFinalized.add(messageId)

  const { streamingBuffers, activeStreamByTab, currentConversationId, session } = get()
  if (!session) return

  const db = getMessageDb(session.userId)
  const text = streamingBuffers[messageId] ?? ""

  await safeDb(() => db.messages.update(messageId, {
    content: { kind: "text", text },
    updatedAt: Date.now(),
    status: "complete",
    pendingSync: true,  // Now we sync to Supabase
  }))

  // Clear in-memory state
  const tabId = Object.entries(activeStreamByTab).find(
    ([_, id]) => id === messageId
  )?.[0]

  set(state => {
    const newBuffers = { ...state.streamingBuffers }
    delete newBuffers[messageId]
    return {
      streamingBuffers: newBuffers,
      activeStreamByTab: tabId
        ? { ...state.activeStreamByTab, [tabId]: null }
        : state.activeStreamByTab,
    }
  })

  if (currentConversationId) {
    queueSync(currentConversationId, session.userId)
  }

  // Clean up finalization tracker after a delay
  setTimeout(() => alreadyFinalized.delete(messageId), 60000)
},

/**
 * User hit "Stop" - keep partial content, mark as interrupted
 * IDEMPOTENT: Safe to call multiple times
 */
stopAssistantStream: async (messageId: string) => {
  if (alreadyFinalized.has(messageId)) return
  alreadyFinalized.add(messageId)

  const { streamingBuffers, activeStreamByTab, currentConversationId, session } = get()
  if (!session) return

  const db = getMessageDb(session.userId)
  const text = streamingBuffers[messageId] ?? ""

  await safeDb(() => db.messages.update(messageId, {
    content: { kind: "text", text },
    updatedAt: Date.now(),
    status: "interrupted",
    abortedAt: Date.now(),
    pendingSync: true,  // Sync the interrupted state
  }))

  const tabId = Object.entries(activeStreamByTab).find(
    ([_, id]) => id === messageId
  )?.[0]

  set(state => {
    const newBuffers = { ...state.streamingBuffers }
    delete newBuffers[messageId]
    return {
      streamingBuffers: newBuffers,
      activeStreamByTab: tabId
        ? { ...state.activeStreamByTab, [tabId]: null }
        : state.activeStreamByTab,
    }
  })

  if (currentConversationId) {
    queueSync(currentConversationId, session.userId)
  }

  setTimeout(() => alreadyFinalized.delete(messageId), 60000)
},

/**
 * Stream failed - keep partial content, mark as error
 * IDEMPOTENT: Safe to call multiple times
 */
failAssistantStream: async (messageId: string, errorCode?: string) => {
  if (alreadyFinalized.has(messageId)) return
  alreadyFinalized.add(messageId)

  const { streamingBuffers, activeStreamByTab, currentConversationId, session } = get()
  if (!session) return

  const db = getMessageDb(session.userId)
  const text = streamingBuffers[messageId] ?? ""

  await safeDb(() => db.messages.update(messageId, {
    content: { kind: "text", text },
    updatedAt: Date.now(),
    status: "error",
    errorCode: errorCode ?? "unknown",
    pendingSync: true,
  }))

  const tabId = Object.entries(activeStreamByTab).find(
    ([_, id]) => id === messageId
  )?.[0]

  set(state => {
    const newBuffers = { ...state.streamingBuffers }
    delete newBuffers[messageId]
    return {
      streamingBuffers: newBuffers,
      activeStreamByTab: tabId
        ? { ...state.activeStreamByTab, [tabId]: null }
        : state.activeStreamByTab,
    }
  })

  if (currentConversationId) {
    queueSync(currentConversationId, session.userId)
  }

  setTimeout(() => alreadyFinalized.delete(messageId), 60000)
},
```

### 2. UI Message Hook

Merge Dexie data with in-memory streaming buffers:

```typescript
// apps/web/features/chat/hooks/useTabMessages.ts
"use client"

import { useMemo } from "react"
import { useMessages } from "@/lib/db/useMessageDb"
import { useMessageStore } from "@/lib/stores/messageStore"
import { toUIMessage } from "@/lib/db/messageAdapters"
import type { UIMessage } from "@/features/chat/lib/message-parser"

const STALE_STREAM_THRESHOLD_MS = 30_000  // 30 seconds

/**
 * Get messages for a tab, merging persisted + streaming state
 * Handles stale stream detection for page refresh scenarios
 */
export function useTabMessages(tabId: string | null): UIMessage[] {
  const dbMessages = useMessages(tabId)
  const streamingBuffers = useMessageStore(s => s.streamingBuffers)

  return useMemo(() => {
    if (!dbMessages) return []

    const now = Date.now()

    return dbMessages.map(dbMsg => {
      const ui = toUIMessage(dbMsg)

      // If this message is streaming...
      if (dbMsg.status === "streaming") {
        // Check if we have a live buffer (same tab)
        const buffered = streamingBuffers[dbMsg.id]
        if (typeof buffered === "string") {
          // Live streaming in this tab - use buffer
          return {
            ...ui,
            content: buffered,
            isStreaming: true,
          }
        }

        // No buffer - either different tab or page was refreshed
        // Check if it's stale (old updatedAt)
        const isStale = now - dbMsg.updatedAt > STALE_STREAM_THRESHOLD_MS
        if (isStale) {
          // Treat as interrupted in UI
          return {
            ...ui,
            status: "interrupted",
            isStreaming: false,
          }
        }

        // Recent streaming from another tab - show snapshot
        return {
          ...ui,
          isStreaming: true,  // Show loading indicator
        }
      }

      return ui
    })
  }, [dbMessages, streamingBuffers])
}
```

### 3. Stream Event Handler

Wire up NDJSON events to store actions using the shared event types:

```typescript
// apps/web/features/chat/hooks/useStreamHandler.ts
"use client"

import { useCallback, useRef } from "react"
import { useMessageStore } from "@/lib/stores/messageStore"
import {
  type BridgeEvent,
  type BridgeMessageEvent,
  isBridgeEvent,
} from "@/lib/bridge/streamTypes"
import type { UIMessage } from "@/features/chat/lib/message-parser"

interface UseStreamHandlerOptions {
  tabId: string
  onUserMessage?: (message: UIMessage) => Promise<void>
}

export function useStreamHandler({ tabId, onUserMessage }: UseStreamHandlerOptions) {
  const currentStreamId = useRef<string | null>(null)

  const startAssistantStream = useMessageStore(s => s.startAssistantStream)
  const appendToAssistantStream = useMessageStore(s => s.appendToAssistantStream)
  const finalizeAssistantStream = useMessageStore(s => s.finalizeAssistantStream)
  const stopAssistantStream = useMessageStore(s => s.stopAssistantStream)
  const failAssistantStream = useMessageStore(s => s.failAssistantStream)
  const addMessage = useMessageStore(s => s.addMessage)

  /**
   * Handle incoming NDJSON event from stream
   * Uses typed BridgeEvent from shared types module
   */
  const handleStreamEvent = useCallback(async (event: unknown) => {
    // Type guard to ensure valid event
    if (!isBridgeEvent(event)) {
      console.warn("[stream] Invalid event received:", event)
      return
    }

    const e: BridgeEvent = event

    switch (e.type) {
      case "bridge_start":
        // Stream starting - create assistant message skeleton
        currentStreamId.current = await startAssistantStream(tabId)
        break

      case "bridge_message": {
        const msg = e as BridgeMessageEvent

        if (msg.messageType === "assistant" && currentStreamId.current) {
          // Assistant chunk - append to stream
          // Check the `complete` flag to know if this is final
          const content = msg.content as { message?: { content?: Array<{ text?: string }> } }
          const text = content.message?.content?.[0]?.text ?? ""

          if (msg.complete) {
            // Final message content - finalize instead of append
            appendToAssistantStream(currentStreamId.current, text)
            await finalizeAssistantStream(currentStreamId.current)
            currentStreamId.current = null
          } else {
            appendToAssistantStream(currentStreamId.current, text)
          }
        } else if (msg.messageType === "user") {
          // User message - write directly to Dexie
          const uiMessage = parseUserMessage(msg.content)
          if (uiMessage && onUserMessage) {
            await onUserMessage(uiMessage)
          }
        } else {
          // Tool use, tool result, thinking - write directly
          const uiMessage = parseMessage(msg)
          if (uiMessage) {
            await addMessage(uiMessage)
          }
        }
        break
      }

      case "bridge_complete":
        // Stream finished successfully
        if (currentStreamId.current) {
          await finalizeAssistantStream(currentStreamId.current)
          currentStreamId.current = null
        }
        break

      case "bridge_interrupt":
        // User cancelled (or system interrupted)
        if (currentStreamId.current) {
          await stopAssistantStream(currentStreamId.current)
          currentStreamId.current = null
        }
        break

      case "bridge_error":
        // Stream failed
        if (currentStreamId.current) {
          await failAssistantStream(currentStreamId.current, e.code)
          currentStreamId.current = null
        }
        break
    }
  }, [tabId, startAssistantStream, appendToAssistantStream, finalizeAssistantStream, stopAssistantStream, failAssistantStream, addMessage, onUserMessage])

  /**
   * Cancel current stream (user hit stop)
   * Safe to call even if no stream is active (idempotent)
   */
  const cancelStream = useCallback(async () => {
    if (currentStreamId.current) {
      await stopAssistantStream(currentStreamId.current)
      currentStreamId.current = null
    }
  }, [stopAssistantStream])

  return {
    handleStreamEvent,
    cancelStream,
    isStreaming: currentStreamId.current !== null,
  }
}

// Helper to parse message content (simplified)
function parseMessage(msg: BridgeMessageEvent): UIMessage | null {
  // Implementation depends on actual message format
  return null
}

function parseUserMessage(content: unknown): UIMessage | null {
  // Implementation depends on actual message format
  return null
}
```

## Edge Cases

### 1. Page Refresh During Stream

- Dexie has message with `status: "streaming"` and `updatedAt` from last snapshot
- On reload, `useTabMessages` detects stale stream (updatedAt > 30s ago)
- UI shows message as "interrupted" with partial content
- User can retry if needed

### 2. Multiple Tabs Same Conversation

- Tab A starts stream → creates `DbMessage` with `status: "streaming"`
- Tab B sees snapshot via `useLiveQuery` (lagging ~300ms)
- Tab A completes → `status: "complete"`, `pendingSync: true`
- Tab B sees final message via `useLiveQuery`

### 3. User Sends New Prompt Mid-Stream

- Current stream continues (or backend cancels it)
- New user message written to Dexie
- New assistant stream starts (new message ID)
- Old stream remains with `status: "interrupted"` if cancelled

### 4. Network Disconnect

- Stream stops receiving events
- Zustand buffer has partial content
- Dexie has last snapshot
- On reconnect attempt, if backend says error → `failAssistantStream`
- If no response, frontend can timeout and call `failAssistantStream`

## Server Changes (Minimal)

The server already emits the right events. No changes required.

Optional enhancement for better interruption handling:
```typescript
// In ndjson-stream-handler.ts
createInterruptMessage(requestId, source, {
  lastMessageId: lastAssistantMessageId
})
```

## File Changes Summary

| File | Change |
|------|--------|
| `apps/web/lib/bridge/streamTypes.ts` | **NEW** - Shared event types (server + client) |
| `apps/web/lib/db/messageDb.ts` | Add `status`, `updatedAt`, `abortedAt`, `errorCode`, `origin` to `DbMessage` |
| `apps/web/lib/stores/messageStore.ts` | Add streaming state + 5 idempotent lifecycle actions |
| `apps/web/features/chat/hooks/useTabMessages.ts` | **NEW** - Merge Dexie + streaming buffers with stale detection |
| `apps/web/features/chat/hooks/useStreamHandler.ts` | **NEW** - Wire typed NDJSON events to store |

## Testing Checklist

### Stream Lifecycle
1. **Complete stream** → message `status: "complete"`, synced to Supabase
2. **Cancel mid-stream** → message `status: "interrupted"` with partial content
3. **Error mid-stream** → message `status: "error"` with partial content
4. **Rapid chunks** → debounced Dexie writes, no performance issues

### Stale Detection
5. **Refresh during stream** → message shown as interrupted (stale > 30s)
6. **Recent streaming in another tab** → shows loading indicator

### Multi-Tab
7. **Stream in tab A** → tab B sees lagging snapshots via useLiveQuery
8. **Complete in tab A** → tab B sees final message immediately

### Race Conditions
9. **Double finalization** → idempotent, no errors
10. **ERROR after COMPLETE** → first event wins, second ignored
11. **Lost currentStreamId** → gracefully handles null refs

### Shared Types
12. **Invalid event shape** → caught by type guard, logged, ignored
13. **Server/client type drift** → prevented by shared module

## Timeline

- Shared types: 30 min
- Schema updates: 30 min
- Store streaming actions: 2 hours
- useTabMessages hook: 1 hour
- useStreamHandler hook: 2 hours
- Integration with existing chat: 2 hours
- Testing: 2.5 hours

**Total: ~10.5 hours**

## Execution Order

1. **[Part 1: Architecture](./one-dexie-architecture.md)** - Read first for context
2. **[Part 2: Schema](./two-dexie-schema.md)** - Implement Supabase + Dexie schema
3. **[Part 3: Implementation](./three-dexie-implementation.md)** - Sync service, hooks, store
4. **[Part 4: Streaming](./four-dexie-streaming-integration.md)** - Streaming message lifecycle (this doc)
