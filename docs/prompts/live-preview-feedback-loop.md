# Prompt: Live Preview Feedback Loop for E2B Sandboxes

## Goal

Build the live preview feedback loop for E2B sandboxes. This is the single most impactful feature for making the product feel real: the agent writes code, the user sees the result updating in real-time in the preview iframe, and if the app breaks, the agent knows immediately and fixes it without the user doing anything.

Today, a user on an E2B sandbox cannot see what the agent built. Preview-proxy routing into sandboxes is "out of scope" per the rollout doc. That is not a missing feature — that is a missing product.

## What Exists Today

Read these files first to understand current state:

### Sandbox infrastructure
- `packages/sandbox/src/manager.ts` — SandboxManager: create/connect/reconnect E2B sandboxes, sync workspace files, keyed by domain_id
- `packages/sandbox/src/e2b-mcp.ts` — MCP tools (Read, Write, Edit, Bash) that execute inside the sandbox. Note: Write/Edit succeed at the filesystem level but currently have no way to know if the change broke the app
- `packages/sandbox/src/constants.ts` — E2B template names, workspace root (`/home/user/project`)
- `docs/architecture/e2b-sandbox-routing.md` — The rollout plan. Section 4 "Deferred Features" explicitly lists "Preview proxy routing into sandbox" as out of scope. That is what you are building.

### Preview proxy (currently systemd-only)
- `apps/preview-proxy/main.go` — Go reverse proxy that maps `preview--{domain}.alive.best` to `localhost:{port}`. Reads port mappings from a JSON file (`/var/lib/alive/generated/port-map.json`). Currently only handles systemd sites where ports are on localhost. For E2B sandboxes, the dev server runs inside a Firecracker VM, not on localhost.

### Alive tagger (already injected into previews)
- `packages/alive-tagger/src/client.ts` — Injected into preview iframes via a Vite plugin. Handles element selection (Cmd/Ctrl+click → sends `postMessage` to parent with file:line info). Already uses `window.parent.postMessage()` to communicate from iframe to workbench. This is the same mechanism error capture should use.
- `packages/alive-tagger/src/plugin.ts` — Vite plugin that injects the tagger. This is where error capture injection should also go.

### Workbench (the preview UI)
- `apps/web/features/chat/components/workbench/hooks/usePreviewEngine.ts` — Manages the preview iframe. Already listens for `postMessage` from alive-tagger.

### Error codes
- `apps/web/lib/error-codes.ts` — Has `SANDBOX_NOT_READY` error code. Terminal lease, file read/write/delete all return 503 with this code when sandbox isn't running.
- `apps/web/features/chat/components/workbench/WorkbenchTerminal.tsx` — Already handles `SANDBOX_NOT_READY` with auto-retry (up to MAX_SANDBOX_RETRIES).

## The Problem in Three Parts

### Part 1: Preview routing into E2B sandboxes

The preview-proxy (`apps/preview-proxy/main.go`) currently maps hostnames to localhost ports. E2B sandboxes expose ports via `https://{port}-{sandboxId}.{e2bDomain}` (e.g. `https://5173-abc123.e2b.sonno.tech`). The proxy needs to handle both:

- systemd sites: `preview--example.alive.best` → `localhost:3456` (existing)
- E2B sites: `preview--example.alive.best` → `https://5173-{sandboxId}.e2b.sonno.tech` (new)

This means the port-map JSON (or a new lookup mechanism) needs to include E2B sandbox routing info for E2B domains. The proxy needs to know: is this domain systemd or e2b? If e2b, what is the sandbox_id and what port is the dev server on?

Key constraint: E2B's port URLs use HTTPS with their own TLS. The preview-proxy needs to proxy to an HTTPS upstream, not just localhost.

### Part 2: Error capture from the preview iframe

When the user's app crashes inside the preview, Alive's agent is currently blind. The agent runs Write/Edit, the tool succeeds at the filesystem level, and the agent moves on — even if the change broke the app completely.

Build a structured error capture system:

1. **Inject error listeners into the preview.** Extend `@alive-game/alive-tagger` (or add a sibling) to also inject:
   - `addEventListener("error", ...)` to avoid overwriting existing handlers
   - `addEventListener("unhandledrejection", ...)` to avoid overwriting existing handlers
   - React error boundary detection (check if `#root` is empty after an error)

2. **Structured error payload via postMessage:**
```typescript
interface PreviewError {
  type: "alive-preview-error"
  timestamp: number
  error_type: "RUNTIME_ERROR" | "UNHANDLED_PROMISE_REJECTION" | "COMPILE_ERROR"
  message: string
  stack: string | null
  filename: string | null
  lineno: number | null
  colno: number | null
  has_blank_screen: boolean  // THIS IS THE KEY FIELD
}
```

