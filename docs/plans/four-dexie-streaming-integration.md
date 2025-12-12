# Plan Part 4: Direct Broker Streaming

How streaming works with direct browser-to-broker communication.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Client                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User sends message                                                   │
│     │                                                                    │
│     ▼                                                                    │
│  2. POST /api/stream-token → { token, brokerUrl }                       │
│     │                                                                    │
│     ▼                                                                    │
│  3. POST brokerUrl/v1/streams (with token) → { streamId }               │
│     │                                                                    │
│     ▼                                                                    │
│  4. GET brokerUrl/v1/streams/:id/events (SSE)                           │
│     │                                                                    │
│     │  ┌─────────────────────────────────────────┐                      │
│     │  │         Zustand (in-memory)             │                      │
│     │  │  • isStreaming: true                    │                      │
│     │  │  • streamText: "Hello, I can..."        │                      │
│     │  │  • currentStreamId: "abc-123"           │                      │
│     │  │  • lastSeq: 47                          │                      │
│     │  └─────────────────────────────────────────┘                      │
│     │                                                                    │
│     ▼                                                                    │
│  5. On stream_complete → Write final message to Dexie                   │
│     │                                                                    │
│     ▼                                                                    │
│  6. Dexie syncs to Supabase (debounced)                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Shared Event Types

**File: `packages/bridge-types/src/events.ts`**

```typescript
// Protocol version for compatibility checks
export const BRIDGE_PROTOCOL_VERSION = "1.0.0"

// Base event with sequence number for ordering/replay
export interface BaseStreamEvent {
  seq: number           // Monotonically increasing
  timestamp: number     // Unix ms
}

// Stream started
export interface StreamStartEvent extends BaseStreamEvent {
  type: "stream_start"
  streamId: string
  requestId: string
}

// Complete SDK message
export interface StreamMessageEvent extends BaseStreamEvent {
  type: "stream_message"
  messageType: "user" | "assistant" | "tool_use" | "tool_result" | "thinking" | "system"
  messageId: string
  content: unknown
  complete: boolean     // True if this is final state of this message
}

// Text delta for streaming assistant response
export interface StreamChunkEvent extends BaseStreamEvent {
  type: "stream_chunk"
  messageId: string
  delta: string         // Text to append
}

// Periodic state sync (every 5s)
export interface StreamStateEvent extends BaseStreamEvent {
  type: "stream_state"
  state: "running" | "paused"
  lastMessageId: string
}

// Stream completed successfully
export interface StreamCompleteEvent extends BaseStreamEvent {
  type: "stream_complete"
  result: unknown
  totalTokens: {
    input: number
    output: number
  }
}

// Stream interrupted
export interface StreamInterruptEvent extends BaseStreamEvent {
  type: "stream_interrupt"
  source: "user" | "system" | "timeout"
  lastMessageId?: string
}

// Stream error
export interface StreamErrorEvent extends BaseStreamEvent {
  type: "stream_error"
  code: string
  message: string
  retryable: boolean
}

// Union type
export type StreamEvent =
  | StreamStartEvent
  | StreamMessageEvent
  | StreamChunkEvent
  | StreamStateEvent
  | StreamCompleteEvent
  | StreamInterruptEvent
  | StreamErrorEvent

// Type guard
export function isStreamEvent(e: unknown): e is StreamEvent {
  if (typeof e !== "object" || e === null || !("type" in e)) return false
  const validTypes = [
    "stream_start", "stream_message", "stream_chunk",
    "stream_state", "stream_complete", "stream_interrupt", "stream_error"
  ]
  return validTypes.includes((e as { type: string }).type)
}
```

**File: `packages/bridge-types/src/tokens.ts`**

```typescript
export interface StreamTokenPayload {
  sub: string           // userId
  org: string           // orgId
  ws: string            // workspace
  tab: string           // tabId
  rid: string           // requestId (idempotency)
  exp: number           // Expiry (unix seconds)
  iat: number           // Issued at (unix seconds)
  mdl?: string          // Model override (if allowed)
}

export interface TokenResponse {
  token: string
  brokerUrl: string
  expiresAt: number
}

export interface StreamStartRequest {
  messages: Array<{
    role: "user" | "assistant"
    content: string
  }>
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface StreamStartResponse {
  streamId: string
  status: "started" | "already_exists"
  existingSeq?: number
}
```

**File: `packages/bridge-types/src/index.ts`**

