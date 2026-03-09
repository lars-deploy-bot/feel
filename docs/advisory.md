# Advisory: Scaling Alive on Self-Hosted E2B

Date: March 6, 2026

## Executive Summary

If Alive wants to support many websites on self-hosted E2B without creating a heavy ops burden, the core move is this:

1. Keep agents always reachable at the Alive platform layer, not as permanently running sandboxes.
2. Route all AI execution through Alive so model tokens and policy stay under platform control.
3. Treat E2B sandboxes as an on-demand compute pool for code-writing and runtime tasks, not as the permanent home of each site.
4. Make persistence come from snapshots or another durable workspace source of truth.
5. Keep public website serving separate from edit/build sandboxes whenever possible.

The current Alive codebase is already good enough to prove the E2B execution model, but it is not yet the right shape for cheap high-density hosting. Today, the E2B path is best understood as isolated agent execution for a domain, not as the final low-ops architecture for many durable websites.

If you are hitting a clean cap like "8 sandboxes max", do not start with hugepages. In a self-hosted E2B deployment, the more likely hard stops are NBD device count, network slot exhaustion, node-level running-sandbox caps, or simple RAM/CPU pressure.

The core argument is simple:

- users want agents to be available
- Alive needs model access, billing, and policy to stay centralized
- sandboxes are only valuable when work becomes side-effectful

So the thing that should stay hot is the agent layer. The thing that should stay cold until needed is the sandbox layer.

The burden of proof should therefore be on the always-on sandbox model. It only makes sense if keeping one sandbox hot per site is cheaper and simpler than deciding when isolation is needed. On a small self-hosted footprint, that is almost never true.

## What Alive Has Today

Alive already has the right basic routing primitives:

- Domains can run in `systemd` or `e2b` mode via [`docs/architecture/e2b-sandbox-routing.md`](./architecture/e2b-sandbox-routing.md).
- New E2B sites get a sandbox record with `sandbox_id` and `sandbox_status` in [`apps/web/lib/deployment/e2b-site-deployment.ts`](../apps/web/lib/deployment/e2b-site-deployment.ts).
- Chat requests in E2B mode call `SandboxManager.getOrCreate(...)` from [`packages/worker-pool/src/worker-entry.mjs`](../packages/worker-pool/src/worker-entry.mjs), so sandbox creation is already on-demand for the agent path.
- File and shell tools are swapped to E2B MCP tools in [`packages/sandbox/src/e2b-mcp.ts`](../packages/sandbox/src/e2b-mcp.ts).

That part is solid.

The current constraints are architectural, not conceptual:

- The host workspace under `E2B_SCRATCH_ROOT` is only synced one way, host to sandbox, in [`packages/sandbox/src/manager.ts`](../packages/sandbox/src/manager.ts).
- After that, edits happen inside the sandbox through MCP tools, not back into the host copy.
- The scratch workspace currently lives under `/tmp/alive/e2b-workspaces` in [`packages/shared/src/config.ts`](../packages/shared/src/config.ts).
- Terminal and file routes fail fast with `SANDBOX_NOT_READY` if the sandbox is not already running in [`apps/web/app/api/terminal/lease/route.ts`](../apps/web/app/api/terminal/lease/route.ts) and the file routes.
- The E2B rollout doc explicitly says preview-proxy routing into sandbox is still out of scope in [`docs/architecture/e2b-sandbox-routing.md`](./architecture/e2b-sandbox-routing.md).

The practical result is:

- Alive currently depends on the sandbox itself to hold the most recent state for E2B sites.
- That is fine for a small beta.
- It is the wrong durability model for "many websites on one box".

Alive also already has the right control-plane shape for centralized agent execution:

- Claude queries are issued from the worker layer, not from inside the sandbox, in [`packages/worker-pool/src/worker-entry.mjs`](../packages/worker-pool/src/worker-entry.mjs).
- The worker pool is explicitly designed as a persistent always-on process layer in [`docs/architecture/persistent-worker-pool.md`](./architecture/persistent-worker-pool.md).
- Auth and infrastructure env vars are controlled and stripped in [`packages/worker-pool/src/env-isolation.ts`](../packages/worker-pool/src/env-isolation.ts).

That means the platform can keep control of AI tokens and policy without requiring an always-on sandbox for every user.

## What Actually Limits Self-Hosted E2B

For self-hosting, ignore SaaS team-tier reasoning. The important limits are host-level.

### 1. NBD devices

E2B's orchestrator allocates from an NBD device pool in [`packages/orchestrator/internal/sandbox/nbd/pool.go`](../../e2b/infra/packages/orchestrator/internal/sandbox/nbd/pool.go).

Important detail:

- The pool reads `/sys/module/nbd/parameters/nbds_max`.
- One NBD device can only back one sandbox at a time.
- If `nbds_max=8`, you get an exact hard stop at 8 no matter how much RAM you still have.

This is the cleanest explanation for a neat cap.

### 2. Network slots

Each sandbox also needs a network slot with namespace, TAP/veth pair, and IP allocation in:

- [`packages/orchestrator/internal/sandbox/network/pool.go`](../../e2b/infra/packages/orchestrator/internal/sandbox/network/pool.go)
- [`packages/orchestrator/internal/sandbox/network/slot.go`](../../e2b/infra/packages/orchestrator/internal/sandbox/network/slot.go)
- [`packages/orchestrator/internal/sandbox/network/storage_local.go`](../../e2b/infra/packages/orchestrator/internal/sandbox/network/storage_local.go)

This can create another clean hard cap if the slot space or namespace pool is exhausted.

### 3. Node-level sandbox caps

The orchestrator also has node-level refusal paths in [`packages/orchestrator/internal/server/sandboxes.go`](../../e2b/infra/packages/orchestrator/internal/server/sandboxes.go):

- max running sandboxes per node
- max starting sandboxes per node

So even with enough RAM and NBD devices, you can still get `ResourceExhausted` from node policy.

