# Claude SDK Investigation Findings

**Date**: November 9, 2025
**Context**: Root cause analysis of stream cancellation race condition
**Purpose**: Document learnings about how the Claude Agent SDK behaves in bridge's multi-process architecture

## Overview

During investigation of the "still working on previous request" error, we traced the full request-to-response pipeline through the Claude SDK. This document captures important findings about SDK behavior, process architecture, and cancellation semantics.

## Process Architecture

### Three-Layer Process Model

The bridge uses a three-layer process model:

```
┌─────────────────────────────────────┐
│ Next.js Route Handler               │
│ /api/claude/stream                  │
│ (runs in Next.js worker thread)     │
└──────────────┬──────────────────────┘
               │
               │ spawn()
               ↓
┌─────────────────────────────────────┐
│ Node.js Child Process               │
│ /scripts/run-agent.mjs              │
│ (runs as workspace user via UID     │
│  switching, has workspace creds)    │
└──────────────┬──────────────────────┘
               │
               │ import + call
               ↓
┌─────────────────────────────────────┐
│ Claude Agent SDK                    │
│ @anthropic-ai/claude-agent-sdk      │
│ query() → async iterable            │
│ (runs in same Node.js process)      │
└─────────────────────────────────────┘
```

**Why three layers:**
1. **Layer 1 (Route handler)**: Handles HTTP request/response, workspace resolution, authentication
2. **Layer 2 (Child process)**: Provides process isolation and UID switching for file operations
3. **Layer 3 (SDK)**: Executes Claude queries, tool calls, and message iteration

### Data Flow

```
Route Handler          Child Process          SDK
    │                      │                   │
    │ spawn()              │                   │
    ├─────────────────────>│                   │
    │                      │ import query()    │
    │                      ├──────────────────>│
    │                      │ call query()      │
    │ write stdin ────────>│ read stdin        │
    │  (request JSON)      │ (parse request)   │
    │                      │ for await msg     │
    │                      │ in query() ───────┤
    │                      │                   │ iterate API
    │                      │<───────────────── │ yield message
    │ read stdout <────────│ write stdout      │
    │  (NDJSON)            │ (NDJSON)          │
    │                      │                   │
    │ read stdout <────────│ write stdout      │
    │  (repeats)           │ (tool results)    │
    │                      │                   │
    │ read stdout <────────│ write stdout      │
    │  (final complete)    │ (complete event)  │
    │                      │ exit(0)
    │ close stream         │
```

### Communication Protocol

**stdin → request.json**
```json
{
  "message": "user's message",
  "model": "claude-3-5-sonnet-20241022",
  "maxTurns": 25,
  "resume": null,
  "systemPrompt": "...",
  "apiKey": null
}
```

**stdout → NDJSON stream**
```
{"type": "message", "messageCount": 1, "messageType": "system", "content": {...}}
{"type": "message", "messageCount": 2, "messageType": "assistant", "content": {...}}
{"type": "message", "messageCount": 3, "messageType": "tool_result", "content": {...}}
{"type": "complete", "totalMessages": 3, "result": {...}}
```

**stderr → diagnostics**
```
[runner] Dropped to UID: 1001
[runner] Changed to workspace: /srv/webalive/sites/example.com/user
[runner] Tool allowed: Read
```

## SDK Query Execution

### Async Iteration Model

The SDK uses async iteration for message streaming:

```typescript
const agentQuery = query({
  prompt: request.message,
  options: {
    model: "claude-3-5-sonnet-20241022",
    maxTurns: 25,
    permissionMode: "ask",
    allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
    canUseTool: async (name, input) => { /* validation */ },
    resume: sessionId || undefined,
    mcpServers: { /* configured servers */ },
  },
})

// Async iteration - continues until SDK sends final result
for await (const message of agentQuery) {
  // message can be: system, user, assistant, tool_use, tool_result, result
  console.log(`Message ${count}: ${message.type}`)
}
```

**Key behavior**: The `for await` loop continues until the SDK completes the query. It won't exit early just because the reader stops reading from stdout.

### Message Types and Sequence

During a typical query execution:

1. **system (init)** - Initialization message with tools, model info, session ID
2. **user** - The user's input message
3. **assistant** - Claude's response (often with tool_use)
4. **tool_use** - Request for tool execution
5. **tool_result** - Result from tool execution
6. [Repeats 3-5 if Claude requests more tools]
7. **result** - Final completion message with usage info

Each message is yielded by the async iterator and written to stdout by the child process.

