# Claude Bridge Development Guide

This document provides instructions and guidelines for AI assistants (Claude) working on the Claude Bridge codebase.

1. NEVER COMMIT
2. ALWAYS USE BUN

## Project Overview

Claude Bridge is a **multi-tenant development platform** that enables Claude AI to assist with website development through controlled file system access. Key characteristics:

- **Multi-tenant architecture**: Each domain gets isolated workspace
- **Security-first design**: Workspace sandboxing, systemd isolation, process separation
- **Next.js 16 + React 19**: Modern App Router architecture
- **SSE streaming**: Real-time Claude responses via Server-Sent Events
- **Tool-based interaction**: Limited to safe file operations (Read, Write, Edit, Glob, Grep)

## Core Architecture Patterns

### 1. Workspace Isolation

**CRITICAL**: All file operations must respect workspace boundaries.

```typescript
// Workspace resolution
const workspace = isTerminalMode
  ? req.workspace  // Custom workspace from user
  : hostname       // Auto-mapped from domain

const workspacePath = path.join(WORKSPACE_BASE, workspace, 'user')

// ALWAYS validate before operations
if (!isPathWithinWorkspace(filePath, workspacePath)) {
  throw new Error('Path traversal attack detected')
}
```

**Locations:**
- New sites: `/srv/webalive/sites/[domain]/` (systemd-managed, secure)
- Legacy sites: `/root/webalive/sites/[domain]/` (PM2-managed, should migrate)
- Template: `/root/webalive/claude-bridge/packages/template/user/`

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
5. **Password Storage**: Passwords in `domain-passwords.json` (secured at OS level)

### Code Style

- **Formatting**: Use `bun run format` (Biome)
- **Linting**: Use `bun run lint` (Biome)
- **TypeScript**: Strict mode enabled, no implicit any
- **React**: Use hooks, functional components only
- **Error Handling**: Always catch and properly format errors for SSE

### Common Tasks

#### Adding a New API Endpoint

1. Create route handler in `app/api/[name]/route.ts`
2. Import and use `getCookieUserId()` for authentication
3. Validate workspace if file operations involved
4. Return proper status codes (401, 400, 500, etc.)

#### Modifying Claude Integration

**Files to update:**
- `apps/web/app/api/claude/stream/route.ts` - SSE streaming endpoint
- `apps/web/app/api/claude/route.ts` - Polling endpoint
- `apps/web/lib/claude.ts` - SDK helpers and tool configuration

**Key considerations:**
- Tool callbacks must handle workspace paths correctly
- All tool operations must be logged
- Errors should be streamed as SSE events, not thrown

#### Deploying a New Site

**ONLY use the secure systemd deployment:**

```bash
# Automated deployment
/root/webalive/claude-bridge/scripts/deploy-site-systemd.sh newsite.com

# This creates:
# - Systemd service: site@newsite-com.service
# - Dedicated user: site-newsite-com
# - Workspace: /srv/webalive/sites/newsite.com/
# - Password: "supersecret" (in domain-passwords.json)
# - Port: Auto-assigned from registry
```

**Never use PM2 for new sites** - it lacks security isolation.

#### Updating Caddy Configuration

**Location**: `/root/webalive/claude-bridge/Caddyfile`

```bash
# 1. Edit Caddyfile (add domain block)
nano /root/webalive/claude-bridge/Caddyfile

# 2. Reload (zero-downtime)
systemctl reload caddy

# 3. Verify
systemctl status caddy
```

**Auto-sync architecture**: Main Caddyfile imports the webalive Caddyfile, no manual copying needed.

## Testing Guidelines

**Documentation**: See [docs/testing/TESTING_GUIDE.md](./docs/testing/TESTING_GUIDE.md) for complete testing guide.

### When to Write Tests (STRICT - This is MVP)

**✅ MUST write tests for:**
1. **Security-critical functions** (100% coverage required)
   - Path traversal protection (`isPathWithinWorkspace`)
   - Session validation (`getSessionUser`, `hasSessionCookie`)
   - Workspace boundary checks (`getWorkspace`)
   - Shell command sanitization (if executing shell commands)
   - Authentication logic

