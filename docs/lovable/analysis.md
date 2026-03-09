# Analysis: What's Good, What's Bad

## What Most People Won't Realize Is Bad

### gVisor is a syscall tax on the worst possible workload

gVisor intercepts every syscall in user space. A Vite dev server is one of the most syscall-intensive things you can run — inotify watches on hundreds of files, constant module resolution through `node_modules`, HMR hot-path reads. Every single one pays gVisor overhead that doesn't exist on bare metal, Docker, or Firecracker. Users feel it as "slightly sluggish HMR" and blame Vite.

### The "warm pool" is a lie

Pods are pre-created (Kubernetes Deployment), but `node_modules` can't be pre-installed because the project isn't known until claim. The 2-minute cold start is dominated by npm install (317MB), not container boot. The warm pool saves ~1 second of container startup while you wait ~2 minutes for `bun install`. The `npm-cache.p.l5e.io` proxy helps but can't eliminate the work.

### No per-pod resource limits

No cgroup limits visible inside gVisor. 16 CPUs and 32GB RAM are shared across pods on the node. A runaway `vite build` or infinite loop in user code can starve neighbors. Resource enforcement is at the node level — coarser than you'd want for multi-tenant.

### The git history is fabricated

Single-file commits on `edit/edt-{uuid}` branches, then `git reset` merged to main. The user sees clean history. The actual history is hundreds of tiny commits per conversation, squashed away. You can never `git bisect` to find which agent action broke something.

### 115KB of JavaScript on every published site

`lovable.js` patches `window.fetch`, records the DOM via rrweb, intercepts console output, and opens a bidirectional postMessage channel. Every published site carries this payload and performance overhead — not just the dev preview. Users don't know their published site is being recorded and monitored.

## What Most People Won't Realize Is Good

### The Vite config override is the smartest thing in the stack

Instead of forking Vite or requiring users to modify their config, `lovable-exec` generates a Go-templated wrapper that imports the user's original `vite.config.ts` and merges lovable plugins (tagger, lovite) at runtime. The user's config is untouched. If the user has an unsupported config (`hasUnsupportedViteConfig`), it falls back gracefully. Feature-flagged for legacy projects. This is how you add platform capabilities without breaking user code.

### The task resolution chain is quietly brilliant

`lovable.toml` → `Justfile` → `package.json` scripts. Imported codebases work immediately because `lovable-exec dev` falls through to `package.json`'s `dev` script. Power users customize via `lovable.toml`. Polyglot projects use `Justfile`. Three layers, zero configuration required for standard projects. Most platforms require you to adapt to them — this adapts to you.

### Suspension/resume with Vite cache clearing

When a pod resumes from suspension, the system clears `node_modules/.vite` (Vite's pre-bundle cache). Without this, Vite serves stale optimized dependencies from before suspension, causing cryptic module errors. Three code paths handle it (success, failure, nothing-to-clear). Most teams would discover this bug in production after months. They engineered for it.

### The actor mailbox pattern for deployments

kameo actors with sequential mailbox processing means concurrent deploy requests are naturally serialized per-sandbox — no distributed locks, no Redis, no race conditions. For a single-pod-per-project model, this is the right abstraction.

### VIRTUAL_OVERRIDE for instant preview

The two-phase editing model (preview via DOM manipulation → commit via file write) means users see changes before they're real. This makes the product feel fast even when the agent is slow. The `VIRTUAL_OVERRIDE` mechanism in lovable.js overrides file content in-memory without touching disk — the ultimate optimistic update.

### LSP dual-mode validation

Running both LSP-based and legacy typechecking in parallel with OpenTelemetry comparison metrics (`lsp.typecheck.comparison`). Textbook migration strategy — measure agreement before cutting over.

## Implications for Alive

### What to copy
- Vite config override pattern (we already have `alive-tagger`, but not the auto-injection wrapper)
- Error capture with `blankScreen` boolean as severity signal
- The task resolution chain concept for imported codebases
- `VIRTUAL_OVERRIDE` for instant preview before commit

### What to avoid
- gVisor overhead on IO-heavy workloads (our E2B/Firecracker approach is better for this)
- 2-minute cold starts from npm install (pre-warm or cache `node_modules` per project)
- 115KB bridge script on published sites (keep preview-only vs published separate)
- Fabricated git history (give users real, meaningful commits)
