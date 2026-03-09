# Lovable Sandbox Architecture

This document has been split into individual files for readability.

See **[docs/lovable/README.md](./lovable/README.md)** for the full index.

| File | Topic |
|------|-------|
| [infrastructure.md](./lovable/infrastructure.md) | Fly.io, gVisor, Kubernetes, pod pool, claim flow, cold start |
| [sandbox-runtime.md](./lovable/sandbox-runtime.md) | Rust binary, HTTP/gRPC API, actors, PTY, process management, shutdown |
| [git-model.md](./lovable/git-model.md) | Git remotes, branching, merge model, worktree layout, HTTP backend |
| [build-deploy.md](./lovable/build-deploy.md) | Deployment pipeline, build caching, CDN publish, lol_html rewriting |
| [preview-hmr.md](./lovable/preview-hmr.md) | Vite dev server, HMR, port proxying, preview routing |
| [lovable-js.md](./lovable/lovable-js.md) | The 115KB CDN script: error capture, rrweb recording, element inspector, live DOM manipulation, network monitoring |
| [tagger.md](./lovable/tagger.md) | lovable-tagger Vite plugin, JSX source tracking, Tailwind config extraction |
| [agent-architecture.md](./lovable/agent-architecture.md) | How code gets written, lovable-exec task runner, proprietary binaries, agent invocation mystery |
| [nix-profiles.md](./lovable/nix-profiles.md) | Nix environment, llm-agents.nix, installed tools |
| [unknowns.md](./lovable/unknowns.md) | What we still don't know |
| [analysis.md](./lovable/analysis.md) | What's good, what's bad, non-obvious insights, implications for Alive |
