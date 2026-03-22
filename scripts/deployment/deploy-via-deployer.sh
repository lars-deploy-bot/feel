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
source "$SCRIPT_DIR/lib/deploy-contract.sh"

ENVIRONMENT="${1:?Usage: deploy-via-deployer.sh <staging|production>}"
SKIP_E2E="${SKIP_E2E:-0}"

if [[ "$ENVIRONMENT" != "$DEPLOY_ENV_STAGING" && "$ENVIRONMENT" != "$DEPLOY_ENV_PRODUCTION" ]]; then
    log_error "Invalid environment: $ENVIRONMENT (must be $DEPLOY_ENV_STAGING or $DEPLOY_ENV_PRODUCTION)"
    exit 1
fi

# Port for the target environment (used for post-deploy smoke checks)
case "$ENVIRONMENT" in
    "$DEPLOY_ENV_STAGING")    PORT=$DEPLOY_PORT_STAGING ;;
    "$DEPLOY_ENV_PRODUCTION") PORT=$DEPLOY_PORT_PRODUCTION ;;
esac

# Load credentials for the deploy control plane database.
# Source ALL EnvironmentFile entries from the deployer service in order, matching
# systemd's loading semantics where later files override earlier ones.
# This ensures this script's psql uses the exact same DATABASE_URL as the deployer-rs.
DEPLOYER_ENV_FILES=()
while IFS= read -r line; do
    # Strip systemd's "(ignore_errors=yes/no)" suffix
    local_file=$(printf '%s' "$line" | sed 's/ (ignore_errors=.*//')
    [[ -n "$local_file" && -f "$local_file" ]] && DEPLOYER_ENV_FILES+=("$local_file")
done < <(systemctl show alive-deployer -p EnvironmentFiles --value 2>/dev/null)