```typescript
export * from "./events"
export * from "./tokens"

export const BRIDGE_PROTOCOL_VERSION = "1.0.0"
```

## Client Implementation

### Stream Client Hook

**File: `apps/web/features/chat/hooks/useStreamClient.ts`**

```typescript
"use client"

import { useCallback, useRef } from "react"
import { useMessageStore } from "@/lib/stores/messageStore"
import type {
  StreamEvent,
  StreamStartRequest,
  StreamStartResponse,
  TokenResponse,
  isStreamEvent,
} from "@webalive/bridge-types"

interface UseStreamClientOptions {
  tabId: string
  workspace: string
  onError?: (error: Error) => void
}

export function useStreamClient({ tabId, workspace, onError }: UseStreamClientOptions) {
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastSeqRef = useRef<number>(0)
  const streamIdRef = useRef<string | null>(null)

  const setStreamingState = useMessageStore(s => s.setStreamingState)
  const appendStreamText = useMessageStore(s => s.appendStreamText)
  const addFinalStreamMessage = useMessageStore(s => s.addFinalStreamMessage)

  /**
   * Get a stream token from Next.js
   */
  const getToken = useCallback(async (requestId: string): Promise<TokenResponse> => {
    const res = await fetch("/api/stream-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, tabId, workspace }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || "Failed to get stream token")
    }

    return res.json()
  }, [tabId, workspace])

  /**
   * Start a new stream
   */
  const startStream = useCallback(async (
    messages: StreamStartRequest["messages"]
  ): Promise<void> => {
    // Generate idempotency key
    const requestId = crypto.randomUUID()

    // Abort any existing stream
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    try {
      // 1. Get token
      const { token, brokerUrl } = await getToken(requestId)

      // 2. Start stream on broker
      const startRes = await fetch(`${brokerUrl}/v1/streams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
        signal: abortControllerRef.current.signal,
      })

      if (!startRes.ok) {
        const error = await startRes.json()
        throw new Error(error.message || "Failed to start stream")
      }

      const { streamId, status, existingSeq }: StreamStartResponse = await startRes.json()
      streamIdRef.current = streamId
      lastSeqRef.current = existingSeq ?? 0

      // Set initial streaming state
      setStreamingState(tabId, {
        streamId,
        requestId,
        messageId: "", // Will be set when first chunk arrives
        text: "",
        startedAt: Date.now(),
      })

      // 3. Connect to event stream
      const eventSource = new EventSource(
        `${brokerUrl}/v1/streams/${streamId}/events`,
        // Note: EventSource doesn't support custom headers in standard API
        // Use query param for auth in production, or use fetch + ReadableStream
      )

      eventSource.onmessage = (e) => {
        try {
          const event: StreamEvent = JSON.parse(e.data)
          handleEvent(event)
        } catch (err) {
          console.error("[stream] Failed to parse event:", err)
        }
      }

      eventSource.onerror = () => {
        // Try to reconnect with replay
        eventSource.close()
        handleDisconnect()
      }

      // Store reference for cleanup
      abortControllerRef.current.signal.addEventListener("abort", () => {
        eventSource.close()
      })

    } catch (error) {
      setStreamingState(tabId, null)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [tabId, getToken, setStreamingState, onError])

  /**
   * Handle incoming stream events
   */
  const handleEvent = useCallback((event: StreamEvent) => {
    lastSeqRef.current = event.seq

    switch (event.type) {
      case "stream_start":
        // Stream started, waiting for content
        break

      case "stream_chunk":
        // Append text to streaming buffer
        appendStreamText(tabId, event.delta)
        break

      case "stream_message":
        if (event.messageType === "assistant" && event.complete) {
          // Final assistant message - will be handled by stream_complete
        }
        // Tool use, tool result, thinking - could add to UI here
        break

      case "stream_complete": {
        // Stream finished successfully
        const state = useMessageStore.getState().activeStreams[tabId]
        if (state) {
          addFinalStreamMessage(
            tabId,
            state.streamId,
            event.seq,
            state.text,
            "complete"
          )
        }
        setStreamingState(tabId, null)
        break
      }

      case "stream_interrupt": {
        // Stream interrupted (user cancelled or system)
        const state = useMessageStore.getState().activeStreams[tabId]
        if (state) {
          addFinalStreamMessage(
            tabId,
            state.streamId,
            event.seq,
            state.text,
            "interrupted"
          )
        }
        setStreamingState(tabId, null)
        break
      }

      case "stream_error": {
        // Stream failed
        const state = useMessageStore.getState().activeStreams[tabId]
        if (state) {
          addFinalStreamMessage(
            tabId,
            state.streamId,
            event.seq,
            state.text,
            "error",
            event.code
          )
        }
        setStreamingState(tabId, null)
        onError?.(new Error(event.message))
        break
      }
    }
  }, [tabId, appendStreamText, addFinalStreamMessage, setStreamingState, onError])

  /**
   * Handle disconnect - try to reconnect with replay
   */
  const handleDisconnect = useCallback(async () => {
    const streamId = streamIdRef.current
    if (!streamId) return

    try {
      // Get fresh token
      const requestId = crypto.randomUUID()
      const { token, brokerUrl } = await getToken(requestId)

      // Try replay
      const replayRes = await fetch(
        `${brokerUrl}/v1/streams/${streamId}/replay?after=${lastSeqRef.current}`,
        {
          headers: { "Authorization": `Bearer ${token}` },
        }
      )

      if (replayRes.status === 404 || replayRes.status === 410) {
        // Stream expired - show partial content as interrupted
        const state = useMessageStore.getState().activeStreams[tabId]
        if (state) {
          addFinalStreamMessage(
            tabId,
            state.streamId,
            lastSeqRef.current,
            state.text,
            "interrupted"
          )
        }
        setStreamingState(tabId, null)
        return
      }

      const { events, ended, finalState } = await replayRes.json()

      // Process missed events
      for (const event of events) {
        handleEvent(event)
      }

      // If stream is still running, reconnect to live stream
      if (!ended) {
        // Reconnect logic would go here
        // For simplicity, we'll let the user retry
      }

    } catch (error) {
      console.error("[stream] Reconnect failed:", error)
      onError?.(error instanceof Error ? error : new Error(String(error)))
    }
  }, [tabId, getToken, handleEvent, addFinalStreamMessage, setStreamingState, onError])

  /**
   * Cancel the current stream
   */
  const cancelStream = useCallback(async () => {
    const streamId = streamIdRef.current
    if (!streamId) return

    abortControllerRef.current?.abort()

    try {
      const requestId = crypto.randomUUID()
      const { token, brokerUrl } = await getToken(requestId)

      await fetch(`${brokerUrl}/v1/streams/${streamId}/cancel`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      })
      // stream_interrupt event will be emitted by broker
    } catch (error) {
      console.error("[stream] Cancel failed:", error)
      // Still clear local state
      setStreamingState(tabId, null)
    }
  }, [tabId, getToken, setStreamingState])

  return {
    startStream,
    cancelStream,
  }
}
```

### Using the Stream Client

**File: `apps/web/features/chat/hooks/useChat.ts`**

```typescript
"use client"

