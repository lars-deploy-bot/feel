# Alive Development Guide

AI assistant guidelines for working on Alive. Our frontpage is at [alive.best](https://alive.best).

## Two Servers

This repo is deployed on two servers. Check which one you're on:

| | **Server 1 (alive.best)** | **Server 2 (sonno.tech)** |
|---|---|---|
| **IP** | 138.201.56.93 | 95.217.89.48 |
| **Domains** | `alive.best`, `*.alive.best` | `sonno.tech`, `*.sonno.tech` |
| **Production** | `app.alive.best` (port 9000) | `sonno.tech` (port 9000) |
| **Staging** | `staging.alive.best` (port 8998) | `staging.sonno.tech` (port 8998) |
| **Shared services on Server 2** | — | PostHog (`posthog.homecatch.nl`), Sentry (`sentry.sonno.tech`) |

Both servers run the same codebase. Server 1 is primary production, Server 2 is the replica. PostHog and Sentry are only on Server 2 but serve both.

**Supabase instances are SEPARATE per environment — never mix credentials:**
- **Production** → Supabase Cloud (`qnvprftdorualkdyogka.supabase.co`)
- **Staging** → Self-hosted Supabase on Server 2 (`supabase-api.sonno.tech`)

**PostHog Analytics**: Queryable from any server via API. Use the `/analytics` skill to check app performance. API key is in `apps/web/.env.production` as `POSTHOG_PERSONAL_API_KEY`, project ID is `2`.

**Quick Links:** [Getting Started](./docs/GETTING_STARTED.md) | [Architecture](./docs/architecture/README.md) | [Security](./docs/security/README.md) | [Testing](./docs/testing/README.md)

## Project Management

Use the `/roadmap` skill to manage issues, milestones, and the project board. This is the source of truth for what we're building and what's next.

- **GitHub Project**: [Alive Roadmap](https://github.com/users/eenlars/projects/1) (board #1, owner: eenlars)
- **Repo**: `eenlars/alive`
- When creating issues, always assign a milestone and add to the project board
- When fixing a bug or completing a feature, close the related issue with a comment
- Use `/roadmap` to check project state before starting work

## Core Rules

1. **SHORTEST FEEDBACK LOOP** - The best way to test something is by creating a feedback loop that is as short as possible. The easiest way for testing functionality is creating something for yourself to be able to OBSERVE something quickly if working on it. For example, directly calling an API, or creating some flow/script to quickly grasp the workings. Be relentlessly resourceful.
2. **ALWAYS USE BUN** - Runtime and package manager
3. **GIT HOOKS** - Pre-push hooks run automatically; if they fail, fix the issues (don't force-push)
4. **NO RANDOM ENV VARS** - Don't add environment variables unless absolutely necessary. Use existing config, constants, or code-level defaults instead. Adding .env variables creates deployment complexity and hidden dependencies.
5. **NO EXPLORE AGENT** - Never use `Task(subagent_type=Explore)`. Use Glob and Grep directly instead - they're faster and more precise for this codebase.
6. **CADDYFILE IS LARGE** - The generated sites file at `/root/webalive/alive/ops/caddy/generated/Caddyfile.sites` (synced from `/var/lib/alive/generated/Caddyfile.sites`) is too large to read in one go. Use `Read` with `offset` and `limit` parameters, or use `Grep` to find specific domain configurations.
7. **OWN YOUR CHANGES** - When deploying or committing, NEVER say "these unrelated changes are not mine" or refuse to include changes in the working directory. If changes exist, they are part of the current work. Take responsibility and include them.
8. **SEEMINGLY UNRELATED ISSUES ARE OFTEN RELATED** - When you see multiple errors or issues, assume they share a common cause until proven otherwise. Type errors in test files often stem from the same interface change. Build failures across packages usually have one root cause. Don't treat each error as isolated - find the pattern first.
9. **INVESTIGATE BEFORE FIXING** - When something is "broken", first understand what it IS. Not all `*.alive.best` domains are Vite websites. Check nginx config, caddy-shell config, and existing services before creating anything new.
10. **DEPLOYMENTS REQUIRE NOHUP** - When deploying staging/production, ALWAYS use `nohup make staging > /tmp/staging-deploy.log 2>&1 &` (never bare `make staging`). If your chat session disconnects or you cancel, bare commands leave orphaned build processes that stack up and crash production. Check `tail -f /tmp/staging-deploy.log` for progress. NEVER run deployment commands multiple times - wait for the first to complete.
11. **ONE DEPLOYMENT AT A TIME** - Before starting any deployment, check if one is already running: `make deploy-status`. If a deployment is running, WAIT. Do not start another. Stacked deployments cause memory exhaustion and production outages.
12. **CLEAN BEFORE DEPLOY** - Before ANY deployment, check for orphaned processes: `ps aux | grep -E "make|ship|turbo|next build" | grep -v grep`. If you see old ones, kill them: `pkill -9 -f "ship.sh|build-and-serve|turbo|next build"` and remove stale lock: `rm -f /tmp/alive-deploy.lock`. Only then deploy.
13. **DEBUG STREAM ERRORS** - When users report "error while streaming", find root cause: `journalctl -u alive-staging | grep "STREAM_ERROR:<error-id>"`. See [docs/troubleshooting/stream-errors.md](./docs/troubleshooting/stream-errors.md).
14. **NEXT.JS MODULE CACHING** - If config changes aren't picked up, clear cache: `rm -rf apps/web/.next/cache && systemctl restart [environment]`. Modules load config at initialization time.
15. **NO FALLBACKS** - Never write `value || fallback` or `value ?? default` for configuration. If a value is required, throw when it's missing. Silent fallbacks hide bugs and create confusing behavior. Fail fast, fail loud.
16. **NO `as` OR `any`** - Never use `as` type assertions or `any`. Fix the types properly. If TypeScript complains, the types are wrong — fix them at the source, don't silence the compiler.
17. **NO HARDCODED DOMAINS** - Domain configuration comes from `server-config.json` at runtime. Never bake domains into env files, source code, or build artifacts. The same build must work on any server.
18. **USE TSGO, NOT TSC** - Type-checking uses `tsgo --noEmit` (TypeScript 7 native compiler, ~5x faster). `tsc` is only for `build` scripts that emit JS. Never add `tsc --noEmit` to new packages. No enums, no constructor parameter properties (`erasableSyntaxOnly` is on).
19. **FIX WHAT'S BROKEN** - Never dismiss a failing test or CI check as "pre-existing" or "unrelated to my changes". If it's broken on the branch you're working on, it's your problem. Fix it. The branch isn't done until CI is green.
20. **GENERATED TYPES ARE GENERATED** - Files in `packages/database/src/*.generated.ts` are auto-generated by `bun run gen:types`. NEVER edit them manually. If the types are wrong, fix the database schema and regenerate. These files export `AppConstants` (runtime enum values) and `AppDatabase` (type-level schema) — both are used by `automation-enums.ts` to derive shared types.
21. **BASH TOOL ESCAPES `!`** - The Bash tool escapes `!` to `\!` in all commands — use file-based queries (`-F query=@file.graphql`) or inline values to avoid breaking GraphQL syntax.
22. **CONSOLIDATE, DON'T DUPLICATE** - Before writing new logic, search for existing implementations. This codebase has duplicate shared logic that needs consolidation, not more copies. If you find the same pattern in two places, merge them into one shared location (usually `packages/shared` or `packages/database`). One function, one source of truth.
23. **DB ENUM TYPES COME FROM `@webalive/database`** - Never hardcode database enum values (`"pending"`, `"running"`, `"success"`, `"cron"`, `"prompt"`, etc.) as inline union types, arrays, or Zod schemas. Import from `@webalive/database` instead:
    - **Types**: `RunStatus`, `JobStatus`, `TriggerType`, `ActionType`, `TerminalRunStatus`
    - **Type guards**: `isRunStatus()`, `isTriggerType()`, `isActionType()`, `isJobStatus()`
    - **Runtime sets**: `RUN_STATUSES`, `TRIGGER_TYPES`, `ACTION_TYPES`, `JOB_STATUSES`
    - **Zod schemas**: Derive with `z.enum(AppConstants.app.Enums.<name>)`, never hand-write the values
    - Source file: `packages/database/src/automation-enums.ts`, derived from auto-generated `AppConstants`
24. **`canUseTool` IS BROKEN IN THE SDK — DO NOT RELY ON IT** - The Claude Agent SDK's `canUseTool` callback is **NEVER CALLED** by the CLI subprocess. Tested empirically on SDK v0.2.41: regardless of `permissionMode` (`default`, `acceptEdits`, `dontAsk`), the CLI auto-approves all tools without sending `can_use_tool` control requests back via stdio. Even a callback that returns `{ behavior: "deny" }` for everything is silently ignored — tools run anyway. **Our ONLY enforceable security layers are:** (1) `allowedTools` / `disallowedTools` arrays passed to the SDK (CLI enforces these), (2) `cwd` workspace sandboxing (CLI restricts file tools to cwd), (3) MCP tool-level `validateWorkspacePath()`. The `canUseTool` code in `worker-entry.mjs` (path traversal checks, heavy-command blocking) is **dead code** that provides zero protection. Do not add security logic there — it will never execute. If Anthropic fixes this in a future SDK version, re-verify with the test script at `/tmp/test-permission-mode.mjs` before trusting it.

## E2B Sandbox Migration (ACTIVE)

We are moving to **E2B sandboxes** for site execution. Self-hosted E2B at `e2b.sonno.tech`. This will be aggressive — not a gentle migration with compatibility layers. The codebase will split between the current systemd approach and the new E2B approach as we figure out what needs to change.

**Experiment:** `apps/experimental/e2b-test/` — basic smoke test validating sandbox creation, commands, and file I/O.

## Learn from OpenClaw (IMPORTANT)

**OpenClaw** (formerly ClawdBot) is installed at `/opt/services/clawdbot/`. It's a well-architected open-source AI assistant with battle-tested patterns.

**When building new features, ALWAYS check OpenClaw first:**
```bash
# Search for relevant patterns
ls /opt/services/clawdbot/src/
grep -r "your-feature" /opt/services/clawdbot/src/
```

**Patterns we've already adopted:**
- `proper-lockfile` for file-based locking (OAuth refresh)
- `retryAsync` with exponential backoff and jitter (`@webalive/shared`)
- `createDedupeCache` for TTL-based deduplication (`@webalive/shared`)
- OAuth token auto-refresh with 5-minute buffer

**Patterns worth exploring:**
- `/opt/services/clawdbot/src/security/external-content.ts` - Prompt injection protection for webhooks
- `/opt/services/clawdbot/src/security/audit.ts` - Security audit system with findings/remediation
- `/opt/services/clawdbot/src/infra/` - Infrastructure utilities (ports, restart, ssh-tunnel, etc.)
- `/opt/services/clawdbot/src/memory/` - Embeddings and vector search for conversation memory
- `/opt/services/clawdbot/src/sessions/` - Session management patterns

**The goal:** Don't reinvent. When you need retry logic, deduplication, rate limiting, security patterns, or infrastructure utilities - check OpenClaw first. Copy what works, adapt to our architecture.

## Special Domains (NOT websites)

These domains are **NOT** Vite website templates. Do not deploy them as sites:

| Domain | What it is | Service | Port | Routing |
|--------|-----------|---------|------|---------|
| `go.alive.best` | Go shell-server | `shell-server-go.service` | 3888 | nginx → caddy-shell (8443) → 3888 |
**Nginx SNI routing**: These domains route through `caddy-shell` (not main Caddy) for SSE/WebSocket isolation. Config: `/etc/nginx/nginx.conf` and `/etc/caddy/caddy-shell.Caddyfile`.

## Architecture Smell Detector

**ARCHITECTURE SMELL DETECTOR** - Warn when you see these anti-patterns:
   - Adding more tools/features to solve a problem (instead of one core constraint)
   - "Let the AI figure it out" instead of clear success criteria
   - Flexibility/options when opinionated defaults would work
   - Integrating everything instead of doing one thing exceptionally well
   - Complex autonomy when simple rules would suffice
   - Building for "power users" that don't exist yet
   - Asking users what they want instead of telling them how it works

   **What winners did:**
   - Linear: speed as the constraint. Everything keyboard-first, opinionated, no plugins.
   - Figma: multiplayer as the constraint. Every feature designed for "5 people in this file."
   - Superhuman: $30/mo email with NO features. Just fast. Trained users how to use it.
   - Discord: communities as the constraint. Servers/roles, not "workplace collaboration."

   **The pattern:** Strong opinions, great defaults, ONE core constraint that drives every decision.

   **Our core constraint: Agents do what they promise. No mistakes.**
   - Can't promise what it can't verify
   - Must know when to STOP, not try and break things
   - Small scope = verifiable scope

   If you spot the anti-patterns, say: **"⚠️ Architecture smell: [pattern]. Does this help agents do exactly what they promise, or does it add ways to fail?"**

## Project Overview

Alive is a **multi-tenant development platform** that enables Claude AI to assist with website development through controlled file system access. Key characteristics:

- **Multi-tenant architecture**: Each domain gets isolated workspace
- **Security-first design**: Workspace sandboxing, systemd isolation, process separation
- **TURBOREPO Next.js 16 + React 19**: Modern App Router architecture using **Turborepo** for building and deploying the project.
- **NDJSON streaming**: Real-time Claude responses via HTTP chunked transfer (application/x-ndjson)
- **Tool-based interaction**: Limited to safe file operations (Read, Write, Edit, Glob, Grep)
- **Superadmin access**: Users in `SUPERADMIN_EMAILS` env var can edit this repo via the frontend (workspace: `alive`, runs as root, all tools enabled)

## Monorepo Structure

### Apps (Deployable Services)

| App | Port | Purpose |
|-----|------|---------|
| `web` | 8997/9000 | Next.js monolith: Chat UI, Claude API, file ops, auth, deployments |
| `api` | 5080 | Hono on Bun. Standalone API — gradually taking over routes from `web` |
| `manager` | 5090 | React + Vite admin dashboard. Frontend for `api` |
| `shell-server-go` | - | Go rewrite of shell-server (WIP) |
| `preview-proxy` | configurable | Go preview proxy for workspace preview subdomains |
| `worker` | 5070 | Automation scheduler + executor (standalone Bun, survives web deploys) |
| `image-processor` | 5012 | Python/FastAPI image manipulation service |
| `mcp-servers/google-scraper` | - | MCP server for Google Maps business search |

#### API Migration (In Progress)

We're slowly decoupling from the Next.js monolith (`apps/web`) into a standalone API (`apps/api`, Hono on Bun) and standalone frontends (`apps/manager`, React + Vite). The goal: `apps/api` becomes the single API layer, `apps/web` shrinks to just the chat UI.

**Rules:**
- `apps/api` and `apps/manager` must **never** depend on `apps/web`. They share code only via `packages/`.
- For browser-safe imports from `@webalive/shared`, use subpath imports (`@webalive/shared/constants`) to avoid pulling in Node-only modules.
- Migrate routes one at a time. The old Next.js routes stay until the new ones are verified.

**Dev / prod environments:**
- **Dev**: `api` runs `bun --watch` on port 5080, `manager` runs Vite dev on 5090 (proxies `/api` → 5080). Start both separately.
- **Prod**: `manager` builds to static files served by `bun server.ts` on port 5090 (systemd: `alive-manager.service`), which proxies `/api` → `api` on port 5080. Caddy routes `mg.alive.best` directly to port 5090 (not through Next.js).

### Packages (Shared Libraries)

| Package | Purpose |
|---------|---------|
| `@webalive/shared` | Constants, environment definitions, stream tools. Almost everything depends on this. Zero internal deps (browser-safe). |
| `@webalive/database` | Auto-generated Supabase types (`iam.*`, `app.*` schemas), `AppConstants` (runtime enum values), automation enum types + guards (`RunStatus`, `TriggerType`, `ActionType`, `isRunStatus()`, etc.) |
| `@webalive/tools` | Claude's workspace tools (Read, Write, Edit, Glob, Grep) + MCP server |
| `@webalive/site-controller` | Shell-Operator deployment: TS orchestrates, bash executes systemd/caddy/users |
| `@webalive/oauth-core` | Multi-tenant OAuth with AES-256-GCM encrypted token storage |
| `@webalive/redis` | ioredis wrapper with Docker setup for sessions/caching |
| `@webalive/env` | Zod-validated env vars via @t3-oss/env-nextjs |
| `@webalive/worker-pool` | Unix socket IPC for warm Claude SDK workers |
| `@webalive/images` | Native image processing via @napi-rs/image |
| `@alive-game/alive-tagger` | Vite plugin: injects source locations so Claude knows file:line from UI clicks |
| `@webalive/automation-engine` | Automation claim/finish lifecycle, lease-based locking, run logs |
| `@webalive/automation` | Cron expression parsing utilities |

### Request Flow (Claude Chat)

```text
Browser → /api/claude/stream → Claude Agent SDK → tool callbacks
                                                       ↓
                                              @webalive/tools
                                                       ↓
                                              workspace sandbox
                                              /srv/webalive/sites/[domain]/
```

Tools validate paths via `isPathWithinWorkspace()` before any file operation.

## Core Architecture Patterns

### 1. Workspace Isolation & Privilege Separation

**Guide**: `docs/architecture/workspace-isolation.md`

**🔥 CRITICAL RULE**: When working on package installs, file operations, builds, or ANY command that touches workspace files, you **MUST** read the guide first.

**Quick facts:**
- Each website = own workspace = own system user (e.g., `site-example-com`)
- Bridge runs as root, spawns children that drop to workspace user
- Use `runAsWorkspaceUser()` for commands, not `spawnSync()`
- Pattern in `lib/workspace-execution/`

**Workspace locations:**
- Sites: `/srv/webalive/sites/[domain]/` (systemd-managed, secure)

**Path validation:**
```typescript
if (!isPathWithinWorkspace(filePath, workspacePath)) {
  throw new Error('Path traversal attack detected')
}
```

### 2. Session Management

**Pattern**: Each browser tab = one independent chat session. Sessions are keyed by `userId::workspace::tabGroupId::tabId`

```typescript
// Session key builder
import { tabKey } from '@/features/auth/lib/sessionStore'
const key = tabKey({ userId, workspace, tabGroupId, tabId })
// → "userId::workspace::tabGroupId::tabId"
// or with worktree: "userId::workspace::wt/<slug>::tabGroupId::tabId"

// Session store interface
interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
```

**Implementation**: Supabase IAM-backed (`iam.sessions` table) with domain_id caching. Sessions persist across server restarts.

### 3. Streaming Protocol (NDJSON)

Uses `application/x-ndjson` over HTTP chunked transfer — NOT SSE (`text/event-stream`).
Each line is a self-contained JSON object. Reconnection is handled manually via Redis stream buffers + cursor acks (no `EventSource` / `Last-Event-ID`).

**Message types:** `start`, `message`, `session`, `complete`, `error`

### 4. Conversation Locking

**CRITICAL**: Prevent concurrent requests to same conversation

```typescript
import { tryLockConversation, unlockConversation } from '@/features/auth/lib/sessionStore'

const locked = tryLockConversation(key)
if (!locked) {
  return res.status(409).json({ error: 'Conversation in progress' })
}
try {
  // SDK query
} finally {
  unlockConversation(key)
}
```

### 5. Model Selection & Credits

**CRITICAL**: Credit users restricted to DEFAULT_MODEL for cost management.

See [docs/architecture/credits-and-tokens.md](./docs/architecture/credits-and-tokens.md) for model enforcement patterns.

## Development Guidelines

### File Structure Conventions

```
apps/web/
├── app/
│   ├── api/              # API routes (Next.js route handlers)
│   │   ├── claude/       # Claude SDK integration (stream/, cancel/, reconnect/)
│   │   ├── files/        # File operations
│   │   └── ...           # 50+ route directories
│   ├── chat/             # Chat UI
│   └── globals.css       # Global styles
├── features/             # Feature modules (auth, chat, workspace, settings, ...)
├── components/           # Shared React components (ui/, workspace/, modals/, ...)
└── lib/                  # Utility libraries (env, config, stream/, tools/, ...)
```

### Security Guidelines

**ALWAYS follow these security rules:**

1. **Path Validation**: Use `isPathWithinWorkspace()` before any file operation
2. **User Isolation**: New sites MUST use systemd deployment (dedicated users)
3. **Tool Restrictions**: Only expose Read, Write, Edit, Glob, Grep to Claude
4. **Session Security**: Never expose session keys in logs or responses
5. **Password Storage**: User passwords in Supabase `iam.users.password_hash` (bcrypt)

### Code Style

- **Formatting**: Use `bun run format` (Biome)
- **Linting**: Use `bun run lint` (Biome)
- **TypeScript**: Strict mode enabled, no implicit any
- **React**: Use hooks, functional components only
- **Error Handling**: Always catch and properly format errors for NDJSON stream

### Git Hooks (Husky)

**IMPORTANT**: This project uses Husky for automated quality checks. Hooks run automatically and cannot be disabled without `--no-verify`.

#### Pre-Commit Hook
- **What it does**:
  - Blocks `.env` files from being committed
  - Formats only staged files using `lint-staged`
  - Runs type-check (`bun run type-check`)
- **Speed**: Instant (only touches staged files)
- **When it runs**: Every `git commit`

#### Pre-Push Hook
- **What it does**: Runs `bun run static-check` before allowing push
  - Turbo env validation (`bun run validate:turbo-env`)
  - Workspace contract validation (`bun run check:workspace-contract`)
  - Type checking (`turbo run type-check`)
  - Lint/format check-only (`turbo run ci`)
  - Core unit tests (`bun run test:core`)
- **Speed**: 10-60 seconds (uses Turborepo cache)
- **When it runs**: Every `git push`

#### CI Defaults
- **PRs** run fast, affected-only checks: `bun run check:affected` + error pattern check
- **Pushes to `main`/`dev`/`staging`** run full checks: `bun run static-check` + error pattern check
- **Stale runs auto-cancel** via workflow concurrency settings

#### If Pre-Push Hook Fails

**DO:**
1. Read the error output carefully
2. Fix the type errors, lint errors, or test failures
3. Run `bun run static-check` locally to verify fixes
4. Commit the fixes and push again

**DON'T:**
- Use `git push --no-verify` to bypass checks
- Force push to circumvent quality gates
- Ignore failing tests or type errors

**Manual Testing:**
```bash
# Test what pre-push will run
bun run static-check

# Fast PR check path (affected workspaces only)
bun run check:affected
```

**Common Issues:**
- **"bun: command not found" in GUI clients**: See README.md Git Hooks Setup section
- **Slow pre-push**: First run is slow; subsequent runs use Turbo cache and are fast
- **Test failures**: Some tests may require environment setup (see Testing Guide)

### Common Tasks

#### Adding a New API Endpoint

1. Create route handler in `app/api/[name]/route.ts`
2. Import and use `requireSessionUser()` from `@/features/auth/lib/auth` for authentication
3. Validate workspace if file operations involved
4. Return proper status codes (401, 400, 500, etc.)
5. **Write tests in `app/api/[name]/__tests__/route.test.ts`** (MANDATORY!)
   - See "When to Write Tests" section for minimum required tests
   - File operations require additional security tests

#### Modifying Claude Integration

**Files to update:**
- `apps/web/app/api/claude/stream/route.ts` - NDJSON streaming endpoint
- `apps/web/lib/stream/ndjson-stream-handler.ts` - Stream parsing and buffering
- `apps/web/lib/tools/register-tools.ts` - Tool configuration

**Key considerations:**
- Tool callbacks must handle workspace paths correctly
- All tool operations must be logged
- Errors should be streamed as NDJSON messages, not thrown

#### Migrating Config Files

**⚠️ CRITICAL**: Config/file migrations can break production. Always follow the safe migration guide.

**Required reading**: [`docs/guides/safe-config-migration.md`](./docs/guides/safe-config-migration.md)

**Quick checklist:**
1. ✅ Document the migration plan
2. ✅ Search for ALL references: `grep -r "old-file" .`
3. ✅ Validate before deleting: `./scripts/validate-no-deleted-refs.sh old-file`
4. ✅ Test service restarts: `systemctl restart alive-dev && journalctl -u alive-dev -n 20`
5. ✅ Run full test suite: `bun run test && bun run e2e`

**Never**:
- ❌ Delete files before updating all references
- ❌ Skip the validation script
- ❌ Use dynamic requires in npm scripts: `$(node -p "require('./config').value")`

**See also**: Postmortems in `docs/postmortems/` for past outage lessons.

#### Deploying a New Site

**Site deployments use the `@webalive/site-controller` package with the Shell-Operator Pattern:**

```bash
# Via API (authenticated deployment - primary method)
# POST /api/deploy-subdomain with { domain, email, password? }

# Or programmatically:
import { SiteOrchestrator } from '@webalive/site-controller'

const result = await SiteOrchestrator.deploy({
  domain: 'newsite.com',
  slug: 'newsite-com',
  templatePath: PATHS.TEMPLATE_PATH,
  serverIp: DEFAULTS.SERVER_IP,
  wildcardDomain: DEFAULTS.WILDCARD_DOMAIN,
  rollbackOnFailure: true  // Automatic rollback on failure
})

if (result.success) {
  console.log(`Deployed: ${result.domain} on port ${result.port}`)
} else {
  console.error(`Failed at phase: ${result.failedPhase}`)
  // Infrastructure automatically rolled back
}
```

**Creates:**
- Systemd service: `site@newsite-com.service`
- Dedicated user: `site-newsite-com`
- Workspace: `/srv/webalive/sites/newsite.com/`
- Port: Auto-assigned from registry (3333-3999 range)
- Caddy configuration: Auto-updated with reverse proxy

**Architecture**: Shell-Operator Pattern
- **TypeScript**: Orchestration, error handling, state management
- **Bash**: OS operations, filesystem, permissions, systemd
- **Atomic scripts**: 7 deployment phases with automatic rollback
- **Concurrent safety**: File locking prevents race conditions

**Documentation**:
- Package: `packages/site-controller/README.md`
- Scripts: `packages/site-controller/scripts/*.sh`
- Architecture: `docs/architecture/README.md`

#### Updating Caddy Configuration

**Location (generated)**: `/root/webalive/alive/ops/caddy/generated/Caddyfile.sites`

```bash
# 1. Regenerate routing from DB (creates /var/lib/alive/generated/Caddyfile.sites)
bun run --cwd packages/site-controller routing:generate

# 2. Sync filtered file used by main Caddy import
bun /root/webalive/alive/scripts/sync-generated-caddy.ts

# 3. Reload (zero-downtime, preserves active connections)
systemctl reload caddy

# 4. Verify
systemctl status caddy
```

**Auto-sync architecture**: Main `/etc/caddy/Caddyfile` imports `/root/webalive/alive/ops/caddy/Caddyfile`, which in turn imports the generated routing file.

**⚠️ CRITICAL: `tls force_automate`** — Every explicit `*.sonno.tech` domain block MUST include `tls force_automate`. Without it, Caddy v2.10.x silently fails to obtain certs due to a bug with `on_demand_tls` ([#6996](https://github.com/caddyserver/caddy/issues/6996)). The routing generator template already includes this — see `ops/caddy/README.md` for details.

## Testing Guidelines

**Documentation**: See [docs/testing/README.md](./docs/testing/README.md) for complete testing guide.

**E2E tests are our most valuable tests.** They catch real regressions that unit tests miss — auth flows, streaming, workspace isolation, deployment. When in doubt, write an E2E test. We need more of them. Every user-facing feature should have E2E coverage.

### When to Write Tests (STRICT - MANDATORY)

**⚠️ IMPORTANT: Tests are NOT optional. You MUST write tests before considering any API work complete.**

**✅ MUST write tests for:**
1. **Security-critical functions** (100% coverage required)
   - Path traversal protection (`isPathWithinWorkspace`)
   - Session validation (`getSessionUser`, `hasSessionCookie`)
   - Workspace boundary checks (`getWorkspace`)
   - Shell command sanitization (if executing shell commands)
   - Authentication logic
   - **File operation endpoints** (Read, Write, Edit, Delete, etc.)

2. **New API routes** (MANDATORY - not optional!)
   - Any new endpoint in `app/api/`
   - **Minimum required tests:**
     - Authentication check (401 without session)
     - Happy path (successful operation)
     - At least one error case (400/403/404/500)
   - **For file operations, also test:**
     - Path traversal blocked
     - Protected files/dirs blocked (if applicable)
     - Workspace boundary enforced

3. **File operation endpoints** (CRITICAL - security boundary)
- These handle user data and filesystem access
- Must test all security checks work correctly
- Example: `/api/files/delete` has 15 tests covering auth, traversal, protected files

**⚠️ SHOULD write tests for:**
4. **Complex business logic**
   - Workspace resolution (multiple branches, edge cases)
   - Stream handling (if modifying NDJSON logic)
   - Credit/billing operations

**❌ DON'T write tests for:**
- Simple formatters/transforms
- Type guards (unless security-critical)
- UI components (unless fixing a bug)
- Third-party library wrappers
- Configuration files

### Quick Commands

```bash
# Fast PR checks (affected-only)
bun run check:affected

# Full local gate (matches pre-push)
bun run static-check

# Core unit tests
bun run unit

# Run E2E tests (first time: bunx playwright install chromium)
bun run e2e

# Run a specific web test
cd apps/web && bun run test security.test.ts
```

**Testing Notes:**
- Always use `bun run test`, never `bun test` directly
- Do NOT use `npx vitest` - npx and vitest don't work well together in this codebase

**E2E Test Best Practices**:
- Tests should only wait for what they actually need (API tests don't need UI)
- Use `toBeAttached` instead of `toBeVisible` when you just need DOM presence
- Budget timeouts for parallel execution (4 workers = 2-3x slower)
- Avoid timeout accumulation: put longest wait first, then quick confirmations

### Test Patterns

**MUST READ**: [docs/testing/TEST_PATTERNS.md](./docs/testing/TEST_PATTERNS.md) - Do/Don't examples for AI-generated tests.

Key rules: No mocking internals, no `any` types, test real DB state, descriptive names, use test helpers, clean up data, test error paths.

### Before Committing

**Automated checks:**
- [ ] Run `bun run check:affected` (or `bun run static-check` for broad changes)
- [ ] Run targeted tests for touched paths (`bun run unit`, `cd apps/web && bun run test ...`, and/or `bun run e2e`)

**Manual verification (if applicable):**
- [ ] Tested security functions manually (path traversal, auth)
- [ ] Tested both standard domain mode and terminal mode
- [ ] Verified workspace isolation works
- [ ] No real Anthropic API calls in tests (check logs)

## Production Deployment

For troubleshooting, inspecting production, and dev/staging work, see `docs/deployment/deployment.md`.

### Available Commands

```bash
make ship        # Full pipeline: staging → production
make ship-fast   # Same as ship, skips E2E tests
make staging     # Deploy staging only (port 8998)
make staging-fast # Deploy staging only, skip E2E tests
make production  # Deploy production only (port 9000)
make dev         # Rebuild tools + restart dev server (port 8997)
make devchat     # Restart dev server via systemctl (safe from chat)
make logs-staging # View staging logs
make logs-production # View production logs
make logs-dev    # View dev environment logs

# Status & monitoring
make status      # Show all environments
make rollback    # Interactive rollback (if needed)
```

### Deploying from Chat

See **Core Rules 12-14** at the top of this file. Summary: clean orphans, check `make deploy-status`, deploy with `nohup`.

### Site Deployment (Different)

To deploy individual websites (not the Alive itself), use the API endpoint:
```bash
# Via web UI at /deploy (recommended)
# Or via API:
curl -X POST https://terminal.alive.best/api/deploy-subdomain \
  -H "Content-Type: application/json" \
  -d '{"domain": "newsite.alive.best", "email": "user@example.com"}'
```

**Package**: Site deployments are handled by `@webalive/site-controller` with atomic bash scripts and automatic rollback.


## Key Dependencies & Versions

### Core Stack
- **Next.js**: 16.x (App Router, RSC)
- **React**: 19.2.0 (Concurrent features)
- **Claude Agent SDK**: ^0.2.34 (query, streaming, tools)
- **Bun**: 1.2.22+ (runtime & package manager)
- **TypeScript**: 5.x (strict mode)
- **TailwindCSS**: 4.1.15 (utility-first CSS)

### Infrastructure Packages
- **@webalive/database**: Supabase schema types - `iam` schema (users, orgs, org_memberships, sessions), `app` schema (domains, user_quotas, feedback, templates)
- **@webalive/site-controller**: Site deployment orchestration (Shell-Operator Pattern)
- **@webalive/oauth-core**: Multi-tenant OAuth with AES-256-GCM encryption
- **@webalive/redis**: Redis client with automatic retry and error handling
- **@webalive/alrighty**: Typed API pattern with handleBody for request parsing and response validation

## Common Issues & Solutions

### Issue: Stream Buffering

**Symptom**: Messages don't appear in real-time

**Solution**: Ensure proxy layers don't buffer the NDJSON response. Set `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform` on the `Response`.

### Issue: Path Traversal Vulnerability

**Symptom**: User can access files outside workspace

**Solution**: Always use `isPathWithinWorkspace()`
```typescript
const resolvedPath = path.resolve(workspacePath, userProvidedPath)
if (!isPathWithinWorkspace(resolvedPath, workspacePath)) {
  throw new Error('Invalid path')
}
```

### Issue: Session Not Persisting

**Symptom**: Conversation context lost on refresh

**Solution**: Check session key format and storage
```typescript
import { tabKey } from '@/features/auth/lib/sessionStore'
const key = tabKey({ userId, workspace, tabId })
const sessionId = await sessionStore.get(key)
```

### Issue: Systemd Site Not Starting

**Symptom**: `systemctl status site@domain.service` shows failed

**Solution**: Check logs and permissions
```bash
# View logs
journalctl -u site@domain-com.service -n 50

# Check file permissions
ls -la /srv/webalive/sites/domain.com/

# Verify user exists
id site-domain-com

# Test manual start
sudo -u site-domain-com bun /srv/webalive/sites/domain.com/user/index.ts
```

### Issue: Race Condition in Credit Charging

**Symptom**: Negative credit balances or billing leaks

**Cause**: Concurrent requests use read-modify-write pattern

**Solution**: Use atomic database operation (implemented in `atomic-credit-charging.md`)
```typescript
// ✅ Atomic deduction via RPC
const { data } = await iam.rpc('deduct_credits', {
  p_org_id: orgId,
  p_amount: credits
})
// Returns new balance or null if insufficient
```

**Documentation**: `docs/architecture/atomic-credit-charging.md`

### Template Sites Maintenance

**Template sites** live in `/srv/webalive/templates/`, a dedicated git repo (`eenlars/alive-templates`) that contains all template source code. Templates are the starting points when deploying new sites — each template is a complete Vite project that gets rsync'd to the new site's workspace. They also run as live previews so users can see them before choosing.

**Location**: `/srv/webalive/templates/` (git repo: `eenlars/alive-templates`)
**Systemd**: `template@{slug}.service` (separate from `site@` services)
**Config**: `server-config.json` → `paths.templatesRoot` (default: `/srv/webalive/templates`). The old `templates` key is rejected at parse time by `rejectRemovedKeys()`.
**Server**: Templates only run on **Server 1** (alive.best). Server 2 has no local template sites — the preview proxy cannot reach them there (see [#98](https://github.com/eenlars/alive/issues/98)).
**Push**: `GIT_SSH_COMMAND="ssh -i /root/.ssh/id_lars_deploy_bot" git push` (from `/srv/webalive/templates/`)

**Template sites** (in Supabase `app.templates`):

| Template ID | Domain | Port | Mode |
|---|---|---|---|
| `tmpl_blank` | `blank.alive.best` | 3594 | `bun run preview` |
| `tmpl_gallery` | `template1.alive.best` | 3352 | `bun run dev` |
| `tmpl_event` | `event.alive.best` | 3345 | `bun run dev` |
| `tmpl_saas` | `saas.alive.best` | 3346 | `bun run dev` |
| `tmpl_business` | `loodgieter.alive.best` | 3389 | `bun run dev` |
| — | `components.alive.best` | 3364 | `bun run dev` |

**Key points:**
1. **rsync excludes** `node_modules` and `.bun` (see `02-setup-fs.sh`)
2. Template sites need their `node_modules` for previews to work
3. If template preview returns 502, reinstall deps and restart:
```bash
# Reinstall deps
sudo -u site-blank-alive-best bun install --cwd /srv/webalive/templates/blank.alive.best/user
systemctl restart template@blank-alive-best.service

# Check all template services
systemctl list-units 'template@*'
```
4. Template path resolution: `resolveTemplatePath(dbSourcePath)` from `@webalive/shared` extracts the directory name from the DB `source_path` and joins with `TEMPLATES_ROOT`

**IMPORTANT:** When updating `@alive-game/alive-tagger` or similar packages:
- Update both `vite.config.ts` AND `package.json` in all sites
- The `generate-config.js` script generates vite configs - keep it in sync

## Git Workflow

**Custom SSH Key**: Uses `id_lars_deploy_bot` for GitHub

```bash
# Push changes
bun run push

# Pull changes
bun run pull
```

## Local Open Source Services

**Location**: `/opt/services/`

Self-hosted open-source tools running on this server. Each service has its own directory with docker-compose or systemd configuration.

```
/opt/services/
├── mailcow/            # Self-hosted email server
└── supabase/           # Self-hosted Supabase instance
```

**Management**: Services typically run via Docker Compose or systemd. Check individual directories for their `docker-compose.yml` or service configuration.

## Automation System

Jobs are stored in Supabase `app.automation_jobs` and executed by a standalone worker process.

**Architecture:**
- `apps/worker` - Standalone Bun process: CronService (scheduler) + executor (Claude Agent SDK). Managed by systemd (`automation-worker.service`), survives web deploys.
- `apps/web` - API + UI only. Thin client POSTs to worker's HTTP API for poke/trigger.
- `packages/automation-engine` - Shared engine: claim/finish lifecycle, lease-based locking, heartbeat, run logs. Used by both worker and web trigger routes.
- `packages/automation` - Cron expression parsing utilities.

**Worker HTTP API** (port 5070):
- `GET /health` - Health check
- `POST /poke` - Re-arm scheduler immediately (called when jobs are created/updated)
- `POST /trigger/:id` - Manually run a job (requires `X-Internal-Secret` header)
- `GET /status` - Detailed service info

**Web API endpoints:**
- `GET/POST /api/automations` - List/create automations
- `POST /api/automations/[id]/trigger` - Manually trigger a job
- `GET /api/automations/[id]/runs` - Get run history

**Debugging:**
```bash
# Worker logs
journalctl -u automation-worker -f

# Check worker health
curl http://localhost:5070/health

# Check app.automation_jobs in Supabase
# psql "$SUPABASE_DB_URL" -c "select id, name, is_active, next_run_at from app.automation_jobs limit 20;"
```

## External Reference Repos

**Location**: `/opt/third/`

External codebases cloned for reference when stuck on frontend issues.

Check these repos for working examples before reinventing.

