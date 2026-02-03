# Postmortem: E2E Test Flakiness (2025-11-30)

## Summary

E2E tests were flaky, failing intermittently on consecutive runs. Tests would pass individually but fail when run as part of the full suite, especially on the 2nd or 3rd consecutive run.

## Impact

- CI/CD unreliable - tests would randomly fail
- Developer frustration - "it works on my machine" syndrome
- False confidence - tests marked as "flaky" were being ignored

## Root Cause

**Multiple issues compounding:**

1. **Short timeouts for workspace hydration** - Tests used 5000ms timeouts for `workspace-ready` element, but under parallel load (4 workers), hydration could take 10-15 seconds.

2. **Unnecessary UI dependencies** - The "Layer 2: Server blocks API calls" test navigated to `/chat` and waited for workspace-ready, but it only needed to make an API call - no UI required.

3. **Sequential timeout accumulation** - Tests waited for Element A (15s), then Element B (10s), then Element C (5s). If A took 14s, B took 9s, and C took 8s, total = 31s > 30s test timeout.

4. **No retry mechanism** - Single failures caused entire CI to fail.

## Timeline

1. Tests started failing intermittently after adding parallel workers
2. Added `retries: 1` to Playwright config - masked the problem but didn't fix it
3. Identified specific flaky tests: `org-workspace-selection.spec.ts` and `protection-verification.spec.ts`
4. Root cause analysis revealed timeout issues

## Resolution

### 1. Simplified Layer 2 Test
```typescript
// BEFORE: Unnecessary UI navigation
test("Layer 2: Server blocks calls", async ({ page, tenant }) => {
  await login(page, tenant)
  await page.goto("/chat")  // NOT NEEDED
  await expect(page.locator('[data-testid="workspace-ready"]')).toBeAttached({
    timeout: 15000,  // Flaky under load
  })
  // Make API call...
})

// AFTER: Just auth + API call
test("Layer 2: Server blocks calls", async ({ page, tenant }) => {
  await login(page, tenant)
  // Make API call directly - no UI needed
  const response = await page.evaluate(async () => {
    const res = await fetch("/api/claude/stream", {...})
    return { status: res.status, body: await res.json() }
  })
  expect(response.status).toBe(403)
})
```

### 2. Fixed Timeout Strategy
```typescript
// BEFORE: Sequential waits accumulate
await expect(messageInput).toBeVisible({ timeout: 15000 })
// ... other code ...
await expect(workspaceReady).toBeAttached({ timeout: 10000 })
// ... other code ...
await expect(sendButton).toBeEnabled({ timeout: 10000 })
// Total potential: 35s > 30s test timeout

// AFTER: Primary wait first, then short confirmations
await expect(messageInput).toBeVisible({ timeout: 20000 })  // Primary indicator
await expect(workspaceReady).toBeAttached({ timeout: 5000 }) // Should be ready by now
await expect(sendButton).toBeEnabled({ timeout: 5000 })      // Quick confirmation
```

### 3. Merged Redundant Tests
Combined two tests in `org-workspace-selection.spec.ts` into one, reducing:
- Login calls (expensive)
- Page navigations (expensive)
- Parallel resource contention

### 4. Use `toBeAttached` vs `toBeVisible`
```typescript
// BEFORE: Checks visibility (slower, stricter)
await expect(workspaceReady).toBeVisible({ timeout: 5000 })

// AFTER: Just checks DOM presence (faster)
await expect(workspaceReady).toBeAttached({ timeout: 5000 })
```

## Key Lessons

### 1. Tests Should Only Wait for What They Need
The Layer 2 test was waiting for the chat UI to fully load just to make a simple API call. **Ask: "What does this test actually need?"**

### 2. Timeouts Should Account for Parallel Execution
With 4 parallel workers hitting the same server:
- Page loads take 2-3x longer
- Database operations queue up
- Memory pressure increases

**Rule of thumb:** If a single test needs 5s, budget 15s in parallel.

### 3. Avoid Timeout Accumulation
```
BAD:  wait(15s) + wait(10s) + wait(10s) = 35s potential
GOOD: wait(20s) + wait(5s) + wait(5s) = 30s potential
```

Put the longest wait first (for the primary element), then use short waits for things that should already be ready.

### 4. `toBeAttached` vs `toBeVisible`
- `toBeAttached`: Element exists in DOM (fast)
- `toBeVisible`: Element visible on screen (slow - checks CSS, layout, etc.)

Use `toBeAttached` when you just need the element to exist.

### 5. Don't Mask Flakiness with Retries
Retries are a safety net, not a solution. If tests need retries to pass, find and fix the root cause.

## Prevention

1. **Code Review Checklist:**
   - [ ] Test timeouts account for parallel execution
   - [ ] Tests wait only for what they actually need
   - [ ] No unnecessary page navigations
   - [ ] Use `toBeAttached` when visibility isn't required

2. **Test Design Principles:**
   - API tests shouldn't depend on UI state
   - UI tests should wait for one primary element, then quick-check others
   - Merge related tests to reduce setup overhead

3. **Monitoring:**
   - Track flaky test rate in CI
   - Investigate any test that needs retries to pass

## Files Changed

- `apps/web/e2e-tests/protection-verification.spec.ts` - Fixed timeouts, removed unnecessary UI wait
- `apps/web/e2e-tests/org-workspace-selection.spec.ts` - Merged tests, fixed timeout strategy
- `apps/web/playwright.config.ts` - Added retries as safety net

## Related Documentation

- `apps/web/e2e-tests/README.md` - E2E test architecture
- `apps/web/e2e-tests/IMPROVEMENTS.md` - Performance recommendations
