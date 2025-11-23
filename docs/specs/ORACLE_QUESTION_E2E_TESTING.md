# Comprehensive E2E Testing Architecture Consultation

## Executive Summary

I'm seeking guidance on architecting an optimal E2E testing strategy for a multi-tenant, server-deployed web application with complex state management, expensive external API dependencies, and strict isolation requirements. This consultation is critical as current testing limitations prevent confident parallel execution and may harbor hidden flakiness risks.

**Core Challenge**: Achieve ultimate performance, robustness, and non-flakiness in E2E tests for a production system where:
- Tests currently run sequentially (workers: 1) due to "state pollution" fears
- External API calls cost real money ($0.003-$0.015 per request)
- Multi-tenant architecture requires strict workspace isolation
- File system operations must respect OS-level user permissions
- Database state persists across test runs
- No CI/CD automation exists (manual server deployments)

---

## Part 1: Application Architecture

### 1.1 Technology Stack

**Runtime & Framework:**
```typescript
// package.json (critical versions)
{
  "name": "claude-bridge-mono",
  "packageManager": "bun@1.2.22",
  "dependencies": {
    "next": "^16.0.0",              // App Router, RSC, Turbopack
    "react": "^19.2.0",              // Concurrent features
    "@anthropic-ai/claude-agent-sdk": "^0.1.25",  // AI integration
    "@playwright/test": "^1.56.1",   // E2E testing
    "zustand": "^4.5.2"             // Client state
  }
}
```

**Server Infrastructure:**
- Physical server (Linux, systemd)
- Three environments on SAME server, DIFFERENT ports:
  - **Production**: Port 9000 (systemd service, standalone build)
  - **Staging**: Port 8998 (systemd service, standalone build)
  - **Dev**: Port 8997 (PM2, hot-reload via `next dev --turbo`)
- Shared workspace directory: `/srv/webalive/sites/`
- Caddy reverse proxy routing domains to localhost ports

**Database (Supabase PostgreSQL):**
- Two schemas on same database:
  - `iam` schema: users, orgs, org_memberships, sessions
  - `app` schema: domains, feedback, errors, gateway_settings
- No test-specific database instance
- No transaction isolation for tests
- Persistent state across all environments

### 1.2 Multi-Tenant Architecture

**Workspace Isolation Model:**

Each deployed website = isolated workspace with:
1. **System user**: `site-{domain-slug}` (e.g., `site-example-com`)
2. **File system isolation**: `/srv/webalive/sites/{domain}/`
3. **Systemd service**: `site@{slug}.service`
4. **Port**: Auto-assigned from registry (3333-3999 range)
5. **Caddy proxy**: Domain → `localhost:{port}`

**Critical Security Pattern:**
```typescript
// Claude AI operations MUST run as workspace user, not root
import { spawn } from "node:child_process"

function runAgentChild(workspaceRoot: string, payload: AgentRequest): ReadableStream {
  const { uid, gid } = statSync(workspaceRoot) // Get workspace owner

  // Spawn child process as ROOT, then drop privileges
  const child = spawn(process.execPath, [runnerPath], {
    env: {
      TARGET_UID: String(uid),  // Child will setuid() to this
      TARGET_GID: String(gid),  // Child will setgid() to this
      TARGET_CWD: workspaceRoot
    },
    stdio: ["pipe", "pipe", "pipe"]
  })

  // Child process runs: process.setgid(gid); process.setuid(uid);
  // All file operations now owned by workspace user
  return streamFromChild(child)
}
```

**Why This Matters for Testing:**
- Tests cannot use simple file operations without permission errors
- Workspace paths must resolve to real system users
- `/tmp/test-workspace` used by tests has ROOT ownership (uid=0, gid=0)
- This bypasses the workspace user isolation mechanism

### 1.3 Authentication & Session Architecture

**JWT-Based Authentication:**
```typescript
// Cookie: auth_session (httpOnly, 30-day expiration)
interface JWTPayload {
  sub: string        // userId
  userId: string
  email: string
  name: string       // Display name
  workspaces: []     // Empty for now
}

// Secret: process.env.JWT_SECRET || "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"
```

**Session Persistence (Supabase-backed):**
```typescript
// Session key format: userId::workspaceDomain::conversationId
// Example: "usr_123::demo.goalive.nl::conv_456"

interface SessionStore {
  get(key: string): Promise<string | null>   // Claude SDK session ID
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
}

// Caching layer: hostname → domain_id (5min TTL)
// Reduces DB queries from 2 per operation to 1
const domainIdCache = new Map<string, { domainId: string; timestamp: number }>()
```

**Conversation Locking (Race Condition Prevention):**
```typescript
// Global in-memory Set prevents concurrent requests to same conversation
const activeConversations = new Set<string>()

function tryLockConversation(key: string): boolean {
  if (activeConversations.has(key)) return false
  activeConversations.add(key)
  return true
}

// Lock released after Claude response completes or errors
// Problem: In-memory locks NOT shared across environments (dev/staging/prod)
```

### 1.4 Real-Time Streaming Architecture

**Server-Sent Events (NDJSON format):**
```typescript
// API: POST /api/claude/stream
// Returns: text/event-stream (keeps connection open)

// Event types:
type StreamEvent =
  | { type: "start"; conversationId: string; model: string }
  | { type: "message"; role: "assistant"; content: Array<TextBlock | ToolUseBlock> }
  | { type: "message"; role: "user"; content: Array<ToolResultBlock> }
  | { type: "thinking"; thinking: string }
  | { type: "text"; text: string }
  | { type: "complete"; tokensUsed: number; totalTurns: number }
  | { type: "error"; error: string; message: string }

// Stream format: newline-delimited JSON (NDJSON)
// Example:
{"type":"start","conversationId":"abc","model":"claude-sonnet-4"}\n
{"type":"message","role":"assistant","content":[{"type":"text","text":"Hello"}]}\n
{"type":"complete","tokensUsed":150,"totalTurns":1}\n
```

**Critical E2E Test Challenge:**
- Real SSE streams are async, multi-message, and timing-sensitive
- Mock handlers must replicate EXACT message sequence and timing
- Production streams can have: thinking → tool_use → tool_result → text → complete
- Tests use simplified mocks: start → text → complete (missing complexity)

---

## Part 2: Current E2E Testing Setup

### 2.1 Playwright Configuration (Two Environments)

