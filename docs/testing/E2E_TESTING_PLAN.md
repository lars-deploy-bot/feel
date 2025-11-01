# Testing Plan - Unit & E2E Tests

> **Goal**: Clean testing setup with unit tests (Vitest) and e2e tests (Playwright). Inspired by lucky-1 and Mastra.

---

## Testing Strategy

### Unit Tests (Vitest)
- **Purpose**: Test individual functions, utilities, components
- **Files**: `*.test.ts` or `*.test.tsx`
- **Location**: Next to source files (e.g., `lib/__tests__/`)
- **Speed**: Very fast (<1s)

### E2E Tests (Playwright)
- **Purpose**: Test complete user flows in browser
- **Files**: `tests/e2e/*.spec.ts`
- **Location**: `apps/web/tests/e2e/`
- **Speed**: Slower (~4s for full suite)

---

## Unit Testing Setup (Vitest)

### Install

```bash
bun add -D vitest vite-tsconfig-paths @testing-library/react happy-dom
```

### Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
  },
})
```

**tests/setup.ts:**
```typescript
process.env.TZ = 'UTC'
process.env.BRIDGE_ENV = 'local'
process.env.NODE_ENV = 'test'
```

### Example Test

**lib/__tests__/example.test.ts:**
```typescript
import { describe, it, expect } from 'vitest'

describe('example test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2)
  })
})
```

### Run Unit Tests

```bash
# Run once
bun run test

# Watch mode (re-runs on file changes)
bun run test:watch

# UI mode (visual test runner)
bun run test:ui
```

### SAFETY: Anthropic API Protection

**The test setup automatically blocks all real Anthropic API calls!**

Inspired by lucky-1's safety pattern, all tests have the Anthropic SDK mocked by default:

```typescript
// tests/setup.ts automatically mocks this
import { query } from '@anthropic-ai/claude-agent-sdk'

// This will THROW an error instead of making a real API call
query({ prompt: 'test' }) // 🚨 Error: Would make REAL API call!
```

**Why?**
- Prevents accidental API calls that cost money 💸
- Forces explicit mocking in tests
- Makes tests fast and deterministic
- No network dependencies

**Verify it works:**
```bash
bun run test anthropic-safety
```

This test verifies the safety mechanism is active.

---

## E2E Testing Setup (Playwright)

### What We're Testing

1. ✅ Login works
2. ✅ Can send a message and see a response
3. ✅ Chat interface loads
4. ✅ Basic user flows

---

## Playwright Setup

### Install Playwright

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

### playwright.config.ts

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:8999',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:8999',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

### Test Structure

```
apps/web/
├── tests/
│   └── e2e/
│       ├── auth.spec.ts          # Login tests
│       ├── chat.spec.ts          # Basic chat tests
│       └── helpers.ts            # Simple login helper
└── playwright.config.ts
```

---

## Tests

### 1. Authentication (auth.spec.ts)

```typescript
import { test, expect } from '@playwright/test'

test('can login with test credentials', async ({ page }) => {
  await page.goto('/')

  // In local dev mode, use test/test
  await page.fill('input[name="workspace"]', 'test')
  await page.fill('input[name="passcode"]', 'test')
  await page.click('button[type="submit"]')

  // Should redirect to chat
  await expect(page).toHaveURL('/chat')
})

test('chat page requires authentication', async ({ page }) => {
  await page.goto('/chat')

  // Should redirect to login
  await expect(page).toHaveURL('/')
})
```

### 2. Basic Chat (chat.spec.ts)

```typescript
import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('has chat interface', async ({ page }) => {
  await page.goto('/chat')

  // Check basic elements exist
  await expect(page.locator('textarea')).toBeVisible()
  await expect(page.locator('button:has-text("Send")')).toBeVisible()
})

test('can send a message', async ({ page }) => {
  await page.goto('/chat')

  const textarea = page.locator('textarea')
  await textarea.fill('Hello')
  await page.click('button:has-text("Send")')

  // User message should appear
  await expect(page.getByText('Hello')).toBeVisible()
})