import { useCallback } from "react"
import { useMessageStore, useStreamingState } from "@/lib/stores/messageStore"
import { useStreamClient } from "./useStreamClient"

interface UseChatOptions {
  tabId: string
  workspace: string
}

export function useChat({ tabId, workspace }: UseChatOptions) {
  const streamingState = useStreamingState(tabId)
  const addMessage = useMessageStore(s => s.addMessage)

  const { startStream, cancelStream } = useStreamClient({
    tabId,
    workspace,
    onError: (error) => {
      console.error("[chat] Stream error:", error)
      // Could show toast here
    },
  })

  const sendMessage = useCallback(async (content: string) => {
    // 1. Add user message to Dexie immediately
    await addMessage({
      id: crypto.randomUUID(),
      type: "user",
      content,
      timestamp: Date.now(),
    })

    // 2. Start stream with conversation history
    // In production, fetch history from Dexie
    await startStream([
      { role: "user", content }
    ])
  }, [addMessage, startStream])

  const stopGeneration = useCallback(() => {
    cancelStream()
  }, [cancelStream])

  return {
    sendMessage,
    stopGeneration,
    isStreaming: streamingState !== null,
    streamText: streamingState?.text ?? "",
  }
}
```

## Next.js Token Endpoint

**File: `apps/web/app/api/stream-token/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/sessions"
import crypto from "crypto"

const STREAM_TOKEN_SECRET = process.env.STREAM_TOKEN_SECRET!
const BROKER_URL = process.env.BROKER_URL!
const TOKEN_TTL_SECONDS = 60

