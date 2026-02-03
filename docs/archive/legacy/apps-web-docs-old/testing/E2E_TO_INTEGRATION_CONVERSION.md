# E2E to Integration Test Conversion Plan

This document identifies E2E tests that should be converted to integration tests for faster execution and easier debugging.

## Conversion Candidates

### ✅ High Priority (Should Convert)

These tests primarily validate API behavior and should be integration tests:

#### 1. `e2e-tests/deploy.spec.ts`

**Current tests:**
- ✅ `deployment API rejects unauthenticated requests` - **CONVERT**
- ✅ `deployment API rejects requests without orgId` - **CONVERT**
- ❌ `deploy page shows authentication requirement` - Keep as E2E (UI validation)
- ❌ `can deploy with valid authentication and orgId - full flow` - Keep as E2E (full system test)

**Conversion:**
```typescript
// New file: app/api/deploy-subdomain/__tests__/route.test.ts
describe("POST /api/deploy-subdomain", () => {
  it("should reject unauthenticated requests", async () => {
    // Mock auth to return false
    // Call route handler directly
    // Verify 401 response
  })

  it("should reject requests without orgId", async () => {
    // Mock auth to return true
    // Call route handler with missing orgId
    // Verify 400 response
  })

  it("should validate slug format", async () => {
    // Test invalid slugs
  })

  it("should create deployment with valid inputs", async () => {
    // Mock successful deployment
    // Verify response structure
  })
})
```

**Benefits:**
- Faster execution: ~100ms vs ~2s
- Easier debugging: Direct function calls
- Better error messages: Exact assertion failures

---

### ⚠️ Medium Priority (Consider Converting)

These tests could be split - some parts as integration tests:

#### 2. `e2e-tests/protection-verification.spec.ts`

**Analysis needed**: Read file to determine if it's testing API protection or UI protection

**Action**: Review and potentially split into:
- Integration test: API endpoint protection
- E2E test: UI-level protection (if any)

---

#### 3. `e2e-tests/polling-only.spec.ts`

**Current test:**
- Polling for deployment status

**Recommendation**: Check if this can be an integration test that:
- Mocks the deployment process
- Tests polling logic directly

---

#### 4. `e2e-tests/concurrent-deploy.spec.ts`

**Current test:**
- Testing concurrent deployments

**Recommendation**:
- Could be integration test using parallel `fetch()` calls
- Tests race conditions in API, not UI

**Conversion:**
```typescript
// features/deployment/__tests__/concurrent-deployments.integration.test.ts
describe("Concurrent Deployments", () => {
  it("should handle concurrent requests to same slug", async () => {
    // Launch multiple fetch() calls in parallel
    // Verify only one succeeds
    // Verify others fail with appropriate error
  })

  it("should handle concurrent requests to different slugs", async () => {
    // Launch multiple fetch() calls in parallel
    // Verify all succeed
  })
})
```

---

### ❌ Keep as E2E (UI-Focused)

These tests validate user interactions and should remain E2E tests:

#### 5. `e2e-tests/auth.spec.ts`

**Reason**: Tests UI login flow (filling form, clicking button, navigation)

**Keep as E2E**: Yes, but could add integration tests for `/api/login` endpoint

---

#### 6. `e2e-tests/chat.spec.ts`

**Reason**: Tests chat UI interactions

**Keep as E2E**: Yes, core user experience

---

#### 7. `e2e-tests/org-workspace-selection.spec.ts`

**Reason**: Tests complex UI state management (dropdowns, selectors, error states)

**Keep as E2E**: Yes, but add integration tests for:
- `/api/auth/organizations` endpoint
- `/api/auth/workspaces` endpoint

