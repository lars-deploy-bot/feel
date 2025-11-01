# Testing Setup - Unit & E2E

> **Goal**: Clean testing setup with unit tests (Vitest) and e2e tests (Playwright). Inspired by lucky-1 and Mastra.

---

## Testing Strategy

### Unit Tests (Vitest)
- **Purpose**: Test individual functions, utilities, components
- **Files**: `*.test.ts` or `*.test.tsx`
- **Location**: Next to source files (e.g., `lib/__tests__/`)
- **Speed**: Very fast (<1s for 4 tests)

### E2E Tests (Playwright)
- **Purpose**: Test complete user flows in browser
- **Files**: `*.spec.ts`
- **Location**: `apps/web/tests/e2e/`
- **Speed**: ~4-5s for full suite (4 tests)

---

## Unit Testing (Vitest)

### Installation

```bash
bun add -D vitest vite-tsconfig-paths @testing-library/react happy-dom
```

### Configuration

**apps/web/vitest.config.ts:**
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

**apps/web/tests/setup.ts:**
```typescript
import { vi } from 'vitest'

process.env.TZ = 'UTC'
process.env.BRIDGE_ENV = 'local'
// Note: NODE_ENV is read-only in Vitest, set via vitest.config.ts instead

// SAFETY: Mock Anthropic SDK to prevent real API calls
vi.mock('@anthropic-ai/claude-agent-sdk', async () => {
  const actual = await vi.importActual('@anthropic-ai/claude-agent-sdk')
  return {
    ...actual,
    query: vi.fn(() => {
      throw new Error(
        '🚨 Anthropic SDK query() called in test without mocking!\n' +
        'This would make a REAL API call and cost money.'
      )
    }),
  }
})
```

### Run Tests

```bash
bun run test          # Run once
bun run test:watch    # Watch mode
bun run test:ui       # Visual UI
```

### 🔒 API Safety Mechanism

**The setup automatically blocks all real Anthropic API calls!**

```typescript
// This will THROW an error instead of making a real API call
import { query } from '@anthropic-ai/claude-agent-sdk'
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

---

## E2E Testing (Playwright)

### What We're Testing

1. ✅ Homepage loads with login form
2. ✅ Login works with test/test credentials
3. ✅ Chat interface renders correctly
4. ✅ Can send a message

### Installation

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

### Configuration

**apps/web/playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test'

const TEST_PORT = '9547' // Different from production (8999)
const BASE_URL = `http://localhost:${TEST_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  webServer: {
    command: 'bun run dev:test',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
```

### Test Structure

```
apps/web/
├── tests/
│   ├── setup.ts              # Vitest global setup
│   └── e2e/
│       ├── setup.ts          # Playwright fixture with API blocking
│       ├── smoke.spec.ts     # Homepage test
│       ├── auth.spec.ts      # Login tests
│       ├── chat.spec.ts      # Chat interface tests
│       └── helpers.ts        # Shared helpers (login)
└── playwright.config.ts
```

---

## Test Examples

### 1. Homepage (smoke.spec.ts)

```typescript
import { test, expect } from './setup'

test('homepage loads', async ({ page }) => {
  await page.goto('/')

  // Check login form elements (using getByPlaceholder is fine for login page)
  await expect(page.getByPlaceholder('domain (e.g. demo.goalive.nl)')).toBeVisible()
  await expect(page.getByPlaceholder('passcode')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ENTER' })).toBeVisible()
})
```

### 2. Authentication (auth.spec.ts)

```typescript
import { test, expect } from './setup'

test('can login with test credentials', async ({ page }) => {
  await page.goto('/')

  await page.getByPlaceholder('domain (e.g. demo.goalive.nl)').fill('test')
  await page.getByPlaceholder('passcode').fill('test')
  await page.getByRole('button', { name: 'ENTER' }).click()

  await expect(page).toHaveURL('/chat')

  // Use data-testid for chat page elements
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
})
```

### 3. Chat (chat.spec.ts)

```typescript
import { test, expect, mockClaudeStream } from './setup'
import { login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
})

test('has chat interface', async ({ page }) => {
  await page.goto('/chat')

  // Use data-testid for stable selectors (Mastra's approach)
  await expect(page.locator('[data-testid="message-input"]')).toBeVisible()
  await expect(page.locator('[data-testid="new-chat-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="send-button"]')).toBeVisible()
})

test('can send a message and receive response', async ({ page }) => {
  await page.goto('/chat')

  // CRITICAL: Mock the API BEFORE sending message
  await mockClaudeStream(page, {
    message: 'Hi there! How can I help you today?'
  })

  // Use data-testid for stable selectors
  const messageInput = page.locator('[data-testid="message-input"]')
  const sendButton = page.locator('[data-testid="send-button"]')

  await messageInput.fill('Hello')
  await sendButton.click()

  // User message appears immediately
  await expect(page.getByText('Hello')).toBeVisible()

  // AI response appears after stream completes
  await expect(page.getByText(/Hi there.*help you today/)).toBeVisible({
    timeout: 5000
  })
})
```

### 4. Helper (helpers.ts)

```typescript
import { Page } from '@playwright/test'

