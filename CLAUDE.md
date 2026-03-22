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
- **Production** → Supabase Cloud (`qnvprftdorualkdyogka.supabase.co`), used by both servers. Credentials in `.env.production`.
- **Staging** → Self-hosted Supabase on Server 2 (`supabase-api.sonno.tech`, raw Postgres on `127.0.0.1:5433`). Credentials in `.env.staging`. **On Server 2 this is local (localhost); on Server 1 it is remote (reachable via WireGuard at `10.8.0.1:5433`).** The `deploy.*` tables and all other schemas live in whichever Supabase instance the env file points to — staging services use the staging Supabase, production services use the cloud Supabase. The deployer-rs (`alive-deployer.service`) must use the **same** Supabase as the API (`alive-api.service`) so they read/write the same `deploy.builds` rows.

**PostHog Analytics**: Queryable from any server via API. Use the `/analytics` skill to check app performance. API key is in `apps/web/.env.production` as `POSTHOG_PERSONAL_API_KEY`, project ID is `2`.

**Quick Links:** [Getting Started](./docs/GETTING_STARTED.md) | [Architecture](./docs/architecture/README.md) | [Security](./docs/security/README.md) | [Testing](./docs/testing/README.md)

## Deploy Control Plane

The deploy control plane handles all staging and production deployments.

- **Service**: `apps/deployer-rs/` runs as `alive-deployer.service` and exposes a localhost health/control surface on port `5095`
- **Database schema**: Deploy state lives in `deploy.*` tables (`deploy.builds`, `deploy.releases`, `deploy.deployments`, `deploy.environments`)
- **Flow**: `scripts/deployment/deploy-via-deployer.sh` inserts a pending build, waits for the Rust worker to create a release, then inserts a deployment and tails status via `/health/details`
- **Build isolation**: Build runs in the repo checkout, then `activate_systemd` copies the primary build output to `.builds/{environment}/standalone/` (from `alive.toml` `[systemd].release_dir_template`). Each environment gets its own copy — staging deploys cannot break production's runtime files.
- **Systemd services**: `alive-staging.service` (port 8998) and `alive-production.service` (port 9000) run from `.builds/{env}/standalone/apps/web/server.js`. `NODE_PATH` points at repo `node_modules` for workspace package resolution.

**Operational commands:**
- `make deployer` - build and restart only `alive-deployer`
- `systemctl status alive-deployer`
- `journalctl -u alive-deployer -n 100`
- `curl http://127.0.0.1:5095/health`
- `curl http://127.0.0.1:5095/health/details`

## Project Management

Use the `/roadmap` skill to manage issues, milestones, and the project board. This is the source of truth for what we're building and what's next.