2. **New API routes** (at minimum: happy path + one error case)
   - Any new endpoint in `app/api/`
   - Focus on authentication, validation, error handling

**⚠️ SHOULD write tests for:**
3. **Complex business logic**
   - Workspace resolution (multiple branches, edge cases)
   - Stream handling (if modifying SSE logic)
   - File operations with validation

**❌ DON'T write tests for:**
- Simple formatters/transforms
- Type guards (unless security-critical)
- UI components (unless fixing a bug)
- Third-party library wrappers
- Configuration files

### Quick Commands

```bash
# Run unit tests
cd apps/web && bun test

# Run E2E tests (first time: bunx playwright install chromium)
bun run test:e2e

# Run specific test
bun test security.test.ts
```

### Local Development Setup

```bash
# 1. Install dependencies
bun install

# 2. Run setup script
bun run setup

# 3. Add .env.local (as shown by setup script)
# ANTHROPIC_API_KEY=your_key
# BRIDGE_ENV=local
# LOCAL_TEMPLATE_PATH=/path/to/packages/template/user

# 4. Start dev server
bun run dev
```

**Test Credentials** (when `BRIDGE_ENV=local`):
- Workspace: `test`
- Passcode: `test`

### Before Committing

**Automated checks:**
- [ ] Tests pass: `bun test && bun run test:e2e` (if you wrote tests)
- [ ] Format: `bun run format`
- [ ] Lint: `bun run lint`

**Manual verification (if applicable):**
- [ ] Tested security functions manually (path traversal, auth)
- [ ] Tested both standard domain mode and terminal mode
- [ ] Verified workspace isolation works
- [ ] No real Anthropic API calls in tests (check logs)

## Production Deployment

**CRITICAL**: Before doing any Claude Bridge deployment work (building and deploying the bridge itself, not deploying websites), you MUST read `docs/deployment/deployment.md` first. All details about atomic builds, rollback, and troubleshooting are there.

### Commands

```bash
# Full deploy (recommended)
bun run deploy

# Build only
./scripts/build-atomic.sh

# Logs
bun run see
```

For deployment questions, see `docs/deployment/deployment.md`.

### Environment Variables (Production)

**Required:**
```bash
ANTHROPIC_API_KEY=sk-ant-xxx
BRIDGE_PASSCODE=your_secure_passcode
```

**Optional:**
```bash
CLAUDE_MODEL=claude-3-5-haiku-20241022
WORKSPACE_BASE=/srv/webalive/sites
```

**Never set in production:**
```bash
BRIDGE_ENV=local  # Development only
LOCAL_TEMPLATE_PATH=...  # Development only
```

### Security Hardening Checklist

- [ ] Replace in-memory SessionStore with Redis
- [ ] Add rate limiting on `/api/claude/stream`
- [ ] Set secure cookie flags (httpOnly, Secure, SameSite)
- [ ] Enable HTTPS in Caddy (automatic with valid domains)
- [ ] Monitor active conversation count
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Implement audit logging for all file operations
- [ ] Regular security audits of workspace isolation

## Key Dependencies & Versions

- **Next.js**: 16.0.0 (App Router, RSC)
- **React**: 19.2.0 (Concurrent features)
- **Claude Agent SDK**: 0.1.25 (query, streaming, tools)
- **Bun**: 1.2.22+ (runtime & package manager)
- **TypeScript**: 5.x (strict mode)
- **TailwindCSS**: 4.1.15 (utility-first CSS)

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

## Git Workflow

**Custom SSH Key**: Uses `alive_brug_deploy` for GitHub

```bash
# Push changes
bun run push

# Pull changes
bun run pull
```

## Documentation

- **README.md**: User-facing documentation
- **CLAUDE.md**: This file (AI assistant guidelines)
- **docs/deployment/**: Atomic build system and deployment guide (deployment.md, failure modes, build isolation)
- **docs/setup/**: Local development setup
- **IMPLEMENTATION_STATUS.md**: Feature completion tracking
- **PHASE1_IMPLEMENTATION.md**: Initial implementation notes

## Important Notes

1. **Never bypass security**: All file operations must be workspace-scoped
2. **Systemd for sites, PM2 for bridge**: Don't mix process managers
3. **Auto-password generation**: All new sites get "supersecret" password
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