### 4. RAM and CPU

This is still the real physical ceiling.

- Hugepages matter, but they are a memory backing choice, not the best explanation for a neat "8 max" by themselves.
- CPU becomes the practical bottleneck earlier than raw VM count if builds run on the same host as interactive sandboxes.

### 5. Rootfs mode

E2B supports both NBD-backed and direct rootfs providers:

- [`packages/orchestrator/internal/sandbox/rootfs/nbd.go`](../../e2b/infra/packages/orchestrator/internal/sandbox/rootfs/nbd.go)
- [`packages/orchestrator/internal/sandbox/rootfs/direct.go`](../../e2b/infra/packages/orchestrator/internal/sandbox/rootfs/direct.go)

This is an advanced lever, not the first one to touch. But it matters if NBD becomes the operational pain point.

## The Main Architectural Problem in Alive

Alive's current E2B integration makes sandbox lifetime too important.

Today the flow is:

1. Copy template into a local scratch workspace.
2. Sync that workspace into a sandbox.
3. Let Claude read/write inside the sandbox.
4. Keep using that sandbox as the effective source of truth.

That means:

- If the sandbox dies and is recreated, the host copy may be stale.
- If you aggressively pause/replace sandboxes to save money, you risk losing the newest state unless you snapshot or export it somewhere durable.
- The current implementation is therefore biased toward "keep the sandbox alive for a long time", which is the opposite of the density model you want.

For scaling, this is the first thing to fix.

## The Right Execution Model For Alive

The product requirement is not "every site gets an always-on VM".

The product requirement is:

- users should have agents that can do work for them
- Alive should keep control of model access and tokens
- builds should not run unless they are actually needed
- sandbox capacity should only be consumed when the task truly needs code execution

That leads to a layered model.

Another way to say it:

- availability is a platform concern
- token control is a platform concern
- filesystem and process side effects are a sandbox concern
- compilation is a burst compute concern

These are different problems. If you force them into one always-on sandbox per site, you pay the cost of all four layers even when the user only needs one.

## The False Equivalence To Avoid

There are three different statements that sound similar but are not the same:

- "the user should be able to hand work to an agent at any time"
- "the user should have a sandbox available at any time"
- "the user's site should always have dedicated compute reserved"

Only the first statement is a default product requirement.

The second is sometimes required.

The third should be exceptional.

Most architectural confusion here comes from silently collapsing all three into one. Once that happens, the platform starts paying permanent infrastructure cost to satisfy a requirement that was really about responsiveness and continuity.

## Capacity Model

The cleanest way to reason about this is to separate three capacities.

### 1. Agent capacity

This is the number of background and interactive agent tasks Alive can keep progressing.

This should scale with:

- worker count
- queueing
- model throughput budget

It should not scale with VM count.

### 2. Mutation capacity

This is the number of tasks currently doing side-effectful code work:

- editing code
- running commands
- opening terminals
- inspecting live runtime behavior

This is the number that should consume sandbox slots.

### 3. Build capacity

This is the number of compilations and publish jobs running concurrently.

This should be separately budgeted because it competes mainly on CPU, not on user-facing responsiveness.

The important consequence is:

- agent capacity should be high
- mutation capacity should be moderate
- build capacity should be tightly controlled

If you instead make one always-on sandbox the unit of capacity, you merge all three into the most expensive one.

In rough terms:

- always-on sandbox model: required sandbox capacity ~= active sites that expect warm compute, and in practice often drifts toward total provisioned sites
- layered model: required sandbox capacity ~= active mutation tasks + active build tasks + explicit premium always-on runtimes

That is the key scaling difference. In the layered model, sandbox count tracks expensive work. In the always-on model, sandbox count tracks product surface area.

## Why The Always-On Sandbox Model Loses

An always-on sandbox model is only the right default if most of the following are true:

- most users are doing side-effectful code work most of the time
- most sites require dedicated warm runtime most of the time
- builds need to start immediately rather than queue
- token control inside many long-lived sandboxes remains simple
- durability of sandbox-local state is easy and cheap

That is not this product:

- not all agents need to write code
- not all sessions need a terminal
- builds are explicitly not required at all times
- token control is intentionally centralized
- current state durability already becomes harder once sandbox lifetime matters too much

So the default should not be "one live sandbox per site". That model is solving the wrong average case.

## Why The Boundaries Matter

### 1. Always-on agents do not require always-on sandboxes

What users actually buy is not "a VM that exists all day". They buy:

- an agent that can accept work immediately
- continuity of context
- confidence that work will continue in the background

All three can be delivered by the Alive worker and automation layer.

An always-on sandbox only becomes necessary when the work itself needs:

- code mutation
- command execution
- app runtime interaction
- environment-specific filesystem state

If the task is planning, research, triage, or orchestration, a sandbox adds cost without adding user value.

That is the key economic boundary in this system.

### 2. Centralized token control is not optional

If model execution escapes into autonomous sandboxes, Alive loses the things that make it a platform:

- cost control
- rate limiting
- policy enforcement
- auditability
- consistent auth handling
- the ability to attribute spend to users, orgs, and jobs

The current worker-pool design is already pointing in the right direction: the model call happens in Alive, and the sandbox is a tool target.

That separation should become more explicit, not less.

### 3. Sandbox allocation should follow side effects, not session existence

The wrong question is:

- "Does this user have an active agent session?"

The right question is:

- "Has this task crossed into side-effectful work?"

That means the sandbox boundary should be triggered by things like:

- first write to workspace files
- first shell command
- first need for an interactive terminal
- first need to boot the app and inspect runtime behavior

Before that point, the work should stay in the cheaper centralized layer.

This is not just a cost optimization. It is also a scaling simplification. It means sandbox concurrency tracks real mutation pressure instead of total user attention.

That distinction is the whole game. If 100 users are thinking with agents but 8 are actively changing code, the platform should feel like it is serving 100 users while only paying sandbox cost for 8.

