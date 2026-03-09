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
- How the CDN publish pipeline works end-to-end (sandbox builds → what uploads to CDN?).
- How suspension/resume is triggered (by idle timeout? by the scheduler?).
- What Modal is used for (GPU workloads? async builds? image generation?).
- What `TunnelConnect` / `TunnelData` is used for in practice.
- Full Confidence flag set — only two flags observed.

## lovable.js

- How `VIRTUAL_OVERRIDE` interacts with the agent's file writes — does the agent write first, then the override is cleared? Or does the override preview before the write?
- Whether rrweb recordings are used for agent context (the agent "seeing" what the user sees).
- What the full Tailwind visual editing flow looks like end-to-end.
