# Alive Web – Claude Code UI

Next.js web frontend for Claude Code agentic conversations with workspace-scoped tool execution and streaming SSE responses.

# rules

always use bun!

## Request → Response Pipeline

**Client POST** → `/api/claude/stream` (message, conversationId, workspace?) → **Auth check** (session cookie) → **Workspace resolve** (terminal.* vs default) → **Conversation lock** (Set<convKey>) → **Resume lookup** (SessionStore.get) → **query()** async iter → **ReadableStream SSE** → **Client SSE parser** → **toolUseMap build** → **UIMessage[]** → **groupMessages()** → **MessageGroup[]** → **renderMessage() switch**

## Stream Implementation

### SSE Protocol (createClaudeStream, streamHandler.ts)
- `new ReadableStream({ async start(controller) { ... } })`
- Frame format: `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`
- Encoder: `new TextEncoder().encode()`
- Response headers: `Content-Type: text/event-stream, Cache-Control: no-cache, Connection: keep-alive`

### Event Lifecycle
1. **start** – `{ host, cwd, message, messageLength, isResume: !!options.resume }`
2. **message** – For each SDK msg: `{ messageCount, messageType: m.type, content: SDKMessage }`
3. **session** – Once per query: `{ sessionId }` (extracted from system:init via `extractSessionId()`, persisted to store)
4. **complete** – `{ totalMessages, result: SDKResultMessage | null }`
5. **error** – `{ error, message, details, stack }`

### Query Iteration (SDK loop)
```ts
const q = query({ prompt: message, options: claudeOptions })
for await (const m of q) {
  if (m.type === 'system' && !sessionSaved) { await conversation.store.set(key, sessionId) }
  sendEvent('message', { messageCount++, messageType: m.type, content: m })
  if (m.type === 'result') queryResult = m
}
```

## Tool Tracking & Results

### toolUseMap Pattern (message-parser.ts)
- Global `Map<string, string>` maps `tool_use.id` → `tool_use.name`
- **Assistant msg** with content block `{ type: 'tool_use', id, name }` → `toolUseMap.set(id, name)`
- **User msg** with content block `{ type: 'tool_result', tool_use_id }` → lookup name from map, inject `item.tool_name = toolUseMap.get(tool_use_id)`
- Result rendering matches tool name to ToolOutputRouter component

## Message Grouping Logic (message-grouper.ts)

Discriminates on `isTextMessage()`:
```ts
const isTextMessage = (msg: UIMessage): boolean => {
  if (msg.type === 'user') return true
  if (msg.type === 'sdk_message' && msg.content?.type === 'assistant') {
    return msg.content.message?.content?.length === 1 && content[0]?.type === 'text'
  }
  return false
}
```

- **true** → standalone text `MessageGroup { type: 'text', messages: [msg], isComplete: true }`
- **false** → accumulate into `currentThinkingGroup: UIMessage[]`
- Flush thinking on text message OR on `isCompletionMessage()` (type === 'complete'|'result')
- Final group `isComplete` = reached completion message; otherwise incomplete

## Session & Concurrency

### SessionStore (sessionStore.ts)
- Interface: `{ get(key): Promise<str|null>, set(key, val): Promise<void>, delete(key): Promise<void> }`
- Default: `SessionStoreMemory` = `Map<string, string>` in-memory ⚠️ Lose state on restart; use Redis/DB in prod
- Key format: `${userId}::${workspace ?? 'default'}::${conversationId}`

### Conversation Locking (sessionStore.ts)
- `const activeConversations = new Set<string>()`
- `tryLockConversation(key): boolean` → checks membership, adds if absent, returns success
- `unlockConversation(key)` → deletes from set (called in finally block of stream)
- Prevents concurrent requests for same (userId, workspace, conversationId) tuple

### Session Resume
- Pre-query: `const existingSessionId = await SessionStoreMemory.get(convKey)`
- Pass to SDK: `{ resume: existingSessionId }` in claudeOptions (if exists)
- SDK automatically resumes conversation context; prevents re-execution of prior tools

## Authentication

### Cookie → User (auth.ts)
- Session cookie: `jar.get('session')` from next/headers
- `SessionUser = { id: string }` extracted as `sessionCookie.value` (TODO: decode JWT/lookup DB in prod)
- Login: POST `/api/login` with passcode → sets httpOnly cookie
- All API routes check `jar.get('session')` before proceeding

### Local Development Test User
- When `BRIDGE_ENV=local`: test user `workspace=test`, `passcode=test` bypasses domain password validation
- Sets session cookie with value `test-user`

## Workspace Enforcement

