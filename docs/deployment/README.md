# Claude Bridge Deployment

> **Atomic build system with zero-downtime deployments, automatic rollback, and 92% failure protection**

## Start Here

**I want to...**
- 🚀 **Deploy now** → `bun run deploy` then read [Quick Start](#quick-start)
- 🔧 **Fix a problem** → Check [Troubleshooting](#troubleshooting-index)
- 📚 **Understand how it works** → Read [deployment.md](./deployment.md)
- 🏗️ **Learn the architecture** → Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- 📜 **See what changed** → Read [CHANGELOG.md](./CHANGELOG.md)

## Quick Start

```bash
# Full deployment (recommended)
bun run deploy

# Build only (no restart)
./scripts/build-atomic.sh

# Staging
bun run staging

# View logs
bun run see
```

## What's Protected

✅ **12/13 failure modes covered (92%)**

- Concurrent deploys → Lock file
- CSS/static assets → Explicit copy to standalone
- Port conflicts → PM2 process check
- Disk exhaustion → 250MB pre-check
- Staging isolation → Dev files backed up
- Failed builds → Old build untouched
- Build cleanup → Keeps last 3
- Zombie processes → Killed before start

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete coverage analysis.

## Troubleshooting Index

| Symptom | Solution |
|---------|----------|
| CSS not loading (404) | `bun run deploy` |
| Port in use error | Check if PM2: `pm2 list` |
| Staging broken | `pm2 restart claude-bridge-staging` |
| Disk full | Remove old builds: `cd .builds && ls -dt dist.* \| tail -n +4 \| xargs rm -rf` |
| Deploy locked | Check running: `ps aux \| grep build-and-serve` |

Full troubleshooting in [deployment.md](./deployment.md#troubleshooting).

## File Guide

| File | Purpose | Read When |
|------|---------|-----------|
| **deployment.md** | Complete operational guide | Deploying or troubleshooting |
| **ARCHITECTURE.md** | Technical design & internals | Understanding how it works |
| **CHANGELOG.md** | Historical changes | Investigating past decisions |
| **README.md** | This file - navigation hub | Starting point |

## Current State

**Structure:**
```
.builds/                          # Isolated builds
├── current → dist.TIMESTAMP      # Active (PM2 serves this)
├── dist.20251105-180718/         # Latest
├── dist.20251105-180529/         # Rollback ready
└── dist.20251105-180347/         # Backup

apps/web/.next/dev/               # Staging only
```

**Servers:**
- Production: `localhost:8999` → `.builds/current/standalone/`
- Staging: `localhost:8998` → `next dev` (uses `.next/dev`)

**Protection:** 92% coverage, see [ARCHITECTURE.md](./ARCHITECTURE.md#failure-modes)
