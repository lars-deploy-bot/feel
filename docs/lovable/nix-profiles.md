# Nix Profiles

## Sandbox Profile (single merged profile)

**System tools**: nodejs_22, bun (1.3.3), deno, git, ripgrep, curl, jq, awscli2, gcc, gnumake, pkg-config, postgresql, chromium, playwright, python3 + numpy/pandas/scipy/sklearn/jupyter, duckdb, rust (1.91.1), tigrisfs, tini, direnv, sed, awk, ast-grep, unzip.

**Agent tools** (merged into sandbox profile):
- `lovable-exec` — proprietary Go task runner
- `lovable-skills` — proprietary Go binary
- `lovable-agentmds` — proprietary Go binary
- `apply-patch` — proprietary Go binary
- `apply_patch` — proprietary binary (different, links glibc)
- `agent-browser` — open-source Claude Code skill (Playwright)
- `openskills` — npm TrueSkill lib (not an agent tool)
- `code-server` — VS Code in browser
- `lsp-bridge` — LSP integration binary
- `knip-language-server.mjs` — dead code detection LSP

**Playwright**: `PLAYWRIGHT_BROWSERS_PATH=/nix/var/nix/profiles/sandbox`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.

## Default Profile

Core Unix tools, git, ssh, nix, curl, wget, tar.

## Debug Profile

htop, strace, lsof, tmux.

## Nix Source

`llm-agents.nix` by Numtide — a public collection of 50+ AI coding agent packages. Not proprietary.

Includes: claude-code, codex, codex-acp, gemini-cli, cursor-agent, goose-cli, qwen-code, opencode, amp, jules, forge, crush, droid, pi, and many more.

Note: The "agent profile" doesn't exist as a separate Nix profile link — agent tools are merged into the sandbox profile.
