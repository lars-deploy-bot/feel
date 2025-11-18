# Claude Bridge Deployment

> **Atomic build system with zero-downtime deployments, automatic rollback, and 92% failure protection**

## Start Here

**I want to...**
- 🚀 **Deploy to staging** → `make staging` then read [Quick Start](#quick-start)
- 🚀 **Deploy to dev** → `make dev`
- 🔧 **Fix a problem** → Check [Troubleshooting](#troubleshooting-index)
- 📚 **Understand how it works** → Read [deployment.md](./deployment.md)
- 🏗️ **Learn the architecture** → Read [ARCHITECTURE.md](./ARCHITECTURE.md)
- 📜 **See what changed** → Read [CHANGELOG.md](./CHANGELOG.md)

⚠️ **Production deployment is restricted** - Contact devops for production deploys.

## Quick Start

```bash
# Staging deployment (recommended for testing)
make staging

# Dev environment (with hot reload)
make dev

# View logs
make logs-staging
make logs-dev
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
| CSS not loading in staging (404) | `make staging` |
| CSS not loading in dev (404) | `make dev` |
| Port in use error | Check if PM2: `pm2 list` |
| Staging broken | `pm2 restart claude-bridge-staging` |
| Dev broken | `make dev` |
| Disk full | Remove old builds: `cd .builds && ls -dt dist.* \| tail -n +4 \| xargs rm -rf` |

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
- Production (restricted): `localhost:8999` → `.builds/current/standalone/`
- Staging: `localhost:8998` → `.builds/staging/current/standalone/`
- Dev: `localhost:8997` → `next dev --turbo` (uses `.next/dev`)

**Protection:** 92% coverage, see [ARCHITECTURE.md](./ARCHITECTURE.md#failure-modes)
