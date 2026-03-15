#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENVIRONMENT="${1:-}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "Usage: $0 <staging|production>" >&2
    exit 1
fi

log() {
    printf '[db-seed] %s\n' "$*"
}

if [[ "$ENVIRONMENT" != "staging" ]]; then
    log "Skipping seed step for $ENVIRONMENT."
    exit 0
fi

ENV_FILE="$PROJECT_ROOT/apps/web/.env.staging"
if [[ ! -f "$ENV_FILE" ]]; then
    log "Missing env file: $ENV_FILE"
    exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
    log "DATABASE_URL missing in $ENV_FILE"
    exit 1
fi

if [[ -z "${ALIVE_PASSCODE:-}" ]]; then
    log "ALIVE_PASSCODE missing in $ENV_FILE; cannot seed staging bootstrap user."
    exit 1
fi

log "Applying idempotent staging seeds."
(
    cd "$PROJECT_ROOT/packages/database"
    DATABASE_URL="$DATABASE_URL" \
    SEED_PASSWORD="$ALIVE_PASSCODE" \
    bash scripts/seed.sh
)

log "Staging seeds synchronized."
