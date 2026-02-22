# Chat vs Automation SDK Flow

**Date**: 2026-02-22  
**Status**: Proposed (single-file architecture spec)  
**Scope**: unify Claude SDK execution path used by chat and automation

## Summary

The platform already converges at `pool.query(...)`, but everything before that call is duplicated across:

- `apps/web/app/api/claude/stream/route.ts`
- `apps/web/lib/automation/executor.ts`
- `apps/web/lib/automation/attempts.ts`

The fix is not "more helpers everywhere." The fix is one execution boundary: `executeAgent()`.  
Chat and automation keep their delivery-specific behavior, but execution setup and worker-pool invocation move to one place.

## Why this matters

Current duplication increases risk in exactly the wrong place: auth-adjacent execution setup, workspace credentials, tool policy, OAuth tokens, and model/runtime configuration.

Symptoms today:

1. Same setup logic in multiple files with slight drift.
2. New SDK features require duplicate wiring.
3. Runtime behavior differs unintentionally between chat and automation.
4. No single, queryable execution trace model across both workloads.

## Current call paths

### Chat path (today)

```text
POST /api/claude/stream
  -> apps/web/app/api/claude/stream/route.ts
     -> auth/session/lock/model checks
     -> workspace + uid/gid resolution
     -> OAuth + provider tokens + user env keys
     -> build agentConfig
     -> pool.query(..., workloadClass: "chat")
     -> createNDJSONStream(...)
     -> per-message credit charging in ndjson-stream-handler
```

### Automation path (today)

```text
Automation trigger
  -> apps/web/lib/automation/executor.ts
     -> input validation/skills/system prompt
     -> workspace + uid/gid resolution
     -> OAuth access token + session JWT mint
     -> apps/web/lib/automation/attempts.ts
        -> build agentConfig
        -> pool.query(..., workloadClass: "automation")
        -> createMessageCollector() -> AttemptResult
```

### Actual convergence point

Both paths converge only at:

```typescript
pool.query(credentials, {
  requestId,
  ownerKey,
  workloadClass,
  payload,
  onMessage,
  signal,
})
```

Everything above this call is duplicated and can drift.

## Duplication inventory

| Concern | Chat | Automation | Problem |
|---|---|---|---|
| workspace + credential resolution | `route.ts` | `executor.ts` + `attempts.ts` | Same pattern, repeated |
| OAuth access token resolution | `route.ts` | `executor.ts` | Same dependency, repeated |
| agentConfig assembly | `route.ts` | `attempts.ts` | Slightly different policy inputs |
| payload assembly for worker | `route.ts` | `attempts.ts` | Nearly identical shape |
| worker-pool invocation | `route.ts` | `attempts.ts` | Two high-risk call sites |
| execution telemetry | stream logs only | automation run data | fragmented observability |

## Design goals

1. One worker-pool execution call site.
2. One canonical builder for `credentials`, `agentConfig`, and worker payload.
3. Keep chat-only and automation-only behavior explicit (no hidden coupling).
4. Preserve workspace isolation and existing security checks.
5. Add unified execution trace records for both workloads.

## Non-goals

1. Rewriting worker-pool internals.
2. Removing chat session-recovery logic from stream route in the first phase.
3. Changing billing behavior in phase 1.
4. Merging all route/executor orchestration into one file.

## Target architecture

```text
                 caller responsibilities
        (chat route / automation executor only)
                             |
                             v
                   +-------------------+
                   |   executeAgent    |
                   |-------------------|
                   | resolve workspace |
                   | resolve oauth     |
                   | build agentConfig |
                   | build payload     |
                   | call pool.query   |
                   | emit trace        |
                   +---------+---------+
                             |
                 +-----------+-----------+
                 |                       |
                 v                       v
       Stream delivery adapter   Collector delivery adapter
       (chat NDJSON pipeline)    (automation AttemptResult)
```

## `executeAgent()` contract

Create: `apps/web/lib/agent/execute-agent.ts`

```typescript
type WorkloadClass = "chat" | "automation"

interface ExecuteAgentRequest {
  requestId: string
  ownerKey: string
  workloadClass: WorkloadClass
  workspace: string
  userId: string
  orgId: string

  message: string
  systemPrompt: string
  model: string
  maxTurns: number
  timeoutMs: number

  resume?: string
  resumeSessionAt?: string
  extraTools?: string[]
  planMode?: boolean
  enableSuperadminTools?: boolean
  sessionCookie?: string

  oauthTokens?: Record<string, unknown>
  userEnvKeys?: Record<string, unknown>

  onMessage: (msg: WorkerToParentMessage) => void
  signal: AbortSignal
}

interface ExecuteAgentResult {
  requestId: string
  workloadClass: WorkloadClass
  startedAt: string
  completedAt: string
  durationMs: number
  model: string
  workspace: string
  costUsd?: number
  numTurns?: number
  usage?: { input_tokens: number; output_tokens: number }
  outcome: "success" | "error" | "timeout" | "cancelled"
  error?: string
}
```

## Responsibility split (hard boundary)

### Caller keeps (chat route / automation executor)

