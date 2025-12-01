# Claude Bridge Development Guide

AI assistant guidelines for working on Claude Bridge.

**Quick Links:** [Getting Started](./docs/GETTING_STARTED.md) | [Architecture](./docs/architecture/README.md) | [Security](./docs/security/README.md) | [Testing](./docs/testing/README.md)

## Core Rules

1. **NEVER COMMIT** - Never create commits
2. **ALWAYS USE BUN** - Runtime and package manager
3. **GIT HOOKS** - Pre-push hooks run automatically; if they fail, fix the issues (don't force-push)
4. **NO RANDOM ENV VARS** - Don't add environment variables unless absolutely necessary. Use existing config, constants, or code-level defaults instead. Adding .env variables creates deployment complexity and hidden dependencies.

## Project Overview

Claude Bridge is a **multi-tenant development platform** that enables Claude AI to assist with website development through controlled file system access. Key characteristics:

- **Multi-tenant architecture**: Each domain gets isolated workspace
- **Security-first design**: Workspace sandboxing, systemd isolation, process separation
- **TURBOREPO Next.js 16 + React 19**: Modern App Router architecture using **Turborepo** for building and deploying the project.
- **SSE streaming**: Real-time Claude responses via Server-Sent Events
- **Tool-based interaction**: Limited to safe file operations (Read, Write, Edit, Glob, Grep)

## Core Architecture Patterns

### 1. Workspace Isolation & Privilege Separation

**Guide**: `apps/web/docs/architecture/workspace-privilege-separation.md`

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

**Pattern**: Conversation sessions are keyed by `userId::workspace::conversationId`

```typescript
// Session store interface
interface SessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}
```

**IMPORTANT**: Current implementation uses in-memory storage. For production, this MUST be replaced with Redis or a database.

### 3. Streaming & SSE Protocol

**Event Types:**
- `start` - Conversation initialization
- `message` - Each SDK message (assistant/user/thinking/tool)
- `session` - Session ID for resumption
- `complete` - Final completion with result
- `error` - Error information

**Tool Tracking Pattern:**
```typescript
// Global map tracks tool invocations
const toolUseMap = new Map<string, string>()

// Assistant message with tool_use
toolUseMap.set(tool_use_id, tool_name)

// User message with tool_result
const toolName = toolUseMap.get(tool_use_id)
```

This enables proper component rendering for interleaved messages.

### 4. Conversation Locking

**CRITICAL**: Prevent concurrent requests to same conversation

```typescript
const conversationKey = `${userId}::${workspace}::${conversationId}`

if (activeConversations.has(conversationKey)) {
  return res.status(409).json({ error: 'Conversation in progress' })
}

activeConversations.add(conversationKey)
try {
  // SDK query
} finally {
  activeConversations.delete(conversationKey)
}
```

### 5. Model Selection & Credits

**CRITICAL**: Credit users restricted to DEFAULT_MODEL for cost management.

See [docs/architecture/CREDITS_AND_TOKENS.md](./docs/architecture/CREDITS_AND_TOKENS.md) for model enforcement patterns.

## Development Guidelines

### File Structure Conventions

```
apps/web/
├── app/
│   ├── api/              # API routes (Next.js route handlers)
│   │   ├── claude/       # Claude SDK integration
│   │   ├── files/        # File operations
│   │   ├── login/        # Authentication
│   │   └── manager/      # Domain password management
│   ├── chat/             # Chat UI
│   ├── workspace/        # Workspace selection
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── ui/              # Reusable UI components
│   └── [feature]/       # Feature-specific components
└── lib/                  # Utility libraries
    ├── security.ts      # Security utilities
    ├── sessions.ts      # Session management
    └── claude.ts        # Claude SDK helpers
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
- **Error Handling**: Always catch and properly format errors for SSE

### Git Hooks (Husky)

**IMPORTANT**: This project uses Husky for automated quality checks. Hooks run automatically and cannot be disabled without `--no-verify`.

#### Pre-Commit Hook
- **What it does**: Formats only the files being committed using `lint-staged`
- **Speed**: Instant (only touches staged files)
- **When it runs**: Every `git commit`

#### Pre-Push Hook
- **What it does**: Runs comprehensive checks before allowing push
  - Type checking (`turbo run type-check`)
  - Linting (`turbo run lint`)
  - Format checking (`turbo run format`)
  - Unit tests (`bun run unit`)
- **Speed**: 10-60 seconds (uses Turborepo cache)
- **When it runs**: Every `git push`

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

# Or test individual checks
bun run type-check
bun run lint
bun run unit
```

**Common Issues:**
- **"bun: command not found" in GUI clients**: See README.md Git Hooks Setup section
- **Slow pre-push**: First run is slow; subsequent runs use Turbo cache and are fast
- **Test failures**: Some tests may require environment setup (see Testing Guide)

### Common Tasks

#### Adding a New API Endpoint

1. Create route handler in `app/api/[name]/route.ts`
2. Import and use `getCookieUserId()` for authentication
3. Validate workspace if file operations involved
4. Return proper status codes (401, 400, 500, etc.)
5. **Write tests in `app/api/[name]/__tests__/route.test.ts`** (MANDATORY!)
   - See "When to Write Tests" section for minimum required tests
   - File operations require additional security tests

#### Modifying Claude Integration

**Files to update:**
- `apps/web/app/api/claude/stream/route.ts` - SSE streaming endpoint
- `apps/web/app/api/claude/route.ts` - Polling endpoint
- `apps/web/lib/claude.ts` - SDK helpers and tool configuration

**Key considerations:**
- Tool callbacks must handle workspace paths correctly
- All tool operations must be logged
- Errors should be streamed as SSE events, not thrown

#### Migrating Config Files

**⚠️ CRITICAL**: Config/file migrations can break production. Always follow the safe migration guide.

**Required reading**: [`docs/guides/safe-config-migration.md`](./docs/guides/safe-config-migration.md)

**Quick checklist:**
1. ✅ Document the migration plan
2. ✅ Search for ALL references: `grep -r "old-file" .`
3. ✅ Validate before deleting: `./scripts/validate-no-deleted-refs.sh old-file`
4. ✅ Test service restarts: `systemctl restart claude-bridge-dev && journalctl -u claude-bridge-dev -n 20`
5. ✅ Run full test suite: `bun run test && bun run test:e2e`

**Never**:
- ❌ Delete files before updating all references
- ❌ Skip the validation script
- ❌ Use dynamic requires in npm scripts: `$(node -p "require('./config').value")`

**See also**: [Postmortem: 2025-11-23 Config Migration Outage](./docs/postmortems/2025-11-23-config-migration-outage.md)

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

**Location**: `/root/webalive/claude-bridge/ops/caddy/Caddyfile`

```bash
# 1. Edit Caddyfile (add domain block)
nano /root/webalive/claude-bridge/ops/caddy/Caddyfile

# 2. Reload (zero-downtime)
systemctl reload caddy

# 3. Verify
systemctl status caddy
```

**Auto-sync architecture**: Main `/etc/caddy/Caddyfile` imports the webalive Caddyfile via `import /root/webalive/claude-bridge/ops/caddy/Caddyfile`.

## Testing Guidelines

**Documentation**: See [docs/testing/TESTING_GUIDE.md](./docs/testing/TESTING_GUIDE.md) for complete testing guide.

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
   - Stream handling (if modifying SSE logic)
   - Credit/billing operations

**❌ DON'T write tests for:**
- Simple formatters/transforms
- Type guards (unless security-critical)
- UI components (unless fixing a bug)
- Third-party library wrappers
- Configuration files

### Quick Commands

```bash
# Run unit tests
cd apps/web && bun run test

# Run E2E tests (first time: bunx playwright install chromium)
bun run test:e2e

# Run specific test
bun run test security.test.ts
```

**Testing Notes:**
- Always use `bun run test`, never `bun test` directly
- Do NOT use `npx vitest` - npx and vitest don't work well together in this codebase

**E2E Test Best Practices** (see [postmortem](./docs/postmortems/2025-11-30-e2e-test-flakiness.md)):
- Tests should only wait for what they actually need (API tests don't need UI)
- Use `toBeAttached` instead of `toBeVisible` when you just need DOM presence
- Budget timeouts for parallel execution (4 workers = 2-3x slower)
- Avoid timeout accumulation: put longest wait first, then quick confirmations

### Local Development Setup

```bash
# 1. Install dependencies
bun install

# 2. Run setup script
bun run setup

# 3. Add .env.local (as shown by setup script)
# ANTHROPIC_API_KEY=your_key
# BRIDGE_ENV=local
# LOCAL_TEMPLATE_PATH=/path/to/.alive/template

# 4. Start dev server
bun run dev
```

**Test Credentials** (when `BRIDGE_ENV=local`):
- Email: `test@bridge.local`
- Password: `test`

### Before Committing

**Automated checks:**
- [ ] Tests pass: `bun run test && bun run test:e2e` (if you wrote tests)
- [ ] Format: `bun run format`
- [ ] Lint: `bun run lint`

**Manual verification (if applicable):**
- [ ] Tested security functions manually (path traversal, auth)
- [ ] Tested both standard domain mode and terminal mode
- [ ] Verified workspace isolation works
- [ ] No real Anthropic API calls in tests (check logs)

## Production Deployment

**⚠️ CRITICAL: Production deployment is intentionally restricted.** Contact devops for production deploys.

For troubleshooting, inspecting production, and dev/staging work, see `docs/deployment/deployment.md`.

### Available Commands

**Dev & Staging:**
```bash
make staging     # Full staging deployment (port 8998)
make dev         # Rebuild tools + restart dev server (port 8997)
make logs-staging # View staging logs
make logs-dev    # View dev environment logs

# Status & monitoring
make status      # Show all environments
make rollback    # Interactive rollback (if needed)
```

### Site Deployment (Different)

To deploy individual websites (not the Claude Bridge itself), use the API endpoint:
```bash
# Via web UI at /deploy (recommended)
# Or via API:
curl -X POST https://terminal.goalive.nl/api/deploy-subdomain \
  -H "Content-Type: application/json" \
  -d '{"domain": "newsite.alive.best", "email": "user@example.com"}'
```

**Package**: Site deployments are handled by `@webalive/site-controller` with atomic bash scripts and automatic rollback.


## Key Dependencies & Versions

### Core Stack
- **Next.js**: 16.0.0 (App Router, RSC)
- **React**: 19.2.0 (Concurrent features)
- **Claude Agent SDK**: 0.1.25 (query, streaming, tools)
- **Bun**: 1.2.22+ (runtime & package manager)
- **TypeScript**: 5.x (strict mode)
- **TailwindCSS**: 4.1.15 (utility-first CSS)

### Infrastructure Packages
- **@webalive/site-controller**: Site deployment orchestration (Shell-Operator Pattern)
- **@webalive/oauth-core**: Multi-tenant OAuth with AES-256-GCM encryption
- **@alive-brug/redis**: Redis client with automatic retry and error handling
- **@webalive/template**: Template for new site deployments

### Legacy (Deprecated)
- **@alive-brug/deploy-scripts**: Replaced by site-controller (no longer maintained)

## Common Issues & Solutions

### Issue: SSE Stream Buffering

**Symptom**: Messages don't appear in real-time

**Solution**: Ensure Next.js doesn't buffer SSE responses
```typescript
// In route.ts
return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'  // Disable nginx buffering
  }
})
```

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
const sessionKey = `${userId}::${workspace}::${conversationId}`
const sessionId = await sessionStore.get(sessionKey)
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

## Git Workflow

**Custom SSH Key**: Uses `alive_brug_deploy` for GitHub

```bash
# Push changes
bun run push

# Pull changes
bun run pull
```

## Documentation Structure

All documentation in `/docs` with clean, nested organization:

- **[docs/README.md](./docs/README.md)** - Documentation hub
- **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)** - Setup & quick start
- **[docs/architecture/](./docs/architecture/README.md)** - System design, patterns, core concepts
- **[docs/security/](./docs/security/README.md)** - Authentication, workspace isolation, security patterns
- **[docs/testing/](./docs/testing/README.md)** - Unit, integration, E2E testing
- **[docs/features/](./docs/features/README.md)** - Feature documentation
- **[docs/deployment/](./docs/deployment/README.md)** - Environment management (devops)
- **[docs/troubleshooting/](./docs/troubleshooting/README.md)** - Common issues, solutions
- **[docs/archive/](./docs/archive/)** - Historical documentation

## Important Notes

1. **Never bypass security**: All file operations must be workspace-scoped
2. **Systemd for everything**: All processes managed by systemd
3. **User-based authentication**: Users have ONE account password that works across all their sites
4. **Session persistence**: Current in-memory store is NOT production-ready
5. **Terminal mode**: Allows custom workspace, verify before use
6. **Manager access**: Hidden `/manager` URL with separate authentication

## Questions or Unclear Requirements?

When working on this codebase:

1. **Check existing patterns** before introducing new approaches
2. **Security first** - if uncertain, ask user before proceeding
3. **Test both modes** - standard domain and terminal mode
4. **Document changes** - update relevant docs when adding features
5. **Use provided scripts** - don't reinvent deployment/management tools

## Contact & Support

For questions about this codebase, refer to:
- README.md for architecture overview
- Implementation docs for feature status
- Deployment scripts for infrastructure patterns