# Testing Documentation

> **Philosophy**: Write tests that won't break. Test behavior, not implementation. Focus on security-critical paths first.

## Quick Start

```bash
# Run unit tests
cd apps/web && bun test

# Run E2E tests
bun run test:e2e

# Run E2E in headed mode (see browser)
bun run test:e2e:headed
```

---

## Testing Structure

Claude Bridge uses **three types of tests** with separate configurations:

### 1. Unit Tests (Vitest)
- **What**: Test individual functions in isolation
- **Config**: `apps/web/vitest.config.ts`
- **Runner**: Vitest with happy-dom
- **Speed**: Very fast (milliseconds)
- **Guide**: [UNIT_TESTING.md](./UNIT_TESTING.md)

```bash
cd apps/web && bun test
```

### 2. Integration Tests (Vitest)
- **What**: Test multiple components working together
- **Config**: `apps/web/vitest.config.ts` (same as unit)
- **Runner**: Vitest with real dependencies
- **Speed**: Fast (seconds)
- **Guide**: [INTEGRATION_TESTING.md](./INTEGRATION_TESTING.md)

```bash
cd apps/web && bun test '**/*.integration.test.ts'
```

### 3. E2E Tests (Playwright)
- **What**: Test complete user flows in a real browser
- **Config**: `apps/web/playwright.config.ts`
- **Runner**: Playwright with Chromium
- **Speed**: Slower (minutes)
- **Guide**: [E2E_TESTING.md](./E2E_TESTING.md)

```bash
bun run test:e2e
```

---

## File Structure

```
apps/web/
├── vitest.config.ts          # Unit + Integration test config
├── playwright.config.ts      # E2E test config
├── tests/
│   ├── setup.ts              # Global test setup (mocks Anthropic SDK)
│   └── e2e/
│       ├── setup.ts          # E2E test fixture (API protection)
│       ├── helpers.ts        # Reusable E2E functions (login, etc.)
│       ├── lib/
│       │   ├── stream-builder.ts  # Mock SSE stream builder
│       │   └── handlers.ts        # Pre-built mock handlers
│       └── *.spec.ts         # E2E test files
├── lib/
│   ├── auth.ts
│   └── __tests__/
│       ├── auth.test.ts              # Unit tests
│       └── auth.integration.test.ts  # Integration tests
└── features/
    └── chat/
        ├── components/
        └── __tests__/
```

**Naming conventions:**
- Unit tests: `{filename}.test.ts`
- Integration tests: `{filename}.integration.test.ts`
- E2E tests: `{feature}.spec.ts`

---

## What to Test (MVP Priorities)

### 1. Security-Critical Functions (100% coverage required)
- Path traversal protection (`isPathWithinWorkspace`)
- Session validation (`getSessionUser`, `hasSessionCookie`)
- Workspace boundary checks (`getWorkspace`)
- Shell command sanitization

**Test type**: Unit tests

### 2. API Routes (70% coverage target)
- Authentication flows
- Request validation
- Error handling

**Test type**: Integration tests

### 3. Business Logic (60% coverage target)
- Workspace resolution
- Stream processing
- File operations

**Test type**: Unit + Integration tests

### 4. User Flows (Critical paths only)
- Login → Chat → Get response
- Workspace switching
- Error handling

**Test type**: E2E tests

---

## Quick Reference

### Running Tests

```bash
# Unit tests
cd apps/web && bun test                      # All unit tests
bun test --watch                             # Watch mode
bun test security.test.ts                    # Specific file
bun test --coverage                          # With coverage

# Integration tests
bun test '**/*.integration.test.ts'          # All integration tests

# E2E tests
bun run test:e2e                             # All E2E tests
bun run test:e2e:headed                      # With visible browser
bun run test:e2e:debug                       # Debug mode
bunx playwright test chat.spec.ts            # Specific file
```

### Common Test Patterns

#### Unit Test
```typescript
// lib/__tests__/security.test.ts
import { describe, expect, it } from 'vitest'
import { isPathWithinWorkspace } from '../security'

describe('Path Traversal Protection', () => {
  it('should reject paths with ../', () => {
    expect(isPathWithinWorkspace('../etc/passwd', '/workspace')).toBe(false)
  })

  it('should allow valid paths', () => {
    expect(isPathWithinWorkspace('src/index.ts', '/workspace')).toBe(true)
  })
})
```

#### Integration Test
```typescript
// features/workspace/__tests__/workspaceRetriever.integration.test.ts
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { getWorkspace } from '../workspaceRetriever'

describe('Workspace Resolution', () => {
  const testDir = '/tmp/test-' + Date.now()

  beforeEach(() => mkdirSync(testDir, { recursive: true }))
  afterEach(() => rmSync(testDir, { recursive: true }))

  it('should resolve valid workspace', () => {
    const result = getWorkspace({
      host: 'terminal.example.com',
      body: { workspace: testDir }
    })

    expect(result.success).toBe(true)
  })
})
```

