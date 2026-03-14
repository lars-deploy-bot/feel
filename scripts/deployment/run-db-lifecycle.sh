#!/bin/bash
# =============================================================================
# Database Lifecycle: migrations → drift check → seed
#
# Shared by both build-and-serve.sh and deploy-via-deployer.sh.
# Callers must provide ENVIRONMENT and PREVIOUS_DEPLOY_GIT_SHA.
#
# Usage:
#   run-db-lifecycle.sh <staging|production> [previous_git_sha]
#
# Exit codes:
#   0 = success
#   1 = fatal (migrations or seed failed)
#   2 = drift detected (non-fatal, logged as warning)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENVIRONMENT="${1:-}"
PREVIOUS_DEPLOY_GIT_SHA="${2:-}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "[db-lifecycle] Usage: $0 <staging|production> [previous_git_sha]" >&2
    exit 1
fi

log() {
    printf '[db-lifecycle] %s\n' "$*"
}

# ── 1. Apply pending migrations ──────────────────────────────────────────────

log "Phase 1/3: Applying database migrations for $ENVIRONMENT"

if ! "$SCRIPT_DIR/apply-new-db-migrations.sh" "$ENVIRONMENT" "$PREVIOUS_DEPLOY_GIT_SHA"; then
    log "FATAL: Failed to apply database migrations"
    exit 1
fi

# ── 2. Verify schema drift ──────────────────────────────────────────────────

log "Phase 2/3: Verifying database schema for $ENVIRONMENT"

drift_exit=0
if ! "$PROJECT_ROOT/scripts/database/check-schema-drift.sh" --target "$ENVIRONMENT"; then
    log "WARNING: Database schema drift detected (non-blocking)"
    drift_exit=2
fi

# ── 3. Seed required data ───────────────────────────────────────────────────

log "Phase 3/3: Seeding required database data for $ENVIRONMENT"

if ! "$SCRIPT_DIR/seed-required-db-data.sh" "$ENVIRONMENT"; then
    log "FATAL: Failed to seed required database data"
    exit 1
fi

log "Database lifecycle complete for $ENVIRONMENT"
exit "$drift_exit"
