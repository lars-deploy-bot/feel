# Claude Bridge Deployment Guide

This document explains the atomic build system used for deploying Claude Bridge without downtime or race conditions.

## Problem Solved

Traditional Next.js deployments write directly to the build directory while the server is potentially reading from it, creating race conditions where PM2 might serve incomplete builds.

The atomic build system eliminates this by using timestamped build directories and symlinks.

## How It Works

### Build Structure

```
apps/web/
├── dist → dist.20251105-155847  (symlink, PM2 serves this)
├── dist.20251105-155847/        (current build)
├── dist.20251105-155805/        (previous build, available for rollback)
└── dist.20251105-140312/        (older build, kept for safety)
```

### Atomic Build Process

1. **Build to temporary location**: Next.js builds normally to `dist/`
2. **Move to timestamped directory**: `dist/` is moved to `dist.TIMESTAMP/`
3. **Atomic symlink swap**: `ln -sfn dist.TIMESTAMP/ dist` (kernel-level atomic operation)
4. **PM2 restart**: Serves new build via symlink
5. **Cleanup**: Old builds beyond the last 3 are removed

This process guarantees PM2 never reads a half-built directory because:
- The build happens in isolation before the symlink is created
- Symlink updates are atomic at the filesystem level
- Old builds remain until the new build is verified working

## Deployment Methods

### Full Deployment (Recommended)

Handles git pull, dependency installation, build, PM2 restart, and health checks:

```bash
bun run deploy
```

This script:
1. Pulls latest code from git
2. Installs dependencies
3. Runs atomic build
4. Stops PM2 process
5. Starts PM2 with new build
6. Performs health check
7. Rolls back if health check fails

### Build Only

Build a new version without deploying:

```bash
./scripts/build-atomic.sh
```

This creates a timestamped build and updates the symlink without restarting PM2.

### Manual Deployment

Build and deploy separately:

```bash
# Build
./scripts/build-atomic.sh

# Deploy
pm2 restart claude-bridge
```

This approach is safe because the build is isolated until the symlink swap completes.

## Build Script Details

### Location

`/root/webalive/claude-bridge/scripts/build-atomic.sh`

### What It Does

1. Removes existing `dist` symlink (if present)
2. Builds workspace dependencies (`packages/tools`)
3. Builds web app to `apps/web/dist/`
4. Moves build to `apps/web/dist.TIMESTAMP/`
5. Creates symlink `apps/web/dist → dist.TIMESTAMP/`
6. Removes old builds (keeps last 3)
7. Displays active build and available builds

### Output Example

```
[INFO] Starting atomic build to dist.20251105-155847...
[INFO] Building workspace dependencies...
[INFO] Building web app...
[SUCCESS] Build completed in 27s
[INFO] Moving build to timestamped directory...
[SUCCESS] Build moved to: dist.20251105-155847
[INFO] Creating symlink: dist -> dist.20251105-155847
[SUCCESS] Symlink updated atomically
[INFO] Available builds:
  → dist.20251105-155847 (144M) [ACTIVE]
    dist.20251105-155805 (127M)
```

## Rollback

### Automatic Rollback

The deploy script automatically rolls back if:
- Build fails (preserves previous build)
- Health check fails after PM2 restart (reverts symlink to previous build)

### Manual Rollback

Switch to a previous build:

```bash
# List available builds
ls -dt apps/web/dist.*/

# Switch symlink to older build
cd apps/web
ln -sfn dist.20251105-155805 dist

# Restart PM2
pm2 restart claude-bridge
```

### Verify Active Build

```bash
readlink apps/web/dist
# Output: dist.20251105-155847
```

## Configuration

### Next.js Config

`apps/web/next.config.js`:

```javascript
const nextConfig = {
  // Production: use "dist" for atomic builds
  // Development: use ".next" to avoid conflicts with staging dev server
  distDir: process.env.NODE_ENV === "production" ? "dist" : ".next",
  output: "standalone",
  // ... other config
}
```

**Why Environment-Based distDir?**

- **Production** (`NODE_ENV=production`): Uses `dist/` for atomic builds
  - Enables zero-downtime deployments via timestamped directories and symlinks
  - PM2 production process serves from `dist/` symlink

- **Development** (`NODE_ENV=development`): Uses `.next/` for dev server cache
  - Staging dev server (port 8998) uses standard Next.js dev cache location
  - Prevents conflicts: production builds temporarily remove the `dist/` symlink during atomic builds (see `build-atomic.sh:40-44`), which would corrupt the dev server cache if both used the same directory
  - Ensures staging always reflects current code state with hot reload

**Important:** Without this separation, running a production build while the staging dev server is running would cause missing build manifest errors in the dev server, requiring a restart to recover.

- `output: "standalone"` creates self-contained builds (required for Hetzner deployment)

