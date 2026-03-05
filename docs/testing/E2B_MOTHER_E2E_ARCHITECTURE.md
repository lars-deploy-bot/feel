# E2B Mother E2E Architecture

## Objective

Define one long-lived, zero-mock E2E scenario that proves E2B domains behave correctly end-to-end across chat, files, terminal, watch, cancellation, and sandbox lifecycle.

Primary regressions this must catch:
- #375 auth bypass on `/api/files` and `/api/files/read`
- #376 wrong branch ordering (host/systemd path touched before `execution_mode` decision)
- #377 watch retry loop on E2B domains (`WATCH_UNSUPPORTED` handling)

## Design Principles

- Zero product API mocks. Use real APIs, real DB state, real E2B sandbox flow.
- One canonical journey, many checkpoints. Keep a single "mother" scenario but assert each contract step explicitly.
- Deterministic control plane. Add test-only endpoints for setup/teardown and domain runtime introspection.
- Idempotent cleanup. Test can be rerun after partial failure without manual repair.
- Staging-first lane. Run where real E2B infra exists.

## Test Topology

- Spec file: `apps/web/e2e-tests/e2b-mother-live.spec.ts`
- Config lane: `playwright.live.config.ts` (or dedicated `playwright.e2b.config.ts` if we want independent scheduling)
- Workers: `1` (serial, stateful by design)
- Retry: `0` for nightly gate, `1` for developer debug runs
- Environment: `.env.staging`
- Data isolation: existing `E2E_RUN_ID` + worker tenant bootstrap

## Required Test-Only Control Plane

Add one route:
- `apps/web/app/api/test/e2b-domain/route.ts`

Operations:
1. `GET /api/test/e2b-domain?workspace=<hostname>`
- Returns `{ execution_mode, sandbox_id, sandbox_status, org_id, hostname }`

2. `POST /api/test/e2b-domain`
- Body supports:
  - `workspace: string` (required)
  - `executionMode: "systemd" | "e2b"` (required)
  - `sandboxStatus?: "creating" | "running" | "dead" | null`
  - `sandboxId?: string | null`
  - `killSandbox?: boolean` (default `false`)
  - `resetSandboxFields?: boolean` (default `false`)
- Behavior:
  - updates `app.domains.execution_mode`
  - optionally sets sandbox fields
  - optionally kills in-memory/remote sandbox when requested

Security:
- same guard as other test routes: `NODE_ENV === "test" || STREAM_ENV === "local" || valid x-test-secret`
- return `404` on unauthorized (hide endpoint existence)

## Mother Scenario (Single Test, Multi-Phase)

### Phase 0: Preflight

- Bootstrap tenant via `/api/test/bootstrap-tenant`
- Assert workspace/domain exists
- Assert domain starts in `systemd`

Completion signal:
- tenant and domain records available, test user can log in

### Phase 1: Flip to E2B + clean baseline

- Call `/api/test/e2b-domain` to set:
  - `executionMode: "e2b"`
  - `resetSandboxFields: true`
  - `killSandbox: true`
- Assert runtime now: `execution_mode=e2b`, sandbox fields empty or dead

Completion signal:
- runtime readback confirms E2B mode

### Phase 2: Trigger sandbox creation through real chat

- Login in UI
- Send prompt that creates `e2e-sandbox-proof.txt` with unique nonce
- Capture stream response + `X-Request-Id`
- Assert transport: `POST /api/claude/stream` returns `200`
- Assert user-visible: assistant confirms file creation
- Assert mechanism: `/api/test/e2b-domain` now shows `sandbox_status=running` and non-null `sandbox_id`

Completion signal:
- first sandbox is alive and bound to domain

### Phase 3: File APIs through E2B

Use real authenticated API calls from browser context:
- `/api/files` on root path includes `e2e-sandbox-proof.txt`
- `/api/files/read` returns nonce content
- `/api/files/upload` uploads a text file, then `/api/files/read` returns uploaded content

Negative assertions:
- `/api/files/read` with `../../etc/passwd` returns `403 PATH_OUTSIDE_WORKSPACE`
- same endpoints with a different workspace return `403 WORKSPACE_NOT_AUTHENTICATED` (#375)

Completion signal:
- all file operations succeed through E2B and security checks hold

### Phase 4: Watch and terminal routing

Watch:
- Call `/api/watch/lease` and assert `501 WATCH_UNSUPPORTED`
- UI check: file watcher settles to disconnected/non-retrying state (bounded request count)

Terminal:
- Call `/api/terminal/lease`
- Assert `200`, `wsUrl` contains `/e2b/ws?lease=`

Negative assertion:
- force sandbox dead via control endpoint, then `/api/terminal/lease` returns `503 SANDBOX_NOT_READY`

Completion signal:
- watch and terminal behavior match E2B contract (#377)

### Phase 5: Cancellation and lock release

- Start long response
- Cancel via `POST /api/claude/stream/cancel` using captured requestId
- Assert cancel status is one of:
  - `cancelled`
  - `cancel_queued` (cross-process race, still valid)
  - `cancel_timed_out` (cleanup delay, still valid but should be monitored)
- Immediately send follow-up message in same tab
- Assert no `409 CONVERSATION_BUSY` and stream proceeds

Completion signal:
- lock is reliably released after stop

### Phase 6: Reconnect/new sandbox path

- Save current `sandbox_id` from control endpoint
- Force dead + kill via control endpoint
- Send another message
- Assert runtime returns new `sandbox_id` and `sandbox_status=running`

Completion signal:
- recreate path works without manual intervention

### Phase 7: Teardown and restore

In `finally`:
- set domain back to `systemd`
- kill sandbox
- clear sandbox fields
- remove E2B proof files if needed

Completion signal:
- no residual E2B state left in shared staging

## Assertion Contract (Per Phase)

Each phase must include:
- User-visible assertion
- Transport/mechanism assertion
- Negative assertion

The mother test fails if any of the three are missing from a phase.

## Observability and Artifacts

Attach on failure:
- NDJSON stream payloads (sanitized)
- domain runtime snapshots before/after each phase
- request/response traces for `/api/files*`, `/api/watch/lease`, `/api/terminal/lease`, `/api/claude/stream`, `/api/claude/stream/cancel`
- current `sandbox_id` timeline

Use `testInfo.attach()` with JSON blobs for postmortem diffs.

## Implementation Plan

1. Add `api/test/e2b-domain` route + unit tests
2. Add shared live helper module for tenant bootstrap + login + typed API wrappers
3. Implement `e2b-mother-live.spec.ts` with phases 0-3 first (must pass)
4. Add phases 4-7
5. Add nightly CI lane (non-blocking)
6. After two stable weeks, promote to required staging gate

## Runbook

Local trigger:

```bash
cd apps/web
ENV_FILE=.env.staging bun run test:e2e:live e2b-mother-live.spec.ts
```

Suggested CI schedule:
- nightly on staging
- on-demand before E2B rollout changes

## Non-Goals

- Full performance benchmarking
- Multi-domain parallel E2B chaos testing
- Preview proxy inside sandbox

Those belong to separate reliability suites; this mother test is the correctness gate.
