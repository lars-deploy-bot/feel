# What We Still Don't Know

## Agent Invocation (highest priority)

- **How the AI agent gets invoked** — `lovable-exec` is just the dev toolchain. Something spawns Claude Code (or calls the API directly) to generate code. Is it the platform API calling into the sandbox via gRPC `StartRequest`? Or does the platform call Anthropic's API directly and send file diffs to the sandbox?
- **Which Claude Code variant is actually used** — standard `claude`, `claude-code-acp` (Zed's ACP), or `ccr` (router)? All three are available in the Nix profile.
- **What `lovable-skills` does** — likely generates SKILL.md files or custom tool definitions for Claude Code.
- **What `lovable-agentmds` does** — likely generates CLAUDE.md-style agent instruction files.
- **What `apply-patch` vs `apply_patch` does** — two different compiled binaries. Could be the primary file-write mechanism (structured diffs instead of full file content). If so, the agent produces diffs externally and these apply them inside the sandbox.

## Infrastructure

- How the edge proxy binds `{project-id}.lovableproject.com` → pod IP (external routing layer).
- How `lovable.code.storage` handles branch merging / conflict resolution.
- ~~How the CDN publish pipeline works end-to-end~~ → **ANSWERED**: Sandbox pushes via git to platform. No S3/R2 upload from sandbox. Platform side handles CDN distribution.
- ~~How suspension/resume is triggered~~ → **ANSWERED**: Lifecycle events: `idle_timeout_expired`, `api_shutdown`, `signal_shutdown`, `expecting_suspend`. Cgroup-based freeze/unpause, filesystem persists.
- What Modal is used for (GPU workloads? async builds? image generation?).
- ~~What `TunnelConnect` / `TunnelData` is used for~~ → **ANSWERED**: TCP and Unix socket tunneling into the sandbox. Platform connects to internal services (LSP at :9999, daemons) via gRPC tunnel. Configurable timeouts.
- Full Confidence flag set — only two flags observed.
- What the `[paths]` and `[dev_server]` sections in `lovable.toml` contain (field names unknown).

## lovable.js

- How `VIRTUAL_OVERRIDE` interacts with the agent's file writes — does the agent write first, then the override is cleared? Or does the override preview before the write?
- Whether rrweb recordings are used for agent context (the agent "seeing" what the user sees).
- What the full Tailwind visual editing flow looks like end-to-end.

## Resolved Questions

| Question | Answer | Source |
|----------|--------|--------|
| How do build artifacts get to CDN? | Git push from sandbox → platform handles CDN | Deep probe: no S3/R2 upload in binary |
| How does dependency caching work? | Diffs `package.json`/lockfile/`.npmrc`/`.gitmodules` between trees, keyed by deployment ID | Deep probe: `get_last_successful_install`, `cached_from_deployment_id` |
| How is suspension triggered? | `idle_timeout_expired`, `api_shutdown`, `signal_shutdown` lifecycle events | Deep probe: lifecycle event strings |
| How is state preserved on suspend? | Cgroup freeze-in-place, filesystem persists, `.vite` cache cleared on resume | Deep probe: `expecting_suspend` event + resume logic |
| What does `lovable.toml` look like? | `[run]`, `[dev_server]` (port), `[paths]`, `[vite]` (override flag) | Deep probe: `taskrunner.Config`, `DevServerConfig`, `ViteConfig` structs |
| What is `TunnelConnect`/`TunnelData` for? | TCP + Unix socket tunneling into sandbox. Platform reaches internal services (LSP :9999, daemons) | Deep probe: `grpc/tunnel.rs` — TCP/Unix targets, configurable timeouts |