- **GitHub Project**: [Alive Roadmap](https://github.com/users/lars-deploy-bot/projects/1) (board #1, owner: lars-deploy-bot)
- **Repo**: `lars-deploy-bot/feel`
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
9. **INVESTIGATE BEFORE FIXING** - When something is "broken", first understand what it IS. Not all `*.alive.best` domains are Vite websites. Check caddy config, caddy-shell config, and existing services before creating anything new.
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
24. **NO SYMLINKS IN BUILD OUTPUTS** - Never use `ln -sfn` for build artifacts that a running server depends on. Symlinks let one environment's rebuild destroy another's runtime files. Always `cp -r`. Staging and production each get their own isolated copy under `.builds/{environment}/`. The deployer-rs `activate_systemd` step copies build outputs to the per-environment release directory (from `alive.toml` `[systemd].release_dir_template`) before restarting the service.
25. **DEPLOYER CODE IS REPO-AGNOSTIC** - The deployer-rs (`apps/deployer-rs/`) must work for any app, not just Alive. Paths come from `alive.toml` config (`[build].outputs`, `[systemd].release_dir_template`, `[systemd].unit_template`), not hardcoded. Environment names (`staging`, `production`) are fine to hardcode — all our apps use those.
26. **`canUseTool` IS BROKEN IN THE SDK — DO NOT RELY ON IT** - The Claude Agent SDK's `canUseTool` callback is **NEVER CALLED** by the CLI subprocess. Tested empirically on SDK v0.2.41: regardless of `permissionMode` (`default`, `acceptEdits`, `dontAsk`), the CLI auto-approves all tools without sending `can_use_tool` control requests back via stdio. Even a callback that returns `{ behavior: "deny" }` for everything is silently ignored — tools run anyway. **Our ONLY enforceable security layers are:** (1) `allowedTools` / `disallowedTools` arrays passed to the SDK (CLI enforces these), (2) `cwd` workspace sandboxing (CLI restricts file tools to cwd), (3) MCP tool-level `validateWorkspacePath()`. Do not put security logic in `canUseTool`; the CLI subprocess will not enforce it. If Anthropic fixes this in a future SDK version, re-verify with `scripts/verify-canUseTool-callback.mjs` before trusting it.

## E2B Sandbox Migration (ACTIVE)

Migrating site execution from systemd to **E2B sandboxes**. Self-hosted E2B at `e2b.sonno.tech`. The codebase currently has both paths — systemd (legacy, still serving all live sites) and E2B (new, being wired up).

**Architecture:**
- `packages/sandbox/` — Core package: `SandboxManager` (create/connect/pause/resume/kill), `SandboxSessionRegistry` (session caching + Supabase persistence), file sync, MCP tools, domain runtime facades
- `apps/e2b-terminal/` — PTY bridge server (port 5075), accessed via `go.alive.best:8443/e2b/*` through caddy-shell
- `apps/web/app/api/sandbox/ensure/` — API endpoint to ensure sandbox is ready for a domain
- `apps/web/features/workspace/hooks/useSandboxEnsure.ts` — Frontend hook, fires on workspace change (fire-and-forget)
- `apps/web/lib/sandbox/session-registry.ts` — Singleton registry backed by Supabase `app.domains` table (`sandbox_id`, `sandbox_status` columns)

**Sandbox lifecycle:** `creating` → `running` → `paused` (30-day timeout) → `dead` (on failure). Sandboxes are keyed by `domain_id`. First create syncs host workspace files (500 files max, 10MB total, 1MB per file), installs deps, starts dev server. Reconnect reuses existing sandbox — does NOT resync.

**Critical rule:** NEVER delete/reset `sandbox_id` from the DB. The sandbox IS the user's filesystem after first sync.

**Experiment:** `apps/experimental/e2b-test/` — original smoke test (still exists, superseded by `packages/sandbox/`).

## Learn from OpenClaw

**OpenClaw** at `/opt/services/clawdbot/` — check it before building new patterns. We already adopted: `proper-lockfile`, `retryAsync`, `createDedupeCache`, OAuth token auto-refresh. When you need retry logic, deduplication, rate limiting, or security patterns — `grep -r "your-feature" /opt/services/clawdbot/src/` first.

## Special Domains (NOT websites)

These domains are **NOT** Vite website templates. Do not deploy them as sites:

| Domain | What it is | Service | Port | Routing |
|--------|-----------|---------|------|---------|
| `go.alive.best` | Go shell-server | `shell-server-go.service` | 3888 | caddy-shell (8443) → 3888 |
| `go.alive.best/e2b/*` | E2B PTY bridge | `e2b-terminal` | 5075 | caddy-shell (8443) → 5075 |

**caddy-shell** runs as a separate Caddy instance on port 8443 for SSE/WebSocket isolation. Config: `/etc/caddy/Caddyfile.shell` (generated at `/var/lib/alive/generated/Caddyfile.shell`). **nginx is configured but NOT running** — Caddy handles all routing directly.

## Architecture Smell Detector

**Core constraint: Agents do what they promise. No mistakes.** Can't promise what it can't verify. Must know when to STOP. Small scope = verifiable scope.

Warn on these anti-patterns: adding features instead of constraints, "let the AI figure it out" instead of clear success criteria, flexibility when opinionated defaults work, building for power users that don't exist yet.

If you spot them: **"⚠️ Architecture smell: [pattern]. Does this help agents do exactly what they promise, or does it add ways to fail?"**

## Project Overview

Alive is a **multi-tenant development platform** — Claude AI assists with website development through sandboxed file system access. Each domain gets an isolated workspace. Turborepo + Next.js 16 + React 19. NDJSON streaming for real-time responses. Superadmin users (`SUPERADMIN_EMAILS`) can edit this repo via the frontend (workspace: `alive`, runs as root).

## Monorepo Structure

### Apps (Deployable Services)

| App | Port | Purpose |
|-----|------|---------|
| `web` | 8997/9000 | Next.js monolith: Chat UI, Claude API, file ops, auth, deployments |
| `api` | 5080 | Hono on Bun. Standalone API — gradually taking over routes from `web` |
| `manager` | 5090 | React + Vite admin dashboard. Frontend for `api` |
| `shell-server-go` | 3888 | Go shell-server (`go.alive.best`) + preview proxy (host-based dispatch on `preview--*`) |
| `worker` | 5070 | Automation scheduler + executor (standalone Bun, survives web deploys) |
| `deployer-rs` | 5095 | Rust deploy worker: builds, releases, deployments. Health API on localhost |
| `image-processor` | 5012 | Python/FastAPI image manipulation service (Docker, not systemd) |
| `e2b-terminal` | 5075 | E2B PTY bridge server for sandbox terminal access |
| `widget-server` | - | Go widget server |
| `mcp/*` | - | MCP servers: browser-control (5061), gmail, google-calendar, google-search-console, ocr, outlook, stealth-request |

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
| `@webalive/sandbox` | E2B sandbox lifecycle management (create, connect, pause, resume, file sync) |
| `@webalive/org` | Organization membership domain logic (permissions, invites, credits) |
| `@webalive/runtime-auth` | Runtime auth with jose + zod |
| `@webalive/tunnel` | Cloudflare Tunnel routing manager |
| `@alive-brug/alrighty` | Type-safe API client with Zod validation |

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

### 2. Session Management

Each browser tab = one independent chat session. Key format: `userId::workspace::tabGroupId::tabId` (or with worktree: `userId::workspace::wt/<slug>::tabGroupId::tabId`). Built via `tabKey()` from `@/features/auth/lib/sessionStore`. Backed by Supabase `iam.sessions` table.

### 3. Streaming Protocol (NDJSON)

Uses `application/x-ndjson` over HTTP chunked transfer — NOT SSE (`text/event-stream`).
Each line is a self-contained JSON object. Reconnection is handled manually via Redis stream buffers + cursor acks (no `EventSource` / `Last-Event-ID`).

**Message types:** `start`, `message`, `session`, `complete`, `error`

### 4. Conversation Locking

Use `tryLockConversation(key)` / `unlockConversation(key)` from `@/features/auth/lib/sessionStore`. Return 409 if already locked.

### 5. Model Selection & Credits

Credit users restricted to `DEFAULT_MODEL`. See [docs/architecture/credits-and-tokens.md](./docs/architecture/credits-and-tokens.md).

## Development Guidelines

### Code Style

Biome for formatting (`bun run format`) and linting (`bun run lint`). TypeScript strict mode. Errors in stream routes must be formatted as NDJSON messages, not thrown.

### Git Hooks (Husky)

**IMPORTANT**: This project uses Husky for automated quality checks. Hooks run automatically and cannot be disabled without `--no-verify`.

#### Pre-Commit Hook
- **What it does**:
  - Blocks `.env` files from being committed
  - Syncs skills (`bun run sync:skills`) and stages `.agents/skills`
  - Formats only staged files using `lint-staged`
  - Runs type-check (`bun run type-check`)
- **Speed**: Instant (only touches staged files)
- **When it runs**: Every `git commit`

#### Pre-Push Hook
- **What it does**: Syncs skills, checks for skill drift, then runs `bun run static-check`:
  - Turbo env validation (`bun run validate:turbo-env`)
  - Workspace contract validation (`bun run check:workspace-contract`)
  - canUseTool dead code check (`bun run check:canUseTool-dead`)
  - Env sync check (`bun run check:env-sync`)
  - Type checking (`turbo run type-check`)
  - Lint/format check-only (`turbo run ci`)
  - Error pattern check (`check-error-patterns.ts`, `check-e2e-patterns.ts`, `check-test-assertions.sh`)
  - Core unit tests (`bun run test:core`)
- **Speed**: 10-60 seconds (uses Turborepo cache)
- **When it runs**: Every `git push`

#### CI Defaults
- **PRs** run fast, affected-only checks: `bun run check:affected` + error pattern check
- **Pushes to `main`/`dev`/`staging`** run full checks: `bun run static-check` + error pattern check
- **Stale runs auto-cancel** via workflow concurrency settings

#### If Pre-Push Hook Fails

Fix the errors, run `bun run static-check` locally to verify, commit fixes, and push again. Never use `--no-verify`.

### Common Tasks

#### New API Endpoints

Auth: `requireSessionUser()` from `@/features/auth/lib/auth`. Tests: `app/api/[name]/__tests__/route.test.ts` (MANDATORY — auth, happy path, error case minimum).

#### Config Migrations

Read [`docs/guides/safe-config-migration.md`](./docs/guides/safe-config-migration.md) first. Use `./scripts/validate-no-deleted-refs.sh` before deleting anything. See `docs/postmortems/` for past outage lessons.

#### Deploying a New Site

`POST /api/deploy-subdomain` or `SiteOrchestrator.deploy()` from `@webalive/site-controller`. Creates systemd service, dedicated user, workspace, port (3333-3999), Caddy config. 7 atomic phases with rollback. Docs: `packages/site-controller/README.md`.

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

**Auto-sync architecture**: Main `/etc/caddy/Caddyfile` imports four files directly: `Caddyfile.custom` (Let's Encrypt domains), `Caddyfile.internal` (generated site routing on `:8444`), `Caddyfile.prod` (app/mg/widget), `Caddyfile.staging` (staging/dev). The internal config uses a `map` directive to route `{host}` to site upstreams, with unmatched hosts falling through to shell-server-go on port 3888 (which handles preview routing).

**⚠️ CRITICAL: `tls force_automate`** — Every explicit `*.sonno.tech` domain block MUST include `tls force_automate`. Without it, Caddy v2.10.x silently fails to obtain certs due to a bug with `on_demand_tls` ([#6996](https://github.com/caddyserver/caddy/issues/6996)). The routing generator template already includes this — see `ops/caddy/README.md` for details.

## Testing

Full guide: [docs/testing/README.md](./docs/testing/README.md). Patterns: [docs/testing/TEST_PATTERNS.md](./docs/testing/TEST_PATTERNS.md).

**E2E tests are our most valuable tests.** When in doubt, write an E2E test.

**Tests are MANDATORY for:** security-critical functions (100% coverage), new API routes (auth + happy path + error case minimum), file operation endpoints (path traversal, workspace boundary).

```bash
bun run check:affected  # Fast PR checks (affected-only)
bun run static-check    # Full local gate (matches pre-push)
bun run unit            # Core unit tests
bun run e2e             # E2E tests
```

**Gotchas:** Always `bun run test`, never `bun test` directly. Never `npx vitest`.

## Production Deployment

For troubleshooting, inspecting production, and dev/staging work, see `docs/deployment/deployment.md`.

### Available Commands

```bash
make ship        # Full pipeline: staging → production
make ship-fast   # Same as ship, skips E2E tests
make staging     # Deploy staging only (port 8998)
make staging-fast # Deploy staging only, skip E2E tests
make production  # Deploy production only (port 9000)
make production-fast # Deploy production only, skip E2E tests
make dev         # Rebuild tools + restart dev server (port 8997)
make devchat     # Restart dev server via systemctl (safe from chat)
make logs-staging # View staging logs
make logs-production # View production logs
make logs-dev    # View dev environment logs
make services    # Deploy API + Manager
make api         # Deploy API only
make manager     # Deploy Manager only
make shell       # Build and deploy shell-server-go
make rollback    # Interactive rollback

# Status & monitoring
make status      # Show all environments
make deploy-status # Check if a deployment is running
```

Deploy from chat: see Core Rules 10-12. Site deployment (individual websites): see "Deploying a New Site" above.


## Key Dependencies

Next.js 16 (App Router), React 19, Claude Agent SDK ^0.2.80, Bun 1.3+, TypeScript 5.9 (strict), TailwindCSS 4.x. See `package.json` for exact versions.

## Common Issues

- **Stream buffering**: Set `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform`
- **Session not persisting**: Check key format via `tabKey()` from `@/features/auth/lib/sessionStore`
- **Credit race condition**: Use `iam.rpc('deduct_credits', ...)` (see `docs/architecture/atomic-credit-charging.md`)

### Template Sites Maintenance

**Template sites** live in `/srv/webalive/templates/`, a dedicated git repo (`lars-deploy-bot/feel-templates`) that contains all template source code. Templates are the starting points when deploying new sites — each template is a complete Vite project that gets rsync'd to the new site's workspace. They also run as live previews so users can see them before choosing.

**Location**: `/srv/webalive/templates/` (git repo: `lars-deploy-bot/feel-templates`)
**Systemd**: `template@{slug}.service` (separate from `site@` services)
**Config**: `server-config.json` → `paths.templatesRoot` (default: `/srv/webalive/templates`). The old `templates` key is rejected at parse time by `rejectRemovedKeys()`.
**Server**: Templates only run on **Server 1** (alive.best). Server 2 has no local template sites — the preview proxy cannot reach them there (see [#98](https://github.com/lars-deploy-bot/feel/issues/98)).
**Push**: `GIT_SSH_COMMAND="ssh -i /root/.ssh/id_lars_deploy_bot" git push` (from `/srv/webalive/templates/`)

**Template sites** (in Supabase `app.templates`):

| Template ID | Domain | Port | Mode |
|---|---|---|---|
| `tmpl_blank` | `blank.alive.best` | 3594 | `bun run dev` |
| `tmpl_gallery` | `template1.alive.best` | 3352 | `bun run dev` |
| `tmpl_event` | `event.alive.best` | 3345 | `bun run dev` |
| `tmpl_saas` | `saas.alive.best` | 3346 | `bun run dev` |
| `tmpl_business` | `loodgieter.alive.best` | 3389 | `bun run dev` |
| — | `components.alive.best` | 3364 | `bun run dev` |

**Key points:** rsync excludes `node_modules` and `.bun`. Template 502 = reinstall deps as site user + restart `template@{slug}.service`. Path resolution: `resolveTemplatePath()` from `@webalive/shared`. When updating `@alive-game/alive-tagger`: update both `vite.config.ts` and `package.json` in all sites.

## Git Workflow

**Custom SSH Key**: Uses `id_lars_deploy_bot` for GitHub

```bash
# Push changes
bun run push

# Pull changes
bun run pull
```

## Local Open Source Services

**Location**: `/opt/services/` (mailcow, supabase) — Docker Compose or systemd. Check individual dirs for config.

## Automation System

Jobs in Supabase `app.automation_jobs`. Worker (`apps/worker`, port 5070, systemd `automation-worker.service`) runs standalone — survives web deploys. Engine in `packages/automation-engine` (claim/finish lifecycle, lease-based locking). Web POSTs to worker's HTTP API (`/poke`, `/trigger/:id`). Debug: `journalctl -u automation-worker -f`, `curl localhost:5070/health`.

## External Reference Repos

**Location**: `/opt/third/` — check for working examples before reinventing.
