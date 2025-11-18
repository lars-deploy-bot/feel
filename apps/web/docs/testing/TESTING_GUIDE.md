# Testing Guide

Comprehensive guide for writing and organizing tests in the Claude Bridge codebase.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Types](#test-types)
3. [When to Use Which Test Type](#when-to-use-which-test-type)
4. [Integration Test Patterns](#integration-test-patterns)
5. [E2E Test Patterns](#e2e-test-patterns)
6. [Converting E2E Tests to Integration Tests](#converting-e2e-tests-to-integration-tests)
7. [Running Tests](#running-tests)
8. [Debugging Failing Tests](#debugging-failing-tests)

## Testing Philosophy

**This is MVP** - We focus on:
1. **Security-critical code** (100% coverage required)
2. **New API routes** (happy path + error cases)
3. **Complex business logic** (when fixing bugs or adding features)

**We DON'T test:**
- Simple formatters/transforms
- Type guards (unless security-critical)
- UI components (unless fixing a bug)
- Third-party library wrappers
- Configuration files

## Test Types

### 1. Unit Tests (`.test.ts`)

**Purpose**: Test individual functions and modules in isolation

**Tool**: Vitest

**Location**: Co-located with source files in `__tests__/` directories

**Example**: `lib/__tests__/utils.test.ts`

```typescript
import { describe, expect, it } from "vitest"
import { myFunction } from "../myModule"

describe("myFunction", () => {
  it("should return expected value", () => {
    expect(myFunction("input")).toBe("expected output")
  })
})
```

### 2. Integration Tests (`.integration.test.ts`)

**Purpose**: Test API endpoints and backend flows without browser UI

**Tool**: Vitest + native fetch

**Location**: Co-located in `__tests__/` directories

**Example**: `features/deployment/__tests__/deployment-api.integration.test.ts`

**Key characteristics:**
- Tests API endpoints directly using `fetch()`
- Uses real authentication (session cookies)
- Uses test database (via test user helpers)
- Fast execution (~100-500ms per test)
- Easy to debug (console logs, breakpoints work)

### 3. E2E Tests (`.spec.ts`)

**Purpose**: Test user flows through browser UI

**Tool**: Playwright

**Location**: `e2e-tests/` directory

**Example**: `e2e-tests/auth.spec.ts`

**Key characteristics:**
- Tests full user interactions (click, type, navigate)
- Uses real browser (Chromium)
- Tests visual elements and UX
- Slower execution (~2-10s per test)
- Harder to debug (requires browser inspection)

## When to Use Which Test Type

### Use Unit Tests When:

✅ Testing pure functions (no side effects)
✅ Testing utility modules
✅ Testing security-critical functions (path validation, etc.)
✅ Testing business logic with multiple branches

### Use Integration Tests When:

✅ Testing API endpoints
✅ Testing authentication flows
✅ Testing database operations
✅ Testing backend services interaction
✅ Testing error handling and validation
✅ You want fast, reliable tests

**Example scenarios:**
- "Does the login API reject invalid credentials?"
- "Does the deployment API require authentication?"
- "Does the users API filter out test users?"

### Use E2E Tests When:

✅ Testing critical user journeys
✅ Testing UI interactions that can't be tested otherwise
✅ Testing visual elements (buttons, modals, forms)
✅ Testing browser-specific behavior (navigation, redirects)

**Example scenarios:**
- "Can a user log in through the UI?"
- "Does the settings modal open when clicking the button?"
- "Does the workspace switcher show the correct workspace?"

## Integration Test Patterns

### Pattern 1: API Route Testing

**File**: `app/api/manager/users/__tests__/route.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest"

// Mock dependencies
vi.mock("@/features/auth/lib/auth", () => ({
  isManagerAuthenticated: vi.fn(),
}))

vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: vi.fn(),
}))

// Import after mocking
const { GET } = await import("../route")
const { isManagerAuthenticated } = await import("@/features/auth/lib/auth")

describe("GET /api/manager/users", () => {
  it("should require manager authentication", async () => {
    ;(isManagerAuthenticated as any).mockResolvedValue(false)

    const req = new Request("http://localhost/api/manager/users")
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe("UNAUTHORIZED")
  })

  it("should return users when authenticated", async () => {
    ;(isManagerAuthenticated as any).mockResolvedValue(true)

    // Mock Supabase client response
    // ... setup mocks ...

    const req = new Request("http://localhost/api/manager/users")
    const response = await GET(req)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toBeDefined()
  })
})
```

**Key points:**
- Mock external dependencies (auth, database)
- Import route handler AFTER mocking
- Create Request objects directly
- Test both success and error cases

### Pattern 2: Full Flow Testing

**File**: `features/deployment/__tests__/deployment-flow.integration.test.ts`

```typescript
import { describe, expect, test, beforeAll, afterAll } from "vitest"
import { createTestUser, cleanupTestUser } from "@/lib/test-helpers/auth-test-helper"
import { loginAndGetSession } from "@/lib/test-helpers/test-auth-helpers"

describe("Deployment Flow", () => {
  let testUser: TestUser
  let sessionCookie: string

  beforeAll(async () => {
    // Create real test user in database
    testUser = await createTestUser()
    sessionCookie = await loginAndGetSession(testUser.email)
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestUser(testUser.userId)
  })

  test("deployment requires authentication", async () => {
    const response = await fetch("http://localhost:8999/api/deploy-subdomain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "test-site",
        orgId: testUser.orgId,
      }),
    })

    expect(response.status).toBe(401)
  })

  test("deployment succeeds with valid auth", async () => {
    const response = await fetch("http://localhost:8999/api/deploy-subdomain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        slug: "test-site",
        orgId: testUser.orgId,
      }),
    })

    const data = await response.json()
    expect(response.ok).toBe(true)
    expect(data.domain).toBe("test-site.alive.best")
  })
})
```

**Key points:**
- Use real test user (created in database)
- Use real authentication (session cookies)
- Call actual API endpoints with `fetch()`
- Clean up test data in `afterAll()`

## E2E Test Patterns

### Pattern 1: UI Interaction Testing

**File**: `e2e-tests/auth.spec.ts`

```typescript
import { expect, test } from "./setup"

test("can login with test credentials", async ({ page }) => {
  await page.goto("/")

  await page.getByPlaceholder("you@example.com").fill("test@bridge.local")
  await page.getByPlaceholder("Enter your password").fill("test")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page).toHaveURL("/chat")
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
})
```

**Key points:**
- Test user-visible elements and interactions
- Use Playwright locators (`getByRole`, `getByPlaceholder`, etc.)
- Verify UI state changes (URL, visibility)

### Pattern 2: Error State Testing

**File**: `e2e-tests/org-workspace-selection.spec.ts`

```typescript
test("shows error state when org loading fails", async ({ page }) => {
  // Intercept API to simulate failure
  await page.route("**/api/auth/organizations", route => {
    route.abort("failed")
  })

  await page.goto("/chat")

  // Verify error UI is shown
  await expect(page.getByText("Failed to load organizations")).toBeVisible()
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()

  // Test retry button
  await page.unroute("**/api/auth/organizations")
  await page.getByRole("button", { name: "Retry" }).click()

  // Verify error disappears
  await expect(page.getByText("Failed to load organizations")).not.toBeVisible()
})
```

**Key points:**
- Use `page.route()` to mock API responses
- Test error states and retry functionality
- Verify UI updates correctly

## Converting E2E Tests to Integration Tests

### Decision Tree

**Convert to Integration Test if:**
- ✅ Test focuses on API behavior (not UI)
- ✅ Test validates authentication/authorization
- ✅ Test validates data transformation
- ✅ Test validates error handling
- ✅ UI interaction is minimal (just calling an API)

**Keep as E2E Test if:**
- ❌ Test validates visual elements (modals, buttons)
- ❌ Test validates user interactions (clicks, navigation)
- ❌ Test validates browser behavior (redirects, cookies)
- ❌ Test validates complex UI state changes

### Example Conversion

**Before (E2E):**

```typescript
// e2e-tests/deploy.spec.ts
test("deployment API rejects unauthenticated requests", async ({ request }) => {
  const response = await request.post("/api/deploy-subdomain", {
    data: {
      slug: "test",
      orgId: "org-123",
    },
  })

  expect(response.status()).toBe(401)
})
```

**After (Integration):**

```typescript
// app/api/deploy-subdomain/__tests__/route.test.ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@/features/auth/lib/auth", () => ({
  isWorkspaceAuthenticated: vi.fn(),
}))

const { POST } = await import("../route")
const { isWorkspaceAuthenticated } = await import("@/features/auth/lib/auth")

describe("POST /api/deploy-subdomain", () => {
  it("should reject unauthenticated requests", async () => {
    ;(isWorkspaceAuthenticated as any).mockResolvedValue(false)

    const req = new Request("http://localhost/api/deploy-subdomain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "test", orgId: "org-123" }),
    })

    const response = await POST(req)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBeDefined()
  })
})
```

**Benefits of conversion:**
- ⚡ **Faster**: Runs in ~50ms vs ~2s
- 🐛 **Easier to debug**: Console logs, breakpoints work
- 🎯 **More focused**: Tests API logic directly
- 📊 **Better error messages**: Shows exact assertion failure

## Running Tests

### Unit + Integration Tests

```bash
# Run all vitest tests
bun test

# Run with explicit vitest (avoids Playwright conflicts)
bunx vitest run

# Run specific test file
bun test path/to/file.test.ts

# Run in watch mode
bun test --watch

# Run with coverage
bun test --coverage
```

### E2E Tests

```bash
# First time setup
bunx playwright install chromium

# Run all e2e tests
bun run test:e2e

# Run specific test
bunx playwright test e2e-tests/auth.spec.ts

# Run with UI mode (visual debugging)
bunx playwright test --ui

# Run in headed mode (see browser)
bunx playwright test --headed
```

### All Tests

```bash
# Run both vitest and playwright (use for CI)
bunx vitest run && bun run test:e2e
```

## Debugging Failing Tests

### Integration Tests

**Problem**: Test fails with unclear error

**Solution**:
1. Add `console.log()` statements
2. Check the exact assertion failure
3. Inspect mock setup (are mocks correct?)
4. Use `.only` to run single test:
   ```typescript
   it.only("should do something", () => {
     // ...
   })
   ```

**Problem**: Mock not working

**Solution**:
1. Ensure `vi.mock()` is BEFORE imports
2. Import module AFTER mocking:
   ```typescript
   vi.mock("@/lib/supabase/iam")
   const { createIamClient } = await import("@/lib/supabase/iam")
   ```
3. Cast to `any` when calling mock methods:
   ```typescript
   ;(createIamClient as any).mockResolvedValue(...)
   ```

### E2E Tests

**Problem**: Element not found

**Solution**:
1. Increase timeout:
   ```typescript
   await expect(element).toBeVisible({ timeout: 10000 })
   ```
2. Use Playwright inspector:
   ```bash
   bunx playwright test --debug
   ```
3. Take screenshot on failure (auto-enabled in CI)

**Problem**: Test is flaky

**Solution**:
1. Add explicit waits:
   ```typescript
   await page.waitForLoadState("networkidle")
   ```
2. Use better locators (prefer `getByRole` over `locator`)
3. Avoid `waitForTimeout()` - use event-based waits

## Test Organization

### File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts`

### Directory Structure

```
apps/web/
├── app/
│   └── api/
│       └── users/
│           ├── route.ts
│           └── __tests__/
│               ├── route.test.ts              # Unit/integration tests
│               └── security.test.ts           # Security-focused tests
├── features/
│   └── deployment/
│       └── __tests__/
│           ├── deployment-api.integration.test.ts
│           └── deployment-flow.integration.test.ts
├── lib/
│   └── __tests__/
│       └── utils.test.ts
└── e2e-tests/
    ├── auth.spec.ts
    ├── deploy.spec.ts
    └── org-workspace-selection.spec.ts
```

### Test Helpers

**Location**: `lib/test-helpers/`

**Key helpers:**
- `auth-test-helper.ts`: Create/cleanup test users
- `test-auth-helpers.ts`: Login and get session cookies
- `test-constants.ts`: Shared test constants
- `cleanup-test-database.ts`: Database cleanup utilities
- `test-email-domains.ts`: Test email domain allowlist

## Best Practices

### DO:

✅ Use integration tests for API testing (faster, easier to debug)
✅ Use E2E tests for critical user journeys only
✅ Clean up test data in `afterAll()` hooks
✅ Use strict internal test domains (`@bridge-vitest.internal`, `@bridge-playwright.internal`)
✅ Test both success and error cases
✅ Use descriptive test names
✅ Group related tests in `describe` blocks

### DON'T:

❌ Use generic test emails (`@test.com`, `@example.com`)
❌ Leave test data in database
❌ Write E2E tests for API-only behavior
❌ Use `waitForTimeout()` in E2E tests (use event-based waits)
❌ Skip tests without a good reason
❌ Test implementation details (test behavior, not internals)

## Checklist Before Committing

- [ ] Tests pass: `bunx vitest run && bun run test:e2e`
- [ ] New API routes have integration tests
- [ ] Security-critical code has unit tests
- [ ] Test data is cleaned up (no orphaned users/orgs)
- [ ] Tests use internal test domains (not generic ones)
- [ ] E2E tests only for UI flows (not API testing)

## Common Patterns Reference

### Create Test User

```typescript
import { createTestUser, cleanupTestUser } from "@/lib/test-helpers/auth-test-helper"

const testUser = await createTestUser() // Auto-generates internal email
await cleanupTestUser(testUser.userId)
```

### Mock Supabase Client

```typescript
vi.mock("@/lib/supabase/iam", () => ({
  createIamClient: vi.fn(),
}))

const { createIamClient } = await import("@/lib/supabase/iam")

;(createIamClient as any).mockResolvedValue({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
})
```

### Mock Authentication

```typescript
vi.mock("@/features/auth/lib/auth", () => ({
  isManagerAuthenticated: vi.fn(),
}))

const { isManagerAuthenticated } = await import("@/features/auth/lib/auth")

;(isManagerAuthenticated as any).mockResolvedValue(true)
```

### Create Mock Request

```typescript
function createMockRequest(url: string, options: RequestInit = {}): Request {
  const req = new Request(url, options) as any
  req.nextUrl = new URL(url)
  return req
}

const req = createMockRequest("http://localhost/api/users", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data: "test" }),
})
```

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [security/authentication.md](../security/authentication.md) - Auth patterns
- [test-helpers/](../../lib/test-helpers/) - Test utility functions
