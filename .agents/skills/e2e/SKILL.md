---
name: e2e
description: "Write strict zero-mock E2E tests: real backend flows only, shared type reuse only, and no hand-written mock payloads."
---

# E2E (Zero-Mock, Zero-Drift Protocol)

Use this skill when writing or refactoring E2E tests.

## Mission

Ship E2E tests that fail only for real product regressions.

If a test can pass with fake behavior, it is not E2E.

## Absolute Rules (Non-Negotiable)

1. **No endpoint mocks in E2E specs.**
2. **No `page.route`/`route.fulfill` for product APIs.**
3. **No hand-written response shapes when production contracts exist.**
4. **No `as any`, no contract casts, no test-local duplicate API contracts.**
5. **No internal-state assertions (localStorage/sessionStorage/Zustand) unless persistence itself is the feature under test.**
6. **No `waitForTimeout` as readiness synchronization.**

If any rule is violated, reject the test.

## Environment Preflight (Required Before Writing Assertions)

Run this decision first:

1. Is this behavior executable in target env with real product APIs?
2. If yes, write pure zero-mock E2E.
3. If no, is there a **test-only setup endpoint** (seed/cleanup) to establish real state?
4. If no setup path exists, add one server-side; do not fall back to mocks.
5. If target env lacks the test-only endpoint, the spec must `skip` with an explicit reason.

Never silently degrade to mocked behavior.

## Setup Hierarchy (Strict Order)

1. Real product APIs and UI flows.
2. Test-only setup APIs for deterministic data seeding/cleanup.
3. Shared fixture infrastructure only (auth/bootstrap harness).

Spec-level mocks for product behavior are forbidden.

## Zero-Mock Policy

### Forbidden

- Mocking `/api/*` endpoints in E2E scenarios.
- Faking success paths with static route payloads.
- Proving behavior via fake counters from mocked routes.
- Intercepting product requests to mutate behavior (`route.fulfill`, `route.abort`, `route.continue` with rewrites).

### Required

- Use real backend and real app flows.
- Seed state through real setup APIs/fixtures/global setup (real DB state, no fake transport payloads).
- Assert user-visible outcomes from real system behavior.

### Exception policy

Only external third-party dependencies outside product control may be stubbed, and only when both are true:

1. The test is explicitly tagged/in a suite for third-party isolation.
2. The same behavior is still covered in a separate zero-mock E2E.

No exception for core product APIs.

## Contract and Type Reuse Policy (Strict)

Agents are usually weakest here. Enforce this:

1. Reuse production schemas/types at every API boundary.
2. If type is missing, export it from production code first, then reuse in tests.
3. Use `satisfies` for fixture objects.
4. Never create duplicate test-only interfaces for API contracts that already exist.
5. Parse/validate external JSON with shared schemas when available.

### Forbidden type patterns

- `const payload = { ... } as SomeType`
- `as any`
- `unknown as ContractType`
- `type FakeApiResponse = { ... }` when real type exists
- Copy-pasting schema fields into tests

### Required patterns

```ts
import type { Req, Res } from "@/lib/api/schemas"
import { apiSchemas, validateRequest } from "@/lib/api/schemas"

const body: Req<"automations/create"> = validateRequest("automations/create", {
  /* fields */
})

const payload = apiSchemas["automations/create"].res.parse(await response.json())
```

If production module does not export a reusable type, fix production first.

## Test Design Contract (Write Before Code)

Document in test comments:

- Trigger:
- Expected user-visible outcome:
- Negative boundary:
- Completion signal:

If this cannot be stated clearly, do not write the test yet.

## Observability Rules

Allowed:

- `page.on("request")` / `page.on("response")` for counting/verifying real traffic.
- Request/response assertions on real network calls.

Forbidden:

- Any interception that changes product API behavior.
- "Proof" based only on test-maintained counters disconnected from real transport events.

## Selector Standard

Preferred selector order:

1. `getByRole(..., { name })`
2. `data-testid`
3. visible text (only if stable product copy)

Avoid layout/CSS-structure selectors.

## Async Standard

- Use shared timeouts (`TEST_TIMEOUTS`).
- Use `expect(...).toBe...` on explicit UI readiness markers.
- Use `expect.poll` only for real observable progression from the real system.
- Do not stack long waits; assert the longest readiness condition first, then fast confirmations.
- Avoid timeout accumulation from redundant waits.

## Polling/Streaming Standard

To prove background behavior without mocks:

1. Complete user setup interactions.
2. Capture baseline observable state.
3. Stop user interaction.
4. Assert real additional progress during idle window.

If progress requires more clicking, mechanism proof failed.

## Data Setup Standard

Use deterministic setup via existing fixtures/global setup. Avoid ad hoc mutation.

- Fixed IDs where possible.
- Fixed baseline timestamps where relevant.
- Explicit cleanup in `finally` for every resource created by the test.
- Resource naming must be collision-safe under parallel workers.
- Cleanup must be idempotent (safe if partially failed or rerun).

## Assertion Quality Bar

Each E2E test must include all three:

1. **User-visible positive assertion** (what user sees/does).
2. **Transport/mechanism assertion** (real request/response behavior).
3. **Negative assertion** (what must not happen: endpoint errors, wrong state, duplicate action, etc.).

## Failure Taxonomy (Required in Errors/Comments)

When failing or skipping, classify clearly:

1. Environment/setup unavailable.
2. Test bug.
3. Product regression.
4. External dependency instability.

Never blur these categories.

## Drift Traps (Reject Immediately)

- "Mock now, replace later."
- "Small inline interface for convenience."
- "Cast to unblock quickly."
- "Sleep 2s to stabilize."
- "Assert localStorage because UI is hard."

## Review Gate (Must Pass, No Exceptions)

- [ ] Zero endpoint mocks in spec.
- [ ] No product API interception/mutation.
- [ ] No test-local duplicate API types.
- [ ] No `as any` or contract-casts for payloads.
- [ ] Uses production-exported types or exported new ones.
- [ ] Preflight path documented (real-only or explicit test-seed endpoint).
- [ ] At least one positive user-visible assertion.
- [ ] At least one transport/mechanism assertion.
- [ ] At least one negative assertion.
- [ ] No internal-state assertions unless persistence is the subject.
- [ ] Deterministic setup + idempotent cleanup implemented.
- [ ] Test passes in normal CI worker parallelism.

## Commands

```bash
cd apps/web
bun run test:e2e <spec-file>
bunx biome check <spec-file>
```

For broader confidence:

```bash
bun run check:affected
```

## Final Bar

If the test would still pass while the real feature is broken, delete and rewrite it.

## Companion File

Use the line-by-line gate in `CHECKLIST.md` before considering a test complete.