3. **`has_blank_screen` detection:** After an error fires, check:
```typescript
const root =
  document.getElementById("root") ??
  document.getElementById("__next") ??
  document.querySelector("[data-alive-root]")

const hasBlankScreen = root
  ? root.children.length === 0 && root.textContent?.trim() === ""
  : document.body.textContent?.trim() === ""
```
This is the single most important triage signal. It determines whether the agent should drop everything and fix immediately (blank screen = total failure) or continue and batch the fix.

### Part 3: Feeding errors back to the agent

The error payload needs to reach the agent's context. Two approaches:

**Approach A (simpler, do this first):** The workbench UI receives the `postMessage`, stores the error, and shows a "Try to fix" button. When clicked, it sends a new chat message containing the structured error. The agent receives it as a normal user message with the error context.

**Approach B (later):** The error is injected into the agent's conversation as an automatic tool result or system event, so the agent sees it during its current turn and can react without user intervention.

Start with Approach A. It is simpler, requires no changes to the streaming protocol, and still closes the feedback loop.

## Implementation Order

### Step 1: E2B port discovery

The sandbox runtime needs to know what port the dev server is on. Options:
- Parse `/proc/net/tcp` inside the sandbox to detect listening ports
- Capture Vite's stdout when it prints "Local: http://localhost:5173/"
- Just use 5173 as the default (Vite's default) and let the user configure

Start with the simplest: the Bash tool already runs `bun run dev` in the sandbox. When the agent starts a dev server, it can report the port. Store it on the domain record alongside `sandbox_id`.

### Step 2: Preview-proxy E2B routing

Extend the preview-proxy to handle E2B domains. The port-map JSON or a new lookup source needs to provide:

```json
{
  "example.alive.best": {
    "mode": "e2b",
    "sandbox_id": "abc123",
    "port": 5173,
    "e2b_domain": "e2b.sonno.tech"
  }
}
```

The proxy constructs `https://5173-abc123.e2b.sonno.tech` and reverse-proxies to it. This must handle:
- HTTP requests (page loads, API calls)
- WebSocket upgrade (Vite HMR) — this is critical, without it every code change requires a full reload
- Proper Host header forwarding so Vite doesn't reject the request

### Step 3: Error capture injection

Extend the alive-tagger Vite plugin (or add a new plugin) to inject the error capture script. It should:
- Catch `window.onerror` and `window.onunhandledrejection`
- Detect blank screen state
- Post structured errors to parent via `postMessage`
- Work even when the app's default error overlay is still enabled
- If Alive controls the dev-server config, `overlay: false` can be set as an optimization so Alive owns the error UI

### Step 4: Workbench error handling

In the workbench UI (`usePreviewEngine` or a new hook):
- Listen for `alive-preview-error` messages from the iframe
- Display the error in the workbench panel
- Show a "Try to fix" button
- When clicked, compose a message like:
```text
Runtime error in the preview:

{error.message}

Stack trace:
{error.stack}

The screen is {error.has_blank_screen ? "blank — the app is completely broken" : "still partially working"}.

Please fix this error.
```
- Send this as a regular chat message to the agent

### Step 5: Agent awareness

No changes needed for Step 5 if using Approach A — the agent receives the error as a normal user message and fixes it using its existing tools.

## What NOT To Build

- Do not build a custom sandbox runtime binary. The `.mjs` files for that are coming separately.
- Do not build git persistence. That is a separate workstream.
- Do not build snapshot/pause/resume. That depends on the lifecycle controller.
- Do not change the NDJSON streaming protocol. Error capture feeds in as a normal chat message.
- Do not build cold-start handling in the preview-proxy yet. If the sandbox is not running, return 503. The `SANDBOX_NOT_READY` pattern already exists.

## Success Criteria

1. User on an E2B sandbox sends a message. Agent writes code and starts `bun run dev`.
2. The preview iframe shows the running Vite app via `preview--{domain}.alive.best`.
3. HMR works — when the agent edits a file, the preview updates without a full reload.
4. If the agent writes broken code (e.g. a React hook error), the error is captured and shown in the workbench with a "Try to fix" button.
5. Clicking "Try to fix" sends the error to the agent, which reads the error, identifies the problem, and fixes it.
6. The preview updates with the fix.

That loop — code → preview → error → agent → fix → preview — is the product.

## Reference: What a Production Platform Does

See `docs/advisory.md`, "Exploratory: Production Sandbox Platform Observations" section for detailed findings:

- Their sandbox runtime (Rust/Axum) exposes `/_port_{port}/*` for port proxying
- Standard Vite HMR with `overlay: false`, no custom reconnection wrapper — Vite's built-in reconnect is good enough
- Structured error capture with `has_blank_screen` boolean and "Try to fix" button
- Error payloads include `error_type`, `stack`, `filename`, `lineno`, `colno`, `timestamp`
- A "tagger" plugin similar to alive-tagger injects JSX source tracking for visual edits