**Config 1: Mocked Tests (playwright.config.ts)**
```typescript
export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/*-genuine.spec.ts",
  timeout: 30000,
  workers: 1,  // ⚠️ SEQUENTIAL: "avoid state pollution"

  use: {
    baseURL: "http://localhost:9547",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "bash scripts/start-test-server.sh",  // Starts Next.js dev server
    url: "http://localhost:9547",
    reuseExistingServer: !process.env.CI,
    timeout: 180000  // ⚠️ 3 MINUTES to start server (why so slow?)
  },

  // NO retry configuration
  // NO fullyParallel flag
  // NO test fixtures beyond custom setup
})
```

**Test Server Script:**
```bash
#!/usr/bin/env bash
# scripts/start-test-server.sh

export BRIDGE_ENV=local
export PLAYWRIGHT_TEST=true  # ⚠️ Blocks real API calls
export TEST_MODE=true
export SKIP_SSL_VALIDATION=true
export SKIP_BUILD=true

# Runs: bun x --bun next dev --turbo -p 9547
# Why Turbopack for tests? Performance optimization or necessity?
```

**Config 2: Genuine API Tests (playwright.genuine.config.ts)**
```typescript
export default defineConfig({
  testDir: "./e2e-tests",
  testMatch: "**/*-genuine.spec.ts",  // Only genuine tests
  timeout: 60000,  // Double the mocked timeout
  workers: 1,      // Still sequential

  globalSetup: "./e2e-tests/genuine-setup.ts",      // Creates /tmp/test-workspace
  globalTeardown: "./e2e-tests/genuine-teardown.ts", // Removes test workspace

  use: { baseURL: "http://localhost:9548" },  // ⚠️ DIFFERENT port

  webServer: {
    command: "bash scripts/start-test-server-genuine.sh",  // WITHOUT PLAYWRIGHT_TEST=true
    port: 9548,
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
})
```

**Why Two Configs?**
- Mocked: Fast, no API costs, protects against accidental charges
- Genuine: Integration validation, catches mock drift, proves real API works
- Problem: Maintaining two parallel test setups, ensuring mock accuracy

### 2.2 Test Protection Mechanism

**Custom Fixture (setup.ts):**
```typescript
// Wraps Playwright's base test with route tracking
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const registeredRoutes = new Set<string>()
    let testStarted = false

    // Monitor requests to protected endpoints
    page.on("request", request => {
      if (!testStarted) return

      const url = request.url()
      if (isProtectedEndpoint(url)) {  // /api/claude
        const hasHandler = hasMatchingRoute(url, registeredRoutes)

        if (!hasHandler) {
          // ⚠️ FAIL FAST: Throw error immediately
          throw new Error(
            `\n\n🚨 UNMOCKED API CALL: ${request.method()} ${url}\n\n` +
            `Add handler BEFORE page.goto():\n` +
            `  await page.route('**/api/claude/stream', handlers.text('...'))\n`
          )
        }
      }
    })

    // Track route() calls
    const originalRoute = page.route.bind(page)
    page.route = async (pattern, handler, options?) => {
      registeredRoutes.add(pattern.toString())
      return originalRoute(pattern, handler, options)
    }

    // Mark test as started on first page.goto()
    const originalGoto = page.goto.bind(page)
    page.goto = async (url, options?) => {
      testStarted = true
      return originalGoto(url, options)
    }

    await use(page)
  }
})
```

**Defense-in-Depth on Server:**
```typescript
// apps/web/app/api/claude/stream/route.ts
export async function POST(req: NextRequest) {
  // Block real API calls during E2E tests
  if (process.env.PLAYWRIGHT_TEST === "true") {
    return createErrorResponse(ErrorCodes.TEST_MODE_BLOCK, 403)
  }

  // ... actual Claude API call
}
```

**Problem**: What happens if:
- Env var not set correctly?
- Test uses different API endpoint?
- Mock format drifts from production?

### 2.3 Mock Strategy (Stream Builders)

**Handler Library (e2e-tests/lib/handlers.ts):**
```typescript
export const handlers = {
  // Simple text response
  text: (message: string) => async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body: new StreamBuilder()
        .start()
        .text(message)
        .complete()
        .toNDJSON()
    })
  },

  // With thinking block (Claude's reasoning)
  withThinking: (thinking: string, response: string) => {
    // Simulates: thinking → text → complete
  },

  // File operations
  fileRead: (path: string, content: string, response: string) => {
    // Simulates: start → tool_use(Read) → tool_result → text → complete
  },

  fileWrite: (path: string, content: string, response: string) => {
    // Simulates: start → tool_use(Write) → tool_result → text → complete
  }
}
```

**StreamBuilder (mock stream constructor):**
```typescript
class StreamBuilder {
  private events: StreamEvent[] = []

  start() {
    this.events.push({
      type: "start",
      conversationId: `test-${Date.now()}`,
      model: "claude-sonnet-4"
    })
    return this
  }

  text(content: string) {
    this.events.push({
      type: "message",
      role: "assistant",
      content: [{ type: "text", text: content }]
    })
    this.events.push({ type: "text", text: content })  // Duplicate for backwards compat
    return this
  }

  tool(name: string, input: object, result: string) {
    // Tool use message
    this.events.push({
      type: "message",
      role: "assistant",
      content: [{ type: "tool_use", id: `tool_${Date.now()}`, name, input }]
    })

    // Tool result message
    this.events.push({
      type: "message",
      role: "user",
      content: [{ type: "tool_result", tool_use_id: `tool_${Date.now()}`, content: result }]
    })
    return this
  }

  complete(stats = {}) {
    this.events.push({
      type: "complete",
      tokensUsed: 150,
      totalTurns: 1,
      ...stats
    })
    return this
  }

  toNDJSON(): string {
    return this.events.map(e => JSON.stringify(e)).join('\n') + '\n'
  }
}
```

**Current Mock Limitations:**
1. Simplified stream sequences (no multi-turn conversations)
2. No timing delays (instant responses vs real 500ms-5s)
3. No error simulation (API rate limits, network failures)
4. No tool rejection scenarios (permission denied, file not found)
5. No partial stream interruptions (connection drops mid-response)
6. No streaming backpressure (client slow to consume)

### 2.4 Test Patterns & Examples

