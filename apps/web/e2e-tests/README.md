# E2E Tests - Worker Isolation

Playwright tests with parallel workers, each with dedicated test tenant.

## Architecture

```text
Test Run: E2E_2025-11-21T10:30:00Z
├── Worker 0 → e2e-w0@alive.local (e2e-w0.alive.local)
├── Worker 1 → e2e-w1@alive.local (e2e-w1.alive.local)
├── Worker 2 → e2e-w2@alive.local (e2e-w2.alive.local)
└── Worker 3 → e2e-w3@alive.local (e2e-w3.alive.local)
```

Each worker gets isolated user/org/domain - no shared state, true parallelization.

## Setup (One-Time)

**Note**: If you're working on an existing database where E2E tests have been run before, the `test_run_id` columns should already exist. Only run the migration below if:
- You're provisioning a fresh database instance, OR
- You receive database errors about missing `test_run_id` columns when running tests

1. **Run SQL migration in Supabase:**
   ```sql
   -- Adds test_run_id columns for isolation
   \i apps/web/migrations/add-test-run-id.sql
   ```

2. **Regenerate Supabase types:**
   ```bash
   bun run gen:db
   ```

## Running Tests

```bash
# Run the standard suite against a local app + isolated Supabase target
bun run test:e2e

# Run with UI mode
bun run test:e2e:ui

# Run in headed mode
bun run test:e2e:headed

# Debug mode
bun run test:e2e:debug
```

### Local E2E Env

Create `.env.e2e.local` with a local app URL and isolated Supabase credentials:

```bash
TEST_ENV=local
NEXT_PUBLIC_APP_URL=http://127.0.0.1:9547
NEXT_PUBLIC_PREVIEW_BASE=alive.local
SUPABASE_URL=http://10.8.0.1:8000
SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
NEXT_PUBLIC_SUPABASE_URL=http://10.8.0.1:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

`bun run test:e2e` now assumes this local lane. If `SUPABASE_URL` is a private HTTP target such as `http://10.8.0.1:8000`, the wrapper script opens an SSH tunnel and rewrites the runtime env to loopback before Playwright starts. It must not point at shared staging or production data.

### Live Deployed Tests

Use deployed environments only for the explicit live lane:

```bash
# Preview or staging, depending on the env file you pass
ENV_FILE=.env.staging bun run test:e2e:live
```

Staging/preview live tests are intentionally separate from the default suite because they hit deployed infrastructure.

## Test Files

- `auth.spec.ts` - Authentication flow tests
- `chat.spec.ts` - Chat interface tests (some skipped, need workspace auto-selection fix)
- `org-workspace-selection.spec.ts` - **NEW**: Organization and workspace selection flow tests
- `protection-verification.spec.ts` - API protection verification
- `smoke.spec.ts` - Basic smoke tests

## Writing Tests

### Authenticated Tests (Most Common)

```typescript
import { expect, test } from "./fixtures"

test("my test", async ({ authenticatedPage, workerTenant }) => {
  // Already authenticated with JWT + workspace set
  await authenticatedPage.goto("/chat")

  // Use workerTenant for assertions
  console.log(workerTenant.email)      // e2e-w0@alive.local
  console.log(workerTenant.workspace)  // e2e-w0.alive.local
})
```

### Unauthenticated Tests

```typescript
import { expect, test } from "./fixtures"

test("login page", async ({ page }) => {
  await page.goto("/")
  // No auth, no workspace - test login flow
})
```

### Mocking API Responses

Register mocks BEFORE navigation:

```typescript
import { handlers } from "./lib/handlers"

test("mock test", async ({ authenticatedPage }) => {
  await authenticatedPage.route("**/api/claude/stream", handlers.text("Mock response"))
  await authenticatedPage.goto("/chat")
})
```

### Available Fixtures

