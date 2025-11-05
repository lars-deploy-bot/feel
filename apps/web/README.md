# Claude Bridge Web – Multi-Tenant AI Development UI

A production-grade Next.js web interface for Claude Code, part of the **Claude Bridge** multi-tenant platform. Enables real-time agentic conversations with streaming responses, workspace-scoped file operations, and persistent multi-turn sessions across isolated domain-based sandboxes.

**Parent project**: [Claude Bridge](../../README.md)

## Overview

This is the web application layer of **Claude Bridge**, the multi-tenant AI development platform. It provides:

- **Multi-tenant support** – Automatic domain → workspace mapping (`example.com` → `/root/webalive/sites/example.com/src`); terminal mode allows custom workspace selection
- **Domain-based isolation** – Each domain gets its own sandboxed workspace; prevents cross-site file access
- **Passcode authentication** – Configurable via `BRIDGE_PASSCODE` environment variable (dev mode accepts any passcode if unset)
- **Streaming AI conversations** – Real-time SSE responses with inline tool execution visibility
- **Workspace enforcement** – Path normalization + boundary checks; prevents directory traversal
- **Session persistence** – Multi-turn conversations with resumption via SessionStore (conversationId-scoped)
- **Concurrency safety** – Prevents overlapping requests for same conversation via locking mechanism
- **Tool whitelisting** – Only Read, Write, Edit, Glob, Grep allowed; dangerous ops denied

## Architecture

### Request → Response Pipeline

```
Client POST /api/claude/stream
  ↓ Auth check (session cookie)
  ↓ Workspace resolve (terminal.* vs default)
  ↓ Conversation lock (Set<convKey>)
  ↓ Resume lookup (SessionStore.get)
  ↓ Claude SDK query() async iteration
  ↓ ReadableStream SSE (Server-Sent Events)
  ↓ Client SSE parser
  ↓ toolUseMap build (track tool IDs)
  ↓ UIMessage[] accumulate
  ↓ groupMessages() batch by type
  ↓ MessageGroup[] (text vs thinking/tools)
  ↓ renderMessage() switch/component dispatch
  ↓ React JSX
```

### Core Modules

| Module | Responsibility |
|--------|-----------------|
| **app/page.tsx** | Login gate with passcode validation |
| **app/chat/page.tsx** | Main conversation interface; SSE/polling handler; message history UI |
| **app/workspace/page.tsx** | Terminal-mode only; workspace selection + verification |
| **app/api/claude/stream/route.ts** | SSE streaming endpoint; session locking; convo resume |
| **app/api/claude/route.ts** | Polling endpoint (non-streaming fallback) |
| **app/api/login/route.ts** | Passcode auth; session cookie creation |
| **app/api/verify/route.ts** | Workspace directory validation |
| **lib/message-parser.ts** | SSE frame parsing; toolUseMap management; UIMessage construction |
| **lib/message-grouper.ts** | Batch messages into text vs thinking groups; track completion state |
| **lib/message-renderer.tsx** | Polymorphic component dispatch by message type |
| **lib/sessionStore.ts** | In-memory conversation state; concurrency locking; session resumption |
| **lib/auth.ts** | Session cookie extraction; user identity |
| **lib/workspace-utils.ts** | Workspace resolution (terminal vs chat mode); path validation |
| **components/ui/chat*** | Message, tool, thinking, complete component tree |

## Streaming & SSE Protocol

### Event Schema

All events follow this structure:
```json
{
  "type": "start|message|session|complete|error",
  "requestId": "abc123",
  "timestamp": "2025-10-23T14:00:00Z",
  "data": { /* event-specific */ }
}
```

Streamed as SSE frames:
```
event: message
data: {"type":"message","requestId":"abc123","timestamp":"...","data":{"messageCount":1,...}}

```

### Event Lifecycle

1. **start** – `{ host, cwd, message, messageLength, isResume }`
2. **message** – For each SDK message: `{ messageCount, messageType, content: SDKMessage }`
3. **session** – `{ sessionId }` (extracted from `system:init`, persisted to SessionStore)
4. **complete** – `{ totalMessages, result: SDKResultMessage | null }`
5. **error** – `{ error, message, details, stack }`

### SDK Message Flow

The Claude SDK's `query()` async iterator yields messages in this sequence:

```ts
// Assistant initiates tools
{ type: 'assistant', message: { content: [
  { type: 'text', text: '...' },
  { type: 'tool_use', id: 'tool_abc', name: 'Read', input: { file_path: '...' } }
]}}

// User (client) provides results
{ type: 'user', message: { content: [
  { type: 'tool_result', tool_use_id: 'tool_abc', content: '...', is_error: false }
]}}

// Final response
{ type: 'result', content: '...' }
```

## Tool Tracking & Result Rendering

### toolUseMap Pattern

The parser maintains a global `Map<tool_use_id, tool_name>`:

1. When assistant emits `tool_use` block → `toolUseMap.set(id, name)`
2. When user returns `tool_result` block → lookup `toolUseMap.get(tool_use_id)` and inject `tool_name` property
3. Renderer dispatches to correct component (BashOutput, GlobOutput, etc.) based on tool name

This decouples tool results from their invocations, allowing flexible message interleaving.

## Message Grouping Strategy

The `groupMessages()` function batches messages for UI rendering:

```ts
const isTextMessage = (msg: UIMessage): boolean => {
  if (msg.type === 'user') return true
  if (msg.type === 'sdk_message' && msg.content?.type === 'assistant') {
    const blocks = msg.content.message?.content || []
    return blocks.length === 1 && blocks[0]?.type === 'text'
  }
  return false
}
```

**Text messages** (user + assistant-with-only-text) → separate `MessageGroup { type: 'text', isComplete: true }`

**Everything else** (tool invocations, system messages, thinking) → accumulate into `currentThinkingGroup: UIMessage[]`

**Flushing** occurs when:
- Text message encountered → flush pending thinking group (marked incomplete)
- `complete` or `result` event → flush thinking group (marked complete)

The `isComplete` flag drives UI state: incomplete groups show loading indicators; complete groups finalize.

## Session Persistence & Concurrency

### SessionStore Interface

```ts
interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, val: string): Promise<void>
  delete(key: string): Promise<void>
}
```

**Default implementation**: `SessionStoreMemory` = `Map<string, string>` in-memory.
⚠️ **Production warning**: State lost on server restart. Replace with Redis, DynamoDB, or database backend.

### Session Key Format

```
${userId}::${workspace ?? 'default'}::${conversationId}
```

Example: `user_42::webalive/sites/demo::550e8400-e29b-41d4-a716-446655440000`

### Conversation Locking (Concurrency Guard)

```ts
const activeConversations = new Set<string>()

export function tryLockConversation(key: string): boolean {
  if (activeConversations.has(key)) return false
  activeConversations.add(key)
  return true
}

export function unlockConversation(key: string): void {
  activeConversations.delete(key)
}
```

In `/api/claude/stream`:
1. Lock conversation before SDK query
2. Return 409 Conflict if already locked
3. Unlock in finally block (even on error)

Prevents concurrent requests for same (userId, workspace, conversationId).

### Session Resumption

```ts
const existingSessionId = await SessionStoreMemory.get(convKey)
const claudeOptions = {
  cwd,
  allowedTools: [...],
  ...(existingSessionId ? { resume: existingSessionId } : {})
}
const q = query({ prompt: message, options: claudeOptions })
```

When `resume` is provided, the SDK reconnects to the prior session's execution context. Claude has full recall of previous messages and tool executions—no re-invocation occurs.

## Workspace Isolation & Tool Enforcement

### canUseTool Callback

Passed to `Options.canUseTool` in SDK query:

```ts
const ALLOWED = new Set(['Write', 'Edit', 'Read', 'Glob', 'Grep'])

export const canUseTool: Options['canUseTool'] = async (toolName, input) => {
  if (!ALLOWED.has(toolName)) {
    return { behavior: 'deny', message: `tool_not_allowed: ${toolName}` }
  }

  const filePath = input.file_path || input.notebook_path || input.path
  if (filePath) {
    const norm = path.normalize(filePath)
    if (!norm.startsWith(cwd + path.sep)) {
      return { behavior: 'deny', message: 'path_outside_workspace' }
    }
  }

  return {
    behavior: 'allow',
    updatedInput: input,
    updatedPermissions: []
  }
}
```

**Tool whitelist**: Write, Edit, Read, Glob, Grep only. Bash, Task, etc. denied.

