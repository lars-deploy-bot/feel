#!/bin/bash
# =============================================================================
# Deploy via API → deployer-rs
# =============================================================================
# Usage: ./deploy-via-deployer.sh <staging|production>
#
# Triggers a build+deploy through the Alive API.
# The API validates and inserts DB rows, then pokes the deployer-rs worker.
# This script polls the DB for status (build succeeded? deployment succeeded?).
#
# Environment: SKIP_E2E=1 to skip E2E tests
# Requires: curl, jq, psql (for DB lifecycle + status polling)
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

# Load credentials
source "$PROJECT_ROOT/apps/web/.env.production"
export PGPASSWORD="$DATABASE_PASSWORD"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set in apps/web/.env.production}"
SERVER_CONFIG_PATH="${SERVER_CONFIG_PATH:-/var/lib/alive/server-config.json}"

if [[ ! -f "$SERVER_CONFIG_PATH" ]]; then
    log_error "server-config.json not found at $SERVER_CONFIG_PATH"
    exit 1
fi

CURRENT_SERVER_ID="$(jq -r '.serverId // empty' "$SERVER_CONFIG_PATH")"
if [[ -z "$CURRENT_SERVER_ID" ]]; then
    log_error "serverId missing in $SERVER_CONFIG_PATH"
    exit 1
fi

API_URL="http://127.0.0.1:5080"
DEPLOYER_HEALTH="http://127.0.0.1:5095"
APPLICATION_ID="dep_app_bd57129d0218c50d"
GIT_REF="$(git rev-parse --abbrev-ref HEAD)"
GIT_SHA="$(git rev-parse HEAD)"
COMMIT_MSG="$(git log -1 --format=%s)"
AUTH_HEADER="Authorization: Bearer ${ALIVE_PASSCODE:?ALIVE_PASSCODE must be set}"

BUILD_TIMEOUT_SECONDS=600
DEPLOY_TIMEOUT_SECONDS=300
STATUS_POLL_INTERVAL_SECONDS=3

_CURRENT_PHASE=0
_TOTAL_PHASES=8

# =============================================================================
# Helpers
# =============================================================================

db_query() {
    local sql="$1"
    local output
    if ! output=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c "$sql" 2>&1); then
        log_error "Database query failed: $output"
        return 1
    fi
    printf '%s\n' "$output" | { grep -v '^INSERT \|^UPDATE \|^DELETE ' || true; }
}

api_post() {
    local path="$1"
    local body="$2"
    curl -sf -X POST \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "$body" \
        "$API_URL$path" 2>&1
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

HEALTH_OK=$(curl -sf "$DEPLOYER_HEALTH/health" 2>/dev/null | jq -r '.ok // false' 2>/dev/null || echo "false")
if [[ "$HEALTH_OK" != "true" ]]; then
    phase_end error "deployer-rs is not healthy ($DEPLOYER_HEALTH/health)"
    exit 1
fi

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

ENVIRONMENT_ID=$(db_query "SELECT environment_id FROM deploy.environments WHERE application_id = '$APPLICATION_ID' AND name = '$ENVIRONMENT' AND server_id = '$CURRENT_SERVER_ID' LIMIT 1;")
if [[ -z "$ENVIRONMENT_ID" ]]; then
    phase_end error "No environment '$ENVIRONMENT' found for application $APPLICATION_ID on server $CURRENT_SERVER_ID"
    exit 1
fi

ACTIVE_BUILD_ID=$(db_query "SELECT build_id FROM deploy.builds WHERE application_id = '$APPLICATION_ID' AND server_id = '$CURRENT_SERVER_ID' AND status IN ('pending', 'running') LIMIT 1;")
ACTIVE_DEPLOYMENT_ID=$(db_query "SELECT deployment_id FROM deploy.deployments WHERE environment_id = '$ENVIRONMENT_ID' AND status IN ('pending', 'running') LIMIT 1;")
if [[ -n "$ACTIVE_BUILD_ID" || -n "$ACTIVE_DEPLOYMENT_ID" ]]; then
    phase_end error "Another deployment is already in progress (build=$ACTIVE_BUILD_ID deployment=$ACTIVE_DEPLOYMENT_ID)"
    exit 1
fi

phase_end ok "deployer-rs healthy, environment $ENVIRONMENT_ID"

# =============================================================================
# 2. Database lifecycle
# =============================================================================

phase_start "Running database lifecycle"

PREVIOUS_DEPLOY_GIT_SHA=$(db_query "
SELECT r.git_sha
FROM deploy.deployments d
JOIN deploy.releases r ON r.release_id = d.release_id
WHERE d.environment_id = '$ENVIRONMENT_ID'
  AND d.status = 'succeeded'
ORDER BY d.created_at DESC
LIMIT 1;
")

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
# 4. Deploy services
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
# 5. Request build (via API)
# =============================================================================

phase_start "Requesting build"

BUILD_RESPONSE=$(api_post "/api/manager/deploys/builds" \
    "{\"application_id\": \"$APPLICATION_ID\", \"server_id\": \"$CURRENT_SERVER_ID\", \"git_ref\": \"$GIT_SHA\", \"git_sha\": \"$GIT_SHA\", \"commit_message\": $(printf '%s' "$COMMIT_MSG" | jq -Rs .)}")

BUILD_OK=$(printf '%s' "$BUILD_RESPONSE" | jq -r '.ok // false')
if [[ "$BUILD_OK" != "true" ]]; then
    BUILD_ERROR=$(printf '%s' "$BUILD_RESPONSE" | jq -r '.error.message // .error // "unknown"')
    phase_end error "Failed to queue build: $BUILD_ERROR"
    exit 1
fi

BUILD_ID=$(printf '%s' "$BUILD_RESPONSE" | jq -r '.data.build_id')
log_step "Build: $BUILD_ID"
log_step "Branch: $GIT_REF (pinned to ${GIT_SHA:0:12})"

# Poll build status
ELAPSED=0
while [[ $ELAPSED -lt $BUILD_TIMEOUT_SECONDS ]]; do
    BUILD_STATUS=$(db_query "SELECT status FROM deploy.builds WHERE build_id = '$BUILD_ID';")
    case "$BUILD_STATUS" in
        succeeded)
            ARTIFACT_REF=$(db_query "SELECT artifact_ref FROM deploy.builds WHERE build_id = '$BUILD_ID';")
            phase_end ok "Build succeeded ($ARTIFACT_REF)"
            break
            ;;
        failed)
            ERROR=$(db_query "SELECT error_message FROM deploy.builds WHERE build_id = '$BUILD_ID';")
            phase_end error "Build failed: $ERROR"
            exit 1
            ;;
        pending|running)
            sleep "$STATUS_POLL_INTERVAL_SECONDS"
            ELAPSED=$((ELAPSED + STATUS_POLL_INTERVAL_SECONDS))
            ;;
        *)
            phase_end error "Unexpected build status: $BUILD_STATUS"
            exit 1
            ;;
    esac