- `workerTenant` (test-scoped): Tenant info for this worker (userId, email, orgId, workspace)
- `authenticatedPage` (test-scoped): Pre-authenticated page with JWT + workspace
- `page` (test-scoped): Unauthenticated page (default Playwright fixture)

## CI/CD

Tests run automatically in CI via GitHub Actions. See `.github/workflows/` for configuration.

## Common Issues

### Port Conflicts

If tests fail to start, check if port 9547 is in use:

```bash
lsof -i :9547
kill -9 <PID>
```

### Org/Workspace Auto-Selection

Some tests depend on proper org/workspace auto-selection. The flow:

1. Login → `/chat`
2. Organizations fetch from `/api/auth/organizations`
3. Auto-select first org (if none selected)
4. Workspaces fetch from `/api/auth/workspaces?org_id={orgId}`
5. Auto-select first workspace (if none selected)

This process takes ~3-4 seconds. Tests use `waitForTimeout` to ensure completion.

### Debugging Live Deployed Tests

To debug issues against preview/staging:

```bash
# Run local standard E2E in headed mode
bun run test:e2e:headed org-workspace-selection.spec.ts

# Or run the live lane explicitly
ENV_FILE=.env.staging bun run test:e2e:live:headed chat-live.spec.ts
```

## How It Works

1. **Global Setup** (`global-setup.ts`):
   - Generates unique run ID: `E2E_${timestamp}`
   - Creates N tenants (one per worker) via `/api/test/bootstrap-tenant`
   - Each tenant: user + org + domain tagged with `test_run_id`
   - Polls `/api/test/verify-tenant` for readiness (replaces arbitrary 2s delay)

2. **Fixtures** (`fixtures.ts`):
   - `workerStorageState` (worker-scoped): Fetches tenant for this worker once via bootstrap API
   - `workerTenant` (test-scoped): Convenience wrapper that passes through the worker's tenant
   - `authenticatedPage` (test-scoped): Sets JWT cookie + workspace per test

3. **Global Teardown** (`global-teardown.ts`):
   - Deletes all data where `test_run_id = E2E_${timestamp}`
   - Fast indexed cleanup, no orphaned test data

4. **E2B Sandbox Template Routing** (live lane):
   - Worker tenant hostnames (`e2e-w{N}.alive.local`) use a dedicated minimal sandbox template:
     - `self-hosted/alive-e2e-minimal`
   - Non-E2E domains keep using:
     - `self-hosted/alive`
   - This keeps live E2E sandbox startup fast while preserving production behavior.

## Constants

All test config in `@webalive/shared/constants`:

```typescript
TEST_CONFIG.PORT            // 9547
TEST_CONFIG.BASE_URL        // http://localhost:9547
TEST_CONFIG.EMAIL_DOMAIN    // alive.local
TEST_CONFIG.DEFAULT_CREDITS // 1000
```

## Minimal E2B Template Contract (live lane)

`self-hosted/alive-e2e-minimal` should include only what lifecycle tests need:
- writable workspace root at `/home/user/project`
- POSIX shell + coreutils for basic command execution
- no heavy toolchain/runtime unless a test explicitly requires it

Validation coverage:
- `sandbox-lifecycle-live.spec.ts` verifies sandbox creation/reuse on worker tenants.

Build/publish command:

```bash
./scripts/e2b/build-e2e-minimal-template.sh
```

## Debugging

### View Worker's Tenant
```typescript
test("debug", async ({ workerTenant }) => {
  console.log(workerTenant)
  // { userId, email, orgId, orgName, workspace, workerIndex }
})
```

### Check Database
```sql
-- View current test run
SELECT email, test_run_id, is_test_env
FROM iam.users
WHERE test_run_id LIKE 'E2E_%'
ORDER BY test_run_id DESC;
```

## Test Coverage

- ✅ Worker isolation (parallel execution)
- ✅ Authentication with JWT
- ✅ Workspace selection
- ✅ Chat interface
- ✅ API mocking protection
