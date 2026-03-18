#!/bin/bash
# =============================================================================
# Deploy via API → deployer-rs
# =============================================================================
# Usage: ./deploy-via-deployer.sh <staging|production>
#
# Triggers a build+deploy through the Alive API. The API is the single
# authority — it validates, inserts DB rows, and pokes the deployer-rs
# worker which executes immediately.
#
# No direct database access. All deploy state goes through the API.
#
# Environment: SKIP_E2E=1 to skip E2E tests
# Requires: curl, jq
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

source "$SCRIPT_DIR/lib/common.sh"

ENVIRONMENT="${1:?Usage: deploy-via-deployer.sh <staging|production>}"
SKIP_E2E="${SKIP_E2E:-0}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT (must be staging or production)"
    exit 1
fi

SERVER_CONFIG_PATH="${SERVER_CONFIG_PATH:-/var/lib/alive/server-config.json}"

if [[ ! -f "$SERVER_CONFIG_PATH" ]]; then
    log_error "server-config.json not found at $SERVER_CONFIG_PATH"
    exit 1
fi

# API auth — read ALIVE_PASSCODE from the API's env
API_URL="http://127.0.0.1:5080"
DEPLOYER_HEALTH="http://127.0.0.1:5095"
APPLICATION_ID="dep_app_bd57129d0218c50d"
GIT_REF="$(git rev-parse --abbrev-ref HEAD)"
GIT_SHA="$(git rev-parse HEAD)"

# Load passcode from the API's env file
source "$PROJECT_ROOT/apps/api/.env.production" 2>/dev/null || source "$PROJECT_ROOT/apps/web/.env.production" 2>/dev/null
AUTH_HEADER="Authorization: Bearer ${ALIVE_PASSCODE:?ALIVE_PASSCODE must be set}"

_CURRENT_PHASE=0
_TOTAL_PHASES=8

# =============================================================================
# Helpers
# =============================================================================

api_call() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    local response

    if [[ -n "$body" ]]; then
        response=$(curl -sf -X "$method" \
            -H "Content-Type: application/json" \
            -H "$AUTH_HEADER" \
            -d "$body" \
            "$API_URL$path" 2>&1) || {
            log_error "API call failed: $method $path"
            log_error "$response"
            return 1
        }
    else
        response=$(curl -sf -X "$method" \
            -H "$AUTH_HEADER" \
            "$API_URL$path" 2>&1) || {
            log_error "API call failed: $method $path"
            log_error "$response"
            return 1
        }
    fi

    printf '%s' "$response"
}

# =============================================================================
# 1. Preflight
# =============================================================================

phase_start "Preflight" "$_TOTAL_PHASES"

if ! "$PROJECT_ROOT/ops/scripts/pre-deployment-check.sh" "$ENVIRONMENT" >/tmp/alive-predeploy-"$ENVIRONMENT".log 2>&1; then
    tail -n 50 /tmp/alive-predeploy-"$ENVIRONMENT".log || true
    phase_end error "pre-deployment checks failed"
    exit 1
fi

if [[ "$SKIP_E2E" != "1" ]]; then
    if ! ENV_FILE="$PROJECT_ROOT/apps/web/.env.$ENVIRONMENT" "$PROJECT_ROOT/scripts/playwright/verify-browsers.sh" >/tmp/alive-playwright-preflight-"$ENVIRONMENT".log 2>&1; then
        tail -n 20 /tmp/alive-playwright-preflight-"$ENVIRONMENT".log || true
        phase_end error "Playwright browser preflight failed"
        exit 1
    fi
fi

# Check deployer health
HEALTH_OK=$(curl -sf "$DEPLOYER_HEALTH/health" 2>/dev/null | jq -r '.ok // false' 2>/dev/null || echo "false")
if [[ "$HEALTH_OK" != "true" ]]; then
    phase_end error "deployer-rs is not healthy ($DEPLOYER_HEALTH/health)"
    exit 1
fi

# Check API health
API_OK=$(curl -sf "$API_URL/health" 2>/dev/null | jq -r '.status // "error"' 2>/dev/null || echo "error")
if [[ "$API_OK" != "ok" ]]; then
    phase_end error "API is not healthy ($API_URL/health)"
    exit 1
fi

# Schema compatibility gate
if ! SERVER_CONFIG_PATH="$SERVER_CONFIG_PATH" bun -e "
  const { readFileSync } = require('node:fs');
  const { parseServerConfig } = require('@webalive/shared');
  const raw = readFileSync(process.env.SERVER_CONFIG_PATH, 'utf8');
  parseServerConfig(raw);
  console.log('Schema OK');
" >/tmp/alive-schema-check-"$ENVIRONMENT".log 2>&1; then
    log_error "Schema compatibility check failed"
    cat /tmp/alive-schema-check-"$ENVIRONMENT".log || true
    phase_end error "server-config.json schema mismatch"
    exit 1
fi

phase_end ok "deployer-rs healthy, API healthy"

# =============================================================================
# 2. Database lifecycle (migrations → drift check → seed)
# =============================================================================