#### E2E Test
```typescript
// tests/e2e/chat.spec.ts
import { expect, test } from './setup'
import { login } from './helpers'
import { handlers } from './lib/handlers'

test('user can send message', async ({ page }) => {
  await login(page)

  // Mock Claude API (prevents real API calls)
  await page.route('**/api/claude/stream', handlers.text('Hello!'))

  await page.goto('/chat')
  await page.locator('[data-testid="message-input"]').fill('Test')
  await page.locator('[data-testid="send-button"]').click()

  await expect(page.getByText('Hello!')).toBeVisible()
})
```

---

## Test Setup & Configuration

### Vitest Setup (Unit + Integration)

**Auto-mocks Anthropic SDK** to prevent accidental API calls:

```typescript
// apps/web/tests/setup.ts
import { vi } from 'vitest'

vi.mock('@anthropic-ai/claude-agent-sdk', async () => {
  return {
    query: vi.fn(() => {
      throw new Error("🚨 Anthropic SDK query() called in test without mocking!")
    })
  }
})
```

**Override when needed:**
```typescript
import { vi } from 'vitest'
import { query } from '@anthropic-ai/claude-agent-sdk'

it('should handle SDK', async () => {
  vi.mocked(query).mockResolvedValue({ result: { text: 'mocked' } })
  // Your test code
})
```

### Playwright Setup (E2E)

**Auto-protects against unmocked API calls:**

```typescript
// apps/web/tests/e2e/setup.ts
export const test = base.extend({
  page: async ({ page }, use) => {
    page.on('request', request => {
      if (request.url().includes('/api/claude/stream')) {
        if (!request.isInterceptResolutionHandled()) {
          throw new Error('🚨 Claude API not mocked! This will cost money!')
        }
      }
    })
    await use(page)
  }
})
```

**Always mock before navigation:**
```typescript
await page.route('**/api/claude/stream', handlers.text('response'))
await page.goto('/chat')  // Mock is registered
```

---

## Coverage Targets

```
Security functions:  100% (non-negotiable)
API routes:           70%
Business logic:       60%
UI components:        30%
Overall:              50%
```

Check coverage:
```bash
cd apps/web && bun test --coverage
```

---

## Debugging Tests

### Unit/Integration Tests

```bash
# Run with verbose output
bun test --reporter=verbose

# Run single test
bun test security.test.ts

# Use .only to focus on one test
it.only('should do something', () => {
  // Only this test runs
})

# Add console.log
it('test', () => {
  console.log('Debug:', value)
  expect(value).toBe(true)
})
```

### E2E Tests

```bash
# Run in headed mode (see browser)
bun run test:e2e:headed

# Run in debug mode (pause execution)
bun run test:e2e:debug

# View screenshots from failures
ls apps/web/test-results/*/test-failed-*.png

# View trace (timeline, network, console)
npx playwright show-trace apps/web/test-results/*/trace.zip

# Add page.pause() in test
test('debug', async ({ page }) => {
  await page.goto('/chat')
  await page.pause()  # Opens Playwright Inspector
})
```

---

## Common Issues

### "Anthropic SDK query() called in test"
**Cause**: Forgot to mock SDK in test that uses it
**Solution**: Override the global mock:
```typescript
vi.mocked(query).mockResolvedValue({ result: { text: 'mocked' } })
```

### "Port 9547 already in use"
**Cause**: Previous test server still running
**Solution**:
```bash
lsof -i :9547
kill -9 <PID>
```

### E2E test makes real API call
**Cause**: Forgot to mock before navigation
**Solution**: Always mock BEFORE `page.goto()`:
```typescript
await page.route('**/api/claude/stream', handler)  # Mock first
await page.goto('/chat')                          # Then navigate
```

### Tests pass locally, fail in CI
**Cause**: Missing environment variables
**Solution**: Add to CI:
```yaml
env:
  BRIDGE_ENV: local
  LOCAL_TEMPLATE_PATH: ${{ github.workspace }}/packages/template/user
```

---

## Before Committing

- [ ] All tests pass: `bun test && bun run test:e2e`
- [ ] No real API calls in tests (check logs for "🚨")
- [ ] Security functions have tests (100% coverage)
- [ ] New API routes have tests
- [ ] Critical business logic has tests
- [ ] Format code: `bun run format`
- [ ] Lint code: `bun run lint`

---

## Full Guides

For detailed information, see the full guides:

- **[Unit Testing Guide](./UNIT_TESTING.md)** - Testing individual functions with Vitest
- **[Integration Testing Guide](./INTEGRATION_TESTING.md)** - Testing components working together
- **[E2E Testing Guide](./E2E_TESTING.md)** - Testing user flows with Playwright

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Faker.js](https://fakerjs.dev/) - Generate test data