### 4. Builds are not just "more sandbox work"

Builds are a separate workload with different economics and latency expectations.

Interactive code work is latency-sensitive:

- user is waiting
- agent is in a live loop
- a slow response breaks the experience

Build work is throughput-sensitive:

- it can queue
- it burns CPU
- it often does not need to start instantly

If both classes share one undifferentiated pool, build spikes will eat the capacity needed for interactive work. The result is a worse product even when total hardware utilization looks high.

So build capacity should be treated as a separate budget from edit/runtime sandbox capacity.

This also gives the platform a cleaner promise structure:

- agent accepted your task immediately
- code sandbox starts when real code work begins
- build starts when capacity is available

That is a much more honest and scalable contract than pretending every part of the pipeline is permanently hot.

### Layer 1: Always-on platform agents

This layer should be always available.

Responsibilities:

- planning
- research
- issue triage
- content edits outside code workspaces
- orchestration
- deciding whether code work is actually needed

This should run in Alive's worker and automation layer, not in Firecracker sandboxes.

Why:

- cheapest layer
- keeps all AI tokens inside Alive
- easiest place to enforce policy, quotas, audit, and billing
- scales with workers, not with VM count

This is the right place to promise "your agent is always on".

It is not credible to make that promise by pinning one Firecracker VM per site on a small self-hosted footprint. It is credible to make that promise with a centralized worker and automation layer that decides when isolated compute is needed.

### Layer 2: On-demand code-work sandboxes

A sandbox should be created only when the agent crosses into code execution territory.

Examples:

- first `Write`
- first `Edit`
- first `Bash`
- first request for a real workspace terminal
- first request to run the app in a previewable environment

Before that point, the agent can stay in the always-on platform layer.

This is the main density win. Not every agent session needs a VM.

This is also the right technical boundary because this is the moment when the task stops being purely cognitive and starts creating environment-local state.

In other words:

- before this point, the sandbox is overhead
- after this point, the sandbox is the product

That is why the boundary should be event-driven, not preallocated.

### Layer 3: Burst build sandboxes

Builds are a separate cost class and should be treated that way.

- Builds burn CPU.
- Builds can queue.
- Builds do not need to be available all the time.
- Build capacity should scale separately from interactive code-writing capacity.

So do not size the whole platform around "what if every active agent is building right now".

Use a dedicated build queue and a separate concurrency budget.

That gives Alive a much better fallback story:

- if build capacity is saturated, users wait for builds
- if interactive sandbox capacity is saturated, the product feels broken

Those are not equivalent failures, so they should not come from the same undifferentiated pool.

### Layer 4: Optional always-on runtime

Only a minority of sites should land here.

Use this for:

- truly dynamic apps
- apps that cannot tolerate cold starts
- special premium cases

Do not make this the default tier.

If a customer really needs this, it should be surfaced as a premium operational choice, not hidden as the baseline architecture for everyone else.

## Recommended Low-Ops Architecture

### Recommendation 1: Keep AI execution centralized in Alive

The sandbox should be a tool target, not the place where model access lives.

Keep this invariant:

- model calls happen through Alive
- OAuth and model tokens stay under Alive control
- sandboxes never become autonomous token holders by default

This matches the current worker-pool design and should remain true even when you add background agents.

The practical reason is not just security. It is platform coherence. Once token-bearing execution is fragmented across long-lived sandboxes, every later concern becomes harder:

- spend controls
- retries
- background scheduling
- emergency shutdown
- policy updates
- model switching

Centralization keeps those concerns cheap.

It also keeps future changes cheap. If Alive wants to change models, providers, routing policy, or billing logic later, it can do that in one place. A system that has already pushed too much autonomy into long-lived sandboxes becomes expensive to evolve.

### Recommendation 2: Make "persistent" mean "restorable", not "always running"

This should be the default operating model.

- Keep only the active set running.
- Pause or snapshot idle sites.
- Resume on demand for chat, terminal, preview, or rebuild.

E2B already supports the lifecycle primitives:

- pause/resume in the API spec: [`../../e2b/infra/spec/openapi.yml`](../../e2b/infra/spec/openapi.yml)
- snapshot creation in the same spec

Alive should adopt that instead of treating `sandbox_status=running` as the steady state for every E2B site.

### Recommendation 3: Pick a real source of truth for site state

There are two viable options.

#### Option A: Snapshot-backed state

Recommended for the lowest ops burden.

- Store `latest_snapshot_id` per domain.
- On idle timeout, snapshot the sandbox and mark it paused.
- On next activity, resume from the latest snapshot.
- Only create a fresh sandbox from the host workspace for the first boot or explicit repair flow.

Why this fits Alive:

- It uses E2B's native lifecycle instead of inventing your own file replication system.
- It avoids trying to mirror arbitrary Bash side effects back into a host directory.
- It matches the real Firecracker/E2B model.

#### Option B: Durable host workspace plus sandbox as cache

Only choose this if you want the host filesystem to remain canonical.

- Move scratch workspaces out of `/tmp`.
- Make file mutations persist to the durable host workspace.
- Sync host -> sandbox on resume/create.

This is harder than it sounds because Bash commands inside the sandbox can change many files, not just the files touched through `Read`/`Write`/`Edit`.

For Alive, snapshot-backed state is simpler and more correct.

### Recommendation 4: Only allocate sandboxes when the task actually needs them

This should be an explicit policy decision in Alive.

Default path:

1. agent starts in platform worker
2. if task stays planning/research/orchestration, no sandbox
3. if task needs workspace mutation or command execution, allocate code-work sandbox
4. if task needs compile or publish, enqueue build sandbox

This gives you multiple capacity layers instead of one expensive shared pool.

The important improvement here is conceptual clarity:

- "agent exists" should not imply "sandbox exists"
- "site exists" should not imply "sandbox exists"
- "build may happen later" should not imply "build capacity is reserved now"