phase_start "Running database lifecycle"

# Need DB access for migrations only — this is infrastructure, not deploy logic
source "$PROJECT_ROOT/apps/web/.env.production"
export PGPASSWORD="$DATABASE_PASSWORD"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set}"

CURRENT_SERVER_ID="$(jq -r '.serverId // empty' "$SERVER_CONFIG_PATH")"
ENVIRONMENT_ID=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c \
    "SELECT environment_id FROM deploy.environments WHERE application_id = '$APPLICATION_ID' AND name = '$ENVIRONMENT' AND server_id = '$CURRENT_SERVER_ID' LIMIT 1;" 2>/dev/null)

PREVIOUS_DEPLOY_GIT_SHA=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c "
SELECT r.git_sha
FROM deploy.deployments d
JOIN deploy.releases r ON r.release_id = d.release_id
WHERE d.environment_id = '$ENVIRONMENT_ID'
  AND d.status = 'succeeded'
ORDER BY d.created_at DESC
LIMIT 1;
" 2>/dev/null)

db_lifecycle_exit=0
"$SCRIPT_DIR/run-db-lifecycle.sh" "$ENVIRONMENT" "$PREVIOUS_DEPLOY_GIT_SHA" || db_lifecycle_exit=$?

if [[ $db_lifecycle_exit -eq 0 ]]; then
    phase_end ok "Database lifecycle complete"
elif [[ $db_lifecycle_exit -eq 2 ]]; then
    phase_end warn "Database lifecycle complete (drift detected)"
else
    phase_end error "Database lifecycle failed"
    exit 1
fi

# =============================================================================
# 3. Sync ops timers
# =============================================================================

phase_start "Syncing ops timers"

sync_script="$SCRIPT_DIR/lib/sync-ops-timers.sh"
if [[ -x "$sync_script" ]]; then
    "$sync_script" 2>/dev/null || true
fi
phase_end ok "Ops timers synced"

# =============================================================================
# 4. Deploy preview-proxy + services
# =============================================================================

phase_start "Deploying services"

PREVIEW_PROXY_LOG="$(mktemp /tmp/alive-preview-proxy.XXXXXX.log)"
if "$SCRIPT_DIR/deploy-preview-proxy.sh" >"$PREVIEW_PROXY_LOG" 2>&1; then
    tail -n 5 "$PREVIEW_PROXY_LOG" || true
else
    tail -n 50 "$PREVIEW_PROXY_LOG" || true
    rm -f "$PREVIEW_PROXY_LOG"
    phase_end error "Preview proxy deploy failed"
    exit 1
fi
rm -f "$PREVIEW_PROXY_LOG"
phase_end ok "Services deployed"

# =============================================================================
# 5-7. Build + Deploy via API (single call)
# =============================================================================

phase_start "Shipping via API"

log_step "POST /api/manager/deploys/ship"
log_step "Application: $APPLICATION_ID"
log_step "Environment: $ENVIRONMENT"
log_step "Git ref: $GIT_SHA"

SHIP_RESPONSE=$(api_call POST "/api/manager/deploys/ship" \
    "{\"application_id\": \"$APPLICATION_ID\", \"environment\": \"$ENVIRONMENT\", \"git_ref\": \"$GIT_SHA\"}")

SHIP_OK=$(printf '%s' "$SHIP_RESPONSE" | jq -r '.ok // false')
if [[ "$SHIP_OK" != "true" ]]; then
    SHIP_ERROR=$(printf '%s' "$SHIP_RESPONSE" | jq -r '.error.message // .error // "unknown error"')
    phase_end error "Ship failed: $SHIP_ERROR"
    exit 1
fi

BUILD_ID=$(printf '%s' "$SHIP_RESPONSE" | jq -r '.data.build.build_id')
RELEASE_ID=$(printf '%s' "$SHIP_RESPONSE" | jq -r '.data.release_id')
DEPLOYMENT_ID=$(printf '%s' "$SHIP_RESPONSE" | jq -r '.data.deployment.deployment_id')
HC_STATUS=$(printf '%s' "$SHIP_RESPONSE" | jq -r '.data.deployment.healthcheck_status // "ok"')

log_step "Build: $BUILD_ID"
log_step "Release: $RELEASE_ID"
log_step "Deployment: $DEPLOYMENT_ID (health: $HC_STATUS)"

phase_end ok "Shipped"

# =============================================================================
# 8. E2E tests
# =============================================================================

phase_start "Post-deploy checks"

if [[ "$SKIP_E2E" == "1" ]]; then
    log_step "Skipping E2E tests"
    phase_end ok "Skipped E2E"
else
    log_step "Running E2E suite against $ENVIRONMENT"
    cd "$PROJECT_ROOT/apps/web"

    if ENV_FILE=".env.$ENVIRONMENT" E2E_STRICT_API_GUARD=1 bun run test:e2e:gate; then
        phase_end ok "E2E passed"
    else
        phase_end error "E2E tests failed"
        exit 1
    fi

    cd "$PROJECT_ROOT"
fi