**Typical Test Structure:**
```typescript
// e2e-tests/chat.spec.ts
import { login } from "./helpers"
import { handlers } from "./lib/handlers"
import { expect, test } from "./setup"

test.beforeEach(async ({ page }) => {
  await login(page)  // Navigate to /, fill creds, wait for /chat
})

test("can send message and receive response", async ({ page }) => {
  // ⚠️ Register mock BEFORE navigating
  await page.route('**/api/claude/stream', handlers.text('Hi there!'))

  await page.goto('/chat')

  // Wait for workspace initialization
  await expect(page.locator('[data-testid="workspace-ready"]')).toBeVisible({
    timeout: 5000
  })

  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill('Hello')
  await expect(sendButton).toBeEnabled({ timeout: 2000 })
  await sendButton.click()

  // ⚠️ Use .first() to avoid strict mode violations (message appears in sidebar + chat)
  await expect(page.getByText('Hello').first()).toBeVisible()
  await expect(page.getByText(/Hi there/).first()).toBeVisible({ timeout: 5000 })
})
```

**Login Helper:**
```typescript
// e2e-tests/helpers.ts
export async function login(page: Page) {
  await page.goto('/')

  // Set workspace in sessionStorage (always terminal mode)
  await page.evaluate(() => {
    sessionStorage.setItem('workspace', 'test.bridge.local')
  })

  await page.getByTestId('email-input').fill('test@bridge.local')
  await page.getByTestId('password-input').fill('test')
  await page.getByTestId('login-button').click()
  await page.waitForURL('/chat', { timeout: 5000 })
}

// Alternative: JWT cookie injection (bypasses UI)
export async function setAuthCookie(user: TestUser, context: BrowserContext) {
  const JWT_SECRET = process.env.JWT_SECRET || "INSECURE_DEV_SECRET_CHANGE_IN_PRODUCTION"

  const payload = {
    sub: user.userId,
    userId: user.userId,
    email: user.email,
    name: user.orgName
  }

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" })

  await context.addCookies([{
    name: "auth_session",
    value: token,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax"
  }])
}
```

**Genuine API Test (chat-genuine.spec.ts):**
```typescript
test("can send message without INVALID_REQUEST error", async ({ page }) => {
  await loginGenuine(page)

  // ⚠️ NO MOCKS - Real API call
  const messageInput = page.locator('[data-testid="message-input"]')
  await messageInput.fill(TEST_MESSAGES.SIMPLE)

  // Setup request/response promises BEFORE clicking
  const requestPromise = page.waitForRequest(
    req => req.url().includes('/api/claude/stream') && req.method() === 'POST'
  )

  const responsePromise = page.waitForResponse(
    res => res.url().includes('/api/claude/stream') && res.request().method() === 'POST'
  )

  await page.getByTestId('send-button').click()

  // Wait for network events
  const request = await requestPromise
  const response = await responsePromise

  // Validate request body
  const body = request.postDataJSON()
  expect(body).toHaveProperty('message')
  expect(body).toHaveProperty('conversationId')
  expect(body.conversationId).toMatch(PATTERNS.UUID)

  // Validate response
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/x-ndjson')

  // Wait for Claude response in UI
  await expect(page.getByText(/Hello|Hi there/).first()).toBeVisible({ timeout: 15000 })
})
```

**Deployment Test with Systemd Cleanup:**
```typescript
test.beforeEach(async () => {
  // ⚠️ execSync() - Blocking OS operations in test setup
  const serviceSlug = TEST_DOMAIN.replace(/\./g, '-')
  execSync(`systemctl stop site@${serviceSlug}.service 2>/dev/null || true`, { stdio: 'ignore' })

  if (existsSync(SITE_PATH)) {
    execSync(`rm -rf "${SITE_PATH}"`, { stdio: 'ignore' })
  }
})

test.afterEach(async () => {
  // ⚠️ Best-effort cleanup (failures ignored)
  execSync(`systemctl stop site@${serviceSlug}.service 2>/dev/null || true`)
  execSync(`rm -rf "${SITE_PATH}"`, { stdio: 'ignore' })
})
```

### 2.5 Database State Management

**Current Approach: Persistent Test User**
```typescript
// apps/web/e2e-tests/fixtures/test-data.ts
export const TEST_USER = {
  email: "test@bridge.local",
  password: "test",
  workspace: "test.bridge.local"
} as const
```

**User Created on Server:**
```typescript
// apps/web/app/api/login/route.ts
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  // ⚠️ Local dev mode: Auto-create test user
  if (process.env.BRIDGE_ENV === "local") {
    if (email === "test@bridge.local" && password === "test") {
      // Return JWT token for hardcoded test user
      // User exists in database, persists forever
    }
  }

  // Normal authentication flow...
}
```

**Problem: No Test Isolation**
- Test user exists in production database
- Tests share same user account
- Database state persists between test runs
- No cleanup between tests
- Concurrent tests would conflict (same user, same workspace)

**Cleanup Scripts Exist But Not Integrated:**
```bash
# scripts/database/cleanup-test-database.ts
# Manually removes test data
# NOT run automatically by test suite
```

### 2.6 Known Issues & Skipped Tests

**Skipped Tests:**
```typescript
// e2e-tests/concurrent-deploy.spec.ts
test.skip("deploys 3 sites concurrently without Caddyfile corruption", async ({ browser }) => {
  // Test disabled - Caddyfile race conditions not resolved
})

// e2e-tests/deploy.spec.ts
test.skip("CLI deployment works via bin/deploy.ts", async ({ deployUser }) => {
  // Test disabled - CLI interface needs refactoring
})
```

**Flakiness Indicators:**
```typescript
// ⚠️ networkidle - Notoriously unreliable
await page.waitForLoadState("networkidle")

// ⚠️ .first() - Suggests duplicate elements (why?)
await expect(page.getByText('Hello').first()).toBeVisible()

// ⚠️ Long timeouts - Masking real timing issues?
timeout: 15000  // 15 seconds for genuine API response
timeout: 180000 // 3 MINUTES for test server startup
```

**Hidden Assumptions:**
1. Test user always exists in database
2. `/tmp/test-workspace` is always writable
3. Ports 9547/9548 are always available
4. JWT secret matches between test and server
5. Workspace directory exists and is readable
6. No other tests running simultaneously
7. Database connections don't leak
8. File system state resets between tests (does it?)
9. Browser cache doesn't affect tests (does it?)
10. Session storage clears between tests (does it?)

---

## Part 3: Server Deployment Infrastructure

