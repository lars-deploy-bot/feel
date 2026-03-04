# E2B Sandbox Routing - Solid Two-Plan Rollout

Goal: run Claude execution inside E2B sandboxes for selected domains, without breaking current chat/session/cancellation/billing guarantees.

This document replaces the previous draft and hardens the plan around existing production contracts.

## Scope

- Keep both execution paths alive:
  - `systemd` (current)
  - `e2b` (new)
- Route by `app.domains.execution_mode`.
- Preserve current behavior for:
  - NDJSON protocol
  - Plan mode restrictions
  - Session resume/recovery
  - Cancellation/lock cleanup
  - Credit charging

## Hard Invariants (Must Not Regress)

1. NDJSON child events must use `STREAM_TYPES` values (`stream_session`, `stream_message`, `stream_complete`, ...), not ad-hoc names.
2. Plan mode must remain read-only. `Write/Edit/Bash` must not be in `allowedTools` during plan mode.
3. Request cancellation must actually stop sandbox execution and release the conversation lock quickly.
4. Session recovery behavior must match current `WORKER_POOL` path (stale message/session retry).
5. Secrets policy must be explicit: only intentionally-injected runtime secrets enter sandbox; server secrets never do.

---

## Plan 1: Build Safety + Parity (No User Traffic Yet)

### 1) Database Contract

Add execution routing fields on `app.domains`.

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'app' AND t.typname = 'execution_mode'
  ) THEN
    CREATE TYPE app.execution_mode AS ENUM ('systemd', 'e2b');
  END IF;
END $$;

ALTER TABLE app.domains
  ADD COLUMN IF NOT EXISTS execution_mode app.execution_mode NOT NULL DEFAULT 'systemd',
  ADD COLUMN IF NOT EXISTS sandbox_id TEXT,
  ADD COLUMN IF NOT EXISTS sandbox_status TEXT;

CREATE INDEX IF NOT EXISTS idx_domains_execution_mode ON app.domains(execution_mode);
```

Then run:

- `bun run gen:types`
- update any DB type aliases needed by runtime code (do not duplicate enum literals elsewhere).

### 2) Environment Rules

- Reuse existing `E2B_API_KEY`.
- Do not introduce new required env vars unless strictly needed for deployment.
- If self-hosted endpoint override is required, make it optional and validated (no unconditional new required env).

### 3) Create `packages/sandbox` (New package)

```
packages/sandbox/
  src/
    index.ts
    manager.ts        // create/connect/evict/kill
    executor.ts       // querySandbox() + robust stdout framing + cancel wiring
    types.ts
  agent/
    agent-entry.ts    // runs inside sandbox