### Validation (canUseTool callback, route.ts)
```ts
const ALLOWED = new Set(['Write', 'Edit', 'Read', 'Glob', 'Grep'])
const filePath = input.file_path || input.notebook_path || input.path
if (filePath) {
  const norm = path.normalize(filePath)
  if (!norm.startsWith(cwd + path.sep)) return { behavior: 'deny', message: 'path_outside_workspace' }
}
return { behavior: 'allow', updatedInput: input, updatedPermissions: [] }
```
- Hoisted via `Options.canUseTool` callback to SDK
- Tool names whitelisted; paths normalized + boundary-checked
- Fails deny case early; SDK skips tool invocation

### Workspace Resolution (workspace-utils.ts + workspaceRetriever.ts)
- **Local dev mode** (`BRIDGE_ENV=local` + `LOCAL_TEMPLATE_PATH`): uses explicit template path (monorepo seed repo)
- **Terminal mode** (`terminal.*` hostname): use `body.workspace` or fail (required)
- **Chat mode** (default): use `body.workspace` or fallback to system default
- Validated in `/api/verify` via `getWorkspace()` → checks dir exists + readable

## UI Routing (message-renderer.tsx switch)

```ts
switch (getMessageComponentType(message)) {
  case 'user': → <UserMessage> (right-aligned, "you" label)
  case 'start': → <StartMessage> (debug info: host, cwd, messageLength)
  case 'system': → <SystemMessage> (SDKSystemMessage)
  case 'assistant': → <AssistantMessage> (text + tool blocks via ToolInputRouter)
  case 'tool_result': → <ToolResultMessage> (SDKUserMessage with tool_result blocks)
  case 'result': → <ResultMessage> (SDKResultMessage, final)
  case 'complete': → <CompleteMessage> (totalMessages, final summary)
  default: → JSON dump (fallback unknown type)
}
```

## Automatic File Ownership (Child Process Isolation)

**Problem**: Files created by Claude SDK are owned by `root:root`, but site processes run as dedicated users (e.g., `site-two-goalive-nl`), causing permission errors.

**Solution**: Automatic child process isolation for systemd-managed workspaces.

### Detection (agent-child-runner.ts)

```typescript
export function shouldUseChildProcess(workspaceRoot: string): boolean {
  const st = statSync(workspaceRoot)
  return st.uid !== 0 && st.gid !== 0  // Non-root owner = systemd site
}
```

### Execution Flow

**Route logic** (`/api/claude/stream`):
```typescript
if (shouldUseChildProcess(cwd)) {
  // Systemd workspace: spawn SDK in child process
  const childStream = runAgentChild(cwd, { message, model, maxTurns })
  // Convert NDJSON to SSE
} else {
  // Root-owned workspace: use in-process SDK (legacy)
  createClaudeStream({ message, claudeOptions, ... })
}
```

**Child runner** (`scripts/run-agent.mjs`):
1. Spawned as root (can read `/root/` script)
2. Immediately drops to workspace user:
   ```javascript
   process.setegid(targetGid)  // Kernel-level GID switch
   process.seteuid(targetUid)  // Kernel-level UID switch
   ```
3. All file operations inherit process UID/GID
4. SDK writes (tools + debug logs) owned by workspace user

**Why it works**:
- **Kernel enforcement**: After `seteuid()`, entire process runs as workspace user
- **Catches everything**: Built-in SDK tools, debug logs, cache writes
- **No patching needed**: ES module imports, internal SDK code all inherit process credentials
- **Automatic**: Detects systemd workspaces by directory ownership

**Locations**:
- Parent wrapper: `apps/web/lib/agent-child-runner.ts`
- Child runner: `apps/web/scripts/run-agent.mjs`
- Route integration: `apps/web/app/api/claude/stream/route.ts` (line ~263)

## API Routes Summary

| Endpoint | Auth | Async | Purpose |
|----------|------|-------|---------|
| POST `/api/claude` | ✓ | Polling | Full response (non-streaming) |
| POST `/api/claude/stream` | ✓ | SSE | Streaming response (convo locking + session resume + auto permissions) |
| POST `/api/login` | ✗ | – | Passcode → session cookie |
| POST `/api/verify` | ✓ | – | Check workspace dir exists |
| POST `/api/files` | ✓ | – | (Likely unused file ops) |

## Dev

```bash
npm run dev     # :8999 Turbo
npm run build   # next build
npm run start   # next start :8999
```
**Deps**: Next.js 16, @anthropic-ai/claude-agent-sdk, TailwindCSS 4, Lucide React, Zod
**Env**: `CLAUDE_MODEL`, `PASSCODE`, workspace paths
