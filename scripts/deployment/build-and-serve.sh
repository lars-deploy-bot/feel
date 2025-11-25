#!/bin/bash

# Build and deploy Claude Bridge
#
# Usage: ./scripts/build-and-serve.sh [environment]
# Examples:
#   ./scripts/build-and-serve.sh production  # Deploy to port 9000 (systemd)
#   ./scripts/build-and-serve.sh staging     # Deploy to port 8998 (systemd)
#
# Dev environment uses hot-reload (next dev) - use ./scripts/deploy-dev.sh instead
#
# ZERO-DOWNTIME DEPLOYMENT:
# 1. Backup current build before building new version
# 2. If build fails: restore backup, keep old service running
# 3. If build succeeds: restart systemd service
# 4. If health check fails: automatic rollback to backup
#
# This ensures that build failures never break the running application

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Timing tracking
DEPLOY_START_TIME=$(date +%s)
PHASE_START_TIME=$DEPLOY_START_TIME
CURRENT_PHASE=0
TOTAL_PHASES=8

# Load configuration from single source of truth
SCRIPT_DIR="$(dirname "$0")"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_CONFIG="$PROJECT_ROOT/packages/shared/environments.json"

# Verify jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} jq is required but not installed"
    exit 1
fi

# Verify configuration file exists
if [ ! -f "$ENV_CONFIG" ]; then
    echo -e "${RED}[ERROR]${NC} Configuration file not found: $ENV_CONFIG"
    exit 1
fi

# Get environment parameter (default: production)
ENV="${1:-production}"
if [[ ! "$ENV" =~ ^(production|staging)$ ]]; then
    echo -e "${RED}[ERROR]${NC} Invalid environment: $ENV. Must be 'production' or 'staging'"
    echo -e "${RED}[ERROR]${NC} Dev environment uses hot-reload (next dev) - use ./scripts/deploy-dev.sh instead"
    exit 1
fi

# CONFIG_KEY matches ENV directly (no mapping needed)
CONFIG_KEY="$ENV"

# Extract port and app name from environments.json
PORT=$(jq -r ".environments.${CONFIG_KEY}.port" "$ENV_CONFIG")
APP_NAME=$(jq -r ".environments.${CONFIG_KEY}.processName" "$ENV_CONFIG")

