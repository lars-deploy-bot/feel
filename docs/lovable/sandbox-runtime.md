# Sandbox Runtime Binary

**Rust 1.91.1** (compiled with Cargo, `axum` framework). 44MB ELF at `/home/api/sandbox`. Pre-baked in image (timestamp predates pod start by hours).

Combined HTTP + gRPC server on port **3004** (binds `[::]:3004`). Vite dev server on port **8080** separately (binds `[::]:8080` but proxied through sandbox binary).

- **In-memory SQLite** for deployment tracking (`deployments` and `logs` tables with indexes).
- **Direnv integration** for environment management (`direnv allow`, `direnv export json`).
- **gitoxide** (`gix` 0.73.0) — pure Rust git implementation, used alongside standard git CLI.

## Crate Source Tree

Built from ~20 Rust modules at `/build/crates/sandbox/src/`:

```
async_process, build/package_cache, config, db/deployment, db/mod,
dev_server/dev_server, dev_server/dev_server_builder, dev_server/dev_server_ref,
dev_server/deployment, dev_server/deployment_check, direnv, feature_flag, git,
git_ops, grpc/multiplexer, grpc/pty, grpc/state, handlers, handlers/code,
handlers/git, handlers/deployment, hyper_reverse_proxy, lifecycle/notifier,
main, router, system_metrics, util_lib/auth/*
```

## Config Structs

Full configuration hierarchy (from binary string extraction):

- **FlyEnv** (10 fields): Fly.io environment config
- **ModalEnv** (3 fields): `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_ENVIRONMENT`
- **AuthConfig**, **GrpcConfig**, **HttpConfig**, **OwnerConfig**
- **SandboxMeta** — instance identity
- **FeatureFlags** — compile-time and runtime flags
- **SentryConfig** — DSN and environment
- **BuilderConfig** — `build_output_ttl_seconds`, `package_cache_ttl_seconds` (120s), `package_cache_keep_mru` (2)
- **DevServerConfig** — dev server lifecycle settings
- **ProjectAuthConfig** — JWT verification config

## HTTP Routes

| Route | Purpose |
|-------|---------|
| `/_sandbox/dev-server/start\|stop` | Dev server lifecycle |
| `/_sandbox/shutdown` | Self-shutdown |
| `/_sandbox/git/*` | Git operations via `git http-backend` CGI |
| `/_sandbox/claim` | Project binding |
| `/_sandbox/code/ws` | WebSocket: code editing + terminal (PTY) multiplexed |
| `/_port_{port}/*` | Port proxying to any listening port |

## gRPC

Same listener as HTTP, max 4GB messages. Body limit 512MB for HTTP.

- **Deployment**: `StartDeploymentRequest` (with `target_commit`, `push_on_deployment`, `skip_checks`, `force`, `initialize_only`, `skip_edge_function_checks`, `expect_head`), `DeploymentResult` (with `exit_code`, `output`, `package_lock_changed`, `success`, `error`, `npm_install_performed`, `npm_install_skipped_reason`).
- **File ops**: `GetFileContentRequest`, `FileReadRequest`.
- **Env**: `SetEnvVarsRequest`.
- **Daemon management**: `StartDaemonRequest`, `StopDaemonRequest`, `RestartDaemonRequest`, `ListDaemonsRequest`, `GetDaemonStatusRequest`, `SendSignalRequest`. `DaemonConfig` has `shutdown_timeout_seconds`, `max_restarts`, `restart_window_seconds`, `restart_policy`, `command`. This is a mini-systemd inside the sandbox.
- **Command execution**: `StartRequest` (with `stdin`, `cwd`, `env`), `WaitRequest`, `ListCommandsRequest`, `GetLogsRequest`, `CheckResultRequest`.
- **Tunneling**: `TunnelConnect` (with `target`, `connect_timeout_seconds`), `TunnelData`. Supports `TcpTarget` and `UnixTarget`. Enables external services to reach into the sandbox.

### Daemon Management (mini-systemd)

From `grpc/daemon.rs`: Full process supervisor inside the sandbox.
- Working directory sandboxing: `"Working directory '' is outside the allowed project directory"` — rejects paths outside `/dev-server/`
- Canonicalizes paths before use (prevents symlink escapes)
- Tracks `restart_count` and `restart_bucket` per daemon
- Sends signals to **process groups**, not individual PIDs
- Captures stdout/stderr separately

### Tunnel System

