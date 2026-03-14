#!/bin/bash
# =============================================================================
# Build and Deploy Alive
# =============================================================================
# Usage: ./build-and-serve.sh <staging|production>
#
# This script is called by ship.sh - don't run directly.
# For dev, use deploy-dev.sh (hot-reload mode).
#
# Features:
# - Zero-downtime: new build created before service restart
# - Auto-rollback: if health check fails, previous build restored
# - E2E tests: run against deployed server (skip with SKIP_E2E=1)
# - Build promotion: PROMOTE_FROM=staging promotes staging's build artifact
#   to production (skips deps, static checks, and build — all already validated)
# - CLEAN_BUILD=1 clears deploy caches and forces a full rebuild
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
export PATH="$PROJECT_ROOT/node_modules/.bin:$PATH"

# Load shared libraries
source "$SCRIPT_DIR/lib/common.sh"
source "$SCRIPT_DIR/lib/lock.sh"

# =============================================================================
# Configuration
# =============================================================================
ENV="${1:-}"
if [[ ! "$ENV" =~ ^(staging|production)$ ]]; then
    log_error "Usage: $0 <staging|production>"
    log_error "For dev, use deploy-dev.sh"
    exit 1
fi

PORT=$(get_port "$ENV")
SERVICE=$(get_service "$ENV")
BUILDS_DIR="$PROJECT_ROOT/.builds/$ENV"
MAX_WAIT=$( [ "$ENV" = "staging" ] && echo 60 || echo 30 )
DEPLOY_METADATA_FILE=".alive-deploy-metadata.json"

# PROMOTE_FROM: skip deps/static/build, promote artifact from another environment
# When set, only 4 phases run: validate → promote → skills → deploy
PROMOTE_FROM="${PROMOTE_FROM:-}"
if [ -n "$PROMOTE_FROM" ]; then
    _TOTAL_PHASES=4
fi

cd "$PROJECT_ROOT"
timer_start

# =============================================================================
# Runtime Temp Directory
# =============================================================================
configure_runtime_tmpdir() {
    local preferred_tmp="${TMPDIR:-/tmp}"
    local target_tmp="$preferred_tmp/alive-deploy-$ENV"

    mkdir -p "$target_tmp" 2>/dev/null || true
    if [ ! -d "$target_tmp" ] || [ ! -w "$target_tmp" ]; then
        target_tmp="/tmp/alive-deploy-$ENV"
        mkdir -p "$target_tmp" || {
            log_error "Failed to create writable temp dir: $target_tmp"
            exit 1
        }
    fi

    local probe_file="$target_tmp/.tmp-write-probe.$$"
    if ! touch "$probe_file" 2>/dev/null; then
        log_error "Temp dir is not writable: $target_tmp"
        exit 1
    fi
    rm -f "$probe_file"

    export TMPDIR="$target_tmp"
    export TMP="$target_tmp"
    export TEMP="$target_tmp"
}

configure_runtime_cache_dirs() {
    local fallback_bun_cache="$PROJECT_ROOT/.cache/bun-install"
    local fallback_xdg_cache="$PROJECT_ROOT/.cache/xdg-cache"
    local current_bun_install="${BUN_INSTALL:-$HOME/.bun}"
    local current_xdg_cache="${XDG_CACHE_HOME:-$HOME/.cache}"
    local selected_bun_cache="$current_bun_install"
    local selected_xdg_cache="$current_xdg_cache"

    mkdir -p "$fallback_bun_cache/install/cache" "$fallback_xdg_cache" || {
        log_error "Failed to create fallback runtime cache directories"
        exit 1
    }

    local bun_probe="$current_bun_install/.write-probe.$$"
    local xdg_probe="$current_xdg_cache/.write-probe.$$"

    mkdir -p "$current_bun_install/install/cache" 2>/dev/null || true
    if ! touch "$bun_probe" 2>/dev/null; then
        selected_bun_cache="$fallback_bun_cache"
    fi

    mkdir -p "$current_xdg_cache" 2>/dev/null || true
    if ! touch "$xdg_probe" 2>/dev/null; then
        selected_xdg_cache="$fallback_xdg_cache"
    fi
    rm -f "$bun_probe" "$xdg_probe"

    export BUN_INSTALL="$selected_bun_cache"
    export XDG_CACHE_HOME="$selected_xdg_cache"
}

