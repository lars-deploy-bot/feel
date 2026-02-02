# PR Spec: Fix Flaky Protection Verification E2E Test

## Status: Skipped (needs fix)

**File**: `apps/web/e2e-tests/protection-verification.spec.ts`
**Priority**: Medium (test is skipped, protection system still works)

## Problem

The "Layer 1: Catches unmocked calls at browser level" test times out waiting for the message input to become visible.

```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-testid="message-input"]')
Timeout: 10000ms (TEST_TIMEOUTS.slow)
```

## Failing Test

**`Layer 1: Catches unmocked calls at browser level`** (line 22)

## What the Test Does

1. Sets up a request monitor to track Claude API calls
2. Registers a route handler for `/api/claude/stream` BEFORE navigation
3. Navigates to chat using `gotoChatFast()`
4. Waits for message input to be visible
5. Types a message and sends it
6. Verifies the mocked response appears
7. Confirms no unmocked API calls leaked through

## Root Cause Analysis

### What the Subagent Found

The test was using hardcoded timeouts (2000ms, 8000ms) instead of the standardized `TEST_TIMEOUTS` constants. The subagent updated these to use proper timeout values:

```typescript
// Before
await expect(messageInput).toBeVisible({ timeout: 2000 })
await expect(sendButton).toBeEnabled({ timeout: 2000 })
await expect(page.getByText("Protected!")).toBeVisible({ timeout: 8000 })

// After (subagent fix)
await expect(messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.slow })
await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.medium })
await expect(page.getByText("Protected!")).toBeVisible({ timeout: TEST_TIMEOUTS.slow })
```

### Why It Still Fails

Even with `TEST_TIMEOUTS.slow` (10s local, 20s staging), the test times out. The issue is the same as tab-isolation tests:

1. **Chat readiness**: The page loads but chat isn't ready to send messages
2. **State hydration**: Zustand stores, Dexie session, and tab registration all need to complete
3. **No explicit ready signal**: The test has no reliable way to know when chat is truly ready

## Attempted Fixes

1. **Updated to `TEST_TIMEOUTS`** - Subagent changed hardcoded values to constants
2. **Added comments explaining timeout strategy** - For documentation

## Proposed Solution

### Option A: Use Same Fix as Tab Isolation

This test has the exact same problem as the tab-isolation tests. Apply the same fix:

```typescript
// Wait for chat to be fully ready
await waitForChatReady(page)

// Then proceed with test
await messageInput.fill("Test message")
// ...
```

Share the `waitForChatReady()` helper between test files.

### Option B: Add Pre-Check for Send Button

```typescript
// After navigation, wait for send button to exist and be enabled after typing
const input = page.locator('[data-testid="message-input"]')
const sendButton = page.locator('[data-testid="send-button"]')

// Wait for input to be interactive
await input.waitFor({ state: 'visible', timeout: TEST_TIMEOUTS.slow })
await input.fill("test")

// Wait for send button to be enabled (proves chat is ready)
await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.slow })

// Clear and proceed with actual test
await input.fill("")
```

### Option C: Skip Layer 1 Test Entirely

The protection system has multiple layers:
- **Layer 1**: Browser-level request monitoring (this test)
- **Layer 2**: Server-side blocking when `PLAYWRIGHT_TEST=true`

Layer 2 is already tested and works. Layer 1 is less critical because:
- It's a development/debugging aid
- Production doesn't have browser-level monitoring
- The real protection is server-side

We could remove this test and rely on Layer 2 testing.

## Current Test Code (with subagent changes)

```typescript
test.skip("Layer 1: Catches unmocked calls at browser level", async ({ authenticatedPage, workerTenant }) => {
  const apiCalls: string[] = []
  authenticatedPage.on("request", req => {
    if (req.url().includes("/api/claude")) {
      apiCalls.push(req.url())
    }
  })

  await authenticatedPage.route("**/api/claude/stream", handlers.text("Protected!"))
  await gotoChatFast(authenticatedPage, workerTenant.workspace, workerTenant.orgId)

  // Use TEST_TIMEOUTS.slow for primary wait (message input visibility)
  const messageInput = authenticatedPage.locator('[data-testid="message-input"]')
  await expect(messageInput).toBeVisible({ timeout: TEST_TIMEOUTS.slow })

  // Use TEST_TIMEOUTS.medium for secondary checks
  const sendButton = authenticatedPage.locator('[data-testid="send-button"]')
  await messageInput.fill("Hello test")
  await expect(sendButton).toBeEnabled({ timeout: TEST_TIMEOUTS.medium })

  await sendButton.click()

  // Use TEST_TIMEOUTS.slow for response wait
  await expect(authenticatedPage.getByText("Protected!")).toBeVisible({
    timeout: TEST_TIMEOUTS.slow,
  })

  // Verify our mock was hit (Layer 1 allowed it through)
  expect(apiCalls.some(url => url.includes("/api/claude/stream"))).toBe(true)
})
```

## Test Environment Details

- **Local**: May pass (faster initialization)
- **Staging**: Fails (slower hydration, parallel workers)
- **Timeout**: 10s local / 20s staging (`TEST_TIMEOUTS.slow`)

## Files to Modify

1. `apps/web/e2e-tests/protection-verification.spec.ts` - Fix the test
2. `apps/web/e2e-tests/helpers/index.ts` - Add shared `waitForChatReady()` helper (if Option A)

## Relationship to Tab Isolation Tests

This test fails for the **exact same reason** as the tab-isolation tests. The fix should be coordinated:

1. Create a shared `waitForChatReady()` helper
2. Use it in both test files
3. Consider adding a `[data-chat-ready]` attribute to the UI

## Validation

1. Test passes locally: `bun run test:e2e --grep "Protection System"`
2. Test passes on staging: Run full E2E suite
3. No flakiness: Run 5+ times consecutively

## References

- [Fix Tab Isolation E2E Tests PR Spec](./fix-tab-isolation-e2e-tests.md) - Related issue
- [E2E Test Flakiness Postmortem](../docs/postmortems/2025-11-30-e2e-test-flakiness.md)