interface TokenRequest {
  requestId: string
  tabId: string
  workspace: string
}

function signToken(payload: Record<string, unknown>): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto
    .createHmac("sha256", STREAM_TOKEN_SECRET)
    .update(payloadB64)
    .digest("base64url")
  return `${payloadB64}.${signature}`
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify session
    const user = await getSessionUser(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse request
    const body: TokenRequest = await req.json()
    const { requestId, tabId, workspace } = body

    if (!requestId || !tabId || !workspace) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // 3. Verify user has access to workspace
    // (Add workspace access check here)

    // 4. Create signed token
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      sub: user.userId,
      org: user.orgId,
      ws: workspace,
      tab: tabId,
      rid: requestId,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    }

    const token = signToken(payload)

    return NextResponse.json({
      token,
      brokerUrl: BROKER_URL,
      expiresAt: (now + TOKEN_TTL_SECONDS) * 1000,
    })
  } catch (error) {
    console.error("[stream-token] Error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

## UI Integration

### Message List with Streaming

**File: `apps/web/features/chat/components/MessageList.tsx`**

```typescript
"use client"

import { useMessages } from "@/lib/db/useMessageDb"
import { useStreamingState } from "@/lib/stores/messageStore"
import { toUIMessage } from "@/lib/db/messageAdapters"

interface MessageListProps {
  tabId: string
  userId: string
}

export function MessageList({ tabId, userId }: MessageListProps) {
  // Final messages from Dexie
  const dbMessages = useMessages(tabId, userId)

  // Live streaming state from Zustand
  const streamingState = useStreamingState(tabId)

  // Convert Dexie messages to UI format
  const messages = dbMessages?.map(toUIMessage) ?? []

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}

      {/* Show streaming message if active */}
      {streamingState && (
        <Message
          message={{
            id: streamingState.messageId || "streaming",
            type: "assistant",
            content: streamingState.text,
            timestamp: streamingState.startedAt,
            isStreaming: true,
          }}
        />
      )}
    </div>
  )
}
```

## Error Handling & Edge Cases

### 1. Token Expired During Stream

If the token expires while streaming:
- Broker continues the stream (token was valid at start)
- Client can reconnect with new token via replay endpoint
- Replay endpoint validates new token

### 2. Browser Refresh During Stream

1. Zustand state is lost
2. On page load, check for any `running` streams in Supabase
3. If found, try to reconnect via replay
4. If stream expired, show message as interrupted

### 3. Network Disconnect

1. EventSource triggers `onerror`
2. Client attempts reconnect with replay
3. If replay fails (404/410), mark message as interrupted
4. User can manually retry

### 4. User Cancels

1. Client calls `POST /v1/streams/:id/cancel`
2. Broker emits `stream_interrupt` event
3. Client writes interrupted message to Dexie
4. Idempotent - safe to call multiple times

## Testing Checklist

### Stream Lifecycle
1. Start stream → events flow
2. Complete stream → message saved to Dexie
3. Cancel mid-stream → interrupted message saved
4. Error mid-stream → error message saved

### Token Security
5. Expired token → 401 from broker
6. Invalid signature → 401 from broker
7. Missing token → 401 from broker

### Reconnection
8. Disconnect + reconnect → replay works
9. Long disconnect (> buffer TTL) → shows interrupted
10. Multiple rapid disconnects → handles gracefully

### Multi-Tab
11. Stream in tab A → tab B doesn't show streaming
12. Complete in tab A → tab B sees message via Dexie live query

### Idempotency
13. Duplicate requestId → returns existing stream
14. Cancel twice → no error

## Timeline

- Shared types package: 1 hour
- Token endpoint: 1 hour
- Stream client hook: 3 hours
- UI integration: 2 hours
- Testing: 3 hours

**Total: ~10 hours**

## Execution Order

1. **[Part 1: Architecture](./one-dexie-architecture.md)** - Read first
2. **[Part 2: Schema](./two-dexie-schema.md)** - Database schema
3. **[Part 3: Implementation](./three-dexie-implementation.md)** - Sync service, store
4. **[Part 4: Streaming](./four-dexie-streaming-integration.md)** - This doc

## Related Documents

- **[DIRECT_STREAMING_CONTRACT.md](./DIRECT_STREAMING_CONTRACT.md)** - Complete API specs
- **[ARCHITECTURE_REVISION.md](./ARCHITECTURE_REVISION.md)** - Why direct streaming