configure_runtime_tmpdir
configure_runtime_cache_dirs

INSTALL_FINGERPRINT_DIR="$PROJECT_ROOT/.cache/deploy"
INSTALL_FINGERPRINT_FILE="$INSTALL_FINGERPRINT_DIR/install-fingerprint.txt"

compute_install_fingerprint() {
    {
        printf '%s\n' \
            "$PROJECT_ROOT/package.json" \
            "$PROJECT_ROOT/bun.lock"

        find "$PROJECT_ROOT/apps" "$PROJECT_ROOT/packages" -mindepth 2 -maxdepth 2 -type f -name "package.json" 2>/dev/null
        find "$PROJECT_ROOT/templates/site-template/user" -maxdepth 1 -type f \( -name "package.json" -o -name "bun.lock" \) 2>/dev/null
        find "$PROJECT_ROOT/patches" -maxdepth 1 -type f -name "*.patch" 2>/dev/null
    } | sort | while IFS= read -r file; do
        [ -f "$file" ] || continue
        sha256sum "$file"
    done | sha256sum | cut -d' ' -f1
}

should_skip_bun_install() {
    [ -d "$PROJECT_ROOT/node_modules" ] || return 1
    [ -x "$PROJECT_ROOT/node_modules/.bin/turbo" ] || return 1
    [ -d "$PROJECT_ROOT/templates/site-template/user/node_modules" ] || return 1
    [ -f "$INSTALL_FINGERPRINT_FILE" ] || return 1

    local current_fingerprint
    local cached_fingerprint

    current_fingerprint=$(compute_install_fingerprint)
    cached_fingerprint=$(cat "$INSTALL_FINGERPRINT_FILE" 2>/dev/null || true)

    [ -n "$current_fingerprint" ] || return 1
    [ "$current_fingerprint" = "$cached_fingerprint" ]
}

store_install_fingerprint() {
    local current_fingerprint
    current_fingerprint=$(compute_install_fingerprint)
    [ -n "$current_fingerprint" ] || return 1

    mkdir -p "$INSTALL_FINGERPRINT_DIR"
    printf '%s\n' "$current_fingerprint" > "$INSTALL_FINGERPRINT_FILE"
}

# =============================================================================
# Lock Verification
# =============================================================================
lock_require_or_exit() {
    if [ ! -f "$LOCK_FILE" ]; then
        log_error "No deployment lock. Run via: make ship, make staging, or make production"
        exit 1
    fi
    local lock_pid=$(cut -d'|' -f1 "$LOCK_FILE" 2>/dev/null)

    # Check if lock holder is us or our ancestor
    local pid=$$
    while [ "$pid" != "1" ] && [ -n "$pid" ]; do
        [ "$pid" = "$lock_pid" ] && return 0
        pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ') || break
    done

    # Check if lock holder is still running
    if ps -p "$lock_pid" > /dev/null 2>&1; then
        log_error "Lock held by PID $lock_pid"
        exit 1
    fi

    log_warn "Removing stale lock"
    rm -f "$LOCK_FILE"
}

lock_require_or_exit

# =============================================================================
# Sync Repo-Managed Systemd Units
# =============================================================================
sync_ops_systemd_units() {
    phase_start "Syncing ops timers"

    local sync_script="$PROJECT_ROOT/scripts/systemd/sync-ops-units.sh"

    if [ ! -x "$sync_script" ]; then
        phase_end error "Missing or non-executable sync script: $sync_script"
        exit 1
    fi

    if ! "$sync_script" \
        --alive-root "$PROJECT_ROOT" \
        --enable-required-timers \
        --verify-required-timers; then
        phase_end error "Failed to sync ops timers"
        exit 1
    fi

    phase_end ok "Ops timers synced"
}

sync_ops_systemd_units