### PM2 Ecosystem Config

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'claude-bridge',
      script: 'bun',
      args: 'next start -p 8999',
      env: {
        NODE_ENV: 'production',  // Uses dist/ for atomic builds
        // ... other env vars
      }
    },
    {
      name: 'claude-bridge-staging',
      script: 'bunx',
      args: 'next dev --turbo -p 8998',
      env: {
        NODE_ENV: 'development',  // Uses .next/ for dev cache
        // ... other env vars
      }
    }
  ]
}
```

The `NODE_ENV` setting in each PM2 app config determines which `distDir` is used, ensuring production and staging don't interfere with each other.

### Package Scripts

Root `package.json`:

```json
{
  "scripts": {
    "deploy": "./scripts/build-and-serve.sh"
  }
}
```

Web app `apps/web/package.json`:

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start -p 8999"
  }
}
```

## Cleanup

### Automatic Cleanup

The build script automatically keeps only the 3 most recent builds.

### Manual Cleanup

Remove specific old builds:

```bash
cd apps/web
rm -rf dist.20251105-140312
```

Remove all builds except the active one:

```bash
cd apps/web
ACTIVE=$(readlink dist)
ls -d dist.* | grep -v "$ACTIVE" | xargs rm -rf
```

## Troubleshooting

### Build Fails

The atomic build script will:
1. Display the error
2. Restore the previous symlink if it existed
3. Exit with status code 1

Previous build remains active. Fix the error and run `./scripts/build-atomic.sh` again.

### PM2 Not Serving New Build

Verify the symlink points to the correct build:

```bash
readlink apps/web/dist
ls -la apps/web/dist
```

If symlink is correct but PM2 still serves old content, restart PM2:

```bash
pm2 restart claude-bridge
```

### Disk Space Issues

Each build is approximately 130-150MB. With 3 builds retained, this uses about 400-450MB.

To reclaim space:

```bash
cd apps/web
ls -dt dist.* | tail -n +2 | xargs rm -rf  # Keep only the latest build
```

### TypeScript Errors About Missing Files

This usually happens if Next.js finds old build artifacts in its cache.

Clean and rebuild:

```bash
cd apps/web
rm -rf dist dist.* .next
cd ../..
./scripts/build-atomic.sh
```

### Staging Dev Server: Missing Build Manifest Errors

**Symptom:** Staging dev server logs show repeated errors like:
```
Error: ENOENT: no such file or directory, open '.../dist/dev/server/app/page/build-manifest.json'
```

**Cause:** Production build ran while staging dev server was using the same `dist/` directory. The atomic build temporarily removes the `dist/` symlink (see `build-atomic.sh:40-44`), corrupting the dev server cache.

**Solution:**
1. Ensure `next.config.js` uses environment-based `distDir`:
   ```javascript
   distDir: process.env.NODE_ENV === "production" ? "dist" : ".next"
   ```
2. Restart staging dev server:
   ```bash
   pm2 restart claude-bridge-staging
   ```

**Prevention:** The environment-based `distDir` configuration ensures staging uses `.next/` while production uses `dist/`, preventing conflicts entirely.

## Production Considerations

### Health Checks

The deploy script includes a 30-second health check that curls `http://localhost:8999/`.

If the check fails, the script automatically rolls back to the previous build.

### Zero Downtime

The atomic symlink swap ensures zero downtime:
- Old build remains accessible during the new build
- Symlink update is instantaneous
- PM2 restart takes 1-2 seconds

### Build Artifacts

Builds are stored in the git-ignored `dist.*` directories.

The `.gitignore` includes:

```
dist/
dist.*/
```

### Concurrent Builds

The deploy script uses a lock file (`/tmp/claude-bridge-deploy.lock`) to prevent concurrent deployments.

If you need to force a deployment while one is running:

```bash
rm -f /tmp/claude-bridge-deploy.lock
bun run deploy
```

## Comparison with Traditional Deployment

### Traditional (Broken)

```bash
bun run build   # Writes to dist/ while PM2 reads it
pm2 restart     # May serve incomplete build
```

Race condition: PM2 might restart mid-build and serve incomplete files.

### Atomic (Fixed)

```bash
./scripts/build-atomic.sh  # Builds to isolated dist.TIMESTAMP/
                          # Updates symlink atomically
pm2 restart               # Serves complete build via symlink
```

No race condition: Build completes in isolation before symlink swap.

## Additional Commands

### Check PM2 Status

```bash
pm2 status
pm2 logs claude-bridge
pm2 describe claude-bridge
```

### Manual Build Without Atomic Script

Not recommended, but if needed:

```bash
cd apps/web
bun run build  # Builds to dist/
```

This creates a regular `dist/` directory instead of a timestamped one. Only use for local testing.

## Notes

- Builds include the `standalone` output which bundles all dependencies
- The build process includes workspace dependencies (`packages/tools`)
- Caddy reverse proxy automatically picks up changes after PM2 restart
- DNS changes are not required for deployments
