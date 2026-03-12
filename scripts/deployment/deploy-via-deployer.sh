#!/bin/bash
# =============================================================================
# Deploy via deployer-rs
# =============================================================================
# Usage: ./deploy-via-deployer.sh <staging|production>
#
# Triggers a build+deploy through the deployer-rs control plane.
# Inserts a build row, waits for it to succeed, then inserts a deployment row
# and waits for that to succeed. Fails fast on any error.
#
# Environment: SKIP_E2E=1 to skip E2E tests
# Requires: psql, curl, python3
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

# Load DB credentials
source "$PROJECT_ROOT/apps/web/.env.production"
export PGPASSWORD="$DATABASE_PASSWORD"
DB_URL="postgresql://postgres@db.qnvprftdorualkdyogka.supabase.co:5432/postgres"
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

DEPLOYER_HEALTH="http://127.0.0.1:5095"
APPLICATION_ID="dep_app_bd57129d0218c50d"
GIT_REF="$(git rev-parse --abbrev-ref HEAD)"
GIT_SHA="$(git rev-parse HEAD)"
COMMIT_MSG="$(git log -1 --format=%s)"

_CURRENT_PHASE=0
_TOTAL_PHASES=7

# =============================================================================
# Helpers
# =============================================================================

db_query() {
    psql "$DB_URL" -t -A -c "$1" 2>/dev/null | { grep -v '^INSERT \|^UPDATE \|^DELETE ' || true; }
}

# =============================================================================
# 1. Preflight
# =============================================================================

phase_start "Preflight" "$_TOTAL_PHASES"

HEALTH_OK=$(curl -sf "$DEPLOYER_HEALTH/health" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['ok'])" 2>/dev/null || echo "")
if [[ "$HEALTH_OK" != "True" ]]; then
    phase_end error "deployer-rs is not healthy ($DEPLOYER_HEALTH/health)"
    exit 1
fi

ENVIRONMENT_ID=$(db_query "SELECT environment_id FROM deploy.environments WHERE application_id = '$APPLICATION_ID' AND name = '$ENVIRONMENT' AND server_id = '$CURRENT_SERVER_ID' LIMIT 1;")
if [[ -z "$ENVIRONMENT_ID" ]]; then
    phase_end error "No environment '$ENVIRONMENT' found for application $APPLICATION_ID on server $CURRENT_SERVER_ID"
    exit 1
fi

phase_end ok "deployer-rs healthy, environment $ENVIRONMENT_ID"

# =============================================================================
# 2. Sync ops timers
# =============================================================================

phase_start "Syncing ops timers"

sync_script="$SCRIPT_DIR/lib/sync-ops-timers.sh"
if [[ -x "$sync_script" ]]; then
    "$sync_script" 2>/dev/null || true
fi
phase_end ok "Ops timers synced"

# =============================================================================
# 3. Deploy preview-proxy + services
# =============================================================================

phase_start "Deploying services"

"$SCRIPT_DIR/deploy-preview-proxy.sh" 2>&1 | tail -5
phase_end ok "Services deployed"

# =============================================================================
# 4. Request build
# =============================================================================

phase_start "Requesting build"

BUILD_ID=$(db_query "
INSERT INTO deploy.builds (application_id, git_ref, git_sha, commit_message, status)
VALUES ('$APPLICATION_ID', '$GIT_REF', '$GIT_SHA', '$(echo "$COMMIT_MSG" | sed "s/'/''/g")', 'pending')
RETURNING build_id;
")

if [[ -z "$BUILD_ID" ]]; then
    phase_end error "Failed to insert build row"
    exit 1
fi

log_step "Build: $BUILD_ID"
log_step "Ref: $GIT_REF (${GIT_SHA:0:12})"

# Wait for build
BUILD_TIMEOUT=600
ELAPSED=0
while [[ $ELAPSED -lt $BUILD_TIMEOUT ]]; do
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
            echo "  Debug: curl $DEPLOYER_HEALTH/tasks/build/$BUILD_ID"
            exit 1
            ;;
        pending|running)
            sleep 3
            ELAPSED=$((ELAPSED + 3))
            ;;
        *)
            phase_end error "Unexpected build status: $BUILD_STATUS"
            exit 1
            ;;
    esac
done

if [[ $ELAPSED -ge $BUILD_TIMEOUT ]]; then
    phase_end error "Build timed out after ${BUILD_TIMEOUT}s"
    exit 1
fi

# =============================================================================
# 5. Resolve release
# =============================================================================

phase_start "Resolving release"

RELEASE_ID=$(db_query "SELECT release_id FROM deploy.releases WHERE build_id = '$BUILD_ID' LIMIT 1;")

if [[ -z "$RELEASE_ID" ]]; then
    ARTIFACT_DIGEST=$(db_query "SELECT artifact_digest FROM deploy.builds WHERE build_id = '$BUILD_ID';")
    RELEASE_ID=$(db_query "SELECT release_id FROM deploy.releases WHERE artifact_digest = '$ARTIFACT_DIGEST' AND application_id = '$APPLICATION_ID' ORDER BY created_at DESC LIMIT 1;")
fi

if [[ -z "$RELEASE_ID" ]]; then
    phase_end error "No release found for build $BUILD_ID"
    exit 1
fi

phase_end ok "Release $RELEASE_ID"

# =============================================================================
# 6. Deploy
# =============================================================================

phase_start "Deploying to $ENVIRONMENT"

DEPLOYMENT_ID=$(db_query "
INSERT INTO deploy.deployments (environment_id, release_id, status, action)
VALUES ('$ENVIRONMENT_ID', '$RELEASE_ID', 'pending', 'deploy')
RETURNING deployment_id;
")

if [[ -z "$DEPLOYMENT_ID" ]]; then
    phase_end error "Failed to insert deployment row"
    exit 1
fi

log_step "Deployment: $DEPLOYMENT_ID"

# Wait for deployment
DEPLOY_TIMEOUT=300
ELAPSED=0
LAST_STAGE=""
while [[ $ELAPSED -lt $DEPLOY_TIMEOUT ]]; do
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
            echo "  Debug: curl $DEPLOYER_HEALTH/tasks/deployment/$DEPLOYMENT_ID"
            exit 1
            ;;
        pending|running)
            CURRENT_STAGE=$(curl -sf "$DEPLOYER_HEALTH/health/details" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
dep=d.get('current_deployment')
if dep and dep.get('current_stage'): print(dep['current_stage'])
else: print('')
" 2>/dev/null || echo "")
            if [[ -n "$CURRENT_STAGE" && "$CURRENT_STAGE" != "$LAST_STAGE" ]]; then
                log_step "$CURRENT_STAGE"
                LAST_STAGE="$CURRENT_STAGE"
            fi
            sleep 3
            ELAPSED=$((ELAPSED + 3))
            ;;
        *)
            phase_end error "Unexpected deployment status: $DEPLOY_STATUS"
            exit 1
            ;;
    esac
done

if [[ $ELAPSED -ge $DEPLOY_TIMEOUT ]]; then
    phase_end error "Deployment timed out after ${DEPLOY_TIMEOUT}s"
    exit 1
fi

# =============================================================================
# 7. E2E tests
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
