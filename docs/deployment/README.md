# Claude Bridge Deployment Documentation

This directory contains all documentation related to deploying the Claude Bridge application (not site deployments).

## Files

- **deployment.md** - Complete guide to the atomic build system, commands, and troubleshooting
- **FAILURE_MODES_PENTEST.md** - Penetration testing results for build system failure scenarios (92% protection coverage)
- **BUILD_ISOLATION_CHANGES.md** - Changelog for the build isolation reorganization
- **REORGANIZATION_PLAN.md** - Original planning document for separating build artifacts

## Quick Links

- Production deploy: `bun run deploy`
- Build only: `./scripts/build-atomic.sh`
- View logs: `bun run see`
- Staging: `bun run staging`

## Key Concepts

1. **Atomic Builds** - Timestamped directories prevent race conditions
2. **Zero Downtime** - Symlink swaps are atomic at filesystem level
3. **Rollback Ready** - Keeps last 3 builds for quick revert
4. **Failure Protection** - 12/13 scenarios protected (92% coverage)