# Validate extracted values
if [[ ! "$PORT" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}[ERROR]${NC} Invalid PORT extracted from $ENV_CONFIG: '$PORT'"
    echo -e "${RED}[ERROR]${NC} Check environments.${CONFIG_KEY}.port in $ENV_CONFIG"
    exit 1
fi

if [[ -z "$APP_NAME" || "$APP_NAME" == "null" ]]; then
    echo -e "${RED}[ERROR]${NC} Invalid APP_NAME extracted from $ENV_CONFIG: '$APP_NAME'"
    echo -e "${RED}[ERROR]${NC} Check environments.${CONFIG_KEY}.processName in $ENV_CONFIG"
    exit 1
fi

# Validate APP_NAME contains only safe filename characters
if [[ ! "$APP_NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo -e "${RED}[ERROR]${NC} APP_NAME contains unsafe characters: '$APP_NAME'"
    echo -e "${RED}[ERROR]${NC} APP_NAME must contain only alphanumeric, dot, hyphen, or underscore"
    exit 1
fi

LOCK_FILE="/tmp/${APP_NAME}-deploy.lock"

# Environment-aware health check timeout
if [ "$ENV" = "staging" ]; then
    MAX_WAIT=60  # Staging may be slower (shared resources, network latency)
else
    MAX_WAIT=30  # Production expects fast startup
fi

cd "$PROJECT_ROOT"

# Timing functions
get_elapsed_time() {
    local start_time=$1
    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))
    echo "${elapsed}s"
}

get_total_elapsed() {
    get_elapsed_time $DEPLOY_START_TIME
}

# Phase management
start_phase() {
    CURRENT_PHASE=$((CURRENT_PHASE + 1))
    PHASE_START_TIME=$(date +%s)
    echo ""
    echo -e "${BOLD}${CYAN}[${CURRENT_PHASE}/${TOTAL_PHASES}]${NC} ${BOLD}$1${NC}"
    echo -e "${DIM}⏱️  Total elapsed: $(get_total_elapsed)${NC}"
}

end_phase() {
    local status=$1
    local message=$2
    local phase_time=$(get_elapsed_time $PHASE_START_TIME)

    if [ "$status" = "success" ]; then
        echo -e "  ${GREEN}✓${NC} $message ${DIM}(${phase_time})${NC}"
    elif [ "$status" = "warn" ]; then
        echo -e "  ${YELLOW}⚠${NC} $message ${DIM}(${phase_time})${NC}"
    else
        echo -e "  ${RED}✗${NC} $message ${DIM}(${phase_time})${NC}"
    fi
}

# Logging functions (enhanced)
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_step() {
    echo -e "  ${DIM}→${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Extract meaningful errors from output
extract_errors() {
    local output="$1"
    local pattern="$2"

    # Show lines matching error patterns and context
    echo "$output" | grep -E "$pattern" | head -n 20
}

# Rollback to previous build by switching symlink
rollback_build() {
    local symlink="$1"
    local previous_build="$2"
    local env_dir="$3"

    if [ -z "$previous_build" ] || [ ! -d ".builds/${env_dir}/$previous_build" ]; then
        log_error "Previous build not found: $previous_build"
        return 1
    fi

    log_warn "Rolling back to previous build: $previous_build"
    cd ".builds/${env_dir}"
    ln -sfn "$previous_build" "current"
    cd "$PROJECT_ROOT"

    log_success "Symlink rolled back to: $previous_build"
    return 0
}

# Perform full rollback with service restart and health check
# Usage: perform_rollback "reason for rollback"
perform_rollback() {
    local reason="$1"

    if [ -z "$PREVIOUS_BUILD" ]; then
        log_error "No previous build to rollback to"
        log_error "This was the first deployment - check logs: journalctl -u claude-bridge-${ENV}.service"
        return 1
    fi

    log_warn "Rolling back due to: $reason"

    if rollback_build "$DIST_SYMLINK" "$PREVIOUS_BUILD" "$ENV"; then
        local service="claude-bridge-${ENV}.service"
        if systemctl restart "$service" >/dev/null 2>&1; then
            sleep 3
            if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
                log_success "Rollback successful - previous build is serving"
                return 0
            else
                log_error "Rollback started but not responding - check logs: journalctl -u $service"
                return 1
            fi
        else
            log_error "Failed to restart after rollback - manual intervention required"
            return 1
        fi
    else
        log_error "Rollback failed - manual intervention required"
        log_error "Check logs with: journalctl -u claude-bridge-${ENV}.service"
        return 1
    fi
}

# Clean up old builds, keeping the N most recent
# Usage: cleanup_old_builds <env_dir> <keep_count>
cleanup_old_builds() {
    local env_dir="$1"
    local keep_count="${2:-5}"  # Default: keep 5 builds
    local builds_path="$PROJECT_ROOT/.builds/${env_dir}"

    if [ ! -d "$builds_path" ]; then
        return 0
    fi

    # List directories (excluding 'current' symlink), sort by name (timestamp), get oldest ones
    local build_count=$(ls -1d "$builds_path"/dist.* 2>/dev/null | wc -l)

    if [ "$build_count" -le "$keep_count" ]; then
        log_step "Build cleanup: $build_count builds present (keeping $keep_count)"
        return 0
    fi

    local to_delete=$((build_count - keep_count))
    log_step "Cleaning up $to_delete old build(s)..."

    # Get the oldest builds to delete (sorted ascending by name = timestamp)
    ls -1d "$builds_path"/dist.* 2>/dev/null | sort | head -n "$to_delete" | while read dir; do
        local build_name=$(basename "$dir")
        # Safety: never delete the current symlink target
        local current_target=$(readlink "$builds_path/current" 2>/dev/null || echo "")
        if [ "$build_name" = "$current_target" ]; then
            log_warn "Skipping current build: $build_name"
            continue
        fi
        rm -rf "$dir"
        log_step "Deleted old build: $build_name"
    done
}

# Cleanup function
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# Check if deployment is already running
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        log_error "Deployment already in progress (PID: $PID)"
        exit 1
    else
        log_warn "Stale lock file found, removing..."
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

echo ""
echo "═══════════════════════════════════════════════════════"
log_info "Starting deployment: ${BOLD}${APP_NAME}${NC}"
log_info "Environment: ${ENV} | Port: ${PORT}"
echo "═══════════════════════════════════════════════════════"

start_phase "Validating environment"

log_step "Checking .env files..."
if [ ! -f "apps/web/.env" ] && [ ! -f "apps/web/.env.local" ] && [ ! -f "apps/web/.env.$ENV" ]; then
    log_warn "No .env file found in apps/web/ (checked .env, .env.local, .env.$ENV)"
fi

log_step "Checking required commands (bun, node)..."
for cmd in bun node; do
    if ! command -v "$cmd" &> /dev/null; then
        end_phase "error" "Required command '$cmd' not found"
        exit 1
    fi
done

log_step "Checking port $PORT availability..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    # Check if this is our systemd service
    SERVICE_NAME="claude-bridge-${ENV}.service"
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_step "Port $PORT in use by systemd (will be restarted)"
    else
        PORT_PROC=$(lsof -Pi :$PORT -sTCP:LISTEN | grep -v "PID" || true)
        end_phase "error" "Port $PORT is in use by unknown process"
        echo "$PORT_PROC"
        exit 1
    fi
fi

end_phase "success" "Environment validated"

start_phase "Installing dependencies"
log_step "Running bun install..."

# Capture bun install output and exit code properly
# Note: PIPESTATUS must be captured immediately after the pipe command
set +e
bun install 2>&1 | tee /tmp/bun-install-$$.log | grep -E "(error|warn|packages installed)" || true
BUN_EXIT_CODE=${PIPESTATUS[0]}
set -e

if [ $BUN_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Dependency installation failed"
    echo ""
    log_error "bun install output:"
    cat /tmp/bun-install-$$.log | tail -30
    rm -f /tmp/bun-install-$$.log
    exit 1
fi
rm -f /tmp/bun-install-$$.log

end_phase "success" "Dependencies installed"

start_phase "Running static analysis"
log_step "Comprehensive checks (workspace, knip, lint, types, dependencies)..."

set +e  # Allow capturing exit code
STATIC_CHECK_OUTPUT=$(make static-check 2>&1)
STATIC_CHECK_EXIT_CODE=$?
set -e

if [ $STATIC_CHECK_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Static analysis failed"
    echo ""
    log_error "Static check errors:"
    echo ""
    echo "$STATIC_CHECK_OUTPUT"
    echo ""
    log_error "Fix all static check errors before deploying."
    log_error "Run 'make static-check' locally to see full details."
    exit 1
fi

end_phase "success" "All static checks passed"

start_phase "Running unit tests"
log_step "Executing test suite..."

set +e
TEST_OUTPUT=$(bun run unit 2>&1)
TEST_EXIT_CODE=$?
set -e

# Extract test summary
TEST_SUMMARY=$(echo "$TEST_OUTPUT" | grep -E "Test Files|Tests " | tail -n 2 || echo "")
if [ -n "$TEST_SUMMARY" ]; then
    echo "$TEST_SUMMARY" | while read line; do log_step "$line"; done
fi

if [ $TEST_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Unit tests failed"
    echo ""
    log_error "Failed tests:"
    echo ""

    # Try to extract error messages with improved patterns
    # Look for: error:, FAIL, ✗, Error:, expected, received, # Unhandled error
    ERROR_LINES=$(echo "$TEST_OUTPUT" | grep -E "error:|FAIL|✗|Error:|expected|received|# Unhandled error" || echo "")

    if [ -n "$ERROR_LINES" ]; then
        echo "$ERROR_LINES" | head -n 50
        echo ""
        ERROR_COUNT=$(echo "$ERROR_LINES" | wc -l)
        if [ "$ERROR_COUNT" -gt 50 ]; then
            log_warn "... and $(($ERROR_COUNT - 50)) more error lines. Run 'bun run test' to see all."
        fi
    else
        # If grep didn't find anything, show last 30 lines of output
        log_warn "Could not parse test errors. Showing last 30 lines of output:"
        echo ""
        echo "$TEST_OUTPUT" | tail -n 30
    fi

    echo ""
    log_error "Fix test failures before proceeding."
    log_error "Follow docs/testing/TESTING_GUIDE.md for guidance."
    exit 1
fi

end_phase "success" "All unit tests passed"

start_phase "Building application"

# Capture current build for potential rollback
DIST_SYMLINK="$PROJECT_ROOT/.builds/${ENV}/current"
PREVIOUS_BUILD=""
if [ -L "$DIST_SYMLINK" ]; then
    PREVIOUS_BUILD=$(readlink "$DIST_SYMLINK")
    log_step "Current active build: $PREVIOUS_BUILD"
fi

log_step "Next.js production build (this may take 1-2 minutes)..."

# Remove circular symlinks created by bun install (MUST be done after bun install phase)
log_step "Removing circular symlinks created by bun install..."
rm -f packages/*/template packages/*/images packages/*/tools packages/*/site-controller packages/*/shared 2>/dev/null || true

# Run atomic build (builds to timestamped dir, atomically updates symlink)
set +e
BUILD_OUTPUT=$("$PROJECT_ROOT/scripts/deployment/build-atomic.sh" "$ENV" 2>&1)
BUILD_EXIT_CODE=$?
set -e

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    end_phase "error" "Build failed"
    echo ""
    log_error "Build errors:"
    echo ""
    # Show actual build errors
    echo "$BUILD_OUTPUT" | grep -E "Error:|Failed|error TS" | head -n 30
    echo ""
    log_error "Previous build still active - no changes made"
    log_error "Fix build errors and try again"
    exit 1
fi

# Verify symlink exists
if [ ! -L "$DIST_SYMLINK" ]; then
    end_phase "error" "Build succeeded but dist symlink not found"
    exit 1
fi

NEW_BUILD=$(readlink "$DIST_SYMLINK")
log_step "New build: $NEW_BUILD"

end_phase "success" "Application built successfully"

start_phase "Deploying server"

# Both production and staging use systemd
SERVICE_NAME="claude-bridge-${ENV}.service"
log_step "Restarting systemd service ($SERVICE_NAME)..."
if ! systemctl restart "$SERVICE_NAME"; then
    end_phase "error" "Failed to restart systemd service"
    exit 1
fi

end_phase "success" "Server started"

start_phase "Health check"

log_step "Waiting for server to respond (max ${MAX_WAIT}s)..."
WAITED=0
SERVER_READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf http://localhost:$PORT/ >/dev/null 2>&1; then
        SERVER_READY=true
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
    if [ $((WAITED % 5)) -eq 0 ]; then
        echo -n "."
    fi
done
echo ""

if [ "$SERVER_READY" = true ]; then
    end_phase "success" "Server responding after ${WAITED}s"
else
    end_phase "error" "Server failed health check after ${MAX_WAIT}s"
    perform_rollback "health check failed after ${MAX_WAIT}s"
    exit 1
fi

# ============================================================================
# E2E TESTS: Run against newly deployed server
# ============================================================================
if [ "${SKIP_E2E:-0}" = "1" ]; then
    log_warn "Skipping E2E tests (SKIP_E2E=1)"
    TOTAL_PHASES=7  # Adjust phase count when skipping E2E
else
    start_phase "Running E2E tests"
    log_step "Playwright tests against deployed server (this may take 4-7 minutes)..."
    echo ""

    # Load E2E test secret from environment file for staging/production tests
    E2E_ENV_FILE="$PROJECT_ROOT/apps/web/.env.${ENV}"
    if [ -f "$E2E_ENV_FILE" ]; then
        E2E_TEST_SECRET=$(grep '^E2E_TEST_SECRET=' "$E2E_ENV_FILE" | cut -d '=' -f2)
    fi

    # Verify E2E_TEST_SECRET is set - fail fast if missing
    if [ -z "$E2E_TEST_SECRET" ]; then
        end_phase "error" "E2E_TEST_SECRET not found in $E2E_ENV_FILE"
        log_error "E2E tests require E2E_TEST_SECRET to authenticate test requests."
        log_error "Add 'E2E_TEST_SECRET=<secure-random-value>' to $E2E_ENV_FILE"
        log_error "Generate with: openssl rand -base64 32"
        exit 1
    fi
    log_step "E2E_TEST_SECRET loaded from .env.${ENV}"

    set +e
    if [ "$ENV" = "staging" ]; then
        # For staging, set TEST_ENV=staging and pass E2E_TEST_SECRET
        (cd apps/web && TEST_ENV=staging E2E_TEST_SECRET="${E2E_TEST_SECRET}" bun run test:e2e)
    else
        # For production, set TEST_ENV=production and pass E2E_TEST_SECRET
        (cd apps/web && TEST_ENV=production E2E_TEST_SECRET="${E2E_TEST_SECRET}" bun run test:e2e)
    fi
    E2E_EXIT_CODE=$?
    set -e

    echo ""

    if [ $E2E_EXIT_CODE -ne 0 ]; then
        end_phase "error" "E2E tests failed"
        echo ""
        log_error "E2E tests failed on newly deployed server."
        perform_rollback "E2E tests failed"
        log_error "Fix E2E test failures before proceeding."
        exit 1
    fi

    end_phase "success" "All E2E tests passed"
fi

# ============================================================================
# POST-DEPLOY: Shell-server rebuild, cleanup, Caddy reload
# ============================================================================

# Rebuild shell-server (shared across all environments)
log_step "Rebuilding shell-server..."
cd "$PROJECT_ROOT/apps/shell-server"
if bun run build 2>&1 | tail -5; then
    log_success "Shell-server built successfully"
    if systemctl is-active --quiet shell-server; then
        log_step "Restarting shell-server systemd service..."
        systemctl restart shell-server
        sleep 2
        if systemctl is-active --quiet shell-server; then
            log_success "Shell-server restarted successfully"
        else
            log_warn "Shell-server failed to start (check: journalctl -u shell-server -n 20)"
        fi
    else
        log_warn "Shell-server systemd service not running, starting it..."
        systemctl start shell-server
    fi
else
    log_warn "Shell-server build failed, skipping restart"
fi
cd "$PROJECT_ROOT"

# Clean up old builds (keep last 5)
cleanup_old_builds "$ENV" 5

# Reload Caddy to pick up any routing changes (skip for production)
if [ "$ENV" != "production" ]; then
    if command -v systemctl &> /dev/null; then
        if systemctl is-active --quiet caddy 2>/dev/null; then
            log_step "Reloading Caddy configuration..."
            if systemctl reload caddy 2>/dev/null; then
                log_step "Caddy reloaded"
            else
                log_warn "Caddy reload failed (non-critical)"
            fi
        fi
    fi
else
    log_step "Skipping Caddy reload for production (manual reload required)"
fi

# Calculate total deployment time
TOTAL_TIME=$(get_total_elapsed)

# Show final status with summary
echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${BOLD}${GREEN}✓ Deployment completed successfully!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo -e "${BOLD}Summary:${NC}"
echo -e "  Environment:  ${CYAN}${ENV}${NC}"
echo -e "  Application:  ${CYAN}${APP_NAME}${NC}"
echo -e "  Port:         ${CYAN}${PORT}${NC}"
echo -e "  Build:        ${CYAN}${NEW_BUILD}${NC}"
echo -e "  Total time:   ${BOLD}${TOTAL_TIME}${NC}"
echo ""

SERVICE_NAME="claude-bridge-${ENV}.service"
echo -e "${BOLD}Status:${NC}"
systemctl status "$SERVICE_NAME" --no-pager -l | head -3
echo ""
echo -e "${BOLD}Commands:${NC}"
echo "  📝 Logs:     journalctl -u $SERVICE_NAME -f"
echo "  🔄 Restart:  systemctl restart $SERVICE_NAME"
echo "  ⏹️  Stop:     systemctl stop $SERVICE_NAME"
echo "  🌐 Access:   http://localhost:$PORT"
echo ""
echo "  📡 Shell:    systemctl status shell-server"
echo ""