### 3.1 Three-Environment Architecture

**Environment Configuration (environments.json):**
```json
{
  "environments": {
    "production": {
      "port": 9000,
      "domain": "terminal.goalive.nl",
      "processName": "claude-bridge-prod",
      "serviceType": "systemd",
      "systemdService": "claude-bridge-prod.service",
      "serverScript": ".builds/prod/current/standalone/apps/web/server.js",
      "buildPath": ".builds/prod",
      "workspacePath": "/srv/webalive/sites",
      "isProduction": true,
      "hasHotReload": false
    },
    "staging": {
      "port": 8998,
      "domain": "staging.terminal.goalive.nl",
      "serviceType": "systemd",
      "systemdService": "claude-bridge-staging.service",
      "serverScript": ".builds/staging/current/standalone/apps/web/server.js",
      "buildPath": ".builds/staging",
      "workspacePath": "/srv/webalive/sites",
      "isProduction": false,
      "hasHotReload": false
    },
    "dev": {
      "port": 8997,
      "domain": "dev.terminal.goalive.nl",
      "processName": "claude-bridge-dev",
      "workspacePath": "/srv/webalive/sites",
      "isProduction": false,
      "hasHotReload": true
    }
  }
}
```

**Key Insight: Shared Infrastructure**
- All three environments on SAME physical server
- Share SAME database (no separate test DB)
- Share SAME workspace directory (`/srv/webalive/sites`)
- Share SAME Caddy reverse proxy
- Different ports for isolation
- Systemd for prod/staging, PM2 for dev

### 3.2 Deployment Process (Atomic Builds)

**Dev Deployment (make dev):**
```bash
#!/bin/bash
# scripts/deployment/deploy-dev.sh

# 1. Linting & Type Checking
bun run lint
bun run type-check

# 2. Build workspace packages
cd packages/images && bun run build
cd packages/tools && bun run build

# 3. Clean Next.js cache
rm -rf apps/web/.next

# 4. Restart PM2 process
pm2 restart claude-bridge-dev --update-env

# 5. Health check (curl API endpoint)
sleep 5
curl -f -X POST "http://localhost:8997/api/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"eedenlars@gmail.com","password":"supersecret"}' && \
  echo "✅ Health check passed" || \
  echo "⚠️  Health check failed"

# Total time: ~30-60 seconds
```

**Staging/Prod Deployment (make staging):**
```bash
#!/bin/bash
# scripts/deployment/build-atomic.sh staging

# ATOMIC BUILD PROCESS:

# 1. Disk space check (require 250MB)
AVAILABLE_MB=$(df -BM . | tail -1 | awk '{print $4}' | sed 's/M//')
if [ "$AVAILABLE_MB" -lt 250 ]; then
  echo "❌ Insufficient disk space"
  exit 1
fi

# 2. Backup dev server files
if [ -d "apps/web/.next/dev" ]; then
  mv apps/web/.next/dev apps/web/.next.dev-backup
fi

# 3. Clean production build
rm -rf apps/web/.next
rm -rf apps/web/dist

# 4. Remove circular symlinks (Turbopack fails otherwise)
rm -f packages/*/$(basename packages/*)

# 5. Build dependencies
cd packages/images && bun run build
cd packages/tools && bun run build
cd packages/site-controller && bun run build

# 6. Build Next.js production
cd apps/web
bun x next build  # Creates .next/ directory

# 7. Create standalone build
# Next.js outputs: apps/web/.next/standalone/
# This is a self-contained server.js with all dependencies

# 8. Copy static assets
cp -r apps/web/.next/static .builds/staging/dist.TIMESTAMP/.next/static
cp -r apps/web/public .builds/staging/dist.TIMESTAMP/public

# 9. Move to timestamped directory
mv .builds/staging/dist .builds/staging/dist.20250121-143052

# 10. Atomic symlink swap
ln -sf dist.20250121-143052 .builds/staging/current.tmp
mv -Tf .builds/staging/current.tmp .builds/staging/current

# 11. Restore dev server files
if [ -d "apps/web/.next.dev-backup" ]; then
  mkdir -p apps/web/.next
  mv apps/web/.next.dev-backup apps/web/.next/dev
fi

# 12. Restart systemd service
systemctl restart claude-bridge-staging.service

# 13. Health check
sleep 10
curl -f -X POST "https://staging.terminal.goalive.nl/api/login" && \
  echo "✅ Staging deployed" || \
  (echo "❌ Health check failed, rolling back" && rollback)

# Total time: ~5-8 minutes
# Build size: ~127MB per build
# Retention: Last 3 builds kept
```

**Build Artifacts:**
```
.builds/
├── staging/
│   ├── current -> dist.20250121-143052  # Symlink (atomic swap)
│   ├── dist.20250121-143052/            # Latest build
│   ├── dist.20250121-120034/            # Previous build
│   └── dist.20250120-153421/            # Older build
└── prod/
    └── current -> dist.20250121-100000
```

**Deployment Safety Mechanisms:**
- ✅ Atomic symlink swap (no downtime)
- ✅ Concurrent deploy blocking (lock file)
- ✅ Failed builds don't affect running server
- ✅ Automatic rollback on health check failure
- ✅ Dev server files preserved during staging builds
- ❌ NO CI/CD automation
- ❌ NO automated tests before deploy
- ❌ NO gradual rollout
- ❌ NO monitoring/alerting

### 3.3 Test Server Startup Performance

**Observed Behavior:**
```typescript
// playwright.config.ts
webServer: {
  command: "bash scripts/start-test-server.sh",
  url: "http://localhost:9547",
  timeout: 180000  // ⚠️ 3 MINUTES
}
```

**Why So Slow?**

Hypothesis 1: Turbopack cold start
```bash
# scripts/start-test-server.sh
exec bun x --bun next dev --turbo -p 9547
```
- First run: Turbopack compiles entire app
- Subsequent runs: Should use cache (but does it?)
- Bun runtime: Faster than Node, but still JIT compilation

Hypothesis 2: Package builds
```bash
# deploy-dev.sh runs BEFORE tests
cd packages/images && bun run build
cd packages/tools && bun run build
```
- Adds ~10-20 seconds
- Required because workspace packages change frequently

Hypothesis 3: Database connections
- Supabase connection pool initialization
- Schema introspection
- Row-level security policy compilation

