# Deployment Guide

**Purpose:** Operational commands, workflows, and troubleshooting.

## Commands

### Production Deploy
```bash
bun run deploy                    # Full: git pull + build + restart + health check
./scripts/build-atomic.sh         # Build only (no restart)
bun run see                       # View PM2 logs
```

### Staging
```bash
bun run staging                   # Rebuild tools + restart staging server
pm2 logs claude-bridge-staging    # View staging logs
```

### Rollback
```bash
# List available builds
ls -lt .builds/

# Switch to previous build
cd .builds && ln -sfn dist.TIMESTAMP current && cd ..
pm2 restart claude-bridge
```

### Verify
```bash
readlink .builds/current          # Check active build
curl -I http://localhost:8999/    # Test production
curl -I http://localhost:8998/    # Test staging
```

## Deploy Workflow

```
bun run deploy
  ↓
1. Git pull (non-fatal if fails)
2. Install dependencies (bun install)
3. Run tests (bun test) - deployment aborted if tests fail
4. Check disk space (require 250MB)
5. Check port (allow PM2 processes)
6. Backup staging dev files (.next/dev)
7. Build to .next
8. Move to .builds/dist
9. Copy static assets to standalone
10. Restore staging dev files
11. Timestamp: .builds/dist → .builds/dist.TIMESTAMP
12. Atomic swap: current → dist.TIMESTAMP
13. Cleanup old builds (keep last 3)
14. Stop PM2
15. Start PM2 with standalone server
16. Health check (30s timeout)
17. Auto-rollback if health check fails
```

## Troubleshooting

### Tests Failed During Deployment

**Symptom:** `ERROR: Tests failed - deployment aborted`

**Cause:** One or more tests failing in the test suite

**Solution:**
```bash
# Run tests locally to see failures
bun test

# Fix failing tests
# [make your fixes]

# Redeploy
bun run deploy
```

**Prevention:** Always run `bun test` locally before deploying.

### CSS Not Loading (404)

**Symptom:** `/_next/static/chunks/*.css` returns 404

**Cause:** Static assets not copied to standalone

**Solution:**
```bash
bun run deploy  # Full redeploy
```

**Prevention:** Build script copies `.next/static` and `public/` automatically.

### Port Already in Use

**Symptom:** `ERROR: Port 8999 is in use by another process`

**Cause:** Non-PM2 process on port 8999

**Solution:**
```bash
# Check what's using the port
lsof -i :8999

# If it's not PM2, kill it
kill <PID>

# Redeploy
bun run deploy
```

### Staging Broken After Deploy

**Symptom:** Staging returns 500 or "ENOENT: no such file or directory"

**Cause:** Production build removed `.next/dev` files

**Solution:**
```bash
pm2 restart claude-bridge-staging  # Regenerates dev files
```

**Prevention:** Build script backs up `.next/dev` before building.

### Disk Space Full

**Symptom:** `ERROR: Insufficient disk space`

**Cause:** Less than 250MB available

**Solution:**
```bash
# Remove all but last 3 builds
cd .builds
ls -dt dist.* | tail -n +4 | xargs rm -rf

# Or remove all except current
ACTIVE=$(readlink current)
ls -d dist.* | grep -v "$ACTIVE" | xargs rm -rf
```

### Deploy Locked

**Symptom:** `ERROR: Deployment already in progress`

**Cause:** Lock file exists

**Solution:**
```bash
# Check if deploy is running
ps aux | grep build-and-serve

# If not running, remove lock
rm -f /tmp/claude-bridge-deploy.lock

# Redeploy
bun run deploy
```

### Build Fails

**Symptom:** Build script exits with error

**Behavior:**
- Previous build remains active (untouched)
- Error displayed in logs
- Exit code 1

**Solution:**
1. Fix the error
2. Run `bun run deploy` again

## Configuration

### Build Paths
```
.builds/current/standalone/apps/web/server.js  # PM2 entry point
apps/web/.next/                                # Build source
apps/web/.next/dev/                            # Staging dev server
```

### PM2
```bash
# Production (port 8999)
script: .builds/current/standalone/apps/web/server.js
interpreter: bun
cwd: /root/webalive/claude-bridge

# Staging (port 8998)
script: bunx next dev --turbo -p 8998
cwd: /root/webalive/claude-bridge/apps/web
```

### Disk Usage
```
Each build: ~127MB
Retention: Last 3 builds
Total: ~400MB
```

## Safety Guarantees

- ✅ Concurrent deploys blocked (lock file)
- ✅ Failed builds don't affect production (atomic swap)
- ✅ CSS/static assets copied automatically
- ✅ Staging isolated (dev files backed up)
- ✅ Disk space checked before build
- ✅ Port conflicts detected early
- ✅ Old builds preserved for rollback
- ✅ Health checks with auto-rollback

See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details.