### Session Resumption

When `resume: sessionId` is passed:

```typescript
const agentQuery = query({
  prompt: "continue from before",
  options: {
    resume: sessionId,  // SDK session ID from prior query
    // ... other options
  },
})
```

**SDK behavior:**
- Skips re-executing prior tool calls
- Resumes context from previous messages
- Starts from where the conversation left off

This is why we store session IDs in `sessionStore` - to resume conversations across requests.

## Process Lifecycle

### Normal Completion

```
Child spawned (PID 12345)
  ├─ stdin → request.json
  ├─ process.chdir() to workspace
  ├─ process.setuid() to workspace user
  ├─ call query()
  │  ├─ API call → system message
  │  ├─ API call → assistant message
  │  ├─ Tool call → tool_result message
  │  ├─ API call → assistant message
  │  └─ API call → result message
  ├─ write stdout (NDJSON events)
  └─ exit(0)
Parent reads stdout → ndjsonStream → Response sent
Child cleaned up
```

**Duration**: 2-10+ seconds depending on tool calls and API latency

### Early Termination (SIGTERM)

```
Child running query
  │
  ├─ Parent sends SIGTERM
  │
  └─ Child receives signal
     ├─ Loop can exit early
     ├─ Cleanup code runs (if any)
     └─ exit(130 or other code)

Parent sees child.killed = true
```

**Grace period**: 5 seconds (line 142, agent-child-runner.ts)
After 5s, if not dead, send SIGKILL (forced kill, no cleanup)

### Orphaned Process (What Currently Happens)

```
Child running query
  │
  ├─ Parent stops reading from stdout
  │  (Abort signal fired, lock released)
  │
  ├─ Child CONTINUES executing
  │  (for await loop still running)
  │  (more tool calls in progress)
  │
  └─ Child eventually exits naturally
     (after all tool results processed)

Meanwhile: Parent sends ANOTHER child process
  (Lock was released, so new request succeeds)
  (But first child is still using that session)
```

**Problem**: Two child processes, one session, session state conflict.

## What DOESN'T Stop the SDK

### Reading vs Executing

These do NOT stop the SDK:

1. **Stop reading from stdout** - SDK continues executing in child process
2. **Close HTTP response** - SDK loop in child doesn't know
3. **Release conversation lock** - Session still active in child process
4. **Break out of route handler finally block** - SDK loop in child keeps going

The SDK query is **independent of the HTTP request** once the child process is spawned.

### Process Isolation Implications

Because the SDK runs in a separate process:
- It doesn't know if the parent stopped reading
- It doesn't know if the HTTP client disconnected
- It doesn't receive signals from the parent (unless explicitly sent)
- It continues until the `for await` loop completes naturally

## What DOES Stop the SDK

1. **SIGTERM to child process** - Allows graceful shutdown
2. **SIGKILL to child process** - Forced termination
3. **Closing stdin** - Signals EOF to child (but child has already read request)
4. **Ctrl+C** - If child is a terminal process (not in bridge)

**The only reliable method**: Send signal via `child.kill()` in parent process.

## SDK State Management

### Session ID Extraction

```typescript
// system init message from SDK
if (message.type === "system" && message.subtype === "init") {
  const sessionId = message.session_id
  // Store for resumption
  await sessionStore.set(conversationKey, sessionId)
}
```

**What session ID contains:**
- Claude's internal conversation context
- Prior messages and tool results
- Any state needed to continue conversation

**Critical**: Must be stored before response ends, so it can be used for resume.

### Session Isolation

Sessions are keyed by: `${userId}::${workspace}::${conversationId}`

Multiple sessions can exist in parallel (different users, different workspaces, different conversations).

**Race condition occurs when:**
- Same key has two SDK instances executing simultaneously
- Both writing to session store
- Session state becomes inconsistent

## Tool Execution in SDK

### Tool Call Flow

```
SDK generates tool_use message
  ├─ tool_name: "Read"
  ├─ tool_input: { path: "package.json" }
  └─ tool_use_id: "toolu_01ABC..."

Child process receives tool_use
  ├─ Calls canUseTool() for permission check
  ├─ SDK executes tool internally (Read, Write, etc.)
  ├─ Tool returns result
  └─ Child writes tool_result to stdout

Parent reads tool_result from stdout
  └─ Routes to UI for display
```

**Time sensitivity**: Long-running tools (file I/O, slow API calls) take time. If parent stops reading mid-tool, child still finishes the tool.