```

### 4) `manager.ts` Requirements

- Key by `domain_id`.
- Deduplicate concurrent creates within process.
- Reconnect by stored `sandbox_id`; on failure create a new sandbox and persist fresh ID.
- Expose explicit `evict(domainId)` on disconnect/error.
- Never claim status without writing DB status (`creating/running/dead`) in the same flow.

### 5) `executor.ts` Requirements (Critical)

`querySandbox()` must:

- Accept payload with `allowedTools`, `disallowedTools`, `permissionMode` already computed by route policy.
- Write request payload to sandbox with strict filename and remove it in `finally`.
- Run agent command and stream stdout incrementally.
- Parse stdout safely across chunk boundaries.
- Honor abort signal by terminating running sandbox command (or sandbox) and returning quickly.

Use this framing pattern (not naive `split("\n")` per chunk):

```ts
let buffer = ""
onStdout: (chunk) => {
  buffer += chunk
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""
  for (const line of lines) {
    if (line.trim()) onMessage(line)
  }
}
```

Cleanup pattern:

```ts
try {
  // run command
} finally {
  await sandbox.commands.run(`rm -f ${payloadPath}`).catch(() => {})
}
```

### 6) `agent-entry.ts` Requirements (Critical)

- Import `query` from Claude Agent SDK.
- Emit child events using `STREAM_TYPES` values from shared constants.
- Do **not** hardcode `allowedTools` to include write tools.
- Use payload-provided `allowedTools`, `disallowedTools`, and `permissionMode`.
- Keep Bun env file disabled for SDK process (`executableArgs: ["--no-env-file"]`) to avoid accidental workspace `.env` auth bleed.

Pseudo-shape:

```ts
const agentQuery = query({
  prompt: request.message,
  options: {
    cwd: process.cwd(),
    model: request.model,
    maxTurns: request.maxTurns,
    permissionMode: request.permissionMode,
    allowedTools: request.allowedTools,
    disallowedTools: request.disallowedTools,
    systemPrompt: request.systemPrompt,
    resume: request.resume,
    resumeSessionAt: request.resumeSessionAt,
    executable: "bun",
    executableArgs: ["--no-env-file"],
  },
})
```

### 7) Stream Route Integration (`apps/web/app/api/claude/stream/route.ts`)

#### 7.1 Domain query

Extend select to include:

- `execution_mode`
- `sandbox_id`
- `sandbox_status`

#### 7.2 E2B branch placement

Keep E2B branch before worker-pool dispatch, but reuse current retry/recovery semantics.

Important: branch payload variables must match existing route names:

- `message: finalMessage`
- `oauthAccessToken`
- `signal: workerAbortController.signal`

#### 7.3 Recovery parity

Do not do a single blind call. Implement same recovery matrix as worker pool path:

- stale `resumeSessionAt` -> retry without `resumeSessionAt`
- stale session id -> clear `sessionStore` key and retry fresh
- if retries fail -> stream proper error

Implementation note:

- Extract the existing retry logic into shared helper(s) so `WORKER_POOL` and `E2B` paths cannot drift.

### 8) Security Boundary (Clarified)

Correct threat model:

- Server-only secrets never enter sandbox:
  - DB credentials
  - server SSH keys
  - internal infra credentials
- Sandbox may receive per-request runtime secrets **only if explicitly injected**:
  - Claude OAuth access token
  - optional user/workspace runtime env keys (if feature enabled)
- Therefore, "only one credential enters sandbox" is not always true; policy must list exactly what is injected.

### 9) Bootstrap Strategy (No `curl | bash` in request path)

Do not install Bun/SDK via runtime `curl | bash` on first user request.

Required:

- Build a pinned E2B template with Bun + SDK + `agent-entry.ts` baked in.
- Use `Sandbox.create(<alive-template>, ...)`.
- Keep first-request path free of package installation/network bootstrapping.

### 10) Plan 1 Exit Gates (Mandatory)

All must pass:

- Unit tests for stdout chunk boundary framing.
- Unit tests for abort path (signal triggers process termination + cleanup).
- Stream route tests for E2B branch:
  - happy path
  - stale message recovery
  - stale session recovery
  - lock release on error/abort
- Plan mode test: no write-capable tools in E2B payload when `planMode=true`.
- Manual smoke:
  - `execution_mode='e2b'` on one test domain
  - send message, cancel mid-stream, send follow-up
  - verify session resume works.

---

## Plan 2: Controlled Rollout + Operations

### 1) Canary Rollout

- Flip exactly one low-traffic domain to `e2b`.
- Observe for at least 24h with real chat traffic.
- Keep instant rollback via SQL:

```sql
UPDATE app.domains
SET execution_mode = 'systemd', sandbox_status = 'dead'
WHERE hostname = '<domain>';
```

### 2) Observability (Must have before expansion)

Track per-request:

- execution path (`systemd` vs `e2b`)
- sandbox create/connect latency
- first token latency
- abort latency
- retry reason (`stale_message`, `stale_session`, none)
- error class (SDK/system/sandbox)

Track per-domain:

- active sandbox id
- sandbox status
- last successful run timestamp
- failure streak

### 3) Expansion Rules

Only expand to more domains if:

- no lock leak regressions
- no cancellation regressions
- no plan-mode policy regressions
- p95 first token latency is acceptable vs systemd path

If any fail, freeze rollout and revert affected domains to `systemd`.

### 4) Deferred Features (Explicitly Out of Scope)

- Preview proxy routing into sandbox.
- Full file sync for existing sites at sandbox creation.
- Automation jobs on E2B.
- Cross-sandbox session durability beyond current SDK/session store behavior.

---

## Realistic Performance Baseline (Current Experimental Script)

From `apps/experimental/e2b-test/src/full-benchmark.ts`:

- Cold first call after create: ~4-5s
- File read/write under 1MB: roughly 30-80ms
- 5MB read/write: roughly 500-1000ms
- "Real agent session" in script is simulated tool-flow timing, not full production traffic.

Use these as planning numbers until production path is benchmarked end-to-end.