done

if [[ $ELAPSED -ge $BUILD_TIMEOUT_SECONDS ]]; then
    phase_end error "Build timed out after ${BUILD_TIMEOUT_SECONDS}s"
    exit 1
fi

# =============================================================================
# 6. Resolve release
# =============================================================================

phase_start "Resolving release"
RELEASE_ID=$(db_query "SELECT release_id FROM deploy.releases WHERE build_id = '$BUILD_ID' LIMIT 1;")
if [[ -z "$RELEASE_ID" ]]; then
    phase_end error "No release found for build $BUILD_ID"
    exit 1
fi
phase_end ok "Release $RELEASE_ID"

# =============================================================================
# 7. Deploy (via API)
# =============================================================================

phase_start "Deploying to $ENVIRONMENT"

DEPLOY_RESPONSE=$(api_post "/api/manager/deploys/deployments" \
    "{\"environment_id\": \"$ENVIRONMENT_ID\", \"release_id\": \"$RELEASE_ID\"}")

DEPLOY_OK=$(printf '%s' "$DEPLOY_RESPONSE" | jq -r '.ok // false')
if [[ "$DEPLOY_OK" != "true" ]]; then
    DEPLOY_ERROR=$(printf '%s' "$DEPLOY_RESPONSE" | jq -r '.error.message // .error // "unknown"')
    phase_end error "Failed to queue deployment: $DEPLOY_ERROR"
    exit 1
fi

DEPLOYMENT_ID=$(printf '%s' "$DEPLOY_RESPONSE" | jq -r '.data.deployment_id')
log_step "Deployment: $DEPLOYMENT_ID"

# Poll deployment status
ELAPSED=0
LAST_STAGE=""
while [[ $ELAPSED -lt $DEPLOY_TIMEOUT_SECONDS ]]; do
    DEPLOY_STATUS=$(db_query "SELECT status FROM deploy.deployments WHERE deployment_id = '$DEPLOYMENT_ID';")
    case "$DEPLOY_STATUS" in
        succeeded)
            HC_STATUS=$(db_query "SELECT healthcheck_status FROM deploy.deployments WHERE deployment_id = '$DEPLOYMENT_ID';")
            phase_end ok "Deployed (health: $HC_STATUS)"
            break
            ;;
        failed)
            ERROR=$(db_query "SELECT error_message FROM deploy.deployments WHERE deployment_id = '$DEPLOYMENT_ID';")
            phase_end error "Deployment failed: $ERROR"
            exit 1
            ;;
        pending|running)
            CURRENT_STAGE=$(curl -sf "$DEPLOYER_HEALTH/health/details" 2>/dev/null | jq -r '.current_deployment.current_stage // empty' 2>/dev/null || echo "")
            if [[ -n "$CURRENT_STAGE" && "$CURRENT_STAGE" != "$LAST_STAGE" ]]; then
                log_step "$CURRENT_STAGE"
                LAST_STAGE="$CURRENT_STAGE"
            fi
            sleep "$STATUS_POLL_INTERVAL_SECONDS"
            ELAPSED=$((ELAPSED + STATUS_POLL_INTERVAL_SECONDS))
            ;;
        *)
            phase_end error "Unexpected deployment status: $DEPLOY_STATUS"
            exit 1
            ;;
    esac
done

if [[ $ELAPSED -ge $DEPLOY_TIMEOUT_SECONDS ]]; then
    phase_end error "Deployment timed out after ${DEPLOY_TIMEOUT_SECONDS}s"
    exit 1
fi

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