Those three decouplings are where the operational leverage comes from.

This is the strongest argument in the document:

- decouple agent existence from sandbox existence
- decouple site existence from sandbox existence
- decouple build possibility from reserved build capacity

If those are kept separate, tenant count can grow much faster than always-on compute.

### Recommendation 5: Separate editing/build sandboxes from published runtime

This is the biggest economic win.

Do not assume every website needs an always-on Firecracker VM.

Use three classes:

- Static or mostly-static sites: build once, serve from disk/Caddy/CDN, no always-on sandbox.
- Editable preview sites: sandbox only when someone is editing, previewing, or rebuilding.
- Truly dynamic apps: small dedicated runtime pool, only for the minority that need it.

This matters because Alive's current E2B path is not yet a full public-routing runtime. Even the rollout doc says preview-proxy routing into sandbox is deferred.

If you force one always-on sandbox per site, costs and ops both scale badly.

### Recommendation 6: Add a small lifecycle controller inside Alive

Do not build a complex scheduler. A small control loop is enough.

Suggested control-plane fields per domain:

- `last_activity_at`
- `latest_snapshot_id`
- `desired_runtime_state` (`cold`, `running`, `paused`, `broken`)
- `last_resume_at`
- `last_snapshot_at`
- `sandbox_generation`

Suggested behavior:

1. Chat/terminal/preview/build request arrives.
2. If sandbox is running, connect.
3. If paused, resume latest snapshot.
4. If dead and snapshot exists, restore from snapshot.
5. If dead and no snapshot exists, seed from template or durable workspace.
6. If idle for N minutes, snapshot and pause.

This is one worker or cron-style loop, not a new platform.

### Recommendation 7: Make non-chat entrypoints capable of cold-starting

Right now, some routes fail with `SANDBOX_NOT_READY`.

That is okay for initial rollout, but it will hurt the pause/resume model.

At minimum, these paths should be able to trigger or wait for resume:

- terminal lease
- file read/write routes
- preview entrypoint

Otherwise you will pause sandboxes to save money and immediately create UX regressions.

## Planning Numbers

Alive already has a rough experimental baseline in:

- [`apps/experimental/e2b-test/src/full-benchmark.ts`](../apps/experimental/e2b-test/src/full-benchmark.ts)
- [`docs/architecture/e2b-sandbox-routing.md`](./architecture/e2b-sandbox-routing.md)

The current numbers are useful for planning:

- cold first call after sandbox create: about 4-5s
- sub-1MB file reads and writes: roughly 30-80ms
- 5MB file reads and writes: roughly 500-1000ms

That is good enough for editing and tool execution.

It is not the right latency budget for anonymous public traffic. That is another reason to keep published serving separate from sandbox cold starts.

It is also a good reason not to allocate a sandbox too early. If the task can stay in the platform layer, you avoid paying the 4-5s cold-create penalty entirely.

## Immediate Checks For The Current "Hard Stop"

Run these on the E2B node first.

```bash
ls /dev/nbd*
cat /sys/module/nbd/parameters/nbds_max
cat /sys/module/nbd/parameters/max_part
ip netns list | wc -l
free -h
grep Huge /proc/meminfo
```

Also look for these failure patterns in orchestrator logs:

- `max number of running sandboxes on node reached`
- `too many sandboxes starting on this node`
- `no free slots`
- network namespace creation failures

Interpretation:

- Exact cap at 8: check NBD first, then network slots.
- Messy failures under load: check RAM, hugepages sizing, and CPU contention.
- Slow or stuck starts: check node-level start concurrency and build pressure.

## Suggested Rollout Plan

### Phase 1: Remove obvious hard caps

- Increase `nbds_max` to something sane like 64 or 128.
- Verify network slot headroom.
- Verify node-level sandbox caps are above your actual target.
- Queue builds so build spikes do not starve interactive sandboxes.

### Phase 2: Introduce workload classes in Alive

- Always-on worker agents with no sandbox by default.
- On-demand code-work sandboxes.
- Separate queued build sandboxes.
- Optional premium always-on runtime only where justified.

This phase is more important than prematurely raising total sandbox count. If the workload classes are wrong, extra capacity just hides the architectural mistake for a while.

It also makes later scaling decisions legible. Once workloads are separated, you can answer questions like:

- do we need more workers?
- do we need more mutation sandboxes?
- do we need more build slots?

Without that separation, every capacity issue looks like "we need more servers", which is usually the wrong conclusion.

### Phase 3: Make snapshots first-class in Alive

- Add `latest_snapshot_id` and lifecycle timestamps to the domain runtime model.
- Snapshot idle sandboxes.
- Resume from snapshot on first user activity.
- Stop treating `running` as the only healthy steady state.

### Phase 4: Split published runtime from editing runtime

- For static sites, publish artifacts and serve them cheaply.
- For dynamic sites, keep only the minority on always-on runtime.
- Use E2B primarily for editing, preview, and build.

### Phase 5: Only then scale tenant count

Once the system is snapshot-backed, you can support many more websites because:

- dormant sites cost mostly storage, not RAM
- active density depends on concurrent usage, not total tenant count
- ops work stays bounded

---

**Everything above this line is the core advisory — tailored to Alive, argued from our constraints, and ready to act on.**

**Everything below is exploratory research: observations from a production sandbox platform, build platform thinking, and open questions. None of it is decided. It is here to inform decisions, not to prescribe them.**

---

## Exploratory: Production Sandbox Platform Observations

A production sandbox platform was inspected from inside. Raw findings are in [`docs/lovable.md`](./lovable.md). This section argues why specific patterns do or do not apply to Alive. The observations are evidence; the recommendations are justified from Alive's own constraints.

### Stable Project Identity With Pooled Execution