# =============================================================================
# Rollback Support
# =============================================================================
PREVIOUS_BUILD=""
if [ -L "$BUILDS_DIR/current" ]; then
    PREVIOUS_BUILD=$(readlink "$BUILDS_DIR/current")
fi

rollback() {
    local reason="$1"
    [ -z "$PREVIOUS_BUILD" ] && { log_error "No previous build to rollback"; return 1; }

    log_warn "Rolling back: $reason"
    ln -sfn "$PREVIOUS_BUILD" "$BUILDS_DIR/current"

    # Use robust restart that handles stuck services
    if ! service_force_restart "$SERVICE" 15; then
        log_error "Rollback failed - service won't start"
        log_error "Check: journalctl -u $SERVICE -n 50"
        return 1
    fi

    if health_check "http://localhost:$PORT/" 10 1; then
        log_success "Rollback complete - now serving: $PREVIOUS_BUILD"
    else
        log_error "Rollback partial - service running but health check failed"
        log_error "Check: journalctl -u $SERVICE"
    fi
}

read_previous_build_git_sha() {
    [ -n "$PREVIOUS_BUILD" ] || return 0

    local metadata_path="$BUILDS_DIR/$PREVIOUS_BUILD/$DEPLOY_METADATA_FILE"
    [ -f "$metadata_path" ] || return 0

    python3 - <<'PY' "$metadata_path"
import json
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as handle:
    data = json.load(handle)

git_sha = data.get("gitSha")
if isinstance(git_sha, str):
    print(git_sha)
PY
}

write_deploy_metadata() {
    local build_dir="$1"
    local git_sha
    git_sha=$(git rev-parse HEAD)

    python3 - <<'PY' "$build_dir/$DEPLOY_METADATA_FILE" "$git_sha"
import json
import sys
from datetime import datetime, timezone

path = sys.argv[1]
git_sha = sys.argv[2]

with open(path, "w", encoding="utf-8") as handle:
    json.dump(
        {
            "gitSha": git_sha,
            "writtenAt": datetime.now(timezone.utc).isoformat(),
        },
        handle,
        indent=2,
        sort_keys=True,
    )
    handle.write("\n")
PY
}

# =============================================================================
# Validate Environment
# =============================================================================
banner "Deploying: $ENV (port $PORT)"
phase_start "Validating environment"

