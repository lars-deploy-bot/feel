# Alive Web – Claude Code UI

Next.js web frontend for Claude Code agentic conversations with workspace-scoped tool execution and streaming SSE responses.

# rules

**🔥 UNIVERSAL RULE**: If you're working on something (auth, state management, API routes, etc.), you MUST check the guide for that area first and follow its patterns. Don't invent new approaches.

**BIG RULE**: This file is a ROUTER, not documentation. Keep sections minimal - just link to guides in `docs/`. No long explanations here.

**Docs structure**: All docs must be in nested directories (e.g., `docs/architecture/`, `docs/security/`), never directly in `docs/`. This keeps organization clear.

always use bun!

## Current Work Documentation

**Directory**: `docs/currently-working-on-this/`

**Purpose**: Living documentation for active development tasks. When working on a multi-step task:

1. **ALWAYS check this directory first** for existing context/plans
2. **Create/update docs here** as you work (design docs, implementation status, TODO lists)
3. **Update throughout the session** - don't wait until done
4. **When task is complete**, move finalized docs to their permanent location (e.g., `docs/streaming/`, `docs/architecture/`)

**Why**: Prevents context loss between sessions, enables easy task switching, creates clear handoff documentation.

**Current Contents**: Check this directory at the start of each session to see what's in progress.

## Deployment & Ports

**Guide**: `docs/deployment/deployment-environments.md`

| Env | Domain | Port | Process | Command |
|-----|--------|------|---------|---------|
| **Prod** | `terminal.goalive.nl` | `8999` | `claude-bridge` | `bun run deploy` |
| **Staging** | `staging.terminal.goalive.nl` | `8998` | `claude-bridge-staging` | `bun run staging` |

**Quick Commands**: `bun run see` (logs), `bun run see:staging` (staging logs), `pm2 list` (status)

## Request → Response Pipeline

**Client POST** → `/api/claude/stream` (message, conversationId, workspace?) → **Auth check** (session cookie) → **Workspace resolve** (terminal.* vs default) → **Conversation lock** (Set<convKey>) → **Resume lookup** (SessionStore.get) → **query()** async iter → **ReadableStream SSE** → **Client SSE parser** → **toolUseMap build** → **UIMessage[]** → **groupMessages()** → **MessageGroup[]** → **renderMessage() switch**

## Stream Implementation

**Files**: `app/api/claude/stream/route.ts`, `features/chat/lib/streamHandler.ts`

**Guide**: `docs/streaming/stream-implementation.md`

**SSE events** (in order): `start` → `message` (many) → `session` → `complete` | `error`

## Tool Tracking & Results & Message Grouping

**Files**: `features/chat/lib/message-parser.ts`, `features/chat/lib/message-grouper.ts`

**Guide**: `docs/architecture/message-handling.md`

- **Tool tracking**: Maps `tool_use.id` → `tool_use.name` for result rendering
- **Message grouping**: Groups text vs. thinking/tool messages; flushes on completion

## Session & Concurrency

**File**: `features/auth/lib/sessionStore.ts`

**Guide**: `docs/sessions/session-management.md`

- **Session store**: In-memory by default (⚠️ use Redis/DB in prod)
- **Conversation lock**: Prevents concurrent requests to same conversation
- **Session resume**: Restores conversation context via SDK, skips tool re-execution

## Authentication

**Files**: `features/auth/lib/jwt.ts`, `features/auth/lib/auth.ts`

**Guide**: `docs/security/authentication.md`

⚠️ **HARD RULE**: All protected routes MUST use `isWorkspaceAuthenticated(workspace)` from `features/auth/lib/auth.ts`. Do NOT implement custom session checks.

- **JWT payload**: `{ workspaces: string[], iat, exp }` (30-day) in httpOnly cookie
- **Login flow**: `/api/login` validates passcode → creates/updates JWT
- **Protected route pattern**: `const isAuth = await isWorkspaceAuthenticated(workspace); if (!isAuth) return 401`
- **Canonical impl**: `/api/claude/stream` and `/api/verify` (follow these)
- **Local dev**: `BRIDGE_ENV=local` + `workspace=test, passcode=test` bypasses validation

## Workspace Enforcement

**Files**: `lib/claude/tool-permissions.ts`, `features/workspace/lib/workspace-secure.ts`, `app/api/claude/stream/route.ts`

**Guide**: `docs/security/workspace-enforcement.md`

- **Tool whitelist**: `ALLOWED_SDK_TOOLS` (Read, Write, Edit, Glob, Grep) + `ALLOWED_MCP_TOOLS`
- **Path validation**: `ensurePathWithinWorkspace()` prevents directory traversal
- **Workspace resolution**: `getWorkspace()` resolves host → workspace root with symlink safety
- **Tool callback**: `createToolPermissionHandler()` validates before SDK execution

## UI Rendering

**Files**: `features/chat/lib/message-renderer.tsx`, `features/chat/components/message-renderers/AssistantMessage.tsx`

**Guide**: `docs/architecture/message-handling.md`

Routes each message type (user, start, system, assistant, tool_result, result, complete) to dedicated component. Tool inputs hidden by default (debug mode only).

## Automatic File Ownership

**Files**: `lib/agent-child-runner.ts`, `scripts/run-agent.mjs`, `app/api/claude/stream/route.ts`

Systemd workspaces spawn SDK in child process that drops to workspace user (via `seteuid`/`setegid`). Automatic detection via directory ownership. Ensures SDK writes inherit correct ownership. **Why**: Sites run as dedicated unprivileged users (e.g., `site-example-com`); without UID switching, files would be owned by root.

## State Management (Zustand)

**Location**: `lib/stores/`

All stores follow **Guide §14.1-14.3** patterns:
- ✅ Actions grouped in stable `actions` object (prevents re-renders)
- ✅ Atomic selector hooks exported (single values only)
- ✅ Backwards compatible (legacy direct access still works)
- ✅ Marked with `"use client"` directive

**Store Reference**:
| Store | Purpose | Hooks |
|-------|---------|-------|
| `debug-store.ts` | Dev UI toggles | `useDebugView()`, `useDebugActions()` |
| `imageStore.ts` | Photo library | `useImages()`, `useImageActions()` |
| `recentSitesStore.ts` | Site history | `useRecentSites()`, `useRecentSitesActions()` |
| `llmStore.ts` | Model + API key | `useModel()`, `useApiKey()`, `useLLMActions()` |
| `deployStore.ts` | Form + deployment | `useDeployDomain()`, `useFormActions()`, etc. |

**Improve a store**: See `/skills/zustand` and `docs/guides/zustand-nextjs-ssr-patterns.md`

## API Routes Summary

**Guide**: `docs/security/authentication.md`

| Endpoint | Auth | Async | Purpose |
|----------|------|-------|---------|
| POST `/api/claude` | ✓ | Polling | Full response (non-streaming) |
| POST `/api/claude/stream` | ✓ | SSE | Streaming response (convo locking + session resume + auto permissions) |
| GET `/api/tokens` | ✓ | – | Fetch credits/tokens balance |
| POST `/api/login` | ✗ | – | Workspace auth → JWT session cookie |
| POST `/api/verify` | ✓ | – | Check workspace dir exists |
| POST `/api/files` | ✓ | – | (Likely unused file ops) |

## Dev

```bash
bun run dev     # :8999 Turbo
bun run build   # next build
bun run start   # next start :8999
```
**Deps**: Next.js 16, @anthropic-ai/claude-agent-sdk, TailwindCSS 4, Lucide React, Zod
**Env**: `CLAUDE_MODEL`, `PASSCODE`, workspace paths