if [[ ${#DEPLOYER_ENV_FILES[@]} -eq 0 ]]; then
    # Fallback: production is the default (matches alive-deployer.service template)
    DEPLOYER_ENV_FILES=("$PROJECT_ROOT/apps/web/.env.production")
fi

for ENV_FILE in "${DEPLOYER_ENV_FILES[@]}"; do
    source "$ENV_FILE"
done
export PGPASSWORD="${DATABASE_PASSWORD:?DATABASE_PASSWORD must be set in $ENV_FILE}"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set in $ENV_FILE}"
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

API_URL="$DEPLOY_API_URL"
DEPLOYER_HEALTH="$DEPLOY_DEPLOYER_URL"
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

APPLICATION_ID=$(db_query "SELECT application_id FROM deploy.applications WHERE slug = 'alive' LIMIT 1;")
if [[ -z "$APPLICATION_ID" ]]; then
    phase_end error "No 'alive' application found in deploy.applications"
    exit 1
fi

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

HEALTH_OK=$(curl -sf "$DEPLOYER_HEALTH$DEPLOY_HEALTH_PATH" 2>/dev/null | jq -r "$DEPLOYER_JQ_OK // false" 2>/dev/null || echo "false")
if [[ "$HEALTH_OK" != "true" ]]; then
    phase_end error "deployer-rs is not healthy ($DEPLOYER_HEALTH$DEPLOY_HEALTH_PATH)"
    exit 1
fi

# Verify the API (Supabase PostgREST) and deployer-rs (direct Postgres) point to the same
# Supabase instance. If they diverge, the API inserts builds into one DB and the deployer
# polls another — builds silently never get picked up.
# Strategy: read the API's SUPABASE_URL from its env file, then query deploy.applications
# via PostgREST and compare with our psql result.
API_ENV_FILE=$(systemctl show alive-api -p EnvironmentFiles --value 2>/dev/null | head -1 | sed 's/ (ignore_errors=.*//')
if [[ -n "$API_ENV_FILE" && -f "$API_ENV_FILE" ]]; then
    API_SUPABASE_URL=$(grep -m1 '^SUPABASE_URL=' "$API_ENV_FILE" | cut -d= -f2-)
    API_SERVICE_KEY=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' "$API_ENV_FILE" | cut -d= -f2-)
    if [[ -n "$API_SUPABASE_URL" && -n "$API_SERVICE_KEY" ]]; then
        API_APP_ID=$(curl -sf \
            -H "apikey: $API_SERVICE_KEY" \
            -H "Authorization: Bearer $API_SERVICE_KEY" \
            -H "Accept-Profile: deploy" \
            "$API_SUPABASE_URL/rest/v1/applications?slug=eq.alive&select=application_id&limit=1" 2>/dev/null \
            | jq -r '.[0].application_id // empty' 2>/dev/null || echo "")
        if [[ -n "$API_APP_ID" && "$API_APP_ID" != "$APPLICATION_ID" ]]; then
            phase_end error "Database mismatch: API Supabase ($API_SUPABASE_URL) has application '$API_APP_ID' but deployer DATABASE_URL ($DB_URL) has '$APPLICATION_ID'. Both must point to the same Supabase. Check /etc/alive-deployer-local.env."
            exit 1
        fi
        if [[ -z "$API_APP_ID" ]]; then
            log_step "Warning: could not verify API Supabase — deploy.applications query returned empty"
        fi
    fi
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

ACTIVE_BUILD_ID=$(db_query "SELECT build_id FROM deploy.builds WHERE application_id = '$APPLICATION_ID' AND server_id = '$CURRENT_SERVER_ID' AND status IN ('$DEPLOY_STATUS_PENDING', '$DEPLOY_STATUS_RUNNING') LIMIT 1;")
ACTIVE_DEPLOYMENT_ID=$(db_query "SELECT deployment_id FROM deploy.deployments WHERE environment_id = '$ENVIRONMENT_ID' AND status IN ('$DEPLOY_STATUS_PENDING', '$DEPLOY_STATUS_RUNNING') LIMIT 1;")
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
  AND d.status = '$DEPLOY_STATUS_SUCCEEDED'
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

phase_start "Syncing ops systemd units"
sync_script="$PROJECT_ROOT/scripts/systemd/sync-ops-units.sh"
if [[ -x "$sync_script" ]]; then
    if "$sync_script" --alive-root "$PROJECT_ROOT" --enable-required-timers 2>&1; then
        phase_end ok "Ops units synced"
    else
        phase_end warn "Ops unit sync failed (non-fatal)"
    fi
else
    phase_end warn "Ops unit sync skipped (script missing or not executable)"
fi

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
# 5-6. Build + Resolve release
# =============================================================================

if [[ "$ENVIRONMENT" == "$DEPLOY_ENV_PRODUCTION" ]]; then
    # Production: promote the latest successful staging release (no fresh build)
    phase_start "Resolving staging release for promotion"

    STAGING_ENV_ID=$(db_query "SELECT environment_id FROM deploy.environments WHERE application_id = '$APPLICATION_ID' AND name = '$DEPLOY_ENV_STAGING' AND server_id = '$CURRENT_SERVER_ID' LIMIT 1;")
    if [[ -z "$STAGING_ENV_ID" ]]; then
        phase_end error "No staging environment found for promotion"
        exit 1
    fi

    RELEASE_ID=$(db_query "
    SELECT d.release_id
    FROM deploy.deployments d
    WHERE d.environment_id = '$STAGING_ENV_ID'
      AND d.status = '$DEPLOY_STATUS_SUCCEEDED'
    ORDER BY d.created_at DESC
    LIMIT 1;
    ")

    if [[ -z "$RELEASE_ID" ]]; then
        phase_end error "No successful staging deployment found to promote"
        exit 1
    fi

    phase_end ok "Promoting release $RELEASE_ID from staging"
else
    # Staging: build fresh
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
            "$DEPLOY_STATUS_SUCCEEDED")
                ARTIFACT_REF=$(db_query "SELECT artifact_ref FROM deploy.builds WHERE build_id = '$BUILD_ID';")
                phase_end ok "Build succeeded ($ARTIFACT_REF)"
                break
                ;;
            "$DEPLOY_STATUS_FAILED")
                ERROR=$(db_query "SELECT error_message FROM deploy.builds WHERE build_id = '$BUILD_ID';")
                phase_end error "Build failed: $ERROR"
                exit 1
                ;;
            "$DEPLOY_STATUS_PENDING"|"$DEPLOY_STATUS_RUNNING")
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

    # Resolve release from build
    phase_start "Resolving release"
    RELEASE_ID=$(db_query "SELECT release_id FROM deploy.releases WHERE build_id = '$BUILD_ID' LIMIT 1;")
    if [[ -z "$RELEASE_ID" ]]; then
        phase_end error "No release found for build $BUILD_ID"
        exit 1
    fi
    phase_end ok "Release $RELEASE_ID"