export async function login(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('domain (e.g. demo.goalive.nl)').fill('test')
  await page.getByPlaceholder('passcode').fill('test')
  await page.getByRole('button', { name: 'ENTER' }).click()
  await page.waitForURL('/chat', { timeout: 5000 })
}
```

---

## 🔒 E2E API Safety & Mocking

**CRITICAL UNDERSTANDING**:

⚠️ **Automatic API blocking is impossible** in this architecture because:
1. Browser → Next.js API (`/api/claude/stream`) → **Server-side** Anthropic API
2. Playwright can only intercept browser requests, not Node.js server-side calls
3. **You MUST manually mock** `/api/claude/stream` in every test that sends messages

**apps/web/tests/e2e/setup.ts** provides mock utilities (NOT automatic blocking):

```typescript
import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  page: async ({ page }, use) => {
    // No automatic blocking - use mockClaudeStream() in your tests
    await use(page)
  },
})
```

**⚠️ If you forget to call `mockClaudeStream()`, your test WILL hit the real Anthropic API and cost money.**

### Mock Utilities

**mockClaudeStream(page, options)** - Mock successful AI responses:

```typescript
import { test, expect, mockClaudeStream } from './setup'

test('can send message', async ({ page }) => {
  // MUST call this BEFORE sending message
  await mockClaudeStream(page, {
    message: 'Hi there! How can I help you today?',
    delay: 100 // Optional delay in ms
  })

  // Use data-testid for stable selectors
  await page.locator('[data-testid="message-input"]').fill('Hello')
  await page.locator('[data-testid="send-button"]').click()

  await expect(page.getByText('Hi there!')).toBeVisible()
})
```

**mockClaudeStreamError(page, message)** - Mock API errors:

```typescript
await mockClaudeStreamError(page, 'Connection timeout')
// Test error handling
```

### Import Requirements

**⚠️ CRITICAL:** All e2e tests MUST:
1. Import from `./setup` (not `@playwright/test`)
2. Call `mockClaudeStream()` BEFORE sending any messages

```typescript
// ❌ WRONG - Will make real API calls ($$$)
import { test, expect } from '@playwright/test'
test('send message', async ({ page }) => {
  await page.locator('[data-testid="send-button"]').click()
  // 💸 Just spent money on real Anthropic API!
})

// ✅ CORRECT - Mocked API
import { test, expect, mockClaudeStream } from './setup'
test('send message', async ({ page }) => {
  await mockClaudeStream(page, { message: 'response' })
  await page.locator('[data-testid="send-button"]').click()
  // ✅ Safe, uses mock
})
```

---

## Environment Setup

**apps/web/.env.local** (for local dev):
```bash
BRIDGE_ENV=local
LOCAL_TEMPLATE_PATH=/path/to/template
```

This enables `test/test` credentials for testing.

---

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo -p 8999",
    "dev:test": "next dev --turbo -p 9547",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## Running Tests

### Locally

```bash
# Unit tests
bun run test
bun run test:watch

# E2E tests (starts dev server on 9547 automatically)
bun run test:e2e
bun run test:e2e:ui        # Visual UI
bun run test:e2e:headed    # See browser
bun run test:e2e:debug     # Step-through debugger
```

### On Hetzner (Pre-Deploy Testing)

Production runs on port **8999**, tests run on port **9547** (no conflicts).

```bash
# SSH into server
ssh root@your-server.com
cd /root/webalive/claude-bridge

# Pull latest
bun run pull

# Install Playwright browsers (first time only)
cd apps/web
bunx playwright install chromium

# Run tests (won't interfere with production)
bun run test:e2e

# If tests pass, deploy
cd /root/webalive/claude-bridge
bun run deploy
```

---

## Test Results

### Current Status

✅ **Unit Tests**: 4 passing in <300ms
- 2 example tests (basic assertions)
- 2 API safety verification tests

✅ **E2E Tests**: 4 passing in ~4-5s
- Homepage loads
- Login with test credentials
- Chat interface renders
- Send message works

### File Organization

```
apps/web/
├── lib/
│   └── __tests__/
│       ├── example.test.ts              # Unit tests
│       └── anthropic-safety.test.ts     # Safety verification
├── tests/
│   ├── setup.ts                         # Vitest global setup
│   └── e2e/
│       ├── setup.ts                     # Playwright fixtures
│       ├── smoke.spec.ts                # E2E tests
│       ├── auth.spec.ts
│       ├── chat.spec.ts
│       └── helpers.ts
├── vitest.config.ts                     # Unit test config
└── playwright.config.ts                 # E2E test config
```

### Clean Separation

- **`.test.ts`** = Unit tests (fast, Vitest)
- **`.spec.ts`** = E2E tests (slower, Playwright)
- No conflicts, both run independently

---

## When Things Go Wrong

See **[TESTING_FAILURE_MODES.md](./TESTING_FAILURE_MODES.md)** for comprehensive troubleshooting:

- Port conflicts
- Environment issues
- Timing and race conditions
- Session/cookie problems
- Browser crashes
- Hetzner-specific problems
- And more...

### Quick Fixes

```bash
# Port already in use
lsof -i :9547
kill -9 <PID>

# Reset everything
rm -rf node_modules test-results playwright-report .next
bun install
bunx playwright install chromium

# Kill stuck processes
pkill -f "next dev"
pkill -f playwright
```

---

## Summary

This setup provides:
- ⚠️ **Manual mocking required** - Must call `mockClaudeStream()` in every test (automatic blocking is impossible)
- ✅ **Fast tests** - Unit tests <1s, E2E ~5s
- ✅ **Port isolation** - Tests (9547) don't conflict with production (8999)
- ✅ **Clean separation** - `.test.ts` vs `.spec.ts`
- ✅ **Stable selectors** - Using `data-testid` attributes (Mastra's approach)
- ✅ **Comprehensive docs** - Failure modes documented

### Data-testid Attributes

**Available in chat interface:**
- `[data-testid="message-input"]` - Message textarea
- `[data-testid="send-button"]` - Send message button
- `[data-testid="stop-button"]` - Stop streaming button
- `[data-testid="new-chat-button"]` - New conversation button
- `[data-testid="photos-button"]` - Photos button

**Inspired by lucky-1's safety patterns and Mastra's stable selector approach.**
