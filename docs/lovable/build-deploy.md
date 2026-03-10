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
5. **Publish**: artifacts pushed via **git**, NOT uploaded to S3/R2. The sandbox uses `git push` (`http.uploadpack`, `http.uploadarchive`) back to the platform. The platform side (outside sandbox) likely runs the production build and distributes to CDN.
6. **Result**: `DeploymentResult` with `exit_code`, `output`, `package_lock_changed`, `success`, `error`, `npm_install_performed`, `npm_install_skipped_reason`

### Pipeline detail (from binary strings)

The internal pipeline is: `deployment.checkout` → `deployment.install` → `deployment.vite` → `deployment.publish_project_config` → `deployment.publish_result`. The `publish_result` step pushes via git — there is **no S3/R2/CDN upload mechanism** in the sandbox binary itself.

## Deployment Locking

- Concurrent deploys serialized via kameo actor mailbox pattern
- "Failed to acquire lock" logged when a deploy is already running
- "Queued deployments:" lists waiting deploys
- At-most-one active deployment per sandbox

## CDN Delivery

- Published sites served via CDN — not from the sandbox
- No `dist/` directory found at time of inspection — artifacts pushed via git to platform
- `lol_html` (Cloudflare's streaming HTML rewriter) injects CDN scripts at byte stream level — no DOM parsing
- Injected script: `https://cdn.gpteng.co/lovable.js` (see [lovable-js.md](./lovable-js.md))
- **Key insight**: The sandbox never uploads to CDN directly. It pushes to git, and the platform side handles CDN distribution. The sandbox is a build+dev environment, not a publish endpoint.

## Dependency Cache Strategy

Cache key is **deployment ID**, not lockfile hash. Logic from binary strings:

- `deployment.get_last_successful_install` → checks last successful deployment
- `deployment.install.cached_from_deployment_id` — caches keyed by deployment ID
- **Skip condition**: "Skipping npm install: package.json unchanged and node_modules exists"
- **Reinstall trigger**: "push_on_deployment: package.json or related files changed, running install"
- Diffs `package.json`, `package-lock.json`, `.npmrc`, and `.gitmodules` between git trees
- Fallback: "bun install failed, retrying with --ignore-scripts"

## Process Management During Deployment

From binary strings — how the sandbox handles process lifecycle during builds:
- Sends `SIGTERM` to entire process group first: `"Error sending SIGTERM to child process group: process cancelled, sent SIGTERM"`
- Waits for graceful exit, escalates: `"Process did not exit after SIGTERM in time, sending SIGKILL"`
- Timeout tracking: `"Process killed due to timeout: Process timed out after , killing..."`
- Control channel pattern: `"applying control fn"`, `"control channel dropped, cancelling"`
- Stdout/stderr captured separately with unflushed buffer handling: `"stdout-unflushed>"`, `"stderr-unflushed>"`

## Imported Codebase Pipeline

When `LOVABLE_IMPORTED_CODEBASE` is set (non-Vite projects):
- Checks out `.envrc` with `--force` (tolerates missing file)
- Skips standard install/build: `"deployment: skipping for imported codebase (devenv manages dev server)"`
- Dependencies managed by devenv: `"imported codebase - devenv manages dependencies"`
- Restarts dev server after checkout
- Submodule initialization supported: `deployment.init_submodules`
- Partial checkout supported: `deployment.checkout_partial`

## Package Manager Support

- **Package manager migration**: `bun pm migrate` support
- `lovable-exec` detects bun/npm/pnpm/yarn from lockfiles
- `npm-cache.p.l5e.io` dedicated caching proxy (Lovable's own npm proxy/cache)
- **Install retry**: `"bun install failed, retrying with --ignore-scripts"` — automatic fallback when scripts cause install failures
- **Lockfile detection**: Checks for `bun.lockb` (`"bun.lockb is up to date"`)