1. Request parsing and validation.
2. Auth/session/conversation lock concerns.
3. Prompt composition (chat message or automation prompt + skills).
4. Delivery behavior (`NDJSON` stream vs collector aggregation).
5. Workflow-specific retry policy (for example stale session recovery in chat).

### `executeAgent()` owns

1. Workspace path + uid/gid resolution.
2. OAuth access token acquisition.
3. Tool allow/disallow policy assembly.
4. Worker payload assembly.
5. `pool.query(...)` execution.
6. Normalized execution trace output.

## Security invariants (must remain true)

1. Workspace path is resolved through existing trusted resolver (`getWorkspacePath` in current flow).
2. Worker credentials come from `statSync(cwd)` unless explicit superadmin-root behavior is required.
3. Tool policy still comes from existing allow/disallow builders, not ad-hoc lists.
4. Session cookie minting remains least-privilege scoped in automation.
5. No new bypass around workspace boundary checks.

## Trace model

Add shared trace storage so chat and automation executions are queryable together.

```sql
create table app.execution_traces (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  workload_class text not null, -- chat | automation
  user_id uuid not null,
  org_id uuid not null,
  workspace text not null,
  model text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  duration_ms integer,
  cost_usd numeric(10,6),
  num_turns integer,
  input_tokens integer,
  output_tokens integer,
  outcome text not null, -- success | error | timeout | cancelled
  error text
);

create index execution_traces_request_id_idx on app.execution_traces (request_id);
create index execution_traces_workspace_idx on app.execution_traces (workspace);
create index execution_traces_started_at_idx on app.execution_traces (started_at desc);
```

If `automation_runs` exists, add nullable `trace_id` foreign key to connect job-level status with execution-level telemetry.

## Migration plan

### Phase 1: extraction (no behavior change)

1. Create `apps/web/lib/agent/execute-agent.ts`.
2. Move shared worker-pool setup logic from `route.ts` and `attempts.ts` into that module.
3. Keep existing chat stream shaping and automation collector behavior unchanged.

Exit criteria:

1. Chat and automation still produce same functional output.
2. Only one `pool.query(` call remains for app-level execution.

### Phase 2: rewire chat

1. Update `apps/web/app/api/claude/stream/route.ts` to call `executeAgent`.
2. Keep chat-specific session recovery and NDJSON stream lifecycle exactly where they are.

Exit criteria:

1. Session resume behavior unchanged.
2. Cancellation path unchanged.
3. Credit charging still handled by `apps/web/lib/stream/ndjson-stream-handler.ts`.

### Phase 3: rewire automation

1. Update `apps/web/lib/automation/executor.ts` to call `executeAgent`.
2. Collapse or delete `apps/web/lib/automation/attempts.ts` if it becomes a thin wrapper.

Exit criteria:

1. `responseToolName` extraction still works.
2. Timeout and error semantics unchanged.
3. Skill loading and system prompt behavior unchanged.

### Phase 4: unified traces

1. Write a trace row for every `executeAgent` invocation.
2. Link automation runs to `trace_id`.
3. Add query helpers for debugging and cost analysis.

Exit criteria:

1. Every chat and automation request has a trace record.
2. Trace shows outcome, timing, model, workspace, usage.

### Phase 5: billing convergence (last)

Current state:

1. Chat charges per assistant message in `ndjson-stream-handler.ts`.
2. Automation returns total cost metadata after completion.

Target state:

1. Introduce a billing policy hook from `executeAgent` events.
2. Keep chat behavior stable first, then migrate automation policy safely.

Do this last because billing regressions are expensive and user-facing.

## Test strategy

### Unit coverage

1. `executeAgent` builds correct credentials for normal and superadmin modes.
2. `executeAgent` assembles payload parity for both workloads.
3. `executeAgent` maps worker outcomes to normalized trace result.
4. Timeout/cancel/error classification is deterministic.

### Integration coverage

1. Chat route still streams NDJSON events in correct order.
2. Chat session recovery behavior still works.
3. Automation still returns collector output and tool-response extraction.
4. Existing credit charging behavior for chat remains unchanged.

### Regression checks

Run targeted checks for touched paths first (short loop), then full gate:

```bash
bun run check:affected
bun run static-check
```

## Acceptance criteria

1. One app-level execution call site for worker pool.
2. No behavior regressions in chat stream, resume, cancellation, and automation output.
3. Security invariants preserved.
4. Unified execution traces available for both workloads.
5. Clear ownership boundary: caller orchestration vs execution core.

## File plan

Primary files involved:

1. `apps/web/lib/agent/execute-agent.ts` (new)
2. `apps/web/app/api/claude/stream/route.ts` (rewire caller)
3. `apps/web/lib/automation/executor.ts` (rewire caller)
4. `apps/web/lib/automation/attempts.ts` (shrink/delete after migration)
5. `apps/web/lib/stream/ndjson-stream-handler.ts` (billing stays here initially)
6. DB migration for `app.execution_traces` (plus optional `automation_runs.trace_id`)

This keeps the architecture proposal in one file, but with explicit boundaries, rollout sequence, and verification gates.
