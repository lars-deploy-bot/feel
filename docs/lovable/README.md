# Lovable Sandbox Architecture

Findings from inspecting Lovable's sandbox from the inside. Raw observations, no spin.

## Files

| File | Topic |
|------|-------|
| [infrastructure.md](./infrastructure.md) | Fly.io, gVisor, Kubernetes, pod pool, claim flow, cold start |
| [sandbox-runtime.md](./sandbox-runtime.md) | Rust binary, HTTP/gRPC API, actors, PTY, process management, shutdown |
| [git-model.md](./git-model.md) | Git remotes, branching, merge model, worktree layout, HTTP backend |
| [build-deploy.md](./build-deploy.md) | Deployment pipeline, build caching, CDN publish, lol_html rewriting |
| [preview-hmr.md](./preview-hmr.md) | Vite dev server, HMR, port proxying, preview routing |
| [lovable-js.md](./lovable-js.md) | The 115KB CDN script: error capture, rrweb recording, element inspector, live DOM manipulation, network monitoring |
| [tagger.md](./tagger.md) | lovable-tagger Vite plugin, JSX source tracking, Tailwind config extraction |
| [agent-architecture.md](./agent-architecture.md) | How code gets written, lovable-exec task runner, proprietary binaries, agent invocation mystery |
| [nix-profiles.md](./nix-profiles.md) | Nix environment, llm-agents.nix, installed tools |
| [unknowns.md](./unknowns.md) | What we still don't know |
| [analysis.md](./analysis.md) | What's good, what's bad, non-obvious insights |

| [architecture-summary.md](./architecture-summary.md) | One-page reference: system overview, lifecycle, deployment pipeline, implications for Alive |

## Architecture Diagram

See [architecture.mermaid](./architecture.mermaid) for the full system diagram.

## Raw Investigation Output

- `docs/output5.md` — lovable-exec strings dump and help output (17K lines)
- `docs/advisory.md` — initial observations