test('new conversation button works', async ({ page }) => {
  await page.goto('/chat')

  // Send a message first
  await page.fill('textarea', 'Test message')
  await page.click('button:has-text("Send")')

  // Click new conversation
  const newConvButton = page.locator('button:has-text("New Conversation")')
  if (await newConvButton.isVisible()) {
    await newConvButton.click()

    // Messages should be cleared
    await expect(page.getByText('Test message')).not.toBeVisible()
  }
})
```

### 3. Helpers (helpers.ts)

```typescript
import { Page } from '@playwright/test'

export async function login(page: Page) {
  await page.goto('/')
  await page.fill('input[name="workspace"]', 'test')
  await page.fill('input[name="passcode"]', 'test')
  await page.click('button[type="submit"]')
  await page.waitForURL('/chat')
}
```

---

## Environment Setup

For local dev mode, set in `.env.local`:

```bash
BRIDGE_ENV=local
LOCAL_TEMPLATE_PATH=/path/to/template
```

This enables `test/test` credentials.

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo -p 8999",
    "dev:test": "next dev --turbo -p 9547",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## Running Tests

### Locally (Development)

```bash
# Run all tests (starts dev server on port 9000 automatically)
bun run test:e2e

# Run with UI
bun run test:e2e:ui

# Run in headed mode (see browser)
bun run test:e2e:headed

# Debug mode
bun run test:e2e:debug
```

### On Hetzner Server (Pre-Deploy Testing)

Since production runs on port 8999, tests run on port 9547 to avoid conflicts:

```bash
# SSH into Hetzner
ssh root@your-server.com

# Navigate to project
cd /root/webalive/claude-bridge

# Pull latest changes
bun run pull

# Install dependencies (if needed)
bun install

# Install Playwright browsers (first time only)
cd apps/web
bunx playwright install chromium

# Run tests (uses port 9547, won't interfere with production on 8999)
bun run test:e2e

# If tests pass, deploy
cd /root/webalive/claude-bridge
bun run deploy
```

**Key Points:**
- Production runs on port `8999`
- Tests run on port `9547` (configured in `playwright.config.ts`)
- The `dev:test` script starts Next.js on port 9547
- Playwright automatically starts/stops the test server
- No need to stop production to run tests

---

## CI/CD (Optional)

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bunx playwright install --with-deps chromium
      - run: bun run test:e2e
```

---

## Summary

### Unit Tests (Vitest)
- ✅ **2 tests passing** in <1s
- Location: `lib/__tests__/example.test.ts`
- Run: `bun run test`

### E2E Tests (Playwright)
- ✅ **4 tests passing** in ~4s
- Location: `tests/e2e/`
- Run: `bun run test:e2e`

### Test Organization

```
apps/web/
├── lib/
│   └── __tests__/
│       └── *.test.ts              # Unit tests (Vitest)
├── tests/
│   ├── setup.ts                   # Vitest global setup
│   └── e2e/
│       ├── smoke.spec.ts          # Playwright e2e tests
│       ├── auth.spec.ts
│       ├── chat.spec.ts
│       └── helpers.ts
├── vitest.config.ts               # Unit test config
└── playwright.config.ts           # E2E test config
```

### Clean Separation

- **`.test.ts`** = Unit tests (fast, run with Vitest)
- **`.spec.ts`** = E2E tests (slower, run with Playwright)
- No conflicts, both can run independently

This follows the same clean pattern as lucky-1 but simplified for Claude Bridge's needs.

---

## When Things Go Wrong

**See [TESTING_FAILURE_MODES.md](./TESTING_FAILURE_MODES.md)** for comprehensive troubleshooting guide covering:

- Port conflicts
- Environment variable issues
- Timing and race conditions
- Session/cookie problems
- File system errors
- Browser crashes
- Network issues
- CI/CD failures
- Hetzner-specific problems

**Common quick fixes:**
```bash
# Port already in use
lsof -i :9547
kill -9 <PID>

# Reset everything
rm -rf node_modules test-results .next
bun install
bunx playwright install chromium

# Kill stuck processes
pkill -f "next dev"
pkill -f playwright
```
