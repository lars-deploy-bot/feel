# Infrastructure

## Platform

- **Fly.io** (`FLY_APP_NAME` env var). Not raw GCP — the `gcp-euw4-bear` provider tag is a region label, not the host.
- **Isolation**: gVisor kernel (`BOOT_IMAGE=/vmlinuz-4.4.0-gvisor`). Not Firecracker, not Docker.
- **Resources**: 16 CPUs, 32GB RAM per shared node. Overlay filesystem 8EB (effectively unlimited). 9p mounts from host for `/etc/hosts`, `/etc/hostname`, `/etc/resolv.conf`. Host filesystem 292GB, ~65% used.
- **Networking**: Pod IP in `10.48.x.x` range (e.g. `10.48.186.190`). Public DNS (`8.8.8.8`, `1.1.1.1`) — no internal DNS. No Kubernetes service account token mounted (pod has no K8s API access).
- **Environment**: Nix flakes pinned to `nixos-25.11` (built by Numtide, `llm-agents.nix`). Nix sandbox disabled (`sandbox = false`) — gVisor is the boundary. Nix profiles are pre-baked in the image (timestamps predate pod start).
- **Monitoring**: Sentry SDK 0.42.0 + OpenTelemetry tracing (via `opentelemetry-http` crate, reqwest transport). Spotify's Confidence for feature flags (full local resolver — see Feature Flags section).
- **Modal integration** present (env: `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_ENVIRONMENT`). Possibly GPU workloads or async jobs.
- **Kubernetes**: `/dev/termination-log` mounted. No cgroup limits visible in gVisor (resource enforcement at the gVisor/node level, not per-pod cgroups).
- **Config profiles**: `dev`, `local`, `sandbox-scheduler-2025-07-18` found in binary strings.

### HTTP Headers

Sandbox responses include identity headers:
- `x-sandbox-image` — image version identifier
- `x-sandbox-id` — unique sandbox instance ID
- `x-sandbox-provider` — infrastructure provider tag

## Pod Pool & Claim

- Pods are a **Kubernetes Deployment** (`sandbox-pool-c765944cc-dk7cd`), not StatefulSet. Ephemeral. Recycled.
- `/_sandbox/claim` accepts JWT-authenticated `ClaimArgs` with feature flags.
- **Claim JWT**: RS256, `SandboxClaimsV1 { user_id, nonce }` + `ProjectAuthClaims` (8 fields: `project_id`, `iat`, `access_type`, and others). Verified via `PROJECT_AUTH_PUBLIC_KEY`.
- **State machine**: Unclaimed → Claimed. On claim, a bare repo at `/git/pool.git` (with alternates) creates an orphan worktree at `/dev-server` via `git worktree add`.
- `node_modules` installed fresh per claim (317MB). Uses `https://npm-cache.p.l5e.io` as a dedicated npm cache proxy — not public registry, not a volume mount.
- Secrets: `.env` written at claim time (root:root, 644). Contains `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`. Additional secrets via gRPC `SetEnvVarsRequest`.
- **Imported codebase support**: `LOVABLE_IMPORTED_CODEBASE` env var triggers alternate flow — uses `devenv`-managed dev server, `.envrc` checkout instead of standard Vite template.

### Cold Start Timeline (observed)

| Step | Time |
|------|------|
| PID 1 starts → `.git` worktree created | ~0s (same second) |
| `.env` written | +6s |
| `node_modules` installed | ~+2 min |
| **Total claim-to-ready** | **~2 min** (dominated by npm install) |

## Multi-tenancy Model

- **1 project = 1 pod**. Multiple users of the same project share one pod.
- **N pods per node**. No per-pod cgroup limits visible — resource enforcement at node level.
- The "warm pool" only saves container startup time (~1s), not npm install (~2 min).

## Feature Flags (Confidence)

Spotify's **Confidence** SDK with full local flag resolution — not just API calls. Uses protobuf service definitions:

- `confidence.auth.v1` — authentication
- `confidence.flags.admin.v1` — flag administration
- `confidence.flags.resolver.v1` — local flag resolution
- `confidence.flags.types.v1` — type definitions

Known flags: `lsp-type-checks.enabled`, `tagger-vite-override.enabled`.

Full-fledged feature flag system with local evaluation. The protobuf definitions mean the Rust binary embeds a gRPC client for the Confidence service.