Hypothesis 4: File system scanning
- Next.js scans `app/` directory for routes
- Turbopack watches entire monorepo
- Many files in `e2e-tests/` may slow things down

**Question**: Is 3 minutes acceptable? Industry standard is <30s.

### 3.4 No CI/CD Integration

**Current Process: Manual**
1. Developer makes changes locally
2. Developer runs tests manually (or doesn't)
3. Developer SSHs into server
4. Developer runs `make dev` or `make staging`
5. Developer manually checks logs
6. If issues found, manual rollback via `make rollback`

**Missing Automation:**
- ❌ No GitHub Actions / GitLab CI
- ❌ No automated test runs on PR
- ❌ No test coverage reporting
- ❌ No performance benchmarking
- ❌ No security scanning
- ❌ No deployment previews
- ❌ No smoke tests post-deploy
- ❌ No monitoring dashboards
- ❌ No error tracking integration

**Implication for Testing:**
- Tests must be ultra-reliable (no second chances)
- Developers skip tests if they're slow or flaky
- No enforcement of test passing before deploy
- Manual QA becomes critical (risky)

---

## Part 4: Specific Technical Questions

### 4.1 Test Isolation & Parallelization

**Current State:**
```typescript
// playwright.config.ts
workers: 1  // Sequential execution
// Comment: "Run all tests sequentially to avoid state pollution"
```

**What Causes State Pollution?**

Hypothesis 1: Database State
- Test user shared across all tests
- Conversation IDs may collide
- Session keys may conflict (`userId::workspace::conversationId`)
- Credits deducted from same org

Hypothesis 2: File System State
- Tests create files in `/tmp/test-workspace`
- Files not cleaned between tests?
- Workspace ownership conflicts?

Hypothesis 3: In-Memory State
- Conversation locks (`activeConversations Set`)
- Domain ID cache (`domainIdCache Map`)
- Session store (in-memory, not Redis)
- All reset when server restarts, but not between tests

Hypothesis 4: Port Conflicts
- Test server on port 9547
- If parallel tests start multiple servers?
- Caddy proxy state?

Hypothesis 5: Browser State
- Cookies persist between tests?
- SessionStorage not cleared?
- LocalStorage leakage?
- Service workers caching?

**Questions:**

1. **Database Isolation**: What's the optimal strategy?
   - Option A: Wrap each test in transaction, rollback after (how with multi-process?)
   - Option B: Create unique test user per test (cleanup after)
   - Option C: Use separate test database entirely (how to provision?)
   - Option D: Use in-memory SQLite for tests (breaks workspace integration)
   - Option E: Mock database entirely (too much mocking)

2. **File System Isolation**: How to handle multi-tenant workspaces?
   - Option A: Unique workspace per test (`/tmp/test-workspace-{testId}`)
   - Option B: Docker containers for each test (overhead?)
   - Option C: Cleanup files between tests (race conditions?)
   - Option D: Mock file operations entirely (breaks integration)

3. **In-Memory State**: How to isolate server state?
   - Option A: Restart server between tests (adds 3min overhead per test)
   - Option B: API endpoint to reset state (manual, error-prone)
   - Option C: Use Redis for shared state (adds dependency)
   - Option D: Accept shared state, design tests around it

4. **Parallel Execution**: Is it worth the complexity?
   - Current: 19 tests × 30s = 9.5 minutes sequential
   - With workers=4: 19 tests / 4 = ~2.4 minutes (if no conflicts)
   - With isolation overhead: ??? minutes
   - With flakiness from race conditions: Infinite time debugging

### 4.2 Mock vs Genuine Testing Balance

**Current Split:**
- Mocked: 18 test files
- Genuine: 1 test file (`chat-genuine.spec.ts`)

**Mock Accuracy Concerns:**

1. **Stream Format Drift**:
   - Production streams evolve (new event types, format changes)
   - Mocks hardcoded and manually maintained
   - No automated verification mocks match production

2. **Timing Differences**:
   - Mocks return instantly
   - Real API takes 500ms-5s
   - UI may have race conditions hidden by instant mocks

3. **Error Scenarios**:
   - Mocks don't simulate rate limiting
   - No network failure simulation
   - No partial response handling

4. **Tool Execution**:
   - Mocks fake tool results
   - Real file operations have permissions, errors, edge cases
   - Tool sequence complexity not tested (multi-turn conversations)

**Questions:**

1. **Optimal Ratio**: What's the right balance?
   - Industry standard: 70% mocked, 20% integration, 10% E2E?
   - Our case: Expensive API ($0.003-$0.015/request) changes equation

2. **Mock Synchronization**: How to prevent drift?
   - Option A: Record real API responses, replay in tests (VCR pattern)
   - Option B: Contract testing (Pact, OpenAPI validation)
   - Option C: Shared mock fixtures between frontend/backend
   - Option D: Periodic genuine test runs to validate mocks

3. **Smoke Test Strategy**: Minimum genuine tests needed?
   - Happy path only?
   - Error cases too?
   - How often to run? (Every commit? Daily? Weekly?)

### 4.3 External API Cost & Performance

**Anthropic Claude API Pricing:**
- Haiku: $0.003 per request (1K tokens)
- Sonnet: $0.015 per request (1K tokens)
- Average test message: ~150 tokens
- Cost per genuine test: ~$0.0005-$0.0025

**Annual Test Cost Projection:**
- If 1 genuine test runs 100 times/day: $0.25/day = $91.25/year
- If 10 genuine tests run 100 times/day: $2.50/day = $912.50/year
- With CI/CD (10 runs/PR × 20 PRs/day): $5-$50/day = $1,825-$18,250/year

**Performance Impact:**
- Genuine tests: 60s timeout (actual: 2-10s)
- Mocked tests: 30s timeout (actual: <1s)
- 10× speed difference

**Questions:**

1. **Cost Optimization**: How to minimize API spend while maintaining confidence?
   - Option A: Record/replay (VCR cassettes)
   - Option B: Synthetic responses (rule-based mock generator)
   - Option C: Cheaper test model (use Haiku for tests, Sonnet for prod)
   - Option D: Dedicated test API key with rate limiting

2. **Caching Strategy**: Can we cache API responses?
   - Same input → same output? (Non-deterministic AI, but could work)
   - Cache invalidation strategy?
   - Shared cache across developers?

3. **Sampling Strategy**: Run genuine tests selectively?
   - Only on main branch?
   - Only before production deploy?
   - Nightly full test run?

### 4.4 Wait Strategies & Flakiness

**Problematic Patterns Found:**

1. **networkidle (Unreliable)**:
```typescript
await page.waitForLoadState("networkidle")
// Waits for 500ms of no network activity
// Breaks with: polling, SSE streams, websockets, delayed requests
```

2. **Arbitrary Timeouts**:
```typescript
await expect(button).toBeEnabled({ timeout: 2000 })
// Why 2000ms? Based on manual testing? Will it work on slow CI?
```

3. **Race Conditions in SSE**:
```typescript
await sendButton.click()
await expect(page.getByText(/response/).first()).toBeVisible({ timeout: 5000 })
// If SSE stream is slow, test fails
// If response comes in multiple chunks, which one to wait for?
```

4. **Element Duplication**:
```typescript
await expect(page.getByText('Hello').first()).toBeVisible()
// Why .first()? Element appears in multiple places (sidebar + chat)
// Suggests layout/rendering issues
```

**Questions:**

1. **Event-Driven Waits**: How to properly wait for async operations?
   - SSE streams: Wait for specific event type?
   - Database operations: Polling vs websocket?
   - File operations: How to know when complete?

2. **Timeout Strategy**: How to set appropriate timeouts?
   - Fast operations: 1s?
   - Network requests: 5s?
   - Claude API: 15s?
   - Server startup: 3min (seems high)?
   - How to adjust for CI environment (slower)?

3. **Retry Logic**: Should tests retry automatically?
   - Playwright supports `retries: N`
   - But does retry hide flakiness or fix it?
   - When to retry vs fix the root cause?

### 4.5 Server Startup Optimization

**Current: 180s (3 minutes)**

**Industry Standards:**
- Next.js dev server: 10-30s
- Production build server: 1-5s
- Test-optimized server: <10s

**Potential Optimizations:**

1. **Pre-built Server**: Use production build for tests?
```bash
# Instead of: bun x next dev --turbo -p 9547
# Use: node .next/standalone/server.js
# Pros: Instant startup (<5s)
# Cons: No hot reload, requires rebuild on changes
```

2. **Persistent Test Server**: Keep server running?
```typescript
// playwright.config.ts
webServer: {
  reuseExistingServer: true  // Don't restart if already running
}
```
Pros: Zero startup time after first run
Cons: State leakage between test runs, manual restart needed

3. **Lighter Dependencies**: Remove unused packages?
```bash
# Analyze bundle size
bun x next-bundle-analyzer

# Potential culprits:
# - Large UI libraries
# - Unused database clients
# - Development-only tools in dependencies
```

4. **Turbopack Tuning**: Optimize compilation?
```typescript
// next.config.js
experimental: {
  turbo: {
    resolveAlias: { ... },  // Reduce module resolution
    rules: { ... }          // Skip unnecessary transformations
  }
}
```

**Questions:**

1. **Test Server Architecture**: What's optimal?
   - Option A: Hot-reload dev server (current, slow startup)
   - Option B: Production build (fast startup, no hot-reload)
   - Option C: Hybrid: prod build + file watching (complex)
   - Option D: Minimal test-only server (breaks parity with prod)

2. **Startup Profiling**: How to identify bottleneck?
   - Enable Next.js debug logging?
   - Profile with `node --inspect`?
   - Measure each initialization phase?

3. **Trade-offs**: Speed vs Accuracy?
   - Faster startup with mocked services → less realistic
   - Slower startup with full stack → more confident
   - What's acceptable for daily development?

### 4.6 Database Schema & State

**Current Schema (Simplified):**

```sql
-- iam schema (users & organizations)
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  is_test_env BOOLEAN DEFAULT false
);

CREATE TABLE orgs (
  org_id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ
);

CREATE TABLE org_memberships (
  org_id UUID REFERENCES orgs,
  user_id UUID REFERENCES users,
  role TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE sessions (
  session_key TEXT PRIMARY KEY,  -- userId::workspace::conversationId
  session_id TEXT NOT NULL,      -- Claude SDK session ID
  domain_id UUID REFERENCES app.domains,
  user_id UUID REFERENCES users,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- app schema (domains & workspaces)
CREATE TABLE domains (
  domain_id UUID PRIMARY KEY,
  hostname TEXT UNIQUE NOT NULL,
  port INTEGER NOT NULL,
  org_id UUID REFERENCES iam.orgs,
  created_at TIMESTAMPTZ
);
```

**State Management Issues:**

1. **Test User Persistence**:
   - `test@bridge.local` exists in production database
   - Never deleted
   - Accumulates sessions, conversations, credits usage
   - Shared across all test runs

2. **Session Pollution**:
   - Sessions table grows unbounded
   - No TTL or cleanup
   - Old conversation IDs may cause conflicts

3. **Credit Deduction**:
   - Test org credits decremented on API calls
   - Not reset between tests
   - May hit zero and fail tests

**Questions:**

1. **Test Database Strategy**:
   - Option A: Separate test database instance
     - Pros: Complete isolation
     - Cons: Setup complexity, environment parity
   - Option B: Test transactions with rollback
     - Pros: Clean state per test
     - Cons: How to handle multi-process (server + test)?
   - Option C: Test fixtures with cleanup
     - Pros: Simple, flexible
     - Cons: Must be comprehensive, cleanup can fail
   - Option D: Database snapshots (pg_dump/restore)
     - Pros: Fast reset
     - Cons: Slow initial snapshot, file management

2. **Test Data Lifecycle**:
   - Create fresh user per test? (slow, many DB writes)
   - Reuse test user, reset state? (how to ensure clean?)
   - Unique namespacing per test? (`test-{testId}@bridge.local`)

3. **Concurrent Test Safety**:
   - If tests run in parallel, how to prevent:
     - Unique constraint violations (email, domain)
     - Session key collisions
     - Race conditions in credit deduction

### 4.7 Monitoring & Observability

**Current State: Minimal**

Logs:
- Production: `journalctl -u claude-bridge-prod.service -f`
- Staging: `journalctl -u claude-bridge-staging.service -f`
- Dev: `pm2 logs claude-bridge-dev`

No:
- ❌ Error tracking (Sentry, Rollbar)
- ❌ Performance monitoring (New Relic, DataDog)
- ❌ Test metrics (pass rate, duration trends)
- ❌ Flakiness detection (test stability over time)
- ❌ API cost tracking (Anthropic usage by test)
- ❌ Database query profiling
- ❌ Alerting (test failures, deployment issues)

**Questions:**

1. **Test Observability**: What metrics matter?
   - Test duration (identify slow tests)
   - Flakiness rate (same test passes/fails randomly)
   - API cost per test
   - Database query count
   - Memory usage
   - CPU usage

2. **Failure Diagnosis**: How to make failures actionable?
   - Video recording (Playwright supports this)
   - DOM snapshots at failure point
   - Console logs
   - Network traffic (HAR files)
   - Server logs correlation

3. **Trend Analysis**: How to improve over time?
   - Track test suite duration (should decrease)
   - Track flakiness (should approach zero)
   - Track API cost (should optimize)
   - Identify problematic tests

---

## Part 5: Synthesis & Core Questions

### 5.1 Primary Architecture Question

**Given this multi-tenant, server-deployed application with:**
- Expensive external API dependencies ($0.003-$0.015/request)
- OS-level workspace isolation (systemd, dedicated users)
- Persistent database state (no test isolation)
- No CI/CD automation
- Manual deployment process
- Three environments on same physical server
- Sequential test execution due to "state pollution"

**What is the optimal E2E testing architecture that achieves:**
1. **Ultimate performance** (test suite completes in <5 minutes)
2. **Absolute robustness** (99%+ pass rate, deterministic)
3. **Zero flakiness** (no race conditions, timing dependencies, or random failures)
4. **Proper isolation** (tests can run in parallel safely)
5. **Cost efficiency** (minimize API calls while maintaining confidence)
6. **Developer happiness** (fast feedback, easy debugging, low maintenance)

### 5.2 Specific Decision Points

**Decision 1: Database Strategy**
- Should we use a separate test database instance?
- Should we implement test transactions with rollback?
- Should we create/destroy test users per test?
- Should we use database snapshots for fast resets?
- Should we mock the database layer entirely?

**Decision 2: API Mocking Strategy**
- What's the optimal mocked-to-genuine test ratio?
- Should we use request recording/replay (VCR pattern)?
- Should we implement contract testing?
- How do we prevent mock drift from production?
- When should we run genuine API tests (every commit? nightly?)?

**Decision 3: Test Server Architecture**
- Should we use dev server (slow startup, hot-reload)?
- Should we use production build (fast startup, no hot-reload)?
- Should we keep server running between tests?
- How do we optimize 3-minute startup time?

**Decision 4: Parallelization Approach**
- Should we parallelize at test level (Playwright workers)?
- Should we parallelize at suite level (multiple test processes)?
- Should we use container-based isolation (Docker per test)?
- What's the state isolation mechanism?

**Decision 5: File System Strategy**
- Should we create unique workspace per test?
- Should we mock file operations?
- How do we handle OS-level permissions in tests?
- Should we use in-memory filesystem?

**Decision 6: Wait & Synchronization**
- How should we wait for SSE streams reliably?
- What timeout values are appropriate?
- Should we implement custom waitFor helpers?
- How do we handle timing differences between environments?

**Decision 7: CI/CD Integration**
- What's the minimal CI/CD setup needed?
- Should we use GitHub Actions, GitLab CI, Jenkins?
- What's the deployment gate strategy?
- How do we handle E2E tests in CI (genuine API calls?)?

### 5.3 Trade-off Analysis Requested

Please provide analysis of trade-offs for:

1. **Speed vs Confidence**:
   - Mocked tests are fast but may miss issues
   - Genuine tests are slow but catch real problems
   - What's the optimal balance?

2. **Isolation vs Simplicity**:
   - Full isolation (containers, separate DB) is complex
   - Shared state is simple but causes conflicts
   - What level of isolation is sufficient?

3. **Cost vs Coverage**:
   - More genuine tests = higher API costs
   - Fewer genuine tests = lower confidence
   - What's the cost-benefit optimal point?

4. **Parallelization vs Stability**:
   - Parallel tests are fast but prone to flakiness
   - Sequential tests are slow but reliable
   - Is parallelization worth the effort?

5. **Mock Accuracy vs Maintenance**:
   - Accurate mocks require constant updates
   - Simple mocks drift from production
   - How to maintain mock accuracy efficiently?

### 5.4 Anti-Patterns to Identify

Please identify any anti-patterns in our current setup:

1. **Sequential execution due to "state pollution"**: Is this masking deeper issues?
2. **3-minute server startup**: Is this acceptable or fixable?
3. **networkidle waits**: Are these hiding timing bugs?
4. **Persistent test user in production DB**: Is this a security/data risk?
5. **No test cleanup**: Are we accumulating cruft?
6. **Manual deployment**: Should this block progress?
7. **Mocked tests only**: Are we over-relying on mocks?

### 5.5 Industry Best Practices Requested

What do industry-leading teams do for E2E testing with similar constraints?

1. **Companies with expensive external APIs** (Stripe, Twilio, SendGrid):
   - How do they test without breaking the bank?
   - Sandbox environments? Recording? Synthetic data?

2. **Multi-tenant SaaS platforms** (Vercel, Netlify, Heroku):
   - How do they isolate test tenants?
   - Database strategies?
   - Workspace cleanup?

3. **Real-time applications** (Slack, Discord, Notion):
   - How do they test SSE/WebSocket reliability?
   - Mock vs genuine streaming?

4. **AI-powered applications** (GitHub Copilot, Cursor, Replit):
   - How do they handle non-deterministic AI responses in tests?
   - How do they control costs?

5. **Deployment pipeline maturity**:
   - What's the minimum viable CI/CD for confidence?
   - At what point is automation ROI positive?

### 5.6 Concrete Recommendations Sought

Please provide concrete, actionable recommendations for:

1. **Immediate wins** (<1 week of work):
   - Quick optimizations that improve stability or speed
   - Low-risk changes with high impact

2. **Short-term improvements** (1-4 weeks):
   - Foundational changes to enable parallelization
   - Test server optimization
   - Basic CI/CD setup

3. **Long-term architecture** (1-3 months):
   - Robust isolation strategy
   - Optimal mock/genuine balance
   - Comprehensive observability

4. **Success metrics**:
   - How to measure test suite health?
   - What are reasonable targets? (duration, flakiness, cost)

---

## Part 6: Specific Technical Implementation Questions

### 6.1 Database Transaction Isolation Pattern

How do I implement test-scoped database transactions with server running in separate process?

**Constraint**: Test runner (Playwright) and application server (Next.js) are separate processes.

**Pattern Attempt 1: Transaction Wrapping**
```typescript
// In test
test("example", async ({ page }) => {
  await db.transaction(async (tx) => {
    // Create test data with tx
    await tx.insert(users).values({ ... })

    // Run test
    await page.goto('/chat')
    // ... test actions ...

    // Transaction rollback happens automatically
  })
})
```
**Problem**: Server process uses its own DB connection, not affected by test transaction.

**Pattern Attempt 2: API-Controlled Transactions**
```typescript
// Add test-only API endpoint
// POST /api/test/begin-transaction -> returns transactionId
// POST /api/test/rollback-transaction -> rolls back

// In test
const txId = await fetch('/api/test/begin-transaction')
// Server now uses this transaction for all operations
// ... test runs ...
await fetch('/api/test/rollback-transaction', { body: { txId } })
```
**Problem**: How to force all server operations to use specific transaction? Thread-local storage?

**Question**: What's the industry-standard pattern for this? How do other frameworks solve it?

### 6.2 Workspace Filesystem Isolation Pattern

How do I create isolated workspace per test without OS permission conflicts?

**Current Issue:**
```typescript
// Test creates workspace
const testWorkspace = `/tmp/test-workspace-${testId}`
execSync(`mkdir -p ${testWorkspace}`)

// Server tries to run as workspace user
const { uid, gid } = statSync(testWorkspace)  // uid=0, gid=0 (root)
// Problem: Cannot drop to uid=0, it's root

// If we chown to fake user:
execSync(`chown site-test:site-test ${testWorkspace}`)
// Problem: User doesn't exist, can't create without root
```

**Pattern Attempt: Docker-Based Isolation**
```bash
# Each test runs in container
docker run --rm \
  -v /tmp/test-workspace-${testId}:/workspace \
  -u site-test:site-test \
  test-server:latest

# Problem: Docker overhead, networking complexity, database access
```

**Question**: How do multi-tenant platforms test workspace isolation without Docker? Mock the entire filesystem layer?

### 6.3 SSE Stream Testing Pattern

How do I reliably test Server-Sent Events without flakiness?

**Current Fragile Pattern:**
```typescript
await sendButton.click()

// ❌ Fragile: Race condition, timing-dependent
await expect(page.getByText(/response/).first()).toBeVisible({ timeout: 5000 })
```

**Better Pattern Attempt:**
```typescript
// Listen to SSE events directly
const events = []
page.on('response', async (response) => {
  if (response.url().includes('/api/claude/stream')) {
    const body = await response.text()
    events.push(...parseNDJSON(body))
  }
})

await sendButton.click()

// Wait for specific event sequence
await waitFor(() => {
  const hasStart = events.some(e => e.type === 'start')
  const hasText = events.some(e => e.type === 'text')
  const hasComplete = events.some(e => e.type === 'complete')
  return hasStart && hasText && hasComplete
})
```

**Question**: Is this the right approach? How do you test streaming protocols reliably?

### 6.4 Mock Synchronization Pattern

How do I ensure mocks stay synchronized with production API?

**Current Problem**: Manual mock maintenance
```typescript
// Mock may become stale
handlers.text('Response')  // Simple mock

// Production adds new field
{ type: 'text', text: 'Response', metadata: { ... } }  // Mock doesn't include metadata
```

**Pattern Attempt: Contract Testing**
```typescript
// Define expected shape
const ClaudeStreamEvent = z.union([
  z.object({ type: z.literal('start'), conversationId: z.string(), model: z.string() }),
  z.object({ type: z.literal('text'), text: z.string() }),
  // ... all event types
])

// Validate mock against contract
test("mock produces valid events", () => {
  const mock = handlers.text('Hello')
  const events = parseNDJSON(mock.body)

  for (const event of events) {
    expect(() => ClaudeStreamEvent.parse(event)).not.toThrow()
  }
})

// Validate genuine API against same contract
test("genuine API produces valid events", async () => {
  const response = await genuineApiCall()
  const events = parseNDJSON(response.body)

  for (const event of events) {
    expect(() => ClaudeStreamEvent.parse(event)).not.toThrow()
  }
})
```

**Question**: Is contract testing sufficient? Or should we use VCR-style recording?

---

## Part 7: Context & Constraints Summary

### 7.1 Must-Have Requirements
1. Tests must be deterministic (no random failures)
2. Tests must catch real bugs (not just pass)
3. Tests must complete in reasonable time (<30min)
4. Tests must not cost excessive money (API calls)
5. Tests must be maintainable by small team (2-3 developers)
6. Tests must provide confidence for production deploys

### 7.2 Nice-to-Have Goals
1. Test suite completes in <5 minutes
2. Parallel execution (4+ workers)
3. Automated CI/CD integration
4. Zero flakiness (100% pass rate when app works)
5. Cost under $100/month for API calls
6. Easy debugging when tests fail

### 7.3 Constraints
1. Physical server (not cloud-managed infrastructure)
2. Single database instance (not per-environment)
3. No budget for external services (test environments, mock APIs)
4. Small team (limited time for complex setups)
5. External API rate limits (Claude API: 5000 req/min)
6. OS-level multi-tenancy (systemd, users, permissions)

### 7.4 Open Questions
1. Should we invest in test infrastructure before CI/CD?
2. Is the current mock-heavy approach sustainable?
3. Are we testing the right things?
4. What's the MVP for confident deployments?
5. What can we defer until later?

---

## Question to You (The Oracle)

**Given this comprehensive architecture, constraints, and goals:**

**Design the optimal E2E testing strategy that balances performance, robustness, cost, and maintainability.**

Specifically:
1. **Provide a detailed testing architecture** with specific patterns, tools, and implementation approaches
2. **Explain trade-offs** for each decision (why choose X over Y)
3. **Prioritize recommendations** into immediate wins, short-term, and long-term
4. **Address each technical challenge** with concrete solutions
5. **Reference industry standards** and how they apply to our constraints
6. **Identify anti-patterns** we should avoid
7. **Propose success metrics** to measure testing effectiveness

This is our **one chance** to get expert guidance on building a world-class E2E testing system. Please provide comprehensive, actionable, and unbiased recommendations that will serve as our north star for the next 6-12 months of testing infrastructure development.