The observed platform uses stable per-project hostnames independent of which sandbox backs them, with separated state dimensions (project state, sandbox readiness, deployment status). See [`lovable.md` § Status Endpoint](./lovable.md#status-endpoint) and [§ Pod Pool & Claim](./lovable.md#pod-pool--claim).

**Why this matters for Alive:**

Alive already has domain records as project identity (`app.domains`) with a mutable `sandbox_id` binding. The pattern is confirmed. What Alive lacks is the **indirection layer** that makes the binding seamless.

Today, if an E2B sandbox dies, non-chat routes fail with `SANDBOX_NOT_READY`. That is because routes check `sandbox_status` and give up. Alive needs this distinction because:

1. **Alive's automation system runs agents without user sessions.** A job triggering while a sandbox is paused should not fail — it should work without a sandbox or trigger a resume.
2. **Alive's preview-proxy routes by domain, not by sandbox.** If the resolution layer handles "sandbox is cold, warm it up," the user never sees `SANDBOX_NOT_READY`.
3. **Alive runs on two servers with limited resources.** Pooled execution is mandatory, not optional.

**Separated state is needed because Alive has three independent systems reading one field:**

- **Automation engine** cares about agent availability
- **Chat UI** cares about sandbox readiness
- **Deployment pipeline** cares about deployment status

Today these are entangled via a single `sandbox_status` field. A build failure makes the chat UI think the project is broken. A paused sandbox makes the automation engine think the agent is unavailable. Recommended fields per domain:

- `agent_available`: boolean (always true if automation is configured)
- `sandbox_status`: `cold | warming | running | paused | broken`
- `deployment_status`: `none | building | deployed | failed`
- `target_commit` or `workspace_version_id`

### Runtime Error Capture

The observed platform captures structured runtime errors from previews and feeds them back to the agent via a "Try to fix" button. The `has_blank_screen` boolean is the key severity signal. See [`lovable.md` § Error Capture](./lovable.md#error-capture).

**Why Alive needs this:**

Alive's core constraint is "agents do what they promise, no mistakes." Right now, agents are blind after a tool call completes. The agent runs `Write`, the tool succeeds at the filesystem level, and the agent moves on — even if the change broke the app. That gap between promise and reality must close.

The implementation for Alive:

1. **Inject error capture via `@alive-game/alive-tagger`** (already a Vite plugin that injects into preview iframes). Add `window.onerror` and `window.onunhandledrejection` handlers that post structured errors to the parent frame via `postMessage`.

2. **`has_blank_screen` is the most important field.** It determines whether the agent should stop and fix immediately (total failure) or continue and batch the fix later (degraded but functional).

3. **Error payloads should enter the agent's conversation as tool results, not UI toasts.** The agent needs the structured payload to reason about what to fix.

4. **The feedback loop — code → preview → error → agent → fix → preview — is the product.** Not a debugging feature. HMR makes the fix visible in seconds if the loop is tight.

5. **Error types route differently:**
   - `has_blank_screen: true` → fix immediately or revert
   - Runtime error without blank screen → fix after current task
   - Build/compile error → different diagnostic path
   - Console warning → ignore unless the user asks

6. **Must run continuously, not just during agent turns.** Errors happen on hot reload, on user interaction, on async data fetch — not during tool calls.

### Git Persistence

The observed platform persists code via git with dual remotes, edit branches per agent session, and reset-merge to main. See [`lovable.md` § Git Model](./lovable.md#git-model).

**Why git is right for Alive — argued from Alive's gaps, not from their choices:**

Today, Alive's E2B path copies a template into `/tmp/alive/e2b-workspaces`, syncs it into a sandbox, and the sandbox holds the only copy. If the sandbox dies, edits may be lost. The scratch workspace under `/tmp` is not durable. There is no way to inspect, diff, or roll back changes without a running sandbox.

Git fixes all of these:

- **Durability**: survives sandbox restarts, crashes, and recycling
- **Diffability**: the agent can see what changed, enabling rollback
- **Inspectability**: code accessible without a running sandbox
- **Branchability**: experimental changes don't risk the working state
- **Independence from sandbox lifecycle**: `workspace_version_id` maps to a commit hash

E2B snapshots remain useful for resuming running processes (dev servers, terminal state). But for code persistence, git is strictly better — lightweight and inspectable vs heavyweight and opaque.

Recommended model:
- Code persists via git. Auto-commit on idle or sandbox pause.
- Git storage is durable and external to the sandbox (bare repo on host, or push to remote).
- Snapshots are optional, for resuming warm state — not for avoiding code loss.
- `/tmp/alive/e2b-workspaces` becomes a cache, not canonical storage.

### Environment Reproducibility

The observed platform uses Nix flakes with layered profiles and disabled Nix sandboxing (the VM is the boundary). See [`lovable.md` § Nix Profiles](./lovable.md#nix-profiles-layered).

**What this means for Alive:**

At one E2B template, reproducibility is not a problem. At 5+ templates, it becomes one. The useful lesson is **layered composition** — one base template, compose capabilities at creation time — not one image per combination. This can be done with simpler mechanisms than Nix (startup `.mjs` scripts, E2B snapshots from a common base).

The gVisor isolation boundary validates Alive's approach: E2B uses Firecracker (even stronger than gVisor), so no second sandboxing layer is needed inside the sandbox.

### Sandbox Runtime

The observed platform runs a compiled Rust/Axum binary (HTTP + gRPC on port 3004) with dev server control, WebSocket multiplexing for code/terminal, port proxying, git operations, and deployment orchestration. See [`lovable.md` § Sandbox Runtime Binary](./lovable.md#sandbox-runtime-binary).

**Alive should build the same functionality as `.mjs` scripts, not Rust:**

1. **Alive's stack is JS/TS.** A Rust binary adds a separate build pipeline and debugging story.
2. **`.mjs` files are inspectable and instantly editable.** No recompile, no template rebuild.
3. **E2B sandboxes already have Node/Bun.** No runtime dependency to add.
4. **The functionality is I/O-bound, not CPU-bound.** Rust's performance advantages don't apply. The one exception is port-proxying — but Alive's preview-proxy handles that externally.
5. **Alive's scale doesn't justify compiled infrastructure.** Tens of sandboxes on two servers vs thousands of pods on Fly.io.

The `.mjs` sandbox runtime should handle:
- Health/status endpoint with controllable lifecycle (start/stop)
- WebSocket for code/terminal (consolidating current separate routes)
- Port detection and reporting
- Git operations (push on deployment)
- Error capture injection
- Process supervision (dev server lifecycle, restart on crash)

These files will be provided separately and integrated into the E2B template.

### Summary: What Applies To Alive

| Observation | Applies? | Why / Why Not |
|---|---|---|
| Stable project identity, pooled execution | **Yes** | Already have domain records. Need the indirection layer. Limited servers make pooling mandatory. |
| Separated state (agent / sandbox / deploy) | **Yes** | Single `sandbox_status` entangles three systems. Separation fixes real bugs. |
| Structured runtime error capture | **Yes** | "Agents do what they promise" requires seeing runtime errors. Already have the Vite plugin mechanism. |
| `has_blank_screen` severity signal | **Yes** | Key triage: stop and fix, or continue? |
| Git persistence | **Yes** | Current `/tmp` persistence is fragile. Git solves durability, diffability, sandbox-independence. |
| Nix flakes for env definition | **Not yet** | One template = no problem. Layered composition principle applies, simpler mechanisms available. |
| VM as isolation boundary | **Yes (validates)** | Confirms no second sandboxing layer needed inside E2B. |
| Compiled Rust sandbox runtime | **No — .mjs instead** | Same functionality, our stack, inspectable. Rust justified at their scale, not ours. |
| Fly.io + gVisor pod pool | **N/A** | Alive uses self-hosted E2B/Firecracker. Pooling concept applies; infrastructure doesn't. |
| tigrisfs / S3 FUSE | **Later** | Git solves the immediate persistence problem. Evaluate when workspace sizes outgrow git. |

For raw observations, see [`docs/lovable.md`](./lovable.md).

## What Not To Do

- Do not equate "many websites" with "many always-running sandboxes".
- Do not equate "always-on agents" with "always-on sandboxes".
- Do not rely on `/tmp/alive/e2b-workspaces` as the long-term source of truth.
- Do not build a complicated dual-write layer before trying snapshots.
- Do not mix CPU-heavy builds and latency-sensitive interactive sandboxes without a queue.
- Do not optimize hugepages first if the current symptom is a clean hard cap.

## Recommended Default Decision

If the goal is "many websites, low budget, low ops", the default answer should be:

- Alive workers and automations as the always-on agent layer
- E2B only when the task actually needs code execution
- separate queued build capacity for compile and publish work
- E2B for isolated editing and preview compute
- snapshots for persistence
- cheap static or lightweight runtime for published sites
- only a small active sandbox set at any time

That is the simplest model that matches both how self-hosted E2B actually works and how Alive is already structured.

The strongest version of the argument is:

- keep cognition centralized
- allocate isolation only when side effects begin
- queue heavy compute instead of reserving it
- store persistence separately from active compute

That is the only version of this system that scales tenant count without scaling ops burden at the same rate.

---

## Exploratory: Build Platform, Execution Routing, and Deployment Architecture

The clean model is not "always-running sandbox per user." It is "always-available agent control plane with on-demand execution." E2B already gives us the primitives that make that possible: pause/resume preserves sandbox state, snapshots capture filesystem plus memory and can spawn new sandboxes from that exact state, and templates can start with prestarted processes for near-zero-wait launches. That makes E2B a good coding and preview substrate, not the permanent home of every user's agent or every published app.

### The Blunt Recommendation

Build four layers, not one:

1. **Control plane** on the Alive platform: agent state, schedules, tool policy, token budget, secrets, audit, billing.
2. **Tool-only workers** for API/database/automation work that does not need a filesystem or shell.
3. **E2B coding sandboxes** only when the agent needs to read/write code, run commands, or host a live preview.
4. **Dedicated build workers** for builds, and a **separate runtime plane** for published apps.

That gives "always-on agents" in product terms without paying for always-on sandboxes in infrastructure terms. It also matches E2B's model much better than treating sandboxes as durable app servers.

Two very practical consequences follow from that:

- Do **not** use E2B as the main build fleet. E2B's own Docker template docs recommend at least 2 CPUs and 2 GB RAM just to run Docker containers, while BuildKit is purpose-built for efficient parallel builds, cache import/export, distributable workers, and multiple output formats.
- Do **not** use E2B as the public serving layer for most apps. Request-driven invocation platforms (functions, routing, CDN primitives) use max-duration limits, archived idle functions, and read-only filesystems except `/tmp` — a very different model from arbitrary long-running custom backends.

### Where The Builds Should Happen

On **Alive's infrastructure**, on a **small dedicated BuildKit worker pool**. Not in the user's coding sandbox, and not primarily on an external hosting platform. BuildKit exists to turn source into artifacts efficiently and repeatably; it emphasizes parallelism, cache handling, multiple outputs, and worker distribution. `buildx bake` also lets multiple targets run in parallel, which is exactly what Alive needs for multi-app Turborepos.

External hosting platforms (Vercel, Netlify, etc.) should be **optional deployment targets**, not the center of gravity. They can absolutely be part of the story — Vercel supports multiple runtimes, has a Build Output API, `vercel build` can run in your own CI, and `vercel deploy --prebuilt` can upload prebuilt `.vercel/output` artifacts. But they still pull you into their runtime primitives, which is not the right abstraction if the goal is "full backends, custom setups, user-controlled architecture."

So the default answer is:

- **Own the build plane**
- **Own the agent control plane**
- **Use external hosting only as one possible target for some frontend apps**
- **Use a separate runtime plane for full backends**

### How To Build A Turborepo-Only Build Platform

This is the part where narrowing scope helps a lot.

#### 1. Standardize hard

Support **Turborepo 2.x only** and pick **one package manager**. Pick **pnpm** and refuse npm/Yarn/Bun at launch, even though Turborepo supports them. Supporting multiple lockfile formats and install behaviors is noise, not leverage. Turborepo supports multiple managers; that is exactly why Alive should narrow rather than inherit all of that complexity.

#### 2. Define one deploy contract per app

Each deployable app in the repo should declare a small manifest:

- `kind`: `static | node-service | worker | vercel-web | docker-custom`
- `entry`: workspace name
- `buildTask`: usually `build`
- `runtime`: port, healthcheck, start command, env schema
- `output`: `static-dir | oci-image | vercel-output`
- `migrations`: optional predeploy job

Do not try to infer everything from framework magic. Give users flexibility through a small explicit contract.

#### 3. Make the sandbox non-canonical

This is the biggest architectural point.

The **source of truth** for code must be a **workspace version**, not a sandbox ID. That workspace version can be:

- a commit/branch in the user's Git provider, or
- a versioned tarball/object-store workspace if there is no upstream Git repo.

Build jobs, previews, and deployments should all reference `workspace_version_id`. E2B sandboxes are then just fast, isolated execution caches for that version.

That one choice removes a huge amount of future pain.

#### 4. Use Turborepo for planning, not just running

Turborepo already understands package relationships and task relationships through the package graph and task graph, and it supports source-control-based filtering for affected work. That means the planner can ask "which deployable apps are affected?" without inventing a second monorepo graph engine.

#### 5. Build minimal contexts, not whole repos

For each deployable app, run:

```bash
turbo prune <app> --docker
```

That gives a pruned workspace, a pruned lockfile, and the split `out/json` / `out/full` structure specifically meant to improve Docker layer caching. Pair that with `pnpm fetch` so dependency prefetching depends only on the lockfile/workspace metadata, then do offline install in the container. The universal path should be `turbo prune --docker` + OCI build.

#### 6. Use BuildKit as the builder, not Dockerfiles alone

Use `docker buildx build` or `docker buildx bake` as the execution backend. BuildKit can:

- parallelize independent stages
- import/export cache
- export local, registry, tarball, and OCI outputs
- attach provenance and SBOM attestations
- use temporary build secrets

Important detail: for real credentials, prefer **BuildKit secret mounts**. Docker's build secrets are explicitly temporary and available only for the instruction that needs them, which is safer than leaning on ARG/ENV patterns.

#### 7. Use remote caching, but do not build a custom cache server first

Turborepo remote cache should be on from day one. The simplest path is Vercel Remote Cache, because it is free even without hosting apps on Vercel. If policy or privacy requires it, Turborepo also documents a self-hosted Remote Cache API, `turbo link --api`, and `TURBO_API`.

The catch: environment-variable handling affects cache correctness, and logs are artifacts. Turborepo supports signed cache artifacts via `TURBO_REMOTE_CACHE_SIGNATURE_KEY`. Cache is not just a performance feature; it is also a correctness and security boundary.

#### 8. Emit only three artifact types

Keep the output contract tiny:

- **Static directory** for static sites
- **OCI image** for services/workers/full backends
- **`.vercel/output`** for the subset of apps the user wants on external hosting platforms

BuildKit can emit local and registry/OCI outputs, and external platforms can consume prebuilt output directories. That single design choice keeps the platform flexible without becoming a generic PaaS.

### What The Agent System Should Actually Do

Route work like this:

- **API/tool automation only**: run on cheap tool workers, no sandbox.
- **Code reading/writing or shell work**: start/resume E2B sandbox.
- **Preview needed**: sandbox only while someone is editing or reviewing.
- **Build or deploy requested**: enqueue a job to the build plane.
- **Published runtime needed**: deploy artifact to runtime plane or external target.

That means "not all agents need to write code" becomes a first-class routing rule, not a side effect. The default path is cheap and light; sandbox escalation happens only when the agent crosses into filesystem or command execution.

Also: keep **all model calls and tool calls routed through the Alive platform**. Sandboxes and workers should receive only short-lived capability tokens to talk back to the gateway. Do not put raw model-provider keys or broad third-party credentials in sandboxes.

### The Real Hard Problems

These are the hard problems that matter, in order.

1. **Canonical workspace state.**
   If builds depend on live sandbox state, the whole system stays fragile. Solve this with `workspace_version_id` first.

2. **Execution routing.**
   A deterministic policy for no-sandbox vs sandbox vs build-worker vs runtime deployment. This is product architecture, not infra trivia.

3. **Cache correctness and trust.**
   Turborepo warns that env vars affect cache correctness and that logs are artifacts. Signed cache artifacts are worth turning on.

4. **Secrets and token custody.**
   The control-plane promise means secrets stay with Alive. Workers and sandboxes get narrow, short-lived access.

5. **Artifact contract.**
   If the team does not decide early that outputs are `static-dir | oci-image | vercel-output`, the platform will sprawl.

6. **Build isolation and scheduling.**
   Build load should scale builder capacity, not E2B capacity. Separate queues, quotas, and concurrency limits.

7. **Preview/runtime split.**
   Editing and preview are one problem; public serving is another. Do not collapse them.

8. **Support boundary.**
   "Custom setups" does not mean "support everything." It means "support a small number of runtime kinds with one escape hatch."

9. **Observability and billing.**
   End-to-end traces from agent -> tool -> sandbox -> build -> deploy, plus cost attribution per user/workspace/job.

10. **Avoiding experimental foundations.**
    Do not build the core platform on experimental Turborepo features like `turbo query` or `turbo boundaries`. Those are still labeled experimental.

### The Noise To Ignore

Do not spend early cycles on:

- building a custom remote-cache server first
- using E2B as the build fleet
- supporting multiple package managers at launch
- public production serving from sandboxes
- deep framework-specific adapters
- trying to make every agent physically always-on

And one E2B-specific nuance: snapshots are great, but they briefly pause the source sandbox and drop active connections while capturing state. Use them on idle, before risky operations, and before teardown — not constantly during active terminal sessions.

### The Default Decision (Extended)

If this had to be locked in today:

- **Agents are logically always-on, not compute-always-on**
- **Default execution is tool-only**
- **E2B is only for code/preview/shell work**
- **Builds happen on dedicated BuildKit workers**
- **Git or versioned workspace storage is the canonical source of truth**
- **Artifacts are static dirs, OCI images, or optional `.vercel/output`**
- **External hosting platforms are optional targets, not the center of the platform**

That cuts through most of the noise. It gives full backends, keeps token control centralized, avoids "sandbox per user forever," and keeps the platform narrow enough to ship.

The next useful move is to define the `workspace_version`, `build_job`, and app manifest schema before touching more infra.

---

## Still To Explore

Open questions for Alive. For reference observations from a production platform, see [`docs/lovable.md`](./lovable.md).

### 1. Git persistence: how exactly?

**Alive today:** Scratch workspace under `/tmp/alive/e2b-workspaces`. One-way sync host → sandbox. Sandbox holds the only copy. If it dies, edits may be lost.

**Direction:** Git repo inside every E2B workspace, auto-commit on idle or pause. Remote could be a bare repo on the host, or push to user's GitHub if connected. Edit branches (one per agent session) give free rollback. The `/tmp` scratch workspace becomes a cache, not canonical storage. (The observed platform uses this approach — see [`lovable.md` § Git Model](./lovable.md#git-model).)

**Undecided:**
- Commit frequency: every Write/Edit? On a timer? On idle? On sandbox pause?
- Non-code state (node_modules, build artifacts, running processes) — git doesn't capture these. E2B snapshots do.
- Interaction with E2B's filesystem.
- **Risk:** getting the sync model wrong creates a more complex version of the same problem. Prototype first.

### 2. Sandbox runtime `.mjs` files

**Alive today:** MCP tools injected from the host (`packages/sandbox/src/e2b-mcp.ts`). No sandbox-side runtime process. No health endpoint. No port detection. No git integration inside the sandbox.

**Direction:** `.mjs` scripts running inside the sandbox, handling:
- Health/status endpoint with controllable lifecycle
- Dev server lifecycle control (start/stop)
- WebSocket for code/terminal (consolidating current separate routes)
- Port detection and reporting
- Git operations (push on deployment)
- Error capture injection
- Auto-shutdown on idle

Files will be provided separately. (For what a compiled runtime looks like at scale, see [`lovable.md` § Sandbox Runtime Binary](./lovable.md#sandbox-runtime-binary).)

### 3. Preview routing for cold sandboxes

**Alive today:** Caddy → preview-proxy → port. E2B sites fail with `SANDBOX_NOT_READY` if sandbox is not running.

**Options:**
- Return 503, UI shows "starting..."
- Block, trigger sandbox resume, then proxy (adds latency but seamless)
- Return a loading page that auto-refreshes

This is a product decision. Need to decide the UX for cold-start before implementing. (The observed platform routes externally via edge proxy — see [`lovable.md` § Preview & HMR](./lovable.md#preview--hmr).)

### 4. WebSocket/HMR across sandbox lifecycle

**Alive today:** `@alive-game/alive-tagger` for source location injection. HMR reconnection not handled (sandboxes not yet paused/resumed).

**Finding:** The observed platform uses Vite's built-in reconnect with no custom wrapper, and it works across pod recycling. If resume-from-snapshot takes <5s, Vite's retry should catch it. No custom wrapper needed.

**Still need to measure:** resume-from-snapshot latency on self-hosted E2B.

### 5. Build pipeline

**Alive today:** Sites built and served by the same systemd service. No production build pipeline for E2B sites.

**Direction:** The core advisory recommends separating build from editing sandbox. At current scale (~50 sites), `bun run build` inside the E2B sandbox is simpler and probably good enough as a first step. Migrate to a separate build system when contention becomes real. (The observed platform builds inside the sandbox too — see [`lovable.md` § Build & Deploy](./lovable.md#build--deploy).)

### 6. Cold start and idle shutdown

**Alive today:** E2B sandbox cold create: ~4-5s (from benchmarks). No idle shutdown. No auto-pause.

**Direction:** E2B with snapshots should be faster than cold create. Implement idle shutdown (5-10 min) and snapshot-on-pause as recommended in the core advisory. (The observed platform shuts down after 6 min idle, cold starts in ~2 min including npm install — see [`lovable.md` § Shutdown](./lovable.md#shutdown).)

### 7. Turborepo for user projects

**Alive today:** Single Vite apps. The Alive monorepo uses Turborepo, but user projects do not. The observed platform also runs single Vite apps — no monorepo support.

**Verdict:** The Turborepo/BuildKit/pnpm recommendations in the build platform section are premature. Single Vite apps is the right scope for now.

### 8. Secrets and env var handling

**Alive today:** User env vars not yet handled for E2B sandboxes. Systemd sites use `.env` files. (The observed platform injects secrets at claim time and via gRPC — see [`lovable.md` § Pod Pool & Claim](./lovable.md#pod-pool--claim).)

**Undecided:**
- Where do user secrets live? Supabase? A vault?
- Injected at sandbox creation, or on demand?
- Scoped to sandbox lifetime or project lifetime?
- What happens on pause/resume?

### 9. Remaining unknowns

See [`lovable.md` § What We Still Don't Know](./lovable.md#what-we-still-dont-know) for gaps in the competitive research. The questions most relevant to Alive:

- **Concurrent editing** — does Alive need multi-writer? Probably not at current scale (single-writer is fine).
- **Build artifact serving** — how does code in a sandbox become a live published site? CDN upload? Static file hosting? This is Alive's biggest open product question.
