# Lovable Architecture Summary

One-page reference. For details, see individual files linked from [README.md](./README.md).

## System Overview

```
User → Platform API → [agent invocation: unknown] → Sandbox Pod (Fly.io/gVisor)
                                                          │
                                                ┌─────────┴─────────┐
                                                │  Rust binary      │  PID 1, 44MB
                                                │  (axum + kameo)   │  HTTP + gRPC on :3004
                                                │                   │
                                                │  ┌─────────────┐  │
                                                │  │ Git ops      │  │  gitoxide + git CLI
                                                │  │ Deploy actor │  │  serialized via mailbox
                                                │  │ Dev server   │  │  Vite on :8080
                                                │  │ PTY/terminal │  │  portable_pty
                                                │  │ Process mgmt │  │  mini-systemd (daemons)
                                                │  │ LSP bridge   │  │  :9999
                                                │  │ SQLite       │  │  in-memory deploy tracking
                                                │  └─────────────┘  │
                                                └───────────────────┘
                                                          │
                                                    git push
                                                          │
                                                    Platform → CDN
                                                    (published sites)
```

## Key Components

| Component | Language | Role | Lifecycle |
|-----------|----------|------|-----------|
| Sandbox binary | Rust | Pod PID 1 — git, deploy, dev server, PTY, process mgmt | Long-lived (hours) |
| `lovable-exec` | Go | Task runner — resolve + run dev/build/install/test | Invoked on demand |
| `lovable-skills` | Go | Unknown — likely Claude Code skill definitions | Invoked on demand |
| `lovable-agentmds` | Go | Unknown — likely CLAUDE.md generation | Invoked on demand |
| `apply-patch` | Go | Patch application — structured diffs to files | Invoked on demand |
| `lovable.js` | JS | 115KB CDN script — error capture, rrweb, element inspector | Every published site |

## Infrastructure

- **Host**: Fly.io Kubernetes (pods named `sandbox-pool-*`)
- **Isolation**: gVisor kernel (syscall interception, not container namespaces)
- **Resources**: 16 CPUs, 32GB RAM per shared node, N pods per node, no per-pod cgroup limits
- **Environment**: Nix flakes (nixos-25.11), pre-baked in image
- **Monitoring**: Sentry + OpenTelemetry + Spotify Confidence (feature flags)

## Lifecycle

1. **Warm pool**: Unclaimed pods run as K8s Deployment, bare repo at `/git/pool.git`
2. **Claim**: JWT auth, worktree created at `/dev-server/`, `.env` written, `node_modules` installed (~2 min)
3. **Active**: Dev server running, agent writes code, deploys via gRPC
4. **Suspend**: Cgroup freeze-in-place, filesystem persists
5. **Resume**: `.vite` cache cleared, `RESUMED_FROM_SUSPENSION` set
6. **Shutdown**: 360s grace, lifecycle events: `idle_timeout_expired` | `api_shutdown` | `signal_shutdown`

## Deployment Pipeline

```
gRPC StartDeploymentRequest
  → checkout target_commit
  → install (skip if package.json unchanged, keyed by deployment ID)
  → vite build
  → lol_html rewrite (inject lovable.js)
  → publish via git push to platform
  → platform distributes to CDN
```

- Concurrent deploys serialized by kameo actor mailbox (no distributed locks)
- `expect_head` precondition prevents force-push on moved HEAD

## Task Resolution Chain

```
lovable.toml [run] section  →  Justfile/justfile  →  package.json scripts
     (highest priority)           (fallback)            (default)
```

## Git Model

- Primary remote: `lovable.code.storage/{project-id}.git` (JWT ES256, `git:read`/`git:write`)
- Backup: `s3://lovable-repositories/{project-id}.git`
- Edit branches: `edit/edt-{uuid}`, reset-merged to main (fabricated clean history)
- Single-writer per sandbox, all commits by `gpt-engineer-app[bot]`

## Two Pipelines

**Standard projects (Vite)**: claim → install (`bun install`) → `lovable-exec dev` → Vite HMR → deploy via `vite build` + git push

**Imported codebases** (`LOVABLE_IMPORTED_CODEBASE`): claim → checkout `.envrc` → devenv/direnv manages environment → devenv manages dev server → deploy via git push. Skips standard install/build entirely.

## What We Don't Know

1. How the AI agent is invoked (Claude Code spawn? Direct API? Hybrid?)
2. What `lovable-skills` and `lovable-agentmds` generate
3. What Modal integration is for

## Implications for Alive

**Copy**: Actor-based deploy serialization, Vite config override pattern, suspension/resume with cache clearing, task resolution chain, `expect_head` precondition.

**Avoid**: gVisor on IO-heavy workloads, 2-min cold starts from uncached npm install, 115KB tracking script on published sites, fabricated git history.

**Our edge**: E2B/Firecracker gives better isolation overhead than gVisor for Vite workloads. Pre-caching `node_modules` per project avoids their biggest cold start bottleneck.