From `grpc/tunnel.rs`: Bidirectional tunneling into the sandbox.
- **TCP tunnels**: `"Opening TCP tunnel to (timeout: ..."` → `"TCP tunnel established to ..."` or `"Connection to timed out"` / `"Failed to connect to ..."`
- **Unix socket tunnels**: `"Opening Unix socket tunnel to ..."` → `"Unix socket tunnel established to ..."`
- Configurable `connect_timeout_seconds`
- Enables external services (the platform orchestrator) to reach services inside the sandbox — e.g., connecting to the LSP bridge at `127.0.0.1:9999` or any daemon port

## Actor System

Built on **kameo** 0.17.2 (Rust actor framework, Tokio-based). Deployments run as actors with mailboxes — messages queued and processed sequentially per deployment. Log messages reference "Queued deployments:" and "Failed to acquire lock", confirming locking/queuing for concurrent deployment requests.

## PTY Implementation

- Uses `portable_pty` crate (cross-platform PTY).
- Terminal: `xterm-256color`, shell via `/usr/bin/env`.
- Single PTY per WebSocket connection.
- Protobuf messages: `PtyStart`, `PtyInput`, `PtyResize`.

## WebSocket Code Channel

The `/_sandbox/code/ws` endpoint multiplexes code editing and terminal:
- **File watcher**: Monitors filesystem changes, sends events over WebSocket. `"File watcher task exited. Closing connection."`, `"File watcher error: ..."`
- **File operations**: Send file content, receive edits. `"Failed to send file. Closing connection: ..."`, `"TODO: file removal not supported"` (file deletion not yet implemented over WebSocket)
- **Init code**: Sends initial state on connect. `"Failed to send init code: ..."`

## Process Management

- Process groups: `kill_on_drop` semantics — child processes killed when parent handle drops.
- SIGKILL sent to entire process group, not individual PIDs.

## LSP Integration

- Built-in LSP bridge at `127.0.0.1:9999`.
- Supports `textDocument/references` for cross-file navigation.
- Runs type checking on changed files, with full project check on config file changes. Scans `*.tsx`, `*.jsx` files.
- Feature-flagged via `lsp-type-checks.enabled` (Confidence).
- Outputs structured diagnostics with file, range, message, severity.
- **Dual-mode comparison**: Runs both LSP-based and legacy typechecking in parallel. OpenTelemetry metric `lsp.typecheck.comparison` tracks agreement/disagreement. Textbook migration validation.

## Shutdown & Suspension

- `shutdown_timeout = 360s` (6 min grace period), configurable `enable_shutdown`. Env var `SHUTDOWN_TIMEOUT=5m` (idle timeout). `ENABLE_SHUTDOWN=true`.
- Status endpoint includes `shutdown_eta` field.
- Pod uptime observed: ~44 min.

### Lifecycle Events (from binary strings)

Full state machine: `startup` → `claimed` → active use → one of:
- `idle_timeout_expired` — pod idle too long
- `api_shutdown` — explicit API call from platform
- `signal_shutdown` — OS signal (SIGTERM)
- `expecting_suspend` — about to be frozen
- `terminating` — final cleanup

### Suspension Mechanism

- **Freeze-in-place**: cgroup-based pause/unpause on Kubernetes (Fly.io). No snapshot/restore — filesystem persists, process is frozen.
- **On resume**: clears `.vite` cache (`node_modules/.vite`) to prevent stale pre-bundled dependencies. Three code paths: removed, failed to remove, nothing to remove. Sets `RESUMED_FROM_SUSPENSION` env var.
- **Triggers**: `idle_timeout_expired` (idle), `api_shutdown` (explicit), `signal_shutdown` (signal).

## Status Endpoint

`GET /_sandbox/dev-server` returns:
```json
{
  "state": "started",
  "initialized": true,
  "deployment": {
    "deployment_id": "2",
    "running": false,
    "target_commit": "b331aa1a7d54e9db10920729709d1ff849c8e2ea"
  },
  "shutdown_eta": "..."
}
```

Additional info structs: `DevServerInfo { initialized, state, output }`, `TypecheckInfo` (3 fields), `CssLintInfo` (3 fields).

## OpenTelemetry Metrics

- `process.memory.usage` — sandbox process memory
- `executor.command.count` — commands executed
- `system.memory.utilization` — host/pod memory
- `lsp.typecheck.comparison` — LSP vs legacy typecheck agreement
- Standard HTTP/gRPC metrics via tracing middleware
