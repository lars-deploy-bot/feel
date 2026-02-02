# PR Spec: Fix Flaky Tab Isolation E2E Tests

## Status: Skipped (needs fix)

**File**: `apps/web/e2e-tests/tab-isolation.spec.ts`
**Priority**: Medium (tests are skipped, functionality still works)

## Problem

The tab isolation E2E tests are consistently timing out on staging. All 3 tests fail with the same pattern:

```
Error: expect(locator).toBeEnabled() failed
Locator: locator('[data-testid="send-button"]')
Expected: enabled
Received: disabled
Timeout: 30000ms
```

## Failing Tests

1. **`different tabs send different tabIds to the API`** (line 82)
2. **`switching tabs preserves each tab's tabId`** (line 137)
3. **`tabId in request matches UUID format`** (line 201)

## Root Cause Analysis

### What the Subagent Found

The tests use a `waitForChatReady()` helper that:
1. Fills the message input with "test"
2. Waits for send button to become enabled
3. Clears the input

The send button stays disabled because `isReady` never becomes true. This requires:
- Dexie session initialized
- Active tab set
- Workspace loaded

### Why It Fails on Staging

1. **Hydration timing**: The chat page hydration takes longer on staging due to network latency and server load
2. **Parallel execution**: 4 workers compete for resources, causing delays
3. **State initialization order**: The Zustand stores need to hydrate from localStorage, Dexie needs to initialize, and the tab must be registered - all async

### Current Workaround

Tests are skipped with `test.skip()` and TODO comments.

## Attempted Fixes (Did Not Work)

1. **Increased timeouts to `TEST_TIMEOUTS.max` (30s)** - Still times out
2. **Changed wait strategy from `chatReady` selector to `sendButton.toBeEnabled()`** - Same result
3. **Fill input before checking button** - Didn't help

## Proposed Solution

### Option A: Wait for Network Idle + State

```typescript
async function waitForChatReady(page: Page) {
  // Wait for all initial network requests to complete
  await page.waitForLoadState('networkidle')

  // Wait for Dexie to initialize (check for session in IndexedDB)
  await page.waitForFunction(() => {
    return window.indexedDB.databases().then(dbs =>
      dbs.some(db => db.name?.includes('dexie'))
    )
  }, { timeout: TEST_TIMEOUTS.max })

  // Then check send button
  const input = page.locator(TEST_SELECTORS.messageInput)
  const sendButton = page.locator(TEST_SELECTORS.sendButton)
  await input.fill("test")
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })
  await input.fill("")
}
```

### Option B: Expose Ready State via Data Attribute

Add a data attribute to the chat container that indicates full readiness:

```tsx
// In ChatPage component
<div data-chat-ready={isReady && hasActiveTab && dexieInitialized}>
```

Then wait for it:
```typescript
await page.locator('[data-chat-ready="true"]').waitFor({
  timeout: TEST_TIMEOUTS.max
})
```

### Option C: Mock Dexie Initialization

Skip Dexie entirely in tests by mocking the session store:
```typescript
await page.addInitScript(() => {
  window.__TEST_SKIP_DEXIE__ = true
})
```

## Test Environment Details

- **Local**: Tests pass (faster hydration, no network latency)
- **Staging**: Tests fail (slower hydration, 4 parallel workers)
- **Timeout**: 30 seconds (`TEST_TIMEOUTS.max`)

## Files to Modify

1. `apps/web/e2e-tests/tab-isolation.spec.ts` - Fix the tests
2. `apps/web/e2e-tests/fixtures/test-data.ts` - Possibly add new selectors
3. `apps/web/features/chat/components/ChatPage.tsx` - Possibly add ready state attribute

## Validation

1. Tests pass locally: `bun run test:e2e --grep "Tab Isolation"`
2. Tests pass on staging: Run full E2E suite via `make staging`
3. No flakiness: Run tests 5+ times consecutively

## References

- [E2E Test Flakiness Postmortem](../docs/postmortems/2025-11-30-e2e-test-flakiness.md)
- [Test Timeouts Documentation](../apps/web/e2e-tests/fixtures/test-data.ts)