**Add integration tests:**
```typescript
// app/api/auth/organizations/__tests__/route.test.ts
describe("GET /api/auth/organizations", () => {
  it("should return user organizations", async () => {
    // Create test user with orgs
    // Call endpoint
    // Verify org list
  })

  it("should require authentication", async () => {
    // Call without auth
    // Verify 401
  })

  it("should handle database errors", async () => {
    // Mock database error
    // Verify 500
  })
})

// app/api/auth/workspaces/__tests__/route.test.ts
describe("GET /api/auth/workspaces", () => {
  it("should return org workspaces", async () => {
    // Create test user with org and domains
    // Call endpoint with orgId
    // Verify workspace list
  })

  it("should filter by orgId", async () => {
    // Create multiple orgs with domains
    // Call endpoint with specific orgId
    // Verify only that org's workspaces returned
  })
})
```

---

#### 8. `e2e-tests/smoke.spec.ts`

**Reason**: Basic smoke test to verify site loads

**Keep as E2E**: Yes, critical health check

---

## Conversion Strategy

### Phase 1: Low-Hanging Fruit (Week 1)

1. ✅ Convert `deploy.spec.ts` API tests → `app/api/deploy-subdomain/__tests__/route.test.ts`
2. ✅ Add integration tests for `/api/auth/organizations`
3. ✅ Add integration tests for `/api/auth/workspaces`

**Expected impact:**
- 3 E2E tests → 10+ integration tests
- ~6s saved per test run
- Better error isolation

### Phase 2: Concurrent/Complex Tests (Week 2)

1. ✅ Review and convert `concurrent-deploy.spec.ts`
2. ✅ Review and convert `polling-only.spec.ts`
3. ✅ Review and convert `protection-verification.spec.ts`

**Expected impact:**
- 5+ E2E tests → 15+ integration tests
- ~15s saved per test run

### Phase 3: Maintenance (Ongoing)

**Rule**: For every new E2E test, ask:
1. "Is this testing API behavior?" → Integration test
2. "Is this testing UI interactions?" → E2E test
3. "Can I split this?" → Both

## Conversion Checklist

When converting an E2E test to integration test:

- [ ] Create new integration test file in `__tests__/` directory
- [ ] Mock external dependencies (auth, database)
- [ ] Use `createTestUser()` for real user data if needed
- [ ] Test both success and error cases
- [ ] Verify response status codes
- [ ] Verify response structure
- [ ] Add cleanup in `afterAll()`
- [ ] Run new integration test: `bun run test path/to/file.test.ts`
- [ ] Verify E2E test still passes (if not fully removed)
- [ ] Update E2E test to skip converted scenarios or delete if fully converted

## Benefits Summary

**Before conversion:**
- 15 E2E tests taking ~45s
- Hard to debug failures
- Flaky due to timing issues

**After conversion:**
- 5 E2E tests (UI-critical only) taking ~15s
- 30+ integration tests taking ~3s
- Total test time: ~18s (60% faster)
- Easier debugging
- More reliable CI/CD

## Files to Create

### New Integration Test Files

```
apps/web/
├── app/
│   └── api/
│       ├── deploy-subdomain/
│       │   └── __tests__/
│       │       ├── route.test.ts                    # NEW
│       │       └── concurrent-deploy.test.ts        # NEW
│       └── auth/
│           ├── organizations/
│           │   └── __tests__/
│           │       └── route.test.ts                # NEW
│           └── workspaces/
│               └── __tests__/
│                   └── route.test.ts                # NEW
```

### E2E Tests to Keep

```
e2e-tests/
├── auth.spec.ts              # Keep (UI login flow)
├── chat.spec.ts              # Keep (UI interactions)
├── org-workspace-selection.spec.ts  # Keep (complex UI state)
├── smoke.spec.ts             # Keep (health check)
└── deploy.spec.ts            # Reduce to UI-only tests
```

## Next Steps

1. ✅ Read this document
2. ✅ Review [TESTING_GUIDE.md](./TESTING_GUIDE.md) for patterns
3. ✅ Start with Phase 1 conversions
4. ✅ Measure before/after test execution times
5. ✅ Update CI/CD to run integration tests separately from E2E tests

## Questions?

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed examples and patterns.