fi

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
        "$DEPLOY_STATUS_SUCCEEDED")
            HC_STATUS=$(db_query "SELECT healthcheck_status FROM deploy.deployments WHERE deployment_id = '$DEPLOYMENT_ID';")
            phase_end ok "Deployed (health: $HC_STATUS)"
            break
            ;;
        "$DEPLOY_STATUS_FAILED")
            ERROR=$(db_query "SELECT error_message FROM deploy.deployments WHERE deployment_id = '$DEPLOYMENT_ID';")
            phase_end error "Deployment failed: $ERROR"
            exit 1
            ;;
        "$DEPLOY_STATUS_PENDING"|"$DEPLOY_STATUS_RUNNING")
            CURRENT_STAGE=$(curl -sf "$DEPLOYER_HEALTH$DEPLOY_HEALTH_DETAILS_PATH" 2>/dev/null | jq -r "$DEPLOYER_JQ_CURRENT_STAGE // empty" 2>/dev/null || echo "")
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

# Post-deploy smoke checks — always run, even with SKIP_E2E.
# These are fast (<5s) and catch silent deploy failures.
SMOKE_ISSUES=0

# 1. Health endpoint responds
SMOKE_HEALTH=$(curl -sf "http://localhost:$PORT/api/health" 2>/dev/null || echo "")
if [[ -z "$SMOKE_HEALTH" ]]; then
    log_step "SMOKE FAIL: health endpoint not responding on port $PORT"
    SMOKE_ISSUES=$((SMOKE_ISSUES + 1))
fi

# 2. SSR pages render (catch missing env vars, broken imports)
for SMOKE_PATH in "/" "/chat"; do
    SMOKE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://localhost:$PORT$SMOKE_PATH" 2>/dev/null || echo "000")
    if [[ "$SMOKE_STATUS" != "200" && "$SMOKE_STATUS" != "302" && "$SMOKE_STATUS" != "307" ]]; then
        log_step "SMOKE FAIL: $SMOKE_PATH returned HTTP $SMOKE_STATUS"
        SMOKE_ISSUES=$((SMOKE_ISSUES + 1))
    fi
done

# 3. Process is still alive (catch immediate crash-loops)
if ! systemctl is-active "alive-$ENVIRONMENT" >/dev/null 2>&1; then
    log_step "SMOKE FAIL: alive-$ENVIRONMENT crashed after deploy"
    SMOKE_ISSUES=$((SMOKE_ISSUES + 1))
fi

# 4. No crash in journal (catch startup errors that don't kill the process)
RECENT_ERRORS=$(journalctl -u "alive-$ENVIRONMENT" --since "30 seconds ago" --no-pager 2>/dev/null | grep -ci "error\|fatal\|unhandled\|EADDRINUSE" || true)
if [[ "$RECENT_ERRORS" -gt 3 ]]; then
    log_step "SMOKE WARN: $RECENT_ERRORS error lines in journal since deploy"
fi

if [[ $SMOKE_ISSUES -gt 0 ]]; then
    phase_end error "Post-deploy smoke checks failed ($SMOKE_ISSUES issues)"
    exit 1
fi

if [[ "$SKIP_E2E" == "1" ]]; then
    log_step "Skipping E2E tests"
    phase_end ok "Skipped E2E"
else
    log_step "Running E2E suite against $ENVIRONMENT"
    cd "$PROJECT_ROOT/apps/web"

    if ENV_FILE=".env.$ENVIRONMENT" E2E_STRICT_API_GUARD=1 bun run test:e2e:gate; then
        log_step "Mocked E2E passed"
    else
        phase_end error "E2E tests failed"
        exit 1
    fi

    # Live critical tests: real Claude API, real streaming, real DB persistence.
    # These run against the already-deployed staging server — no mocks.
    log_step "Running live critical E2E tests against $ENVIRONMENT"
    if ENV_FILE=".env.$ENVIRONMENT" E2E_STRICT_API_GUARD=1 bun run test:e2e:critical:live; then
        phase_end ok "E2E passed (mocked + live)"
    else
        phase_end error "Live critical E2E tests failed"
        exit 1
    fi

    cd "$PROJECT_ROOT"
fi