**Example**: If tool is "Write 1MB file", it may take 2-3 seconds. Aborting the HTTP request doesn't stop the write.

## Error Handling

### SDK Error Propagation

```typescript
try {
  for await (const message of agentQuery) {
    // process message
  }
} catch (error) {
  // SDK error (API error, tool error, etc.)
  // Write error event to stdout
  // Child exits with code 1
}
```

Errors from:
- API failures
- Tool execution failures
- Configuration errors
- Network issues

All surface as error events in the stream.

### Timeout Behavior

Bridge has two timeouts:

1. **Hard timeout (120s)** - Route handler level
   - If child doesn't exit within 120s, force kill
   - Prevents zombie processes

2. **Soft timeout (60s)** - Client level
   - If no data received in 60s, client aborts
   - Allows graceful recovery

These are **not SDK timeouts** - SDK doesn't have built-in request timeout. Timeouts are handled by the bridge.

## Thread Safety / Concurrency

### In-Memory Session Store

```typescript
const sessions = new Map<string, string>()

function get(key: string): string | null {
  return sessions.get(key) || null
}

function set(key: string, value: string): void {
  sessions.set(key, value)
}
```

**Not thread-safe across processes** but fine across async operations in single process:
- Read/write from Map are atomic in Node.js (single-threaded)
- Safe for concurrent async operations
- NOT safe if bridge had multiple worker processes (would need Redis)

**Current safeguard**: Conversation locking prevents two SDK instances from writing same session simultaneously (when working correctly).

### Lock Mechanism

```typescript
const activeConversations = new Set<string>()

function tryLockConversation(key: string): boolean {
  if (activeConversations.has(key)) return false
  activeConversations.add(key)
  return true
}
```

**Assumes**:
- Only one route handler checking the lock (single process)
- Lock released before new SDK instance starts

**Race condition**: When lock released before SDK actually stops, these assumptions break.

## CLI vs SDK Differences

### CLI Mode (original Claude desktop)
```bash
claude
```
- Single process
- Interactive REPL
- Can send Ctrl+C to interrupt
- Immediate termination

### Bridge Mode (web interface)
```
HTTP Request → Route Handler → Child Process → SDK
```
- Multi-process
- HTTP-based (no terminal signals)
- Must explicitly kill child
- Async termination (grace period, then force)

The bridge adds complexity because:
1. Process isolation is intentional (security/UID switching)
2. No terminal connection (can't Ctrl+C)
3. Must signal via process API (kill, signals)
4. Must coordinate parent/child lifecycle

## What We Didn't Fully Test

1. **SDK cancellation API** - Does SDK expose a cancel() method we could call?
2. **Graceful shutdown hooks** - Does SDK have cleanup code we could trigger?
3. **Partial result handling** - Can SDK return partial results if interrupted mid-tool?
4. **Resume after interruption** - Can we resume a conversation that was interrupted and then stopped?

These would be good candidates for future investigation if the solution requires SDK-level integration.

## Key Takeaways

1. **SDK runs independent of HTTP** - Child process continues executing even if parent stops reading
2. **Process termination is required** - Can't gracefully stop SDK without killing the child process
3. **Session state is global** - Multiple SDK instances on same session = conflicts
4. **Locking is necessary** - Prevents concurrent SDK instances on same session
5. **Lock timing is critical** - Must be held until child process exits, not before
6. **Tool execution is time-consuming** - Tools can take seconds; must account for this in abort flow
7. **Grace period is important** - SIGTERM allows cleanup; SIGKILL for forced exit

## Recommendations for Solution

1. **Implement stream.cancel()** - Stop reading, trigger child kill
2. **Wait for process exit** - Don't release lock until child is confirmed dead
3. **Verify graceful shutdown** - Ensure SIGTERM→exit happens in under 5 seconds
4. **Test interrupted resume** - Ensure interrupted sessions can't be corrupted
5. **Add process monitoring** - Log child lifecycle for debugging
6. **Consider SDK API** - Investigate if SDK has cancellation support we should use

## Related Documentation

- **Stream Implementation**: `docs/streaming/stream-implementation.md`
- **Session Management**: `docs/sessions/session-management.md`
- **Agent Child Runner**: `/root/webalive/claude-bridge/apps/web/lib/agent-child-runner.ts`
- **Run Agent Script**: `/root/webalive/claude-bridge/apps/web/scripts/run-agent.mjs`
- **Main RCA**: `docs/postmortems/stream-cancellation-race-condition.md`