**Path boundary check**: Normalized path must start with `${cwd}/`. Prevents traversal outside workspace (e.g., `../../etc/passwd`).

### Workspace Modes

| Mode | Hostname | Workspace Base | Enforcement |
|------|----------|----------------|-------------|
| **Standard** | `example.com` | `/root/webalive/sites/example.com/src` | Auto-mapped by domain; verified before access |
| **Terminal** | `terminal.example.com` | `/root/webalive/sites/{custom-project}` | Manual selection required; `/api/verify` checks existence + readability |

**Standard mode** automatically maps domains to workspace directories. **Terminal mode** allows custom workspace selection under the base directory; workspace verification is mandatory before Claude access.

See parent [Claude Bridge README](../../README.md#multi-tenant-design) for full workspace architecture.

## Authentication

### Cookie-Based Session

1. **Login**: POST `/api/login` with `{ passcode }`
   - Validates against `process.env.BRIDGE_PASSCODE` (if unset, any passcode works in dev)
   - Sets `session` cookie (httpOnly, secure)
   - Session value = temporary token (currently just the cookie value; TODO: JWT with expiry)

2. **Authenticated requests**: All API routes check `jar.get('session')`
   - No session cookie → 401 Unauthorized
   - Session present → extract `SessionUser { id }` from cookie value

3. **User extraction** (auth.ts):
   ```ts
   const user = await requireSessionUser()
   // Returns { id: sessionCookie.value }
   // TODO: Decode JWT or lookup user in database
   ```

### Production TODO

- Replace cookie value with signed JWT + expiry
- Validate session token server-side
- Add logout endpoint that invalidates session
- Store sessions in Redis/database, not just in-memory

## API Endpoints

### POST `/api/claude/stream`

Streaming mode (SSE). Returns continuous event stream.

**Headers**: `Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive`

**Body**:
```json
{
  "message": "What does this file do?",
  "conversationId": "550e8400-e29b-41d4-a716-446655440000",
  "workspace": "webalive/sites/demo"  // optional; terminal mode requires
}
```

**Response**: SSE stream of events (start, message*, session?, complete|error)

**Status codes**:
- 200 OK – Stream begins
- 401 Unauthorized – No session cookie
- 409 Conflict – Conversation already in progress (locked)
- 400 Bad Request – Invalid workspace
- 500 Internal Server Error – SDK query failed

### POST `/api/claude` (Polling)

Non-streaming mode. Returns full response as JSON.

**Body**: Same as `/stream` route

**Response**:
```json
{
  "ok": true,
  "host": "localhost",
  "cwd": "/path/to/workspace",
  "result": { /* SDKResultMessage */ },
  "requestId": "abc123"
}
```

**Status codes**: Same as streaming route

### POST `/api/login`

Authenticate with passcode.

**Body**:
```json
{
  "passcode": "my-secret-code"
}
```

**Response**:
```json
{
  "ok": true,
  "message": "Authenticated"
}
```

Sets `session` cookie on success.

**Status codes**:
- 200 OK – Authenticated
- 401 Unauthorized – Wrong passcode
- 400 Bad Request – Invalid body

### POST `/api/verify`

Validate workspace directory (terminal mode only).

**Body**:
```json
{
  "workspace": "webalive/sites/demo"
}
```

**Response**:
```json
{
  "verified": true,
  "message": "Directory exists and is readable"
}
```

**Status codes**:
- 200 OK – Directory valid
- 400 Bad Request – Directory not found / not readable
- 401 Unauthorized – No session cookie

## UI Architecture

### Message Renderer Dispatch

`renderMessage(UIMessage)` in `message-renderer.tsx` switches on message type:

```ts
switch (getMessageComponentType(message)) {
  case 'user':
    return <UserMessage />        // Right-aligned, "you" label
  case 'start':
    return <StartMessage />        // Debug info (host, cwd, messageLength)
  case 'system':
    return <SystemMessage />       // System initialization
  case 'assistant':
    return <AssistantMessage />    // Text + tool blocks (ToolInputRouter)
  case 'tool_result':
    return <ToolResultMessage />   // Tool results (ToolOutputRouter)
  case 'result':
    return <ResultMessage />       // Final SDK result
  case 'complete':
    return <CompleteMessage />     // Query complete summary
  default:
    return <div>Unknown</div>      // Fallback with JSON dump
}
```

### Tool Input/Output Routing

**ToolInputRouter** (before execution):
- Maps tool name → input component (BashInput, GlobInput, GrepInput, ReadInput, TaskInput)
- Displays Claude's intent + parameters

**ToolOutputRouter** (after execution):
- Maps tool name → output component (BashOutput, GlobOutput, etc.)
- Displays raw results with syntax highlighting + copy buttons

### ThinkingGroup Component

Renders a batch of thinking/tool messages:
- Expands/collapses for readability
- Shows loading state if `isComplete = false`
- Shows final badge if `isComplete = true`
- Displays all nested messages (system, assistant tool blocks, user tool results)

## Development

### Setup

```bash
bun install
bun run dev    # :8999 with Turbo (from monorepo root)
# or from this directory:
npm install
npm run dev
```

### Build & Production

```bash
# Build
bun run build  # from monorepo root
npm run build  # from this directory

# Start production server
bun run start
npm run start   # :8999

# With PM2 (monorepo deployment)
pm2 start apps/web/next start --name claude-bridge -p 8999
```

### Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | `sk-ant-...` |
| `BRIDGE_PASSCODE` | Yes | `secure-password-here` |
| `CLAUDE_MODEL` | No | `claude-3-5-haiku-20241022` |
| `WORKSPACE_BASE` | No | `/root/webalive/sites` |

### Key Dependencies

- **Next.js 16** – React framework + SSR
- **@anthropic-ai/claude-agent-sdk** – Claude integration (query, streaming, tool callbacks)
- **TailwindCSS 4** – Styling (PostCSS)
- **Lucide React** – Icons
- **Zod** – Type validation for request bodies

## Production Checklist

### Application
- [ ] Replace in-memory SessionStore with Redis/database
- [ ] Implement JWT session tokens with expiry
- [ ] Add logout endpoint
- [ ] Set httpOnly, Secure, SameSite flags on session cookie
- [ ] Add rate limiting on `/api/login` and `/api/claude/stream`
- [ ] Monitor SessionStore memory usage (concurrent conversation limit)
- [ ] Log all tool invocations (audit trail)
- [ ] Add request tracing (requestId propagation to logs)
- [ ] Test workspace boundary enforcement with adversarial paths
- [ ] Validate `BRIDGE_PASSCODE` complexity

### Deployment
- [ ] Configure Caddy reverse proxy (see [Caddyfile](../../Caddyfile) in monorepo)
- [ ] Set up PM2 process manager for long-running sessions
- [ ] Enable HTTPS/TLS via Caddy
- [ ] Configure domain routing (`example.com` → standard mode, `terminal.example.com` → terminal mode)
- [ ] Set `WORKSPACE_BASE` to production directory (e.g., `/root/webalive/sites`)
- [ ] Validate all required env vars set: `ANTHROPIC_API_KEY`, `BRIDGE_PASSCODE`, `CLAUDE_MODEL`

### Security
- [ ] Run security review on canUseTool logic
- [ ] Audit path normalization against traversal attacks
- [ ] Review CORS headers (CORS utils reflect origin; validate in production)
- [ ] Ensure passcode is strong and rotated regularly

## Troubleshooting

### "No session cookie found"
- User must login first via `/api/login`
- Check cookie settings (httpOnly, Secure) match request context

### "Conversation already in progress"
- 409 Conflict: Another request is running for this conversation
- Wait for prior request to complete before retrying
- Check SessionStore for stale locks (may need manual cleanup)

### "Path outside workspace"
- Tool attempted to access file outside workspace boundary
- Normalize path and verify `startsWith(cwd + path.sep)` check
- Terminal mode enforces strict boundaries; chat mode less restricted

### Streaming stops mid-response
- SSE connection dropped (client or network)
- Check browser DevTools Network tab for connection closure
- Verify server not crashing (check logs for error event)
- Retry with polling mode (`/api/claude`)

## Contributing

This is part of the **Claude Bridge** monorepo. Submit issues and PRs to the main repository. Ensure:
- Code follows Biome formatting standards (run `bun run format` from monorepo root)
- Types are strict (no `any`)
- New routes require auth check + workspace validation
- Both standard and terminal modes tested
- CLAUDE.md updated if architecture changes
- See parent [Contributing section](../../README.md#contributing) for more
