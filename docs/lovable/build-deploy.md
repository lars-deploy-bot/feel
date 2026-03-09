# Build & Deploy

## Builder

Builder IS in the sandbox binary. Not a separate service.

- `builder.build_output_ttl_seconds = 120`
- `builder.package_cache_ttl_seconds = 120`
- `builder.package_cache_keep_mru = 2`

Deploy triggered via gRPC `StartDeploymentRequest`, build runs locally in the sandbox. Build script: `vite build` (and `vite build --mode development`).

## Deployment Pipeline

1. **Deployment request** via gRPC with `target_commit`, `push_on_deployment`, `skip_checks`, `force`, `initialize_only`, `skip_edge_function_checks`, `expect_head`
2. **Validation checks**: `.gitmodules`, `package.json`, `package-lock.json`, `.npmrc`
3. **Install** (conditional): skips if package.json/lockfile unchanged since last successful deploy. `get_last_successful_install`, `cached_from_deployment_id`. `InstallInfo` struct tracks details.
4. **Build**: `vite build` inside sandbox
5. **Publish**: artifacts uploaded, HTML rewritten via `lol_html` to inject `<script src="https://cdn.gpteng.co/lovable.js">`
6. **Result**: `DeploymentResult` with `exit_code`, `output`, `package_lock_changed`, `success`, `error`, `npm_install_performed`, `npm_install_skipped_reason`

## Deployment Locking

- Concurrent deploys serialized via kameo actor mailbox pattern
- "Failed to acquire lock" logged when a deploy is already running
- "Queued deployments:" lists waiting deploys
- At-most-one active deployment per sandbox

## CDN Delivery

- Published sites served via CDN — not from the sandbox
- No `dist/` directory found at time of inspection — artifacts uploaded elsewhere
- `lol_html` (Cloudflare's streaming HTML rewriter) injects CDN scripts at byte stream level — no DOM parsing
- Injected script: `https://cdn.gpteng.co/lovable.js` (see [lovable-js.md](./lovable-js.md))

## Package Manager Support

- **Package manager migration**: `bun pm migrate` support
- `lovable-exec` detects bun/npm/pnpm/yarn from lockfiles
- `npm-cache.p.l5e.io` dedicated caching proxy