# Check env file
ENV_FILE="apps/web/.env.$ENV"
if [ -f "$ENV_FILE" ]; then
    # Validate LOCKBOX_MASTER_KEY
    LOCKBOX=$(grep "^LOCKBOX_MASTER_KEY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [ -z "$LOCKBOX" ]; then
        phase_end error "Missing LOCKBOX_MASTER_KEY in $ENV_FILE"
        exit 1
    fi
    if ! [[ "$LOCKBOX" =~ ^[0-9a-fA-F]{64}$ ]]; then
        phase_end error "LOCKBOX_MASTER_KEY must be 64 hex chars"
        exit 1
    fi
    log_step "Env vars OK"
fi

# Check port
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    if ! systemctl is-active --quiet "$SERVICE"; then
        phase_end error "Port $PORT in use by unknown process"
        exit 1
    fi
fi

# Check required support services
_SERVICES_DOWN=()
for _svc in e2b-terminal shell-server-go caddy-shell preview-proxy; do
    if systemctl list-unit-files "${_svc}.service" >/dev/null 2>&1 \
       && ! systemctl is-active --quiet "$_svc"; then
        _SERVICES_DOWN+=("$_svc")
    fi
done
if [ ${#_SERVICES_DOWN[@]} -gt 0 ]; then
    phase_end error "Support services not running: ${_SERVICES_DOWN[*]}"
    log_error "Fix: systemctl start ${_SERVICES_DOWN[*]}"
    exit 1
fi

phase_end ok "Environment validated"

# =============================================================================
# Apply Pending Database Migrations
# =============================================================================
phase_start "Applying database migrations"

PREVIOUS_DEPLOY_GIT_SHA="$(read_previous_build_git_sha)"
if "$SCRIPT_DIR/apply-new-db-migrations.sh" "$ENV" "$PREVIOUS_DEPLOY_GIT_SHA"; then
    phase_end ok "Database migrations synchronized"
else
    phase_end error "Failed to synchronize database migrations"
    exit 1
fi

# =============================================================================
# Verify Schema Drift
# =============================================================================
phase_start "Verifying database schema"

if "$PROJECT_ROOT/scripts/database/check-schema-drift.sh" --target "$ENV"; then
    phase_end ok "Database schema matches repo migrations"
else
    phase_end warn "Database schema drift detected (non-blocking)"
fi

# =============================================================================
# Seed Required Database Data
# =============================================================================
phase_start "Seeding required database data"

if "$SCRIPT_DIR/seed-required-db-data.sh" "$ENV"; then
    phase_end ok "Required database data synchronized"
else
    phase_end error "Failed to synchronize required database data"
    exit 1
fi

# =============================================================================
# Install Dependencies & Static Analysis (skipped when promoting)
# =============================================================================
if [ -n "$PROMOTE_FROM" ]; then
    log_step "Skipping checks (validated in $PROMOTE_FROM)"
else
    phase_start "Installing dependencies"

    if should_skip_bun_install; then
        phase_end ok "Dependencies unchanged - skipped bun install"
    else
        INSTALL_LOG="/tmp/bun-install-$ENV.log"
        set +e
        bun install --frozen-lockfile > "$INSTALL_LOG" 2>&1
        BUN_EXIT=$?
        set -e

        if [ $BUN_EXIT -ne 0 ]; then
            phase_end error "bun install failed (exit $BUN_EXIT)"
            echo ""
            banner_error "BUN INSTALL FAILED"
            echo -e "  ${RED}Log: $INSTALL_LOG${NC}"
            echo ""
            grep -E "error|ERR_|ENOENT|EACCES|ENOSPC|resolution|not found" "$INSTALL_LOG" | head -20
            echo ""
            exit 1
        fi

        if ! store_install_fingerprint; then
            phase_end error "Failed to store install fingerprint"
            exit 1
        fi
        phase_end ok "Dependencies installed"
    fi

    # Static analysis: type-check + lint (silent — output in /tmp/static-check-$ENV.log)
    phase_start "Type-checking & linting"

    STATIC_LOG="/tmp/static-check-$ENV.log"
    set +e
    (bun run validate:turbo-env && bun run check:workspace-contract && turbo run type-check && turbo run ci && bun run --cwd apps/web scripts/check-error-patterns.ts) > "$STATIC_LOG" 2>&1
    STATIC_EXIT=$?
    set -e

    if [ $STATIC_EXIT -ne 0 ]; then
        phase_end error "Static checks failed (exit $STATIC_EXIT)"
        echo ""
        banner_error "STATIC CHECKS FAILED"
        echo -e "  ${RED}Log: $STATIC_LOG${NC}"
        echo ""
        echo -e "${BOLD}Errors:${NC}"
        grep -E "error TS|Error:|error\[|FAIL|Cannot find" "$STATIC_LOG" | head -20
        echo ""
        echo -e "${BOLD}Last 20 lines:${NC}"
        tail -20 "$STATIC_LOG"
        echo ""
        exit 1
    fi
    phase_end ok "Static checks passed (log: $STATIC_LOG)"

    # Unit tests (silent — output in /tmp/test-core-$ENV.log)
    phase_start "Running unit tests"

    TEST_LOG="/tmp/test-core-$ENV.log"
    set +e
    bun run test:core > "$TEST_LOG" 2>&1
    TEST_EXIT=$?
    set -e

    if [ $TEST_EXIT -ne 0 ]; then
        phase_end error "Unit tests failed (exit $TEST_EXIT)"
        echo ""
        banner_error "UNIT TESTS FAILED"
        echo -e "  ${RED}Log: $TEST_LOG${NC}"
        echo ""
        echo -e "${BOLD}Failed tests:${NC}"
        grep -E "FAIL|✗|×|AssertionError|Expected|Received" "$TEST_LOG" | head -20
        echo ""
        echo -e "${BOLD}Last 20 lines:${NC}"
        tail -20 "$TEST_LOG"
        echo ""
        exit 1
    fi
    phase_end ok "Tests passed (log: $TEST_LOG)"
fi

# =============================================================================
# Sync Templates Repository
# =============================================================================
CONFIG_PATH="${SERVER_CONFIG_PATH:-/var/lib/alive/server-config.json}"
TEMPLATES_ROOT=$(python3 -c "import json; print(json.load(open('$CONFIG_PATH')).get('paths',{}).get('templatesRoot',''))" 2>/dev/null || echo "")
TEMPLATES_REPO="https://github.com/eenlars/alive-templates.git"

if [ -z "$TEMPLATES_ROOT" ]; then
    log_warn "paths.templatesRoot not set in server-config.json — skipping templates sync"
elif [ ! -d "$TEMPLATES_ROOT/.git" ]; then
    phase_start "Cloning templates repository"
    if git clone --depth 1 "$TEMPLATES_REPO" "$TEMPLATES_ROOT"; then
        phase_end ok "Templates cloned to $TEMPLATES_ROOT"
    else
        phase_end error "Failed to clone templates repository"
        exit 1
    fi
else
    phase_start "Syncing templates"
    WRITE_PROBE="$TEMPLATES_ROOT/.git/.alive-write-probe.$$"
    if ! touch "$WRITE_PROBE" 2>/dev/null; then
        phase_end warn "Templates repo not writable in this runtime — skipping sync"
    else
        rm -f "$WRITE_PROBE"
        if git -C "$TEMPLATES_ROOT" pull --ff-only 2>&1 | tail -3; then
            phase_end ok "Templates up to date"
        else
            phase_end warn "Templates sync failed — continuing with existing templates"
        fi
    fi
fi

# =============================================================================
# Build (or promote from another environment)
# =============================================================================
phase_start "Building application"

[ -n "$PREVIOUS_BUILD" ] && log_step "Current: $PREVIOUS_BUILD"

# Remove circular symlinks from bun
rm -f packages/*/template packages/*/images packages/*/tools 2>/dev/null || true

if [ -n "$PROMOTE_FROM" ]; then
    # Promote build artifact from another environment
    SOURCE_DIR="$PROJECT_ROOT/.builds/$PROMOTE_FROM"
    SOURCE_BUILD=$(readlink "$SOURCE_DIR/current" 2>/dev/null || echo "")

    if [ -z "$SOURCE_BUILD" ] || [ ! -d "$SOURCE_DIR/$SOURCE_BUILD" ]; then
        phase_end error "No build found in $PROMOTE_FROM to promote"
        exit 1
    fi

    log_step "Promoting from $PROMOTE_FROM: $SOURCE_BUILD"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    DEST="$BUILDS_DIR/dist.$TIMESTAMP"
    mkdir -p "$BUILDS_DIR"

    # Hard-link copy: instant, zero extra disk usage.
    # Clean target before fallback to prevent nested-directory bugs.
    if ! cp -al "$SOURCE_DIR/$SOURCE_BUILD" "$DEST" 2>/dev/null; then
        rm -rf "$DEST" 2>/dev/null || true
        cp -a "$SOURCE_DIR/$SOURCE_BUILD" "$DEST"
    fi

    cd "$BUILDS_DIR"
    ln -sfn "dist.$TIMESTAMP" "current"
    cd "$PROJECT_ROOT"

    # Verify promoted build integrity (prevent ChunkLoadError in production)
    PROMOTED_CHUNKS="$DEST/server/chunks"
    PROMOTED_STREAM="$DEST/server/app/api/claude/stream/route.js"
    if [ ! -d "$PROMOTED_CHUNKS" ]; then
        phase_end error "Promoted build missing server/chunks — corrupt copy"
        exit 1
    fi
    PROMOTED_CHUNK_COUNT=$(find "$PROMOTED_CHUNKS" -name '*.js' -type f | wc -l)
    if [ "$PROMOTED_CHUNK_COUNT" -lt 10 ]; then
        phase_end error "Promoted build has only $PROMOTED_CHUNK_COUNT chunks (expected 10+)"
        exit 1
    fi
    if [ ! -f "$PROMOTED_STREAM" ]; then
        phase_end error "Promoted build missing stream route"
        exit 1
    fi

    NEW_BUILD="dist.$TIMESTAMP"
    log_step "Promoted: $NEW_BUILD ($PROMOTED_CHUNK_COUNT chunks verified)"
    phase_end ok "Build promoted"
else
    BUILD_LOG="/tmp/alive-build-${ENV}.log"
    set +e
    "$SCRIPT_DIR/build-atomic.sh" "$ENV" > "$BUILD_LOG" 2>&1
    BUILD_EXIT=$?
    set -e

    if [ $BUILD_EXIT -ne 0 ]; then
        phase_end error "Build failed (exit $BUILD_EXIT)"
        echo ""
        banner_error "BUILD FAILED"
        echo -e "  ${RED}Log: $BUILD_LOG${NC}"
        echo ""
        echo -e "${BOLD}Errors:${NC}"
        grep -E "Error:|error TS|error:|FATAL|Cannot find|Module not found|ENOSPC|ENOMEM" "$BUILD_LOG" | head -20
        echo ""
        echo -e "${BOLD}Last 15 lines:${NC}"
        tail -15 "$BUILD_LOG"
        echo ""
        # Show disk space if that might be the issue
        AVAIL=$(df -BM "$PROJECT_ROOT" | tail -1 | awk '{print $4}')
        echo -e "${DIM}Disk available: $AVAIL${NC}"
        exit 1
    fi

    NEW_BUILD=$(readlink "$BUILDS_DIR/current")
    log_step "New: $NEW_BUILD"
    phase_end ok "Build complete (log: $BUILD_LOG)"
fi

write_deploy_metadata "$BUILDS_DIR/$NEW_BUILD"

# =============================================================================
# Sync Skills
# =============================================================================
phase_start "Skills"
log_step "Superadmin skills read directly from repo at $PROJECT_ROOT/.claude/skills/"
phase_end ok "Skills ready"

# =============================================================================
# Build & Deploy Go Preview Proxy (if configured)
# =============================================================================
if [ -f "$SCRIPT_DIR/deploy-preview-proxy.sh" ]; then
    "$SCRIPT_DIR/deploy-preview-proxy.sh" || log_warn "Preview proxy deploy skipped"
fi

# =============================================================================
# Deploy & Health Check
# =============================================================================
phase_start "Deploying"

log_step "Restarting $SERVICE..."
# Use service_force_restart which handles stuck services (deactivating, stop-sigkill, etc.)
# This is more robust than plain `systemctl restart` which can hang on stuck services
SERVICE_WAIT=20
if ! service_force_restart "$SERVICE" "$SERVICE_WAIT"; then
    phase_end error "Failed to restart (service not active after ${SERVICE_WAIT}s)"
    echo ""
    echo -e "${BOLD}Service status:${NC}"
    systemctl status "$SERVICE" --no-pager 2>&1 | head -20 || true
    echo ""
    echo -e "${BOLD}Recent logs (crash reason):${NC}"
    journalctl -u "$SERVICE" -n 30 --no-pager 2>/dev/null || true
    echo ""
    echo -e "${BOLD}Build being served:${NC}"
    readlink "$BUILDS_DIR/current" 2>/dev/null || echo "  No current symlink"
    echo ""
    rollback "service failed to start"
    exit 1
fi

log_step "Waiting for health check (max ${MAX_WAIT}s)..."
if ! health_check "http://localhost:$PORT/" "$MAX_WAIT" 1; then
    phase_end error "Health check failed after ${MAX_WAIT}s"
    echo ""
    echo -e "${BOLD}Service status:${NC}"
    systemctl status "$SERVICE" --no-pager 2>&1 | head -15 || true
    echo ""
    echo -e "${BOLD}Recent logs:${NC}"
    journalctl -u "$SERVICE" -n 20 --no-pager 2>/dev/null || true
    echo ""
    echo -e "${BOLD}Port $PORT:${NC}"
    lsof -Pi :$PORT -sTCP:LISTEN 2>/dev/null || echo "  Nothing listening on port $PORT"
    echo ""
    rollback "health check timeout"
    exit 1
fi

sleep 3  # Warmup
phase_end ok "Server healthy"

# =============================================================================
# E2E Tests (optional)
# =============================================================================
if [ "${SKIP_E2E:-0}" = "1" ]; then
    log_step "Skipping E2E tests"
else
    phase_start "Running E2E tests"

    E2E_SECRET=$(grep "^E2E_TEST_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || echo "")
    if [ -z "$E2E_SECRET" ]; then
        # Production env intentionally omits E2E_TEST_SECRET — read from staging
        E2E_SECRET=$(grep "^E2E_TEST_SECRET=" "apps/web/.env.staging" 2>/dev/null | cut -d'=' -f2- || echo "")
    fi
    if [ -z "$E2E_SECRET" ]; then
        phase_end error "E2E_TEST_SECRET not found in $ENV_FILE or apps/web/.env.staging"
        exit 1
    fi

    E2E_PLAYWRIGHT_PATH="${PLAYWRIGHT_BROWSERS_PATH:-}"
    if [ -z "$E2E_PLAYWRIGHT_PATH" ]; then
        phase_end error "PLAYWRIGHT_BROWSERS_PATH must be set explicitly for E2E. Refusing machine-local fallbacks."
        exit 1
    fi

    log_step "Using Playwright browsers from: $E2E_PLAYWRIGHT_PATH"

    run_web_e2e() {
        local script_name="$1"
        shift
        (
            cd apps/web &&
            ENV_FILE=".env.$ENV" \
            E2E_TEST_SECRET="$E2E_SECRET" \
            PLAYWRIGHT_BROWSERS_PATH="$E2E_PLAYWRIGHT_PATH" \
            bun run "$script_name" "$@"
        )
    }

    log_step "Running standard E2E suite (against deployed $ENV build)"
    set +e
    run_web_e2e test:e2e:gate
    E2E_EXIT=$?
    set -e

    if [ $E2E_EXIT -eq 0 ]; then
        log_step "Running live deploy E2E gate (deploy-live.spec.ts)"
        set +e
        E2E_REQUIRE_DELETE_SITE_ENDPOINT=1 run_web_e2e test:e2e:deploy-live
        E2E_EXIT=$?
        set -e
    fi

    if [ $E2E_EXIT -eq 0 ]; then
        log_step "Running full live E2E suite (all *-live.spec.ts)"
        set +e
        run_web_e2e test:e2e:live
        E2E_EXIT=$?
        set -e
    fi

    if [ $E2E_EXIT -ne 0 ]; then
        phase_end error "E2E tests failed (exit $E2E_EXIT)"
        echo ""
        echo -e "${BOLD}Hint:${NC} Check apps/web/test-results/ for screenshots and traces"
        echo ""
        rollback "E2E failure"
        exit 1
    fi
    phase_end ok "E2E tests passed"
fi

# =============================================================================
# Cleanup & Summary
# =============================================================================
cleanup_old_builds "$BUILDS_DIR" 5

# Age-based retention safety net (default 7 days), keeps current symlink target.
if ! bun "$PROJECT_ROOT/scripts/deployment/prune-old-builds.ts" --days 7 --env "$ENV"; then
    log_warn "Age-based build pruning failed (continuing)"
fi

[ "$ENV" != "production" ] && systemctl reload caddy 2>/dev/null || true

banner_success "✓ Deployed: $ENV"
echo -e "  Port:  ${CYAN}$PORT${NC}"
echo -e "  Build: ${CYAN}$NEW_BUILD${NC}"
echo -e "  Time:  ${BOLD}$(format_duration $(timer_elapsed))${NC}"
echo ""
echo "  Logs: journalctl -u $SERVICE -f"
echo ""
